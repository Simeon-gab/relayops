import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getDealerOrder, getOrderLinkedShipments } from '@/lib/db/dealer-orders'
import { getWarehouses } from '@/lib/db/warehouses'
import { getWarehouseStockForProducts } from '@/lib/db/warehouses'
import { StatusBadge } from '@/components/admin/status-badge'
import { OrderStatusActions } from '@/components/admin/order-status-actions'
import { OrderStatusHistory } from '@/components/admin/order-status-history'
import { DraftMessageButton } from '@/components/admin/draft-message-button'
import { CreateShipmentFromOrder } from '@/components/admin/create-shipment-from-order'
import type { DealerOrderItemDetail } from '@/types/dealer-orders'

type Props = {
  params: Promise<{ id: string }>
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-NG', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function formatNaira(n: number | null): string {
  if (n == null) return '—'
  return `₦${n.toLocaleString()}`
}

function lineStatus(item: DealerOrderItemDetail): string {
  if (item.quantity_fulfilled >= item.quantity_requested) return 'fulfilled'
  if (item.quantity_fulfilled > 0) return 'partially_fulfilled'
  return 'pending'
}

export default async function DealerOrderDetailPage({ params }: Props) {
  const { id } = await params
  const [order, warehouses, linkedShipments] = await Promise.all([
    getDealerOrder(id),
    getWarehouses(),
    getOrderLinkedShipments(id),
  ])
  if (!order) notFound()

  const productIds = order.items.map((i) => i.product_id)
  const stockEntries = await Promise.all(
    warehouses.map(async (w) => {
      const stockMap = await getWarehouseStockForProducts(w.id, productIds)
      return [w.id, Object.fromEntries(stockMap)] as [string, Record<string, number>]
    })
  )
  const stockByWarehouse: Record<string, Record<string, number>> = Object.fromEntries(stockEntries)

  const totalQty = order.items.reduce((s, i) => s + i.quantity_requested, 0)
  const totalFulfilled = order.items.reduce((s, i) => s + i.quantity_fulfilled, 0)
  const totalRemaining = totalQty - totalFulfilled

  return (
    <div className="px-6 py-10">
      {/* Back link */}
      <Link
        href="/dealer-orders"
        className="mb-6 flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to orders
      </Link>

      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              Order from {order.business_name}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {order.city}, {order.state} &middot; {formatDate(order.requested_at)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge status={order.status} className="text-sm" />
            <OrderStatusActions order={{ id: order.id, status: order.status }} />
            <CreateShipmentFromOrder
              order={order}
              warehouses={warehouses}
              stockByWarehouse={stockByWarehouse}
            />
            {order.status === 'pending' && (
              <DraftMessageButton
                label="Confirm order received"
                dealerId={order.dealer_id}
                contextType="dealer_order"
                contextId={order.id}
                draftInput={{
                  messageType: 'order_received',
                  dealerName: order.business_name,
                  dealerCity: order.city,
                  preferredLanguage: order.preferred_language,
                  orderItems: order.items.map((i: DealerOrderItemDetail) => ({
                    sku_code: i.sku_code,
                    display_name: i.display_name,
                    quantity: i.quantity_requested,
                  })),
                }}
              />
            )}
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="mb-8 grid grid-cols-3 gap-4 sm:grid-cols-3 lg:w-2/3">
        <div className="rounded-lg border bg-white px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Total qty</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{totalQty}</p>
        </div>
        <div className="rounded-lg border bg-white px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Fulfilled</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-green-700">{totalFulfilled}</p>
        </div>
        <div className="rounded-lg border bg-white px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Remaining</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-amber-700">{totalRemaining}</p>
        </div>
      </div>

      {/* Items section */}
      <section className="mb-8">
        <h2 className="mb-3 text-base font-semibold text-slate-800">Items</h2>
        <div className="overflow-hidden rounded-xl border bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-slate-50 text-left">
                <th className="px-4 py-3 font-medium text-slate-600">SKU</th>
                <th className="px-4 py-3 font-medium text-slate-600">Product</th>
                <th className="px-4 py-3 font-medium text-slate-600">Color</th>
                <th className="px-4 py-3 text-right font-medium text-slate-600">Qty requested</th>
                <th className="px-4 py-3 text-right font-medium text-slate-600">Qty fulfilled</th>
                <th className="px-4 py-3 font-medium text-slate-600">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {order.items.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">{item.sku_code}</td>
                  <td className="px-4 py-3">
                    <span className="font-medium text-slate-900">{item.display_name}</span>
                    <span className="ml-1.5 text-xs text-slate-400 capitalize">{item.category}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{item.color ?? '—'}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium text-slate-900">
                    {item.quantity_requested}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium text-slate-900">
                    {item.quantity_fulfilled}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={lineStatus(item)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Notes section */}
      {order.notes && (
        <section className="mb-8">
          <h2 className="mb-3 text-base font-semibold text-slate-800">Notes</h2>
          <div className="rounded-xl border bg-white px-4 py-3 text-sm text-slate-600 whitespace-pre-line">
            {order.notes}
          </div>
        </section>
      )}

      {/* Status history */}
      <OrderStatusHistory orderId={order.id} />

      {/* Linked shipments */}
      <section className="mt-8">
        <h2 className="mb-3 text-base font-semibold text-slate-800">Linked shipments</h2>
        {linkedShipments.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-white px-4 py-8 text-center text-sm text-slate-400">
            No shipments yet.{' '}
            {(order.status === 'pending' || order.status === 'partially_fulfilled') && totalRemaining > 0
              ? "Click 'Create shipment' above to start dispatching."
              : ''}
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50 text-left">
                  <th className="px-4 py-3 font-medium text-slate-600">Shipment ID</th>
                  <th className="px-4 py-3 font-medium text-slate-600">Status</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-600">Total</th>
                  <th className="px-4 py-3 font-medium text-slate-600">Dispatched</th>
                  <th className="px-4 py-3 font-medium text-slate-600">Delivered</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {linkedShipments.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/shipments/${s.id}`}
                        className="font-mono text-xs text-blue-600 hover:underline"
                      >
                        {s.id.slice(0, 8)}…
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={s.status} />
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                      {formatNaira(s.total_amount_naira)}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">
                      {s.dispatched_at ? formatDate(s.dispatched_at) : '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">
                      {s.delivered_at ? formatDate(s.delivered_at) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
