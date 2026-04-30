'use client'

import { useEffect, useState } from 'react'
import { RefreshCw, AlertTriangle } from 'lucide-react'
import { generateDailySummary, type DailySummaryResult } from '@/app/actions/nl-query'
import { formatNaira } from '@/lib/utils/format'

const SEVERITY_STYLES = {
  high: 'border-red-200 bg-red-50 text-red-800',
  medium: 'border-amber-200 bg-amber-50 text-amber-800',
  low: 'border-slate-200 bg-slate-50 text-slate-700',
}

export function DailySummary() {
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState<DailySummaryResult | null>(null)

  useEffect(() => {
    generateDailySummary().then(s => {
      setSummary(s)
      setLoading(false)
    })
  }, [])

  async function handleRefresh() {
    setLoading(true)
    const s = await generateDailySummary()
    setSummary(s)
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="mb-8 rounded-xl border bg-white px-6 py-5">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Today's Summary
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-slate-500" />
          Generating briefing…
        </div>
      </div>
    )
  }

  if (!summary || !summary.success) {
    return null
  }

  const { summary_text, key_metrics, items_needing_attention } = summary

  return (
    <div className="mb-8 rounded-xl border bg-white px-6 py-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Today's Summary
        </h2>
        <button
          onClick={handleRefresh}
          className="flex items-center gap-1.5 text-xs text-slate-400 transition-colors hover:text-slate-700"
        >
          <RefreshCw className="h-3 w-3" />
          Refresh
        </button>
      </div>

      <p className="mb-5 text-sm leading-relaxed text-slate-700">{summary_text}</p>

      {/* Key metrics mini-grid */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg bg-slate-50 px-3 py-2.5">
          <p className="text-xs text-slate-500">Dispatched yesterday</p>
          <p className="mt-0.5 text-xl font-semibold tabular-nums text-slate-900">
            {key_metrics.shipments_dispatched_yesterday}
          </p>
        </div>
        <div className="rounded-lg bg-slate-50 px-3 py-2.5">
          <p className="text-xs text-slate-500">Payments (yesterday)</p>
          <p className="mt-0.5 text-xl font-semibold tabular-nums text-slate-900">
            {formatNaira(key_metrics.payments_received_yesterday_naira)}
          </p>
        </div>
        <div className="rounded-lg bg-slate-50 px-3 py-2.5">
          <p className="text-xs text-slate-500">New orders</p>
          <p className="mt-0.5 text-xl font-semibold tabular-nums text-slate-900">
            {key_metrics.new_orders_yesterday}
          </p>
        </div>
        <div className="rounded-lg bg-slate-50 px-3 py-2.5">
          <p className="text-xs text-slate-500">Pending review</p>
          <p className="mt-0.5 text-xl font-semibold tabular-nums text-slate-900">
            {key_metrics.pending_review_items}
          </p>
        </div>
      </div>

      {/* Attention items */}
      {items_needing_attention.length > 0 && (
        <div className="space-y-2">
          {items_needing_attention.map((item, i) => (
            <div
              key={i}
              className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${SEVERITY_STYLES[item.severity]}`}
            >
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{item.description}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
