import Link from 'next/link'
import { ArrowRight, CheckCircle2 } from 'lucide-react'
import type { AiProposal, ProposalKind } from '@/lib/db/ai-proposals'

/**
 * The one interactive block on the MD and partner dashboards.
 *
 * Everything the agents produced overnight lands here as a single plain-English
 * line. The buttons go to the screen that already knows how to review that kind
 * of thing, rather than duplicating each review UI inline.
 */

const KIND_LABEL: Record<ProposalKind, string> = {
  container_allocation: 'Container to allocate',
  order_from_message:   'Order from message',
  payment_from_receipt: 'Payment to confirm',
  dispatch_message:     'Message to send',
  next_container_load:  'Next container',
  stock_alert:          'Running low',
  overdue_alert:        'Not confirmed',
  credit_alert:         'Over credit limit',
}

const KIND_TONE: Record<ProposalKind, string> = {
  container_allocation: 'bg-brand-soft text-brand-deep border-brand-deep/20',
  order_from_message:   'bg-blue-50 text-blue-700 border-blue-200',
  payment_from_receipt: 'bg-green-50 text-green-700 border-green-200',
  dispatch_message:     'bg-slate-50 text-slate-700 border-slate-200',
  next_container_load:  'bg-brand-soft text-brand-deep border-brand-deep/20',
  stock_alert:          'bg-amber-50 text-amber-700 border-amber-200',
  overdue_alert:        'bg-red-50 text-red-700 border-red-200',
  credit_alert:         'bg-red-50 text-red-700 border-red-200',
}

/** Where a proposal is acted on. Reuses the review screens that already exist. */
function reviewHref(p: AiProposal): string {
  switch (p.kind) {
    case 'container_allocation':
      return p.subject_id ? `/containers/${p.subject_id}` : '/containers'
    case 'order_from_message':
    case 'dispatch_message':
      return p.subject_id ? `/messages/${p.subject_id}` : '/messages'
    case 'payment_from_receipt':
      return p.subject_id ? `/receipts/${p.subject_id}` : '/receipts'
    case 'overdue_alert':
      return p.subject_id ? `/shipments/${p.subject_id}` : '/shipments'
    case 'credit_alert':
      return p.subject_id ? `/dealer-orders/${p.subject_id}` : '/dealer-orders'
    case 'stock_alert':
      return '/warehouses'
    case 'next_container_load':
      return '/containers/new'
  }
}

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days <= 14) return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })
}

interface Props {
  proposals: AiProposal[]
  title?: string
  emptyMessage?: string
}

export function DecisionQueue({
  proposals,
  title = 'Needs your decision',
  emptyMessage = 'Nothing waiting on you.',
}: Props) {
  if (proposals.length === 0) {
    return (
      <div className="mb-6 flex items-center gap-3 rounded-xl border border-border bg-card px-5 py-4">
        <CheckCircle2 className="h-4 w-4 shrink-0 text-status-success" />
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className="mb-6 overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-subtle px-5 py-3">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <span className="rounded-full bg-brand-deep px-2 py-0.5 text-xs font-medium text-white">
          {proposals.length}
        </span>
      </div>

      <ul className="divide-y divide-border">
        {proposals.map((p) => (
          <li
            key={p.id}
            className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${KIND_TONE[p.kind]}`}
                >
                  {KIND_LABEL[p.kind]}
                </span>
                {p.confidence !== null && (
                  <span className="text-xs text-muted-foreground">
                    {Math.round(p.confidence * 100)}% sure
                  </span>
                )}
                <span className="text-xs text-muted-foreground">{timeAgo(p.created_at)}</span>
              </div>
              <p className="mt-1.5 text-sm text-foreground">{p.summary}</p>
            </div>

            <Link
              href={reviewHref(p)}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-subtle"
            >
              Review
              <ArrowRight className="h-3 w-3" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
