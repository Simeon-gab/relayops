'use client'

import { useRouter } from 'next/navigation'
import { formatNairaCurrency } from '@/lib/utils/format'
import type { PaymentSummary } from '@/types/payments'

const METHOD_LABELS: Record<string, string> = {
  bank_transfer: 'Bank transfer',
  cash: 'Cash',
  pos: 'POS',
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-NG', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function shortId(id: string): string {
  return id.slice(-8)
}

interface Props {
  payments: PaymentSummary[]
}

export function PaymentsTable({ payments }: Props) {
  const router = useRouter()

  if (payments.length === 0) {
    return (
      <div className="overflow-hidden rounded-xl border bg-white">
        <p className="py-12 text-center text-sm text-muted-foreground">
          No payments recorded yet.
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-subtle text-left">
            <th className="px-4 py-3 font-medium text-slate-600">Date</th>
            <th className="px-4 py-3 font-medium text-slate-600">Dealer</th>
            <th className="px-4 py-3 text-right font-medium text-slate-600">Amount</th>
            <th className="px-4 py-3 font-medium text-slate-600">Method</th>
            <th className="px-4 py-3 font-medium text-slate-600">Reference</th>
            <th className="px-4 py-3 font-medium text-slate-600">Shipment</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {payments.map((p) => (
            <tr
              key={p.id}
              onClick={() => router.push(`/payments/${p.id}`)}
              className="cursor-pointer hover:bg-subtle"
            >
              <td className="px-4 py-3 text-slate-600">{formatDate(p.payment_date)}</td>
              <td className="px-4 py-3">
                <span className="font-medium text-slate-900">{p.business_name}</span>
                <span className="block text-xs text-slate-500">{p.city}</span>
              </td>
              <td className="px-4 py-3 text-right tabular-nums font-semibold text-slate-900">
                {formatNairaCurrency(p.amount_naira)}
              </td>
              <td className="px-4 py-3 text-slate-600">
                {p.payment_method ? (METHOD_LABELS[p.payment_method] ?? p.payment_method) : '—'}
              </td>
              <td className="px-4 py-3">
                <span className="font-mono text-xs text-slate-500">
                  {p.payment_reference ?? '—'}
                </span>
              </td>
              <td className="px-4 py-3">
                <span className="font-mono text-xs text-slate-500">
                  {p.shipment_id ? `…${shortId(p.shipment_id)}` : '—'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
