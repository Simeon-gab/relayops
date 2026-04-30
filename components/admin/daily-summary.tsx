'use client'

import { useState } from 'react'
import { Sparkles, RefreshCw, AlertTriangle, Loader2 } from 'lucide-react'
import {
  generateDailySummaryFromMetrics,
  type DailySummarySuccess,
} from '@/app/actions/nl-query'
import { formatNaira } from '@/lib/utils/format'
import type { DailySummaryMetrics } from '@/lib/db/daily-metrics'

const SEVERITY_STYLES = {
  high: 'border-red-200 bg-red-50 text-red-800',
  medium: 'border-amber-200 bg-amber-50 text-amber-800',
  low: 'border-slate-200 bg-slate-50 text-slate-700',
}

interface Props {
  metrics: DailySummaryMetrics
}

export function DailySummary({ metrics }: Props) {
  const [loading, setLoading] = useState(false)
  const [summary, setSummary] = useState<DailySummarySuccess | null>(null)

  const pendingReviewItems = metrics.overdue_shipments.length + metrics.low_stock_items.length

  async function handleGenerate() {
    setLoading(true)
    const result = await generateDailySummaryFromMetrics(metrics)
    if (result.success) setSummary(result)
    setLoading(false)
  }

  return (
    <div className="mb-8 rounded-xl border bg-white px-6 py-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Today's Summary
        </h2>
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : summary ? (
            <RefreshCw className="h-3.5 w-3.5" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          {loading ? 'Generating…' : summary ? 'Regenerate' : 'Generate briefing'}
        </button>
      </div>

      {/* Metrics grid — always visible, from server-computed props */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg bg-slate-50 px-3 py-2.5">
          <p className="text-xs text-slate-500">Dispatched yesterday</p>
          <p className="mt-0.5 text-xl font-semibold tabular-nums text-slate-900">
            {metrics.shipments_dispatched_yesterday}
          </p>
        </div>
        <div className="rounded-lg bg-slate-50 px-3 py-2.5">
          <p className="text-xs text-slate-500">Payments (yesterday)</p>
          <p className="mt-0.5 text-xl font-semibold tabular-nums text-slate-900">
            {formatNaira(metrics.payments_received_yesterday_naira)}
          </p>
        </div>
        <div className="rounded-lg bg-slate-50 px-3 py-2.5">
          <p className="text-xs text-slate-500">New orders</p>
          <p className="mt-0.5 text-xl font-semibold tabular-nums text-slate-900">
            {metrics.new_orders_yesterday}
          </p>
        </div>
        <div className="rounded-lg bg-slate-50 px-3 py-2.5">
          <p className="text-xs text-slate-500">Pending review</p>
          <p className="mt-0.5 text-xl font-semibold tabular-nums text-slate-900">
            {pendingReviewItems}
          </p>
        </div>
      </div>

      {/* AI narrative section */}
      {loading && (
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-slate-500" />
          Generating briefing…
        </div>
      )}

      {!loading && !summary && (
        <p className="text-sm text-slate-400">
          Click "Generate briefing" for an AI narrative of today's operations.
        </p>
      )}

      {!loading && summary && (
        <>
          <p className="mb-4 text-sm leading-relaxed text-slate-700">{summary.summary_text}</p>

          {summary.items_needing_attention.length > 0 && (
            <div className="space-y-2">
              {summary.items_needing_attention.map((item, i) => (
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
        </>
      )}
    </div>
  )
}
