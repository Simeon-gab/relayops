export interface DailySummaryMetrics {
  shipments_dispatched_yesterday: number
  deliveries_confirmed_yesterday: number
  payments_received_yesterday_naira: number
  new_orders_yesterday: number
  pending_orders_total: number
  overdue_shipments: { destination: string; dispatched_at: string | null }[]
  low_stock_items: { product: string; sku: string; warehouse: string; quantity: number }[]
}

export function getDailySummarySystemPrompt(): string {
  return `You are a daily operations briefing writer for RelayOps, a motorcycle distribution company (Hungkee Nigeria) with warehouses in Lagos and Kano.

Write a concise morning briefing for the operations team. Your tone is professional and direct — like a team lead summarizing the day's starting position in a morning standup. 2–4 sentences maximum for the narrative.

The metrics you receive are computed from the database. Your job is to synthesize them into a narrative, not to invent numbers. Mention what's worth noting and what needs attention. If everything looks normal, say so briefly.

Output valid JSON (no markdown, no code fences):
{
  "summary_text": "2–4 sentence narrative summary.",
  "key_metrics": {
    "shipments_dispatched_yesterday": <integer from input>,
    "payments_received_yesterday_naira": <number from input>,
    "new_orders_yesterday": <integer from input>,
    "pending_review_items": <integer: overdue + low_stock count>
  },
  "items_needing_attention": [
    {"type": "overdue_shipment|stockout_risk|other", "description": "Concise description.", "severity": "high|medium|low"}
  ]
}

Severity guidelines: high = immediate risk to revenue or operations, medium = needs action today, low = worth monitoring.
Items needing attention should only include real issues, not routine activity.`
}

export function getDailySummaryUserPrompt(metrics: DailySummaryMetrics, dateLabel: string): string {
  const lines: string[] = [
    `Date: ${dateLabel}`,
    '',
    `Shipments dispatched yesterday: ${metrics.shipments_dispatched_yesterday}`,
    `Deliveries confirmed yesterday: ${metrics.deliveries_confirmed_yesterday}`,
    `Payments received yesterday: ₦${metrics.payments_received_yesterday_naira.toLocaleString()}`,
    `New dealer orders yesterday: ${metrics.new_orders_yesterday}`,
    `Total pending/partial orders (backlog): ${metrics.pending_orders_total}`,
  ]

  if (metrics.overdue_shipments.length > 0) {
    lines.push('')
    lines.push('Overdue shipments (dispatched >7 days, not yet delivered):')
    for (const s of metrics.overdue_shipments) {
      const daysAgo = s.dispatched_at
        ? Math.floor((Date.now() - new Date(s.dispatched_at).getTime()) / 86_400_000)
        : null
      lines.push(`  - ${s.destination}${daysAgo !== null ? ` (${daysAgo} days ago)` : ''}`)
    }
  } else {
    lines.push('Overdue shipments: none')
  }

  if (metrics.low_stock_items.length > 0) {
    lines.push('')
    lines.push('Low stock (< 5 units):')
    for (const item of metrics.low_stock_items) {
      lines.push(`  - ${item.product} (${item.sku}) — ${item.warehouse}: ${item.quantity} units`)
    }
  } else {
    lines.push('Low stock alerts: none')
  }

  return lines.join('\n')
}
