'use client'

import { useState } from 'react'
import { Loader2, CheckCircle2, XCircle, AlertTriangle, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { executeAllocation } from '@/app/actions/containers'
import type {
  AllocationSuggestion,
  AllocSuggestedDealer,
  AllocSuggestedItem,
  AllocTransferItem,
} from '@/app/actions/containers'

interface Props {
  suggestion: AllocationSuggestion
  containerId: string
  onReject: () => void
}

function ConfidencePill({ value }: { value: number }) {
  const pct = Math.round(value * 100)
  const color = pct >= 80 ? 'text-green-700 bg-green-50' : pct >= 60 ? 'text-amber-700 bg-amber-50' : 'text-red-700 bg-red-50'
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>
      {pct}% confidence
    </span>
  )
}

export function AllocationSuggestionReview({ suggestion, containerId, onReject }: Props) {
  const router = useRouter()
  const [executing, setExecuting] = useState(false)

  // Editable state — quantities per allocation
  const [allocations, setAllocations] = useState<AllocSuggestedDealer[]>(
    suggestion.dealer_allocations.map((a) => ({ ...a, items: a.items.map((i) => ({ ...i })) }))
  )
  const [kanoTransfer, setKanoTransfer] = useState<AllocTransferItem[]>(
    suggestion.kano_transfer.map((t) => ({ ...t }))
  )

  function updateItemQty(allocIdx: number, itemIdx: number, qty: number) {
    setAllocations((prev) =>
      prev.map((a, ai) =>
        ai !== allocIdx
          ? a
          : { ...a, items: a.items.map((it, ii) => (ii !== itemIdx ? it : { ...it, quantity_allocated: Math.max(0, qty) })) }
      )
    )
  }

  function updateTransferQty(idx: number, qty: number) {
    setKanoTransfer((prev) =>
      prev.map((t, i) => (i !== idx ? t : { ...t, quantity: Math.max(0, qty) }))
    )
  }

  function removeAllocation(idx: number) {
    setAllocations((prev) => prev.filter((_, i) => i !== idx))
  }

  function toggleWarehouse(idx: number) {
    setAllocations((prev) =>
      prev.map((a, i) => (i !== idx ? a : { ...a, served_via: a.served_via === 'LAGOS' ? 'KANO' : 'LAGOS' }))
    )
  }

  async function handleExecute() {
    setExecuting(true)
    try {
      const result = await executeAllocation({
        container_id: containerId,
        dealer_allocations: allocations
          .filter((a) => a.items.some((i) => i.quantity_allocated > 0))
          .map((a) => ({
            order_id: a.order_id,
            dealer_id: a.dealer_id,
            served_via: a.served_via,
            items: a.items
              .filter((i) => i.quantity_allocated > 0)
              .map((i) => ({ product_id: i.product_id, sku_code: i.sku_code, quantity: i.quantity_allocated })),
          })),
        kano_transfer: kanoTransfer
          .filter((t) => t.quantity > 0)
          .map((t) => ({ product_id: t.product_id, sku_code: t.sku_code, quantity: t.quantity })),
      })

      if (!result.success) {
        toast.error(result.error)
        return
      }

      toast.success(`Allocation executed — ${result.shipmentCount} shipment${result.shipmentCount !== 1 ? 's' : ''} created`)
      router.refresh()
    } finally {
      setExecuting(false)
    }
  }

  const totalAllocatedUnits = allocations.reduce(
    (s, a) => s + a.items.reduce((as, i) => as + i.quantity_allocated, 0),
    0
  )
  const totalTransferUnits = kanoTransfer.reduce((s, t) => s + t.quantity, 0)

  return (
    <div className="space-y-6">
      {/* Header strip */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-white px-4 py-3">
        <span className="text-sm font-semibold text-slate-900">AI allocation suggestion</span>
        <ConfidencePill value={suggestion.confidence} />
        <span className="text-xs text-slate-500">
          {allocations.length} dealer allocation{allocations.length !== 1 ? 's' : ''}
          {totalTransferUnits > 0 && ` · ${totalTransferUnits} units → KANO`}
        </span>
      </div>

      {/* Reasoning */}
      <div className="rounded-xl border bg-subtle px-4 py-3 text-sm text-slate-600">
        {suggestion.overall_reasoning}
      </div>

      {/* Caveats */}
      {suggestion.caveats.length > 0 && (
        <div className="flex gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <ul className="space-y-1">
            {suggestion.caveats.map((c, i) => (
              <li key={i} className="text-sm text-amber-800">{c}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Dealer allocations */}
      <div>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Dealer allocations ({totalAllocatedUnits} units total)
        </h3>
        {allocations.length === 0 ? (
          <p className="text-sm text-slate-400">No dealer allocations suggested.</p>
        ) : (
          <div className="space-y-3">
            {allocations.map((alloc, ai) => (
              <div key={alloc.order_id} className="overflow-hidden rounded-xl border bg-white">
                <div className="flex items-center justify-between gap-4 border-b bg-subtle px-4 py-2.5">
                  <div className="flex items-center gap-3">
                    <div>
                      <span className="text-sm font-semibold text-slate-900">{alloc.dealer_name}</span>
                      <span className="ml-2 text-xs text-slate-500">{alloc.dealer_city}</span>
                    </div>
                    <button
                      onClick={() => toggleWarehouse(ai)}
                      className={`flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors ${
                        alloc.served_via === 'LAGOS'
                          ? 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'
                          : 'border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100'
                      }`}
                    >
                      <ArrowRight className="h-3 w-3" />
                      {alloc.served_via}
                    </button>
                  </div>
                  <button
                    onClick={() => removeAllocation(ai)}
                    className="text-xs text-slate-400 hover:text-red-500"
                  >
                    Remove
                  </button>
                </div>
                <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <tbody className="divide-y">
                    {alloc.items.map((item: AllocSuggestedItem, ii) => (
                      <tr key={item.sku_code} className="px-4">
                        <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{item.sku_code}</td>
                        <td className="px-4 py-2.5 text-slate-800">{item.display_name}</td>
                        <td className="px-4 py-2.5 text-right">
                          <input
                            type="number"
                            min={0}
                            value={item.quantity_allocated}
                            onChange={(e) => updateItemQty(ai, ii, parseInt(e.target.value) || 0)}
                            className="w-20 rounded border px-2 py-1 text-right text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-slate-300"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
                {alloc.reasoning && (
                  <p className="border-t px-4 py-2 text-xs italic text-slate-400">{alloc.reasoning}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Kano transfer */}
      {kanoTransfer.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Transfer to KANO ({totalTransferUnits} units)
          </h3>
          <div className="overflow-x-auto rounded-xl border bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-subtle text-left">
                  <th className="px-4 py-3 font-medium text-slate-600">SKU</th>
                  <th className="px-4 py-3 font-medium text-slate-600">Product</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-600">Quantity</th>
                  <th className="px-4 py-3 font-medium text-slate-600">Reasoning</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {kanoTransfer.map((t, ti) => (
                  <tr key={t.sku_code}>
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{t.sku_code}</td>
                    <td className="px-4 py-2.5 text-slate-800">{t.display_name}</td>
                    <td className="px-4 py-2.5 text-right">
                      <input
                        type="number"
                        min={0}
                        value={t.quantity}
                        onChange={(e) => updateTransferQty(ti, parseInt(e.target.value) || 0)}
                        className="w-20 rounded border px-2 py-1 text-right text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-slate-300"
                      />
                    </td>
                    <td className="px-4 py-2.5 text-xs italic text-slate-400">{t.reasoning}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Remaining in Lagos */}
      {suggestion.remaining_in_lagos.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Remaining in LAGOS stock
          </h3>
          <div className="overflow-x-auto rounded-xl border bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-subtle text-left">
                  <th className="px-4 py-3 font-medium text-slate-600">SKU</th>
                  <th className="px-4 py-3 font-medium text-slate-600">Product</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-600">Qty</th>
                  <th className="px-4 py-3 font-medium text-slate-600">Purpose</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {suggestion.remaining_in_lagos.map((r) => (
                  <tr key={r.sku_code} className="hover:bg-subtle">
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{r.sku_code}</td>
                    <td className="px-4 py-2.5 text-slate-800">{r.display_name}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-medium text-slate-900">{r.quantity}</td>
                    <td className="px-4 py-2.5 text-xs capitalize text-slate-500">
                      {r.purpose.replace(/_/g, ' ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between gap-4 rounded-xl border bg-white px-4 py-3">
        <Button variant="ghost" size="sm" onClick={onReject} disabled={executing}>
          <XCircle className="mr-1.5 h-4 w-4 text-slate-400" />
          Reject &amp; allocate manually
        </Button>
        <Button onClick={handleExecute} disabled={executing}>
          {executing ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle2 className="mr-1.5 h-4 w-4" />
          )}
          Execute allocation
        </Button>
      </div>
    </div>
  )
}
