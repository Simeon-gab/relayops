import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { StatusBadge } from '@/components/admin/status-badge'
import { ShipmentStatusActions } from '@/components/admin/shipment-status-actions'
import { DraftMessageButton } from '@/components/admin/draft-message-button'
import { getShipment } from '@/lib/db/shipments'
import { formatNairaCurrency } from '@/lib/utils/format'
import type { ShipmentItemRow, StatusEvent } from '@/types/shipments'

type Props = {
  params: Promise<{ id: string }>
}

const LANG_LABELS: Record<string, string> = { en: 'EN', ha: 'HA', yo: 'YO', ig: 'IG' }

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleDateString('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-NG', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export default async function ShipmentDetailPage({ params }: Props) {
  const { id } = await params
  const shipment = await getShipment(id)

  if (!shipment) notFound()

  const isDealer = shipment.shipment_type === 'dealer'
  const shortId = shipment.id.slice(-8)
  const heading = isDealer ? `Dealer shipment` : `Warehouse transfer`

  const totalItems = shipment.items.reduce((s, i) => s + i.quantity, 0)
  const totalValue = shipment.items.reduce(
    (s, i) => s + i.quantity * (i.unit_price_naira ?? 0),
    0
  )

  return (
    <div className="px-6 py-10">
      {/* Back link */}
      <Link
        href="/shipments"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to shipments
      </Link>

      {/* Header */}
      <div className="mb-8 mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold text-slate-900">
              {heading}{' '}
              <span className="font-mono text-slate-500">#{shortId}</span>
            </h1>
            <StatusBadge status={shipment.status} />
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Dispatched {formatDate(shipment.dispatched_at)} ·{' '}
            {totalItems} unit{totalItems !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isDealer && shipment.destination_dealer && (
            <DraftMessageButton
              label="Draft message"
              dealerId={shipment.destination_dealer.id}
              contextType="shipment"
              contextId={shipment.id}
              draftInput={{
                messageType: 'shipment_dispatched',
                dealerName: shipment.destination_dealer.business_name,
                dealerCity: shipment.destination_city ?? '',
                preferredLanguage: shipment.destination_dealer.preferred_language ?? 'en',
                shipmentItems: shipment.items.map((i: ShipmentItemRow) => ({
                  sku_code: i.sku_code,
                  display_name: i.display_name,
                  quantity: i.quantity,
                  unit_price_naira: i.unit_price_naira,
                })),
                dispatchDate: shipment.dispatched_at ?? undefined,
                originWarehouse: shipment.origin_warehouse.name,
                totalAmountNaira: shipment.total_amount_naira ?? undefined,
              }}
            />
          )}
          <ShipmentStatusActions shipment={{ id: shipment.id, status: shipment.status }} />
        </div>
      </div>

      {/* Stats grid */}
      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border bg-white p-4">
          <p className="text-xs text-slate-500">Origin</p>
          <p className="mt-1 font-mono text-base font-semibold text-slate-900">
            {shipment.origin_warehouse.code}
          </p>
          <p className="text-xs text-slate-400">{shipment.origin_warehouse.name}</p>
        </div>

        <div className="rounded-xl border bg-white p-4">
          <p className="text-xs text-slate-500">Destination</p>
          {isDealer && shipment.destination_dealer ? (
            <>
              <p className="mt-1 text-base font-semibold text-slate-900">
                {shipment.destination_dealer.business_name}
              </p>
              <p className="text-xs text-slate-400">
                {shipment.destination_city}, {shipment.destination_state}
              </p>
            </>
          ) : shipment.destination_warehouse ? (
            <>
              <p className="mt-1 font-mono text-base font-semibold text-slate-900">
                {shipment.destination_warehouse.code}
              </p>
              <p className="text-xs text-slate-400">
                {shipment.destination_warehouse.name}
              </p>
            </>
          ) : (
            <p className="mt-1 text-base font-semibold text-slate-500">—</p>
          )}
        </div>

        {isDealer && (
          <>
            <div className="rounded-xl border bg-white p-4">
              <p className="text-xs text-slate-500">Total amount</p>
              <p className="mt-1 text-base font-semibold tabular-nums text-slate-900">
                {shipment.total_amount_naira != null
                  ? formatNairaCurrency(shipment.total_amount_naira)
                  : '—'}
              </p>
            </div>
            <div className="rounded-xl border bg-white p-4">
              <p className="text-xs text-slate-500">
                {shipment.amount_paid_naira >= (shipment.total_amount_naira ?? 0)
                  ? 'Paid in full'
                  : 'Outstanding'}
              </p>
              {shipment.total_amount_naira != null ? (
                <p
                  className={`mt-1 text-base font-semibold tabular-nums ${
                    shipment.amount_paid_naira < shipment.total_amount_naira
                      ? 'text-amber-600'
                      : 'text-green-700'
                  }`}
                >
                  {formatNairaCurrency(
                    shipment.total_amount_naira - shipment.amount_paid_naira
                  )}
                </p>
              ) : (
                <p className="mt-1 text-base font-semibold text-slate-500">—</p>
              )}
            </div>
          </>
        )}
      </div>

      {/* Shipment items */}
      <div className="mb-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Shipment items
        </h2>
        <div className="overflow-hidden rounded-xl border bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-slate-50 text-left">
                <th className="px-4 py-3 font-medium text-slate-600">SKU</th>
                <th className="px-4 py-3 font-medium text-slate-600">Product</th>
                <th className="px-4 py-3 font-medium text-slate-600">Color</th>
                <th className="px-4 py-3 text-right font-medium text-slate-600">Qty</th>
                {isDealer && (
                  <>
                    <th className="px-4 py-3 text-right font-medium text-slate-600">
                      Unit price
                    </th>
                    <th className="px-4 py-3 text-right font-medium text-slate-600">
                      Subtotal
                    </th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y">
              {shipment.items.length === 0 ? (
                <tr>
                  <td
                    colSpan={isDealer ? 6 : 4}
                    className="py-10 text-center text-sm text-muted-foreground"
                  >
                    No items recorded.
                  </td>
                </tr>
              ) : (
                <>
                  {shipment.items.map((item: ShipmentItemRow) => (
                    <tr key={item.product_id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs text-slate-600">
                          {item.sku_code}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {item.display_name}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {item.color ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="tabular-nums font-semibold">{item.quantity}</span>
                      </td>
                      {isDealer && (
                        <>
                          <td className="px-4 py-3 text-right tabular-nums text-slate-600">
                            {item.unit_price_naira != null
                              ? formatNairaCurrency(item.unit_price_naira)
                              : '—'}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                            {item.unit_price_naira != null
                              ? formatNairaCurrency(item.quantity * item.unit_price_naira)
                              : '—'}
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                  <tr className="border-t-2 bg-slate-50">
                    <td
                      colSpan={isDealer ? 3 : 3}
                      className="px-4 py-3 text-sm font-semibold text-slate-700"
                    >
                      Total
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="tabular-nums font-bold">{totalItems}</span>
                    </td>
                    {isDealer && (
                      <>
                        <td />
                        <td className="px-4 py-3 text-right">
                          <span className="tabular-nums font-bold">
                            {totalValue > 0 ? formatNairaCurrency(totalValue) : '—'}
                          </span>
                        </td>
                      </>
                    )}
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Timeline */}
      <div className="mb-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Timeline
        </h2>
        <div className="rounded-xl border bg-white px-4 py-4">
          {shipment.status_events.length === 0 ? (
            <p className="text-sm text-slate-400">No status events recorded.</p>
          ) : (
            <ol className="space-y-0">
              {shipment.status_events.map((ev: StatusEvent, idx) => (
                <li key={ev.id} className="flex gap-3">
                  {/* Connector line */}
                  <div className="flex flex-col items-center">
                    <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-slate-400" />
                    {idx < shipment.status_events.length - 1 && (
                      <div className="w-px flex-1 bg-slate-200" />
                    )}
                  </div>
                  <div className="pb-5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={ev.to_status} />
                      <span className="text-xs text-slate-400">
                        {formatDateTime(ev.event_at)}
                      </span>
                      <span className="text-xs text-slate-400 capitalize">
                        via {ev.source.replace(/_/g, ' ')}
                      </span>
                    </div>
                    {ev.notes && (
                      <p className="mt-1 text-sm text-slate-500">{ev.notes}</p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      {/* Destination details */}
      <div className="mb-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Destination details
        </h2>
        <div className="rounded-xl border bg-white px-4 py-4">
          {isDealer && shipment.destination_dealer ? (
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
              <div>
                <dt className="text-xs text-slate-500">Business</dt>
                <dd className="mt-0.5 text-sm font-medium">
                  <Link
                    href={`/dealers/${shipment.destination_dealer.id}`}
                    className="text-blue-600 hover:underline"
                  >
                    {shipment.destination_dealer.business_name}
                  </Link>
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Contact</dt>
                <dd className="mt-0.5 text-sm font-medium">
                  {shipment.destination_dealer.contact_name}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Phone</dt>
                <dd className="mt-0.5 text-sm font-medium">
                  {shipment.destination_dealer.phone}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Location</dt>
                <dd className="mt-0.5 text-sm font-medium">
                  {shipment.destination_dealer.city}, {shipment.destination_dealer.state}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Language</dt>
                <dd className="mt-0.5 text-sm font-medium">
                  {LANG_LABELS[shipment.destination_dealer.preferred_language] ??
                    shipment.destination_dealer.preferred_language.toUpperCase()}
                </dd>
              </div>
            </dl>
          ) : shipment.destination_warehouse ? (
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
              <div>
                <dt className="text-xs text-slate-500">Warehouse</dt>
                <dd className="mt-0.5 font-mono text-sm font-medium">
                  {shipment.destination_warehouse.code}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Name</dt>
                <dd className="mt-0.5 text-sm font-medium">
                  {shipment.destination_warehouse.name}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-slate-400">No destination details available.</p>
          )}
        </div>
      </div>

      {/* Notes */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Notes
        </h2>
        <div className="rounded-xl border bg-white px-4 py-4">
          {shipment.notes ? (
            <p className="text-sm text-slate-700">{shipment.notes}</p>
          ) : (
            <p className="text-sm text-slate-400">No notes.</p>
          )}
        </div>
      </div>
    </div>
  )
}
