import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, ArrowDownLeft, ArrowUpRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { DataTable } from '@/components/admin/data-table'
import { StatusBadge } from '@/components/admin/status-badge'
import { getDealer, getDealerActivity } from '@/lib/db/dealers'
import { formatNaira, formatNairaCurrency } from '@/lib/utils/format'
import type { DealerShipment, DealerPayment, DealerMessage, DealerOrder } from '@/types/dealers'

type Props = {
  params: Promise<{ id: string }>
}

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

export default async function DealerDetailPage({ params }: Props) {
  const { id } = await params

  const [dealer, activity] = await Promise.all([
    getDealer(id),
    getDealerActivity(id),
  ])

  if (!dealer) notFound()

  const stats = [
    { label: 'Total shipments', value: dealer.total_shipments },
    { label: 'Active shipments', value: dealer.active_shipments },
    {
      label: 'Total paid',
      value: formatNaira(dealer.total_paid_naira),
    },
    {
      label: 'Outstanding',
      value: formatNaira(dealer.outstanding_balance_naira),
      highlight: dealer.outstanding_balance_naira > 0,
    },
  ]

  // ── Tab: Shipments ──────────────────────────────────────────────────────────
  const shipmentColumns = [
    {
      header: 'ID',
      cell: (r: DealerShipment) => (
        <span className="font-mono text-xs text-slate-500">…{shortId(r.id)}</span>
      ),
    },
    {
      header: 'Status',
      cell: (r: DealerShipment) => <StatusBadge status={r.status} />,
    },
    {
      header: 'Dispatched',
      cell: (r: DealerShipment) => (
        <span className="text-slate-600">
          {r.dispatched_at ? formatDate(r.dispatched_at) : '—'}
        </span>
      ),
    },
    {
      header: 'Total',
      className: 'text-right',
      cell: (r: DealerShipment) => (
        <span className="tabular-nums">
          {r.total_amount_naira != null ? formatNairaCurrency(r.total_amount_naira) : '—'}
        </span>
      ),
    },
    {
      header: 'Paid',
      className: 'text-right',
      cell: (r: DealerShipment) => (
        <span className="tabular-nums">{formatNairaCurrency(r.amount_paid_naira)}</span>
      ),
    },
    {
      header: 'Items',
      className: 'text-right',
      cell: (r: DealerShipment) => (
        <span className="tabular-nums">{r.item_count}</span>
      ),
    },
  ]

  // ── Tab: Payments ───────────────────────────────────────────────────────────
  const paymentColumns = [
    {
      header: 'Date',
      cell: (r: DealerPayment) => (
        <span className="text-slate-600">{formatDate(r.payment_date)}</span>
      ),
    },
    {
      header: 'Amount',
      cell: (r: DealerPayment) => (
        <span className="tabular-nums font-semibold">
          {formatNairaCurrency(r.amount_naira)}
        </span>
      ),
    },
    {
      header: 'Reference',
      cell: (r: DealerPayment) => (
        <span className="font-mono text-xs text-slate-500">
          {r.payment_reference ?? '—'}
        </span>
      ),
    },
    {
      header: 'Shipment',
      cell: (r: DealerPayment) => (
        <span className="font-mono text-xs text-slate-500">
          {r.shipment_id ? `…${shortId(r.shipment_id)}` : '—'}
        </span>
      ),
    },
  ]

  // ── Tab: Orders ─────────────────────────────────────────────────────────────
  const orderColumns = [
    {
      header: 'Date',
      cell: (r: DealerOrder) => (
        <span className="text-slate-600">{formatDate(r.requested_at)}</span>
      ),
    },
    {
      header: 'Status',
      cell: (r: DealerOrder) => <StatusBadge status={r.status} />,
    },
    {
      header: 'Items',
      className: 'text-right',
      cell: (r: DealerOrder) => (
        <span className="tabular-nums">{r.item_count}</span>
      ),
    },
  ]

  return (
    <div className="px-6 py-10">
      {/* Back link */}
      <Link
        href="/dealers"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to dealers
      </Link>

      {/* Header */}
      <div className="mb-8 mt-4">
        <h1 className="text-2xl font-semibold text-slate-900">
          {dealer.business_name}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {dealer.contact_name} · {dealer.phone}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge variant="outline" className="text-slate-600">
            {dealer.city}, {dealer.state}
          </Badge>
          <Badge variant="outline">
            {LANG_LABELS[dealer.preferred_language] ?? dealer.preferred_language.toUpperCase()}
          </Badge>
          <Badge variant="secondary" className="font-mono text-xs">
            Served by {dealer.served_by_warehouse_name}
          </Badge>
        </div>
      </div>

      {/* Stats grid */}
      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map(({ label, value, highlight }) => (
          <div key={label} className="rounded-xl border bg-white p-4">
            <p className="text-xs text-slate-500">{label}</p>
            <p
              className={`mt-1 text-xl font-semibold tabular-nums ${
                highlight ? 'text-amber-600' : 'text-slate-900'
              }`}
            >
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="shipments">
        <TabsList className="mb-4">
          <TabsTrigger value="shipments">Shipments</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="messages">Messages</TabsTrigger>
          <TabsTrigger value="orders">Orders</TabsTrigger>
        </TabsList>

        {/* Shipments tab */}
        <TabsContent value="shipments">
          <div className="overflow-hidden rounded-xl border bg-white">
            <DataTable
              columns={shipmentColumns}
              data={activity.shipments}
              emptyMessage="No shipments yet."
            />
          </div>
        </TabsContent>

        {/* Payments tab */}
        <TabsContent value="payments">
          <div className="overflow-hidden rounded-xl border bg-white">
            <DataTable
              columns={paymentColumns}
              data={activity.payments}
              emptyMessage="No payments yet."
            />
          </div>
        </TabsContent>

        {/* Messages tab */}
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
                          <Badge
                            variant="outline"
                            className="text-xs text-slate-500"
                          >
                            {m.parsed_intent.replace(/_/g, ' ')}
                          </Badge>
                        )}
                        <span className="text-xs text-slate-400">
                          {timeAgo(m.created_at)}
                        </span>
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

        {/* Orders tab */}
        <TabsContent value="orders">
          <div className="overflow-hidden rounded-xl border bg-white">
            <DataTable
              columns={orderColumns}
              data={activity.orders}
              emptyMessage="No orders yet."
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
