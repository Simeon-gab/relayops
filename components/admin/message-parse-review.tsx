'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  ShoppingCart, CreditCard, Truck, HelpCircle, MessageSquare,
  CheckCircle, AlertTriangle, XCircle, Loader2, Info,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { convertParseToOrder, rejectParseResult } from '@/app/actions/messages'
import type { MessageParseResult } from '@/types/messages'
import { formatNairaCurrency } from '@/lib/utils/format'

interface ProductOption {
  id: string
  sku_code: string
  display_name: string
  category: string
}

interface Props {
  parseResult: MessageParseResult
  messageId: string
  availableProducts: ProductOption[]
}

// ─── Confidence helpers ───────────────────────────────────────────────────────

function ConfidenceBadge({ value }: { value: number }) {
  if (value >= 0.8)
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
        <CheckCircle className="h-3 w-3" />{Math.round(value * 100)}%
      </span>
    )
  if (value >= 0.5)
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
        <AlertTriangle className="h-3 w-3" />{Math.round(value * 100)}%
      </span>
    )
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
      <XCircle className="h-3 w-3" />{Math.round(value * 100)}%
    </span>
  )
}

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100)
  const colour = value >= 0.8 ? 'bg-green-500' : value >= 0.5 ? 'bg-amber-400' : 'bg-red-400'
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-32 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full ${colour} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-sm font-semibold text-slate-800">{pct}%</span>
    </div>
  )
}

// ─── Intent badge ─────────────────────────────────────────────────────────────

const INTENT_META: Record<string, { label: string; icon: React.ReactNode; colour: string }> = {
  order_request:        { label: 'Order request',        icon: <ShoppingCart className="h-4 w-4" />, colour: 'bg-blue-50 text-blue-700 border-blue-200' },
  payment_notification: { label: 'Payment notification', icon: <CreditCard className="h-4 w-4" />,  colour: 'bg-green-50 text-green-700 border-green-200' },
  delivery_status:      { label: 'Delivery status',      icon: <Truck className="h-4 w-4" />,        colour: 'bg-purple-50 text-purple-700 border-purple-200' },
  question_inquiry:     { label: 'Question / inquiry',   icon: <HelpCircle className="h-4 w-4" />,   colour: 'bg-amber-50 text-amber-700 border-amber-200' },
  general:              { label: 'General',               icon: <MessageSquare className="h-4 w-4" />,colour: 'bg-slate-100 text-slate-600' },
}

// ─── Main component ───────────────────────────────────────────────────────────

export function MessageParseReview({ parseResult, messageId, availableProducts }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showOrderDialog, setShowOrderDialog] = useState(false)

  const data = parseResult.extracted_data as Record<string, unknown>
  const isRejected = data.rejected === true
  const intent = parseResult.parsed_intent
  const intentMeta = INTENT_META[intent] ?? INTENT_META.general
  const languages = (data.languages_detected as string[] | undefined) ?? []
  const issues = (data.issues as string[] | undefined) ?? []
  const translation = (data.message_translation_english as string | null) ?? null

  // ─── Order items state ───────────────────────────────────────────────────────
  type EditableItem = { description: string; product_id: string; quantity: number; match_confidence: number }

  function skuToId(sku: string | null): string {
    if (!sku) return 'none'
    return availableProducts.find((p) => p.sku_code === sku)?.id ?? 'none'
  }

  const orderData = data.order_data as {
    items?: Array<{
      description_in_message: string
      resolved_sku?: string
      quantity: number
      quantity_confidence: number
      match_confidence: number
    }>
    timeline?: string
    urgency?: string
    conditions?: string
  } | undefined

  const [orderItems, setOrderItems] = useState<EditableItem[]>(() =>
    (orderData?.items ?? []).map((item) => ({
      description: item.description_in_message,
      product_id: skuToId(item.resolved_sku ?? null),
      quantity: item.quantity,
      match_confidence: item.match_confidence,
    }))
  )

  function updateItem(idx: number, field: 'product_id' | 'quantity', val: string | number) {
    setOrderItems((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, [field]: val } : item))
    )
  }

  // ─── Actions ─────────────────────────────────────────────────────────────────

  const resolvedItems = orderItems.filter((i) => i.product_id !== 'none' && i.quantity >= 1)
  const skippedItems = orderItems.length - resolvedItems.length

  function handleCreateOrder() {
    if (!resolvedItems.length) {
      toast.error('Select at least one product before creating an order.')
      return
    }
    setShowOrderDialog(true)
  }

  function confirmCreateOrder() {
    startTransition(async () => {
      const result = await convertParseToOrder(
        messageId,
        resolvedItems.map((i) => ({
          product_id: i.product_id,
          quantity: i.quantity,
          description: i.description,
        }))
      )
      if (!result.success) {
        toast.error(result.error)
        setShowOrderDialog(false)
        return
      }
      toast.success('Order created successfully.')
      setShowOrderDialog(false)
      router.push(`/dealer-orders/${result.orderId}`)
    })
  }

  function handleReject() {
    startTransition(async () => {
      const result = await rejectParseResult(parseResult.id)
      if (!result.success) { toast.error(result.error); return }
      toast.success('Parse dismissed — handle manually.')
      router.refresh()
    })
  }

  // ─── Rejected state ───────────────────────────────────────────────────────────

  if (isRejected) {
    return (
      <div className="rounded-lg border border-border bg-slate-50 px-4 py-3">
        <p className="text-sm text-slate-500">Parse dismissed — this message is being handled manually.</p>
      </div>
    )
  }

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="space-y-5">
        {/* Intent + confidence header */}
        <div className="flex flex-wrap items-start justify-between gap-4 rounded-xl border bg-white p-5">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-semibold ${intentMeta.colour}`}>
                {intentMeta.icon}
                {intentMeta.label}
              </span>
              {languages.map((lang) => (
                <Badge key={lang} variant="outline" className="text-xs uppercase">{lang}</Badge>
              ))}
            </div>
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">Overall confidence</p>
              <ConfidenceBar value={parseResult.confidence} />
            </div>
          </div>
        </div>

        {/* English translation */}
        {translation && (
          <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-blue-500">
              English translation
            </p>
            <p className="text-sm italic text-blue-900">{translation}</p>
            <p className="mt-1 text-xs text-blue-400">Translated by AI — verify against original</p>
          </div>
        )}

        {/* Reasoning */}
        {parseResult.ai_notes && (
          <div className="flex gap-2 rounded-lg border bg-slate-50 px-4 py-3">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
            <p className="text-sm italic text-slate-600">{parseResult.ai_notes}</p>
          </div>
        )}

        {/* Issues */}
        {issues.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-700">Parsing issues</p>
            <ul className="list-inside list-disc space-y-0.5">
              {issues.map((issue, i) => (
                <li key={i} className="text-sm text-amber-800">{issue}</li>
              ))}
            </ul>
          </div>
        )}

        {/* ── Intent-specific panels ── */}

        {intent === 'order_request' && orderData && (
          <div className="space-y-4">
            <div className="rounded-xl border bg-white">
              <div className="border-b px-4 py-3">
                <h3 className="text-sm font-semibold text-slate-700">Order items — edit SKU or quantity if needed</h3>
              </div>
              <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 text-left">
                    <th className="px-4 py-2 font-medium text-slate-500 text-xs">Dealer said</th>
                    <th className="px-4 py-2 font-medium text-slate-500 text-xs">Product (SKU)</th>
                    <th className="px-4 py-2 font-medium text-slate-500 text-xs w-24">Qty</th>
                    <th className="px-4 py-2 font-medium text-slate-500 text-xs">Match</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {orderItems.map((item, idx) => (
                    <tr key={idx}>
                      <td className="px-4 py-2 text-slate-600 italic">"{item.description}"</td>
                      <td className="px-4 py-2">
                        <Select
                          value={item.product_id}
                          onValueChange={(v) => updateItem(idx, 'product_id', v)}
                          disabled={isPending}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Select product…" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">— Not resolved —</SelectItem>
                            {availableProducts.map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.sku_code} — {p.display_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-4 py-2">
                        <Input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(e) => updateItem(idx, 'quantity', parseInt(e.target.value) || 1)}
                          className="h-8 w-20 tabular-nums text-xs"
                          disabled={isPending}
                        />
                      </td>
                      <td className="px-4 py-2">
                        <ConfidenceBadge value={item.match_confidence} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>

            {/* Timeline / urgency / conditions */}
            {(orderData.timeline || orderData.urgency || orderData.conditions) && (
              <div className="grid gap-3 rounded-xl border bg-white p-4 sm:grid-cols-3 text-sm">
                {orderData.timeline && (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Timeline</p>
                    <p className="mt-0.5 text-slate-800">{orderData.timeline}</p>
                  </div>
                )}
                {orderData.urgency && (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Urgency</p>
                    <p className="mt-0.5 capitalize text-slate-800">{orderData.urgency}</p>
                  </div>
                )}
                {orderData.conditions && (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Conditions</p>
                    <p className="mt-0.5 text-slate-800">{orderData.conditions}</p>
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3">
              <Button onClick={handleCreateOrder} disabled={isPending || resolvedItems.length === 0}>
                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {skippedItems > 0
                  ? `Create order (${resolvedItems.length} item${resolvedItems.length !== 1 ? 's' : ''})`
                  : 'Create order from this'}
              </Button>
              <Button variant="outline" onClick={handleReject} disabled={isPending}>
                Dismiss parse
              </Button>
            </div>
          </div>
        )}

        {intent === 'payment_notification' && (() => {
          const pd = data.payment_data as {
            claimed_amount_naira?: number
            claimed_amount_confidence?: number
            claimed_method?: string
            claimed_reference?: string
          } | undefined
          return (
            <div className="space-y-4">
              <div className="divide-y rounded-xl border bg-white">
                {pd?.claimed_amount_naira != null && (
                  <div className="flex items-center justify-between px-4 py-3">
                    <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">Claimed amount</dt>
                    <dd className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                      {formatNairaCurrency(pd.claimed_amount_naira)}
                      {pd.claimed_amount_confidence != null && <ConfidenceBadge value={pd.claimed_amount_confidence} />}
                    </dd>
                  </div>
                )}
                {pd?.claimed_method && (
                  <div className="flex items-center justify-between px-4 py-3">
                    <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">Method</dt>
                    <dd className="text-sm text-slate-800">{pd.claimed_method}</dd>
                  </div>
                )}
                {pd?.claimed_reference && (
                  <div className="flex items-center justify-between px-4 py-3">
                    <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">Reference</dt>
                    <dd className="font-mono text-sm text-slate-800">{pd.claimed_reference}</dd>
                  </div>
                )}
              </div>
              <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3">
                <p className="text-sm text-blue-800">
                  If a receipt image was attached, use <strong>Extract data</strong> on the receipt section above for a more accurate extraction.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Button variant="outline" onClick={handleReject} disabled={isPending}>Dismiss parse</Button>
              </div>
            </div>
          )
        })()}

        {intent === 'delivery_status' && (() => {
          const dd = data.delivery_data as {
            status?: string
            issues?: string
            affected_quantity?: number
          } | undefined
          const statusLabel: Record<string, string> = {
            received_ok: 'Received — OK',
            received_with_issues: 'Received — with issues',
            not_received: 'Not received',
          }
          return (
            <div className="space-y-4">
              <div className="divide-y rounded-xl border bg-white">
                {dd?.status && (
                  <div className="flex items-center justify-between px-4 py-3">
                    <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">Status</dt>
                    <dd className="text-sm font-medium text-slate-900">
                      {statusLabel[dd.status] ?? dd.status}
                    </dd>
                  </div>
                )}
                {dd?.issues && (
                  <div className="px-4 py-3">
                    <dt className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">Issues reported</dt>
                    <dd className="text-sm text-red-700">{dd.issues}</dd>
                  </div>
                )}
                {dd?.affected_quantity != null && (
                  <div className="flex items-center justify-between px-4 py-3">
                    <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">Affected units</dt>
                    <dd className="text-sm font-semibold text-slate-900">{dd.affected_quantity}</dd>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3">
                <Button variant="outline" onClick={handleReject} disabled={isPending}>Dismiss parse</Button>
              </div>
            </div>
          )
        })()}

        {intent === 'question_inquiry' && (() => {
          const qd = data.question_data as {
            question_topic?: string
            question_text?: string
          } | undefined
          return (
            <div className="space-y-4">
              <div className="divide-y rounded-xl border bg-white">
                {qd?.question_topic && (
                  <div className="flex items-center justify-between px-4 py-3">
                    <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">Topic</dt>
                    <dd className="capitalize text-sm font-medium text-slate-900">{qd.question_topic.replace('_', ' ')}</dd>
                  </div>
                )}
                {qd?.question_text && (
                  <div className="px-4 py-3">
                    <dt className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">Question</dt>
                    <dd className="text-sm italic text-slate-700">"{qd.question_text}"</dd>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3">
                <Button variant="outline" onClick={handleReject} disabled={isPending}>Dismiss parse</Button>
              </div>
            </div>
          )
        })()}

        {intent === 'general' && (
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={handleReject} disabled={isPending}>Dismiss parse</Button>
          </div>
        )}
      </div>

      {/* Create order confirmation dialog */}
      <Dialog open={showOrderDialog} onOpenChange={(o) => { if (!isPending) setShowOrderDialog(o) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create dealer order?</DialogTitle>
          </DialogHeader>
          <div className="space-y-1">
            {resolvedItems.map((item, i) => {
              const product = availableProducts.find((p) => p.id === item.product_id)
              return (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-slate-600">{product?.display_name ?? item.description}</span>
                  <span className="font-semibold">{item.quantity}×</span>
                </div>
              )
            })}
          </div>
          {skippedItems > 0 && (
            <div className="mt-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              {skippedItems} unresolved item{skippedItems > 1 ? 's' : ''} skipped — select a SKU in the table to include.
            </div>
          )}
          <p className="text-xs text-slate-500 mt-2">
            A dealer order with status "pending" will be created, linked back to this message.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowOrderDialog(false)} disabled={isPending}>Cancel</Button>
            <Button onClick={confirmCreateOrder} disabled={isPending}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create order'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
