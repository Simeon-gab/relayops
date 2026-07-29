import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { formatNaira } from '@/lib/utils/format'

type PaymentRow = {
  id: string
  amount_naira: number
  payment_date: string
  payment_method: string | null
  payment_reference: string | null
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

export default async function DealerPaymentsPage() {
  const supabase = await createClient()

  const { data } = await supabase
    .from('payments')
    .select('id, amount_naira, payment_date, payment_method, payment_reference')
    .is('deleted_at', null)
    .order('payment_date', { ascending: false })

  const payments = (data ?? []) as unknown as PaymentRow[]

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-heading">Payments</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your payment history and outstanding balances.
        </p>
      </div>

      {payments.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-6">
          <p className="text-sm text-muted-foreground">
            No payments recorded yet. Payments will appear here once confirmed by Hungkee.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-subtle text-left">
                <th className="px-4 py-3 font-medium text-muted-foreground">Date</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Method</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Reference</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {payments.map((payment) => (
                <tr key={payment.id} className="hover:bg-subtle">
                  <td className="px-4 py-3">
                    <Link
                      href={`/portal/payments/${payment.id}`}
                      className="block w-full text-xs text-muted-foreground hover:text-heading"
                    >
                      {formatDate(payment.payment_date)}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/portal/payments/${payment.id}`}
                      className="block w-full text-foreground"
                    >
                      {methodLabel(payment.payment_method)}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/portal/payments/${payment.id}`}
                      className="block w-full font-mono text-xs text-muted-foreground"
                    >
                      {payment.payment_reference ?? '—'}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/portal/payments/${payment.id}`}
                      className="block w-full tabular-nums font-medium text-heading"
                    >
                      {formatNaira(Number(payment.amount_naira))}
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
