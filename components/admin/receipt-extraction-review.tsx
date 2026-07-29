'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle, AlertTriangle, XCircle, Loader2, Info } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { createPaymentFromReceipt } from '@/app/actions/receipts'
import type { ReceiptExtraction } from '@/types/receipts'
import { formatNairaCurrency } from '@/lib/utils/format'

interface ShipmentOption {
  id: string
  outstanding: number
  dispatched_at: string | null
  status: string
}

interface Props {
  extraction: ReceiptExtraction
  receiptId: string
  dealerShipments: ShipmentOption[]
}

function ConfidenceBadge({ value }: { value: number }) {
  if (value >= 0.8)
    return (
      <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
        <CheckCircle className="h-3 w-3" />
        {Math.round(value * 100)}%
      </span>
    )
  if (value >= 0.5)
    return (
      <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
        <AlertTriangle className="h-3 w-3" />
        {Math.round(value * 100)}%
      </span>
    )
  return (
    <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
      <XCircle className="h-3 w-3" />
      {Math.round(value * 100)}%
    </span>
  )
}

function OverallConfidenceBanner({ confidence, status }: { confidence: number; status: string }) {
  if (status === 'rejected')
    return (
      <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
        <XCircle className="h-5 w-5 shrink-0 text-red-500" />
        <div>
          <p className="text-sm font-semibold text-red-800">Not a payment receipt</p>
          <p className="text-xs text-red-600">The AI determined this image is not a payment receipt.</p>
        </div>
      </div>
    )

  if (confidence >= 0.8)
    return (
      <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
        <CheckCircle className="h-5 w-5 shrink-0 text-green-500" />
        <div>
          <p className="text-sm font-semibold text-green-800">
            High confidence — {Math.round(confidence * 100)}%
          </p>
          <p className="text-xs text-green-600">Extraction looks reliable. Review and confirm below.</p>
        </div>
      </div>
    )

  if (confidence >= 0.5)
    return (
      <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
        <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500" />
        <div>
          <p className="text-sm font-semibold text-amber-800">
            Medium confidence — {Math.round(confidence * 100)}%
          </p>
          <p className="text-xs text-amber-600">Please check the extracted fields carefully before confirming.</p>
        </div>
      </div>
    )

  return (
    <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
      <XCircle className="h-5 w-5 shrink-0 text-red-500" />
      <div>
        <p className="text-sm font-semibold text-red-800">
          Low confidence — {Math.round(confidence * 100)}%
        </p>
        <p className="text-xs text-red-600">Extraction is unreliable. Verify all fields manually.</p>
      </div>
    </div>
  )
}

export function ReceiptExtractionReview({ extraction, receiptId, dealerShipments }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)

  // Editable state — initialised from extraction
  const [amount, setAmount] = useState(
    extraction.extracted_amount_naira != null ? String(extraction.extracted_amount_naira) : ''
  )
  const [date, setDate] = useState(extraction.extracted_date ?? '')
  const [reference, setReference] = useState(extraction.extracted_reference ?? '')
  const [payerName, setPayerName] = useState(extraction.extracted_payer_name ?? '')
  const [recipient, setRecipient] = useState(extraction.extracted_recipient ?? '')
  const [method, setMethod] = useState(extraction.extracted_method ?? 'none')
  const [shipmentId, setShipmentId] = useState(extraction.shipment_match_id ?? 'none')
  const [notes, setNotes] = useState('')

  const aiNotes = (() => {
    try {
      if (!extraction.ai_notes) return null
      return JSON.parse(extraction.ai_notes) as { issues: string[]; reasoning: string }
    } catch {
      return { issues: [], reasoning: extraction.ai_notes ?? '' }
    }
  })()

  function handleConfirm() {
    if (!amount || !date) {
      toast.error('Amount and date are required.')
      return
    }
    setShowConfirmDialog(true)
  }

  function handleCreatePayment() {
    startTransition(async () => {
      const result = await createPaymentFromReceipt(receiptId, {
        amount_naira: parseFloat(amount),
        payment_date: date,
        payment_reference: reference || null,
        payment_method: method === 'none' ? null : method,
        shipment_id: shipmentId === 'none' ? null : shipmentId,
        notes: notes || null,
      })

      if (!result.success) {
        toast.error(result.error)
        setShowConfirmDialog(false)
        return
      }

      toast.success('Payment created and receipt matched.')
      setShowConfirmDialog(false)
      router.refresh()
    })
  }

  if (!extraction.is_payment_receipt) {
    return (
      <div className="space-y-4">
        <OverallConfidenceBanner confidence={extraction.overall_confidence} status="rejected" />
        {aiNotes?.reasoning && (
          <div className="flex gap-2 rounded-lg border bg-slate-50 px-4 py-3">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
            <p className="text-sm italic text-slate-600">{aiNotes.reasoning}</p>
          </div>
        )}
      </div>
    )
  }

  const matchedShipment = dealerShipments.find((s) => s.id === extraction.shipment_match_id)

  return (
    <>
      <div className="space-y-5">
        <OverallConfidenceBanner
          confidence={extraction.overall_confidence}
          status={extraction.overall_confidence >= 0.8 ? 'extracted' : 'needs_review'}
        />

        {/* Issues */}
        {aiNotes?.issues && aiNotes.issues.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-700">Issues detected</p>
            <ul className="list-inside list-disc space-y-0.5">
              {aiNotes.issues.map((issue, i) => (
                <li key={i} className="text-sm text-amber-800">{issue}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Match suggestion */}
        {matchedShipment && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
            <p className="mb-0.5 text-xs font-semibold uppercase tracking-wide text-blue-700">Shipment match</p>
            <p className="text-sm text-blue-800">
              Matches outstanding {formatNairaCurrency(matchedShipment.outstanding)} on shipment dispatched{' '}
              {matchedShipment.dispatched_at ? matchedShipment.dispatched_at.slice(0, 10) : '—'} (
              {matchedShipment.status})
            </p>
          </div>
        )}

        {/* AI reasoning */}
        {aiNotes?.reasoning && (
          <div className="flex gap-2 rounded-lg border bg-slate-50 px-4 py-3">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
            <p className="text-sm italic text-slate-600">{aiNotes.reasoning}</p>
          </div>
        )}

        {/* Editable extracted fields */}
        <div className="rounded-xl border bg-white p-5">
          <h3 className="mb-4 text-sm font-semibold text-slate-700">Extracted data — edit if needed</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Amount */}
            <div className="space-y-1.5">
              <Label htmlFor="ext-amount">
                Amount (₦) <span className="text-red-500">*</span>
                <ConfidenceBadge value={extraction.field_confidences.amount} />
              </Label>
              <Input
                id="ext-amount"
                type="number"
                min={0}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="tabular-nums"
                disabled={isPending}
              />
            </div>

            {/* Date */}
            <div className="space-y-1.5">
              <Label htmlFor="ext-date">
                Date <span className="text-red-500">*</span>
                <ConfidenceBadge value={extraction.field_confidences.date} />
              </Label>
              <Input
                id="ext-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                disabled={isPending}
              />
            </div>

            {/* Reference */}
            <div className="space-y-1.5">
              <Label htmlFor="ext-ref">
                Payment reference
                <ConfidenceBadge value={extraction.field_confidences.reference} />
              </Label>
              <Input
                id="ext-ref"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="e.g. TRF/123456789"
                disabled={isPending}
              />
            </div>

            {/* Method */}
            <div className="space-y-1.5">
              <Label>
                Payment method
                <ConfidenceBadge value={extraction.field_confidences.method} />
              </Label>
              <Select value={method} onValueChange={setMethod} disabled={isPending}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Not specified —</SelectItem>
                  <SelectItem value="bank_transfer">Bank transfer</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="pos">POS</SelectItem>
                  <SelectItem value="mobile_money">Mobile money</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Payer name */}
            <div className="space-y-1.5">
              <Label htmlFor="ext-payer">
                Payer name
                <ConfidenceBadge value={extraction.field_confidences.payer_name} />
              </Label>
              <Input
                id="ext-payer"
                value={payerName}
                onChange={(e) => setPayerName(e.target.value)}
                disabled={isPending}
              />
            </div>

            {/* Recipient */}
            <div className="space-y-1.5">
              <Label htmlFor="ext-recipient">
                Recipient
                <ConfidenceBadge value={extraction.field_confidences.recipient} />
              </Label>
              <Input
                id="ext-recipient"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                disabled={isPending}
              />
            </div>
          </div>

          {/* Shipment link */}
          <div className="mt-4 space-y-1.5">
            <Label>Link to shipment (optional)</Label>
            <Select value={shipmentId} onValueChange={setShipmentId} disabled={isPending}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— No shipment —</SelectItem>
                {dealerShipments.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.dispatched_at?.slice(0, 10) ?? 'pending'} · {s.status} · outstanding{' '}
                    {formatNairaCurrency(s.outstanding)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="mt-4 space-y-1.5">
            <Label htmlFor="ext-notes">Notes (optional)</Label>
            <Input
              id="ext-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional notes…"
              disabled={isPending}
            />
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-3">
          <Button onClick={handleConfirm} disabled={isPending}>
            {isPending ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating…</>
            ) : (
              'Confirm and create payment'
            )}
          </Button>
        </div>
      </div>

      {/* Confirm dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={(o) => { if (!isPending) setShowConfirmDialog(o) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm text-slate-700">
            <p>
              <span className="font-medium">Amount:</span>{' '}
              {amount ? formatNairaCurrency(parseFloat(amount)) : '—'}
            </p>
            <p>
              <span className="font-medium">Date:</span> {date || '—'}
            </p>
            {reference && (
              <p>
                <span className="font-medium">Reference:</span> {reference}
              </p>
            )}
            {shipmentId !== 'none' && (
              <p>
                <span className="font-medium">Linked shipment:</span>{' '}
                {shipmentId.slice(0, 8)}…
              </p>
            )}
          </div>
          <p className="mt-2 text-xs text-slate-500">
            A payment record will be created and the receipt marked as matched.
            {shipmentId !== 'none' && ' The shipment outstanding balance will be reduced.'}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button onClick={handleCreatePayment} disabled={isPending}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
