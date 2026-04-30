'use client'

import { useState, useTransition } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { updateShipmentStatus } from '@/app/actions/shipments'

type ShipmentStatus = 'pending' | 'dispatched' | 'in_transit' | 'delivered' | 'cancelled'

interface ActionConfig {
  label: string
  toStatus: ShipmentStatus
  variant: 'default' | 'outline' | 'destructive'
  requiresNotes: boolean
  confirmLabel: string
  successMessage: string
}

const ACTIONS: Record<ShipmentStatus, ActionConfig[]> = {
  pending: [
    {
      label: 'Dispatch',
      toStatus: 'dispatched',
      variant: 'default',
      requiresNotes: false,
      confirmLabel: 'Dispatch shipment',
      successMessage: 'Shipment dispatched',
    },
    {
      label: 'Cancel',
      toStatus: 'cancelled',
      variant: 'destructive',
      requiresNotes: true,
      confirmLabel: 'Cancel shipment',
      successMessage: 'Shipment cancelled',
    },
  ],
  dispatched: [
    {
      label: 'Mark in transit',
      toStatus: 'in_transit',
      variant: 'default',
      requiresNotes: false,
      confirmLabel: 'Mark as in transit',
      successMessage: 'Shipment marked as in transit',
    },
    {
      label: 'Cancel',
      toStatus: 'cancelled',
      variant: 'destructive',
      requiresNotes: true,
      confirmLabel: 'Cancel shipment',
      successMessage: 'Shipment cancelled',
    },
  ],
  in_transit: [
    {
      label: 'Mark delivered',
      toStatus: 'delivered',
      variant: 'default',
      requiresNotes: false,
      confirmLabel: 'Mark as delivered',
      successMessage: 'Shipment marked as delivered',
    },
    {
      label: 'Cancel',
      toStatus: 'cancelled',
      variant: 'destructive',
      requiresNotes: true,
      confirmLabel: 'Cancel shipment',
      successMessage: 'Shipment cancelled',
    },
  ],
  delivered: [
    {
      label: 'Revert to in transit',
      toStatus: 'in_transit',
      variant: 'outline',
      requiresNotes: false,
      confirmLabel: 'Revert to in transit',
      successMessage: 'Shipment reverted to in transit',
    },
  ],
  cancelled: [
    {
      label: 'Reopen as pending',
      toStatus: 'pending',
      variant: 'outline',
      requiresNotes: false,
      confirmLabel: 'Reopen as pending',
      successMessage: 'Shipment reopened as pending',
    },
  ],
}

interface Props {
  shipment: { id: string; status: string }
}

export function ShipmentStatusActions({ shipment }: Props) {
  const [isPending, startTransition] = useTransition()
  const [activeAction, setActiveAction] = useState<ActionConfig | null>(null)
  const [notes, setNotes] = useState('')
  const [notesError, setNotesError] = useState('')

  const actions = ACTIONS[shipment.status as ShipmentStatus] ?? []

  function openDialog(action: ActionConfig) {
    setActiveAction(action)
    setNotes('')
    setNotesError('')
  }

  function closeDialog() {
    if (isPending) return
    setActiveAction(null)
    setNotes('')
    setNotesError('')
  }

  function handleConfirm() {
    if (!activeAction) return
    if (activeAction.requiresNotes && !notes.trim()) {
      setNotesError('A reason is required.')
      return
    }

    startTransition(async () => {
      const result = await updateShipmentStatus(
        shipment.id,
        activeAction.toStatus,
        notes.trim() || undefined
      )

      if (result.success) {
        toast.success(activeAction.successMessage)
        setActiveAction(null)
        setNotes('')
      } else {
        toast.error(`Could not update: ${result.error}`)
        setActiveAction(null)
      }
    })
  }

  if (!actions.length) return null

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => (
          <Button
            key={action.toStatus}
            variant={action.variant}
            size="sm"
            onClick={() => openDialog(action)}
            disabled={isPending}
          >
            {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : action.label}
          </Button>
        ))}
      </div>

      <Dialog open={activeAction !== null} onOpenChange={(open) => { if (!open) closeDialog() }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{activeAction?.confirmLabel}</DialogTitle>
          </DialogHeader>

          <div className="space-y-1.5 py-2">
            <Label htmlFor="shipment-notes">
              Notes
              {activeAction?.requiresNotes ? (
                <span className="ml-0.5 text-red-500">*</span>
              ) : (
                <span className="ml-1 font-normal text-slate-400">(optional)</span>
              )}
            </Label>
            <Textarea
              id="shipment-notes"
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value)
                if (notesError) setNotesError('')
              }}
              placeholder="Add a note about this status change…"
              rows={3}
              disabled={isPending}
            />
            {notesError && (
              <p className="text-xs text-red-600">{notesError}</p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={isPending}>
              Cancel
            </Button>
            <Button
              variant={activeAction?.variant === 'destructive' ? 'destructive' : 'default'}
              onClick={handleConfirm}
              disabled={isPending}
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing…
                </>
              ) : (
                activeAction?.confirmLabel
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
