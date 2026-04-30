'use client'

import { useRouter } from 'next/navigation'
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { DataTable, type Column } from './data-table'
import { StatusBadge } from './status-badge'
import { formatNairaCurrency } from '@/lib/utils/format'
import type {
  DealerActivity,
  DealerShipment,
  DealerPayment,
  DealerMessage,
  DealerOrder,
  DealerOrderSummaryItem,
} from '@/types/dealers'

const LANG_LABELS: Record<string, string> = { en: 'EN', ha: 'HA', yo: 'YO', ig: 'IG' }

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 30) return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })
}

function shortId(id: string): string {
  return id.slice(-8)
}

const shipmentColumns: Column<DealerShipment>[] = [
  {
    header: 'ID',
    cell: (r) => (
      <span className="font-mono text-xs text-slate-500">…{shortId(r.id)}</span>
    ),
  },
  {
    header: 'Status',
    cell: (r) => <StatusBadge status={r.status} />,
  },
  {
    header: 'Dispatched',
    cell: (r) => (
      <span className="text-slate-600">
        {r.dispatched_at ? formatDate(r.dispatched_at) : '—'}
      </span>
    ),
  },
  {
    header: 'Total',
    className: 'text-right',
    cell: (r) => (
      <span className="tabular-nums">
        {r.total_amount_naira != null ? formatNairaCurrency(r.total_amount_naira) : '—'}
      </span>
    ),
  },
  {
    header: 'Paid',
    className: 'text-right',
    cell: (r) => (
      <span className="tabular-nums">{formatNairaCurrency(r.amount_paid_naira)}</span>
    ),
  },
  {
    header: 'Items',
    className: 'text-right',
    cell: (r) => <span className="tabular-nums">{r.item_count}</span>,
  },
]

const paymentColumns: Column<DealerPayment>[] = [
  {
    header: 'Date',
    cell: (r) => (
      <span className="text-slate-600">{formatDate(r.payment_date)}</span>
    ),
  },
  {
    header: 'Amount',
    cell: (r) => (
      <span className="tabular-nums font-semibold">
        {formatNairaCurrency(r.amount_naira)}
      </span>
    ),
  },
  {
    header: 'Reference',
    cell: (r) => (
      <span className="font-mono text-xs text-slate-500">
        {r.payment_reference ?? '—'}
      </span>
    ),
  },
  {
    header: 'Shipment',
    cell: (r) => (
      <span className="font-mono text-xs text-slate-500">
        {r.shipment_id ? `…${shortId(r.shipment_id)}` : '—'}
      </span>
    ),
  },
]

function formatOrderSummary(summary: DealerOrderSummaryItem[]): string {
  if (!summary.length) return '—'
  const parts = summary.slice(0, 3).map((i) => `${i.quantity}× ${i.sku_code}`)
  return summary.length > 3 ? parts.join(', ') + '…' : parts.join(', ')
}

export function DealerActivityTabs({ activity }: { activity: DealerActivity }) {
  const router = useRouter()

  const orderColumns: Column<DealerOrder>[] = [
    {
      header: 'Date',
      cell: (r) => (
        <span className="text-slate-600">{formatDate(r.requested_at)}</span>
      ),
    },
    {
      header: 'Products',
      cell: (r) => (
        <span className="font-mono text-xs text-slate-600">
          {formatOrderSummary(r.summary)}
        </span>
      ),
    },
    {
      header: 'Status',
      cell: (r) => <StatusBadge status={r.status} />,
    },
    {
      header: 'Items',
      className: 'text-right',
      cell: (r) => <span className="tabular-nums">{r.item_count}</span>,
    },
  ]

  return (
    <Tabs defaultValue="orders">
      <TabsList className="mb-4">
        <TabsTrigger value="orders">Orders</TabsTrigger>
        <TabsTrigger value="shipments">Shipments</TabsTrigger>
        <TabsTrigger value="payments">Payments</TabsTrigger>
        <TabsTrigger value="messages">Messages</TabsTrigger>
      </TabsList>

      <TabsContent value="orders">
        <div className="overflow-hidden rounded-xl border bg-white">
          <DataTable
            columns={orderColumns}
            data={activity.orders}
            emptyMessage="No orders yet."
            onRowClick={(r) => router.push(`/dealer-orders/${r.id}`)}
          />
        </div>
      </TabsContent>

      <TabsContent value="shipments">
        <div className="overflow-hidden rounded-xl border bg-white">
          <DataTable
            columns={shipmentColumns}
            data={activity.shipments}
            emptyMessage="No shipments yet."
          />
        </div>
      </TabsContent>

      <TabsContent value="payments">
        <div className="overflow-hidden rounded-xl border bg-white">
          <DataTable
            columns={paymentColumns}
            data={activity.payments}
            emptyMessage="No payments yet."
          />
        </div>
      </TabsContent>

      <TabsContent value="messages">
        <div className="overflow-hidden rounded-xl border bg-white">
          {activity.messages.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No messages yet.
            </p>
          ) : (
            <ul className="divide-y">
              {activity.messages.map((m: DealerMessage) => (
                <li key={m.id} className="flex gap-3 px-4 py-3">
                  <div className="mt-0.5 shrink-0">
                    {m.direction === 'inbound' ? (
                      <ArrowDownLeft className="h-4 w-4 text-blue-500" />
                    ) : (
                      <ArrowUpRight className="h-4 w-4 text-slate-400" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {m.language && (
                        <Badge variant="outline" className="text-xs">
                          {LANG_LABELS[m.language] ?? m.language.toUpperCase()}
                        </Badge>
                      )}
                      {m.parsed_intent && (
                        <Badge variant="outline" className="text-xs text-slate-500">
                          {m.parsed_intent.replace(/_/g, ' ')}
                        </Badge>
                      )}
                      <span className="text-xs text-slate-400">{timeAgo(m.created_at)}</span>
                    </div>
                    <p
                      className="mt-1 text-sm text-slate-700"
                      title={m.original_text}
                    >
                      {m.original_text}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </TabsContent>
    </Tabs>
  )
}
