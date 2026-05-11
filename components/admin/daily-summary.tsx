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
  high:   'border-status-danger/30  bg-status-danger/5  text-status-danger',
  medium: 'border-status-pending/30 bg-status-pending/5 text-amber-700',
  low:    'border-border             bg-subtle            text-muted-foreground',
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
    <div className="mb-6 rounded-xl border border-border bg-card px-6 py-5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Today's Summary
        </span>
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-subtle hover:text-foreground disabled:opacity-50"
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

      {/* Mini-stats — 2×2 on mobile, single row on md+ */}
      <div className="mt-4 border-y border-border py-3">
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 md:flex md:items-center md:gap-6">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Dispatched yesterday</p>
            <p className="mt-0.5 text-xl font-semibold tabular-nums text-heading">
              {metrics.shipments_dispatched_yesterday}
            </p>
          </div>
          <div className="hidden md:block h-8 w-px bg-border" />
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Payments (yesterday)</p>
            <p className="mt-0.5 text-xl font-semibold tabular-nums text-heading">
              {formatNaira(metrics.payments_received_yesterday_naira)}
            </p>
          </div>
          <div className="hidden md:block h-8 w-px bg-border" />
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">New orders</p>
            <p className="mt-0.5 text-xl font-semibold tabular-nums text-heading">
              {metrics.new_orders_yesterday}
            </p>
          </div>
          <div className="hidden md:block h-8 w-px bg-border" />
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Pending review</p>
            <p className="mt-0.5 text-xl font-semibold tabular-nums text-heading">
              {pendingReviewItems}
            </p>
          </div>
        </div>
      </div>

      {loading && (
        <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-foreground" />
          Generating briefing…
        </div>
      )}

      {!loading && !summary && (
        <p className="mt-4 text-sm text-muted-foreground">
          Click "Generate briefing" for an AI narrative of today's operations.
        </p>
      )}

      {!loading && summary && (
        <div className="mt-4 space-y-3">
          <p className="text-sm leading-relaxed text-foreground">{summary.summary_text}</p>

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
        </div>
      )}
    </div>
  )
}
