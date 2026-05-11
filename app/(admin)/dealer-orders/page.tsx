import Link from 'next/link'
import { getDealerOrders } from '@/lib/db/dealer-orders'
import { StatusBadge } from '@/components/admin/status-badge'
import { PageHeader } from '@/components/admin/page-header'
import { cn } from '@/lib/utils'

type Props = {
  searchParams: Promise<{ status?: string }>
}

const STATUS_PILLS = [
  { label: 'All',       value: 'all' },
  { label: 'Pending',   value: 'pending' },
  { label: 'Partial',   value: 'partially_fulfilled' },
  { label: 'Fulfilled', value: 'fulfilled' },
  { label: 'Cancelled', value: 'cancelled' },
]

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-NG', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function formatSummary(items: Array<{ sku_code: string; quantity: number }>): string {
  if (!items.length) return '—'
  const parts = items.slice(0, 3).map((i) => `${i.quantity}× ${i.sku_code}`)
  return items.length > 3 ? parts.join(', ') + '…' : parts.join(', ')
}

export default async function DealerOrdersPage({ searchParams }: Props) {
  const { status } = await searchParams
  const activeStatus = status && status !== 'all' ? status : undefined
  const orders = await getDealerOrders(activeStatus)

  const activeFilter = status ?? 'all'

  return (
    <div className="px-6 py-10">
      <PageHeader
        title="Dealer orders"
        subtitle="Orders received from across the dealer network"
      />

      {/* Filter pills */}
      <div className="mb-6 flex flex-wrap gap-2">
        {STATUS_PILLS.map(({ label, value }) => {
          const isCurrent = activeFilter === value
          return (
            <Link
              key={value}
              href={value === 'all' ? '/dealer-orders' : `/dealer-orders?status=${value}`}
              className={cn(
                'rounded-full border px-3 py-1 text-sm font-medium transition-colors',
                isCurrent
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400 hover:text-slate-900'
              )}
            >
              {label}
            </Link>
          )
        })}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-subtle text-left">
              <th className="px-4 py-3 font-medium text-slate-600">Order date</th>
              <th className="px-4 py-3 font-medium text-slate-600">Dealer</th>
              <th className="px-4 py-3 font-medium text-slate-600">Items</th>
              <th className="px-4 py-3 text-right font-medium text-slate-600">Total qty</th>
              <th className="px-4 py-3 font-medium text-slate-600">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {orders.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-12 text-center text-sm text-muted-foreground">
                  No orders found.
                </td>
              </tr>
            ) : (
              orders.map((order) => (
                <tr
                  key={order.id}
                  className="hover:bg-subtle"
                >
                  <td className="px-4 py-3">
                    <Link href={`/dealer-orders/${order.id}`} className="block w-full">
                      <span className="text-slate-600">{formatDate(order.requested_at)}</span>
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/dealer-orders/${order.id}`} className="block w-full">
                      <span className="font-medium text-slate-900">{order.business_name}</span>
                      <span className="block text-xs text-slate-500">{order.city}, {order.state}</span>
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/dealer-orders/${order.id}`} className="block w-full">
                      <span className="font-mono text-xs text-slate-600">
                        {formatSummary(order.items)}
                      </span>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/dealer-orders/${order.id}`} className="block w-full">
                      <span className="tabular-nums font-semibold text-slate-900">
                        {order.total_qty}
                      </span>
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/dealer-orders/${order.id}`} className="block w-full">
                      <StatusBadge status={order.status} />
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
