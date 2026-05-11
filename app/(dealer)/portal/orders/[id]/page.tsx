import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getDealerOrder } from '@/lib/db/dealer-orders'
import { StatusBadge } from '@/components/admin/status-badge'
import { formatNaira, formatNairaCurrency } from '@/lib/utils/format'
import type { DealerOrderItemDetail } from '@/types/dealer-orders'

type Props = {
  params: Promise<{ id: string }>
}

type AuditEntry = {
  id: string
  action: string
  created_at: string
  changes: {
    from?: string
    to?: string
    reason?: string
    triggered_by_shipment_id?: string
  } | null
}

const SOURCE_LABELS: Record<string, string> = {
  admin_entry:    'Admin entry',
  message_parsed: 'AI-parsed message',
  dealer_portal:  'Dealer portal',
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

function lineStatus(item: DealerOrderItemDetail): string {
  if (item.quantity_fulfilled >= item.quantity_requested) return 'fulfilled'
  if (item.quantity_fulfilled > 0) return 'partially_fulfilled'
  return 'pending'
}

function computeOrderTotal(items: DealerOrderItemDetail[]): string {
  if (!items.length) return '—'
  if (items.some((i) => i.unit_price_naira == null)) return '—'
  const sum = items.reduce(
    (acc, i) => acc + Number(i.unit_price_naira) * i.quantity_requested,
    0
  )
  return formatNaira(sum)
}

const STATUS_LABELS: Record<string, string> = {
  pending:              'Pending',
  partially_fulfilled:  'Partially fulfilled',
  fulfilled:            'Fulfilled',
  cancelled:            'Cancelled',
}

function statusLabel(s: string): string {
  return STATUS_LABELS[s] ?? s.replace(/_/g, ' ')
}

export default async function DealerOrderDetailPage({ params }: Props) {
  const { id } = await params

  const supabase = await createClient()

  const [order, auditResult] = await Promise.all([
    getDealerOrder(id),
    supabase
      .from('audit_log')
      .select('id, action, created_at, changes')
      .eq('entity_type', 'dealer_order')
      .eq('entity_id', id)
      .in('action', ['order_status_changed', 'order_auto_fulfilled'])
      .order('created_at', { ascending: false }),
  ])

  if (!order) notFound()

  const auditEntries = (!auditResult.error ? auditResult.data ?? [] : []) as unknown as AuditEntry[]

  const itemCount = order.items.length
  const totalValue = computeOrderTotal(order.items)
  const sourceLabel = SOURCE_LABELS[order.source] ?? order.source.replace(/_/g, ' ')

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      {/* Back link */}
      <Link
        href="/portal/orders"
        className="mb-6 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-heading"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to orders
      </Link>

      {/* Heading */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold text-heading">
          Order ...{order.id.slice(-8)}
        </h1>
        <StatusBadge status={order.status} className="text-sm" />
      </div>

      {/* Summary card */}
      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-lg border border-border bg-card px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Date placed</p>
          <p className="mt-1 text-sm font-semibold text-heading">{formatDate(order.requested_at)}</p>
        </div>
        <div className="rounded-lg border border-border bg-card px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Total value</p>
          <p className="mt-1 text-sm font-semibold text-heading">{totalValue}</p>
        </div>
        <div className="rounded-lg border border-border bg-card px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Items</p>
          <p className="mt-1 text-sm font-semibold text-heading">{itemCount}</p>
        </div>
        <div className="rounded-lg border border-border bg-card px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Source</p>
          <p className="mt-1 text-sm font-semibold text-heading capitalize">{sourceLabel}</p>
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
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Qty requested</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Qty fulfilled</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Unit price</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {order.items.map((item) => (
                <tr key={item.id} className="hover:bg-subtle">
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{item.sku_code}</td>
                  <td className="px-4 py-3">
                    <span className="font-medium text-heading">{item.display_name}</span>
                    <span className="ml-1.5 text-xs text-muted-foreground capitalize">{item.category}</span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{item.color ?? '—'}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-foreground">
                    {item.quantity_requested}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-foreground">
                    {item.quantity_fulfilled}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                    {item.unit_price_naira != null ? formatNairaCurrency(item.unit_price_naira) : '—'}
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

      {/* Notes */}
      {order.notes && (
        <section className="mb-8">
          <h2 className="mb-3 text-base font-semibold text-foreground">Notes</h2>
          <div className="rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground whitespace-pre-line">
            {order.notes}
          </div>
        </section>
      )}

      {/* Status history */}
      <section className="mb-8">
        <h2 className="mb-3 text-base font-semibold text-foreground">Status history</h2>
        {auditEntries.length === 0 ? (
          <div className="rounded-lg border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
            No status changes recorded.
          </div>
        ) : (
          <div className="divide-y divide-border rounded-lg border border-border bg-card">
            {auditEntries.map((entry) => {
              const from = entry.changes?.from
              const to = entry.changes?.to
              const reason = entry.changes?.reason
              const isAuto = entry.action === 'order_auto_fulfilled'

              return (
                <div key={entry.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <span className="text-sm font-medium text-heading">
                      {from
                        ? `${statusLabel(from)} → ${statusLabel(to ?? '')}`
                        : statusLabel(to ?? '')}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDateTime(entry.created_at)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {isAuto ? 'Auto-updated when shipment was marked delivered' : 'Updated by Hungkee team'}
                  </p>
                  {reason && (
                    <p className="mt-1 text-sm italic text-muted-foreground">{reason}</p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
