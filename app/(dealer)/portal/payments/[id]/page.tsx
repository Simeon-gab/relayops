import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { StatusBadge } from '@/components/admin/status-badge'
import { formatNaira } from '@/lib/utils/format'

type Props = {
  params: Promise<{ id: string }>
}

type ShipmentItem = {
  quantity: number
  products: { sku_code: string; display_name: string } | null
}

type LinkedShipment = {
  id: string
  status: string
  total_amount_naira: number | null
  amount_paid_naira: number
  shipment_items: ShipmentItem[]
}

type PaymentDetail = {
  id: string
  amount_naira: number
  payment_date: string
  payment_method: string | null
  payment_reference: string | null
  source: string
  notes: string | null
  receipt_id: string | null
  shipment_id: string | null
  shipments: LinkedShipment | null
}

const METHOD_LABELS: Record<string, string> = {
  bank_transfer: 'Bank Transfer',
  cash:          'Cash',
  pos:           'POS',
}

function methodLabel(m: string | null): string {
  if (!m) return '—'
  return METHOD_LABELS[m] ?? m.replace(/_/g, ' ')
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-NG', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

export default async function DealerPaymentDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('payments')
    .select(
      'id, amount_naira, payment_date, payment_method, payment_reference, source, notes, receipt_id, shipment_id, shipments!shipment_id(id, status, total_amount_naira, amount_paid_naira, shipment_items(quantity, products(sku_code, display_name)))'
    )
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (error || !data) notFound()

  const payment = data as unknown as PaymentDetail
  const shipment = payment.shipments ?? null

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      {/* Back link */}
      <Link
        href="/portal/payments"
        className="mb-6 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-heading"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to payments
      </Link>

      {/* Heading */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-heading">
          Payment from {formatDate(payment.payment_date)}
        </h1>
      </div>

      {/* Summary cards */}
      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-lg border border-border bg-card px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Amount</p>
          <p className="mt-1 text-lg font-bold text-heading">
            {formatNaira(Number(payment.amount_naira))}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Method</p>
          <p className="mt-1 text-sm font-semibold text-heading">
            {methodLabel(payment.payment_method)}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card px-4 py-3 overflow-hidden">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Reference</p>
          <p className="mt-1 font-mono text-xs font-semibold text-heading break-all">
            {payment.payment_reference ?? '—'}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Date</p>
          <p className="mt-1 text-sm font-semibold text-heading">
            {formatDate(payment.payment_date)}
          </p>
        </div>
      </div>

      {/* Linked shipment */}
      {shipment && (
        <section className="mb-8">
          <h2 className="mb-3 text-base font-semibold text-foreground">Linked shipment</h2>
          <div className="rounded-lg border border-border bg-card px-4 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Link
                  href={`/portal/shipments/${shipment.id}`}
                  className="font-mono text-xs font-medium text-brand-deep hover:underline"
                >
                  ...{shipment.id.slice(-8)}
                </Link>
                <StatusBadge status={shipment.status} />
              </div>
              {shipment.total_amount_naira != null && (
                <span className="text-sm font-semibold text-heading">
                  {formatNaira(Number(shipment.total_amount_naira))}
                </span>
              )}
            </div>
            {shipment.shipment_items.length > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                {shipment.shipment_items
                  .map((i) =>
                    i.products
                      ? `${i.products.sku_code} × ${i.quantity}`
                      : `× ${i.quantity}`
                  )
                  .join(', ')}
              </p>
            )}
            <Link
              href={`/portal/shipments/${shipment.id}`}
              className="mt-3 inline-block text-xs text-brand-deep hover:underline"
            >
              View full shipment →
            </Link>
          </div>
        </section>
      )}

      {/* Linked receipt */}
      {payment.receipt_id && (
        <section className="mb-8">
          <h2 className="mb-3 text-base font-semibold text-foreground">Receipt</h2>
          <div className="rounded-lg border border-border bg-card px-4 py-3">
            <p className="text-sm text-muted-foreground">Receipt on file.</p>
          </div>
        </section>
      )}

      {/* Notes */}
      {payment.notes && (
        <section className="mb-8">
          <h2 className="mb-3 text-base font-semibold text-foreground">Notes</h2>
          <div className="rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground whitespace-pre-line">
            {payment.notes}
          </div>
        </section>
      )}
    </div>
  )
}
