import Link from 'next/link'
import { Inbox, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ParseMessageButton } from './parse-message-button'
import type { MessageQueueItem } from '@/lib/db/messages'

const STATE_CHIPS: Record<MessageQueueItem['state'], { label: string; className: string }> = {
  unparsed:      { label: 'Unparsed',        className: 'bg-amber-50 text-amber-700 border-amber-200' },
  order_ready:   { label: 'Order request',   className: 'bg-blue-50 text-blue-700 border-blue-200' },
  payment_ready: { label: 'Payment receipt', className: 'bg-green-50 text-green-700 border-green-200' },
}

const MAX_SHOWN = 6

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

export function MessageActionQueue({ items }: { items: MessageQueueItem[] }) {
  if (items.length === 0) return null

  const shown = items.slice(0, MAX_SHOWN)
  const remaining = items.length - shown.length

  return (
    <div className="mb-6 overflow-hidden rounded-xl border bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-subtle px-4 py-3 sm:px-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Inbox className="h-4 w-4 text-slate-400" />
          Messages needing your decision
          <span className="rounded-full bg-brand-deep px-2 py-0.5 text-xs font-medium text-white">
            {items.length}
          </span>
        </h2>
        <Link
          href="/messages"
          className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-900"
        >
          All messages
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <ul className="divide-y">
        {shown.map((m) => {
          const chip = STATE_CHIPS[m.state]
          return (
            <li
              key={m.id}
              className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-slate-900">{m.business_name}</span>
                  <span className="text-xs text-slate-400">{m.city}</span>
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${chip.className}`}
                  >
                    {chip.label}
                  </span>
                  <span className="text-xs text-slate-400">{timeAgo(m.created_at)}</span>
                </div>
                <p className="mt-1 truncate text-sm text-slate-500">
                  {m.original_text.length > 90
                    ? m.original_text.slice(0, 90) + '…'
                    : m.original_text}
                </p>
              </div>

              <div className="shrink-0">
                {m.state === 'unparsed' ? (
                  <ParseMessageButton messageId={m.id} />
                ) : (
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/messages/${m.id}`}>
                      Review &amp; approve
                      <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                    </Link>
                  </Button>
                )}
              </div>
            </li>
          )
        })}
      </ul>

      {remaining > 0 && (
        <div className="border-t px-4 py-2.5 sm:px-5">
          <Link href="/messages" className="text-xs font-medium text-slate-500 hover:text-slate-900">
            +{remaining} more waiting — open Messages
          </Link>
        </div>
      )}
    </div>
  )
}
