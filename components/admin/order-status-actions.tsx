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
import { updateOrderStatus } from '@/app/actions/dealer-orders'

type OrderStatus = 'pending' | 'partially_fulfilled' | 'fulfilled' | 'cancelled'

interface ActionConfig {
  label: string
  toStatus: OrderStatus
  variant: 'default' | 'outline' | 'destructive'
  requiresReason: boolean
  confirmLabel: string
  successMessage: string
}

const ACTIONS: Record<OrderStatus, ActionConfig[]> = {
  pending: [
    {
      label: 'Mark fulfilled',
      toStatus: 'fulfilled',
      variant: 'default',
      requiresReason: false,
      confirmLabel: 'Mark as fulfilled',
      successMessage: 'Order marked as fulfilled',
    },
    {
      label: 'Mark partial',
      toStatus: 'partially_fulfilled',
      variant: 'outline',
      requiresReason: false,
      confirmLabel: 'Mark as partially fulfilled',
      successMessage: 'Order marked as partially fulfilled',
    },
    {
      label: 'Cancel order',
      toStatus: 'cancelled',
      variant: 'destructive',
      requiresReason: true,
      confirmLabel: 'Cancel order',
      successMessage: 'Order cancelled',
    },
  ],
  partially_fulfilled: [
    {
      label: 'Mark fulfilled',
      toStatus: 'fulfilled',
      variant: 'default',
      requiresReason: false,
      confirmLabel: 'Mark as fulfilled',
      successMessage: 'Order marked as fulfilled',
    },
    {
      label: 'Cancel order',
      toStatus: 'cancelled',
      variant: 'destructive',
      requiresReason: true,
      confirmLabel: 'Cancel order',
      successMessage: 'Order cancelled',
    },
    {
      label: 'Reopen as pending',
      toStatus: 'pending',
      variant: 'outline',
      requiresReason: false,
      confirmLabel: 'Reopen as pending',
      successMessage: 'Order reopened as pending',
    },
  ],
  fulfilled: [
    {
      label: 'Reopen as pending',
      toStatus: 'pending',
      variant: 'outline',
      requiresReason: false,
      confirmLabel: 'Reopen as pending',
      successMessage: 'Order reopened as pending',
    },
  ],
  cancelled: [
    {
      label: 'Reopen as pending',
      toStatus: 'pending',
      variant: 'outline',
      requiresReason: false,
      confirmLabel: 'Reopen as pending',
      successMessage: 'Order reopened as pending',
    },
  ],
}

interface Props {
  order: { id: string; status: string }
}

export function OrderStatusActions({ order }: Props) {
  const [isPending, startTransition] = useTransition()
  const [activeAction, setActiveAction] = useState<ActionConfig | null>(null)
  const [reason, setReason] = useState('')
  const [reasonError, setReasonError] = useState('')

  const actions = ACTIONS[order.status as OrderStatus] ?? []

  function openDialog(action: ActionConfig) {
    setActiveAction(action)
    setReason('')
    setReasonError('')
  }

  function closeDialog() {
    if (isPending) return
    setActiveAction(null)
    setReason('')
    setReasonError('')
  }

  function handleConfirm() {
    if (!activeAction) return
    if (activeAction.requiresReason && !reason.trim()) {
      setReasonError('A reason is required.')
      return
    }

    startTransition(async () => {
      const result = await updateOrderStatus(
        order.id,
        activeAction.toStatus,
        reason.trim() || undefined
      )

      if (result.success) {
        toast.success(activeAction.successMessage)
        setActiveAction(null)
        setReason('')
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
            <Label htmlFor="status-reason">
              Reason
              {activeAction?.requiresReason ? (
                <span className="ml-0.5 text-red-500">*</span>
              ) : (
                <span className="ml-1 font-normal text-slate-400">(optional)</span>
              )}
            </Label>
            <Textarea
              id="status-reason"
              value={reason}
              onChange={(e) => {
                setReason(e.target.value)
                if (reasonError) setReasonError('')
              }}
              placeholder="Add a note about this status change…"
              rows={3}
              disabled={isPending}
            />
            {reasonError && (
              <p className="text-xs text-red-600">{reasonError}</p>
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
