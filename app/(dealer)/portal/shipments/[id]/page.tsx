import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { StatusBadge } from '@/components/admin/status-badge'
import { formatNaira } from '@/lib/utils/format'

type Props = {
  params: Promise<{ id: string }>
}

type ShipmentDetail = {
  id: string
  status: string
  dispatched_at: string | null
  delivered_at: string | null
  total_amount_naira: number | null
  amount_paid_naira: number
  notes: string | null
  created_at: string
  shipment_items: Array<{
    quantity: number
    products: {
      sku_code: string
      display_name: string
      color: string | null
      category: string
    } | null
  }>
}

type StatusEventRow = {
  id: string
  from_status: string | null
  to_status: string
  event_at: string
  source: string
  notes: string | null
}

const SHIPMENT_STATUS_LABELS: Record<string, string> = {
  pending:    'Pending',
  dispatched: 'Dispatched',
  in_transit: 'In transit',
  delivered:  'Delivered',
  cancelled:  'Cancelled',
}

function statusLabel(s: string): string {
  return SHIPMENT_STATUS_LABELS[s] ?? s.replace(/_/g, ' ')
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-NG', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-NG', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

export default async function DealerShipmentDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const [shipmentResult, eventsResult] = await Promise.all([
    supabase
      .from('shipments')
      .select(
        'id, status, dispatched_at, delivered_at, total_amount_naira, amount_paid_naira, notes, created_at, shipment_items(quantity, products(sku_code, display_name, color, category))'
      )
      .eq('id', id)
      .eq('shipment_type', 'dealer')
      .is('deleted_at', null)
      .single(),

    supabase
      .from('status_events')
      .select('id, from_status, to_status, event_at, source, notes')
      .eq('shipment_id', id)
      .order('event_at', { ascending: false }),
  ])

  if (shipmentResult.error || !shipmentResult.data) notFound()

  const shipment = shipmentResult.data as unknown as ShipmentDetail
  const events = (!eventsResult.error ? eventsResult.data ?? [] : []) as unknown as StatusEventRow[]

  const total = shipment.total_amount_naira != null ? Number(shipment.total_amount_naira) : null
  const paid = Number(shipment.amount_paid_naira)
  const outstanding = total != null ? total - paid : null
  const isPaidInFull = outstanding != null && outstanding <= 0
  const itemCount = shipment.shipment_items.length

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      {/* Back link */}
      <Link
        href="/portal/shipments"
        className="mb-6 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-heading"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to shipments
      </Link>

      {/* Heading */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold text-heading">
          Shipment ...{shipment.id.slice(-8)}
        </h1>
        <StatusBadge status={shipment.status} className="text-sm" />
      </div>

      {/* Summary cards */}
      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-lg border border-border bg-card px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Dispatched</p>
          <p className="mt-1 text-sm font-semibold text-heading">
            {shipment.dispatched_at ? formatDate(shipment.dispatched_at) : 'Not yet dispatched'}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Delivered</p>
          <p className="mt-1 text-sm font-semibold text-heading">
            {shipment.delivered_at ? formatDate(shipment.delivered_at) : 'Pending'}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Items</p>
          <p className="mt-1 text-sm font-semibold text-heading">{itemCount}</p>
        </div>
        <div className="rounded-lg border border-border bg-card px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Balance</p>
          {outstanding == null ? (
            <p className="mt-1 text-sm font-semibold text-heading">—</p>
          ) : isPaidInFull ? (
            <p className="mt-1 text-sm font-semibold text-green-600">Paid in full</p>
          ) : (
            <p className="mt-1 text-sm font-semibold text-heading">{formatNaira(outstanding)}</p>
          )}
        </div>
      </div>

      {/* Items table */}
      <section className="mb-8">
        <h2 className="mb-3 text-base font-semibold text-foreground">Items</h2>
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-subtle text-left">
                <th className="px-4 py-3 font-medium text-muted-foreground">SKU</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Product</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Color</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Quantity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {shipment.shipment_items.map((item, idx) => (
                <tr key={idx} className="hover:bg-subtle">
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {item.products?.sku_code ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-medium text-heading">{item.products?.display_name ?? '—'}</span>
                    <span className="ml-1.5 text-xs text-muted-foreground capitalize">
                      {item.products?.category ?? ''}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{item.products?.color ?? '—'}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-foreground">{item.quantity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Notes */}
      {shipment.notes && (
        <section className="mb-8">
          <h2 className="mb-3 text-base font-semibold text-foreground">Notes</h2>
          <div className="rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground whitespace-pre-line">
            {shipment.notes}
          </div>
        </section>
      )}

      {/* Status history */}
      <section className="mb-8">
        <h2 className="mb-3 text-base font-semibold text-foreground">Status history</h2>
        {events.length === 0 ? (
          <div className="rounded-lg border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
            No status changes recorded.
          </div>
        ) : (
          <div className="divide-y divide-border rounded-lg border border-border bg-card">
            {events.map((event) => (
              <div key={event.id} className="px-4 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <span className="text-sm font-medium text-heading">
                    {event.from_status
                      ? `${statusLabel(event.from_status)} → ${statusLabel(event.to_status)}`
                      : statusLabel(event.to_status)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDateTime(event.event_at)}
                  </span>
                </div>
                {event.notes && (
                  <p className="mt-1 text-sm italic text-muted-foreground">{event.notes}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
