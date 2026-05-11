import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { StatusBadge } from '@/components/admin/status-badge'
import { formatNaira } from '@/lib/utils/format'

type OrderRow = {
  id: string
  status: string
  created_at: string
  dealer_order_items: Array<{
    id: string
    unit_price_naira: number | null
    quantity_requested: number
  }>
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-NG', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function computeTotal(items: OrderRow['dealer_order_items']): string {
  if (!items.length) return '—'
  if (items.some((i) => i.unit_price_naira == null)) return '—'
  const sum = items.reduce(
    (acc, i) => acc + Number(i.unit_price_naira) * i.quantity_requested,
    0
  )
  return formatNaira(sum)
}

export default async function DealerOrdersPage() {
  const supabase = await createClient()

  const { data } = await supabase
    .from('dealer_orders')
    .select('id, status, created_at, dealer_order_items(id, unit_price_naira, quantity_requested)')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  const orders = (data ?? []) as unknown as OrderRow[]

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-heading">My Orders</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Orders you&apos;ve placed with Hungkee Motorcycle.
        </p>
      </div>

      {orders.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-6">
          <p className="text-sm text-muted-foreground">
            You have no orders yet. Orders will appear here once placed.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-subtle text-left">
                <th className="px-4 py-3 font-medium text-muted-foreground">Order ID</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Date</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Items</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Total</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {orders.map((order) => (
                <tr key={order.id} className="hover:bg-subtle">
                  <td className="px-4 py-3">
                    <Link
                      href={`/portal/orders/${order.id}`}
                      className="font-mono text-xs text-brand-deep hover:underline"
                    >
                      ...{order.id.slice(-8)}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/portal/orders/${order.id}`} className="block w-full text-xs text-muted-foreground">
                      {formatDate(order.created_at)}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/portal/orders/${order.id}`} className="block w-full tabular-nums text-foreground">
                      {order.dealer_order_items.length}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/portal/orders/${order.id}`} className="block w-full tabular-nums text-foreground">
                      {computeTotal(order.dealer_order_items)}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/portal/orders/${order.id}`} className="block w-full">
                      <StatusBadge status={order.status} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
