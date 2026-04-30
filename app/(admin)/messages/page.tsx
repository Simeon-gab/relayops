import Link from 'next/link'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MessagesTable } from '@/components/admin/messages-table'
import { getMessages, getMessageCounts } from '@/lib/db/messages'

type Props = {
  searchParams: Promise<{ filter?: string }>
}

export default async function MessagesPage({ searchParams }: Props) {
  const { filter } = await searchParams

  const parseStatus =
    filter === 'parsed' ? 'parsed' : filter === 'unparsed' ? 'unparsed' : undefined

  const [messages, counts] = await Promise.all([
    getMessages(parseStatus ? { parse_status: parseStatus } : {}),
    getMessageCounts(),
  ])

  const filters = [
    { key: undefined, label: 'All', count: counts.total },
    { key: 'unparsed', label: 'Unparsed', count: counts.unparsed },
    { key: 'parsed', label: 'Parsed', count: counts.parsed },
  ]

  return (
    <div className="px-6 py-10">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Inbound messages</h1>
          <p className="mt-1 text-sm text-slate-500">
            Dealer communications received via WhatsApp, SMS, or portal
          </p>
        </div>
        <Button asChild>
          <Link href="/messages/new">
            <Plus className="mr-1.5 h-4 w-4" />
            New message
          </Link>
        </Button>
      </div>

      {/* Filter pills */}
      <div className="mb-6 flex flex-wrap gap-2">
        {filters.map(({ key, label, count }) => {
          const href = key ? `/messages?filter=${key}` : '/messages'
          const active = filter === key || (!filter && !key)
          return (
            <Link
              key={label}
              href={href}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm transition-colors ${
                active
                  ? 'bg-slate-900 text-white'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {label}
              <span className={`text-xs ${active ? 'text-slate-300' : 'text-slate-400'}`}>
                {count}
              </span>
            </Link>
          )
        })}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border bg-white">
        <MessagesTable messages={messages} />
      </div>
    </div>
  )
}
