import Link from 'next/link'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MessagesTable } from '@/components/admin/messages-table'
import { OutboundMessagesTable } from '@/components/admin/outbound-messages-table'
import { getMessages, getMessageCounts, getOutboundMessages } from '@/lib/db/messages'

type Props = {
  searchParams: Promise<{ filter?: string; dir?: string }>
}

const INTENT_FILTERS = ['order_request', 'payment_notification']

export default async function MessagesPage({ searchParams }: Props) {
  const { filter, dir } = await searchParams
  const direction = dir === 'outbound' ? 'outbound' : 'inbound'

  const parseStatus =
    filter === 'unparsed' ? ('unparsed' as const)
    : filter === 'parsed' ? ('parsed' as const)
    : undefined

  const intent = INTENT_FILTERS.includes(filter ?? '') ? filter : undefined

  const msgFilter = intent
    ? { intent }
    : parseStatus
    ? { parse_status: parseStatus }
    : {}

  const [inboundMessages, counts, outboundMessages] = await Promise.all([
    direction === 'inbound' ? getMessages(msgFilter) : Promise.resolve([]),
    getMessageCounts(),
    direction === 'outbound' ? getOutboundMessages() : Promise.resolve([]),
  ])

  const inboundFilters = [
    { key: undefined,              label: 'All',             count: counts.total },
    { key: 'unparsed',             label: 'Unparsed',        count: counts.unparsed },
    { key: 'order_request',        label: 'Order requests',  count: counts.order_requests },
    { key: 'payment_notification', label: 'Payments',        count: counts.payments },
    { key: 'parsed',               label: 'All parsed',      count: counts.parsed },
  ]

  return (
    <div className="px-6 py-10">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">Messages</h1>
          <p className="mt-1 text-sm text-slate-500">
            Dealer communications — inbound and outbound
          </p>
        </div>
        <Button asChild className="w-full sm:w-auto">
          <Link href="/messages/new">
            <Plus className="mr-1.5 h-4 w-4" />
            New message
          </Link>
        </Button>
      </div>

      {/* Direction tabs */}
      <div className="mb-4 flex gap-1 rounded-lg border bg-subtle p-1 w-fit">
        <Link
          href="/messages"
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
            direction === 'inbound'
              ? 'bg-card text-heading shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Inbound
        </Link>
        <Link
          href="/messages?dir=outbound"
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
            direction === 'outbound'
              ? 'bg-card text-heading shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Outbound
        </Link>
      </div>

      {/* Intent filter pills — inbound only */}
      {direction === 'inbound' && (
        <div className="mb-6 flex flex-wrap gap-2">
          {inboundFilters.map(({ key, label, count }) => {
            const href = key ? `/messages?filter=${key}` : '/messages'
            const active = filter === key || (!filter && !key)
            return (
              <Link
                key={label}
                href={href}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors ${
                  active
                    ? 'border-brand-deep bg-brand-deep text-white'
                    : 'border-border bg-card text-muted-foreground hover:bg-subtle hover:text-foreground'
                }`}
              >
                {label}
                <span className={`text-xs ${active ? 'text-white/60' : 'text-muted-foreground'}`}>
                  {count}
                </span>
              </Link>
            )
          })}
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-xl border bg-white">
        {direction === 'inbound' ? (
          <MessagesTable messages={inboundMessages} />
        ) : (
          <OutboundMessagesTable messages={outboundMessages} />
        )}
      </div>
    </div>
  )
}
