import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getPayment } from '@/lib/db/payments'
import { StatusBadge } from '@/components/admin/status-badge'
import { formatNairaCurrency } from '@/lib/utils/format'

type Props = {
  params: Promise<{ id: string }>
}

const METHOD_LABELS: Record<string, string> = {
  bank_transfer: 'Bank transfer',
  cash: 'Cash',
  pos: 'POS',
}

const SOURCE_LABELS: Record<string, string> = {
  admin_manual: 'Manual entry',
  receipt_extraction: 'Receipt extraction',
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

function shortId(id: string): string {
  return id.slice(-8)
}

export default async function PaymentDetailPage({ params }: Props) {
  const { id } = await params
  const payment = await getPayment(id)
  if (!payment) notFound()

  return (
    <div className="px-6 py-10">
      {/* Back link */}
      <Link
        href="/payments"
        className="mb-6 flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to payments
      </Link>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-900">
          Payment of {formatNairaCurrency(payment.amount_naira)}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          <Link
            href={`/dealers/${payment.dealer_id}`}
            className="font-medium text-slate-700 hover:underline"
          >
            {payment.business_name}
          </Link>
          {' '}·{' '}{payment.city}
          {' '}·{' '}{formatDate(payment.payment_date)}
          {' '}·{' '}{payment.payment_method ? (METHOD_LABELS[payment.payment_method] ?? payment.payment_method) : 'Unknown method'}
          {payment.payment_reference && (
            <span className="ml-1 font-mono text-xs text-slate-400">
              ({payment.payment_reference})
            </span>
          )}
        </p>
      </div>

      {/* Details grid */}
      <section className="mb-8">
        <h2 className="mb-3 text-base font-semibold text-slate-800">Details</h2>
        <div className="overflow-hidden rounded-xl border bg-white">
          <dl className="divide-y">
            {[
              { label: 'Amount', value: formatNairaCurrency(payment.amount_naira) },
              { label: 'Payment date', value: formatDate(payment.payment_date) },
              {
                label: 'Method',
                value: payment.payment_method
                  ? (METHOD_LABELS[payment.payment_method] ?? payment.payment_method)
                  : '—',
              },
              { label: 'Reference', value: payment.payment_reference ?? '—' },
              { label: 'Source', value: SOURCE_LABELS[payment.source] ?? payment.source },
              {
                label: 'Dealer',
                value: (
                  <Link
                    href={`/dealers/${payment.dealer_id}`}
                    className="text-slate-700 hover:underline"
                  >
                    {payment.business_name}, {payment.city}
                  </Link>
                ),
              },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-baseline gap-4 px-4 py-3">
                <dt className="w-32 shrink-0 text-xs font-medium uppercase tracking-wide text-slate-400">
                  {label}
                </dt>
                <dd className="text-sm text-slate-900">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Notes */}
      {payment.notes && (
        <section className="mb-8">
          <h2 className="mb-3 text-base font-semibold text-slate-800">Notes</h2>
          <div className="rounded-xl border bg-white px-4 py-3 text-sm text-slate-600 whitespace-pre-line">
            {payment.notes}
          </div>
        </section>
      )}

      {/* Linked shipment */}
      {payment.shipment_id && (
        <section className="mb-8">
          <h2 className="mb-3 text-base font-semibold text-slate-800">Linked shipment</h2>
          <div className="overflow-hidden rounded-xl border bg-white">
            <dl className="divide-y">
              <div className="flex items-baseline gap-4 px-4 py-3">
                <dt className="w-32 shrink-0 text-xs font-medium uppercase tracking-wide text-slate-400">Shipment</dt>
                <dd className="text-sm">
                  <Link
                    href={`/shipments/${payment.shipment_id}`}
                    className="font-mono text-slate-700 hover:underline"
                  >
                    …{shortId(payment.shipment_id)}
                  </Link>
                </dd>
              </div>
              {payment.shipment_status && (
                <div className="flex items-baseline gap-4 px-4 py-3">
                  <dt className="w-32 shrink-0 text-xs font-medium uppercase tracking-wide text-slate-400">Status</dt>
                  <dd><StatusBadge status={payment.shipment_status} /></dd>
                </div>
              )}
              {payment.shipment_dispatched_at && (
                <div className="flex items-baseline gap-4 px-4 py-3">
                  <dt className="w-32 shrink-0 text-xs font-medium uppercase tracking-wide text-slate-400">Dispatched</dt>
                  <dd className="text-sm text-slate-900">{formatDate(payment.shipment_dispatched_at)}</dd>
                </div>
              )}
              {payment.shipment_total != null && (
                <div className="flex items-baseline gap-4 px-4 py-3">
                  <dt className="w-32 shrink-0 text-xs font-medium uppercase tracking-wide text-slate-400">Total</dt>
                  <dd className="text-sm tabular-nums text-slate-900">{formatNairaCurrency(payment.shipment_total)}</dd>
                </div>
              )}
              {payment.shipment_paid != null && (
                <div className="flex items-baseline gap-4 px-4 py-3">
                  <dt className="w-32 shrink-0 text-xs font-medium uppercase tracking-wide text-slate-400">Total paid</dt>
                  <dd className="text-sm tabular-nums text-slate-900">{formatNairaCurrency(payment.shipment_paid)}</dd>
                </div>
              )}
            </dl>
          </div>
        </section>
      )}

      {/* Recorded by */}
      <section>
        <h2 className="mb-3 text-base font-semibold text-slate-800">Recorded by</h2>
        <div className="rounded-xl border bg-white px-4 py-3">
          <p className="text-sm text-slate-900">{payment.recorded_by_email}</p>
          <p className="mt-0.5 text-xs text-slate-500">{formatDateTime(payment.recorded_at)}</p>
        </div>
      </section>
    </div>
  )
}
