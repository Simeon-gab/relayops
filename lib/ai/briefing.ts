import { unstable_cache } from 'next/cache'
import { callClaudeText, AI_MODEL } from '@/lib/ai/client'
import {
  getDailySummarySystemPrompt,
  getDailySummaryUserPrompt,
  type DailySummaryMetrics,
} from '@/lib/ai/prompts/daily-summary'

/**
 * The daily briefing.
 *
 * Previously this only ran when somebody pressed "Generate briefing". The MD's
 * dashboard renders it on load instead, so it has to be cached — otherwise
 * every visit to the page is a paid model call, and he opens it several times
 * a day.
 *
 * Cached on the date plus a digest of the metrics: the briefing regenerates
 * when the day rolls over or when the numbers behind it actually move, and is
 * free on every other view.
 */

export interface Briefing {
  summary_text: string
  key_metrics: {
    shipments_dispatched_yesterday: number
    payments_received_yesterday_naira: number
    new_orders_yesterday: number
    pending_review_items: number
  }
  items_needing_attention: {
    type: string
    description: string
    severity: 'high' | 'medium' | 'low'
  }[]
  generated_at: string
  ai_model: string
}

/** One uncached call. Exported so the manual "regenerate" path can reuse it. */
export async function generateBriefing(metrics: DailySummaryMetrics): Promise<Briefing> {
  const dateLabel = new Date().toLocaleDateString('en-NG', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const raw = await callClaudeText(
    getDailySummarySystemPrompt(),
    getDailySummaryUserPrompt(metrics, dateLabel)
  )

  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('No JSON in model response.')

  const parsed = JSON.parse(jsonMatch[0]) as Omit<Briefing, 'generated_at' | 'ai_model'>

  return {
    summary_text: parsed.summary_text,
    key_metrics: parsed.key_metrics,
    items_needing_attention: parsed.items_needing_attention ?? [],
    generated_at: new Date().toISOString(),
    ai_model: AI_MODEL,
  }
}

/**
 * Stable key for a set of metrics. Only the figures the briefing actually
 * talks about are included, so a change elsewhere in the system doesn't
 * needlessly re-bill a model call.
 */
function metricsDigest(m: DailySummaryMetrics): string {
  return [
    m.shipments_dispatched_yesterday,
    m.deliveries_confirmed_yesterday,
    Math.round(m.payments_received_yesterday_naira),
    m.new_orders_yesterday,
    m.pending_orders_total,
    m.overdue_shipments.length,
    m.low_stock_items.length,
  ].join('-')
}

const cachedBriefing = unstable_cache(
  async (_key: string, metrics: DailySummaryMetrics) => generateBriefing(metrics),
  ['relayops-daily-briefing'],
  { revalidate: 3600, tags: ['daily-briefing'] }
)

/**
 * The briefing for right now, generated at most once per (day, numbers) pair.
 * Returns null rather than throwing — a dashboard must still render when the
 * model is unreachable or the API key is missing.
 */
export async function getDailyBriefing(metrics: DailySummaryMetrics): Promise<Briefing | null> {
  try {
    const today = new Date().toISOString().slice(0, 10)
    return await cachedBriefing(`${today}:${metricsDigest(metrics)}`, metrics)
  } catch (err) {
    console.error('[briefing] failed:', err instanceof Error ? err.message : err)
    return null
  }
}
