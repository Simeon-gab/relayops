import Link from 'next/link'
import { getStandaloneReceipts } from '@/lib/db/receipts'
import { formatNairaCurrency } from '@/lib/utils/format'

type Props = {
  searchParams: Promise<{ status?: string }>
}

const STATUS_LABELS: Record<string, string> = {
  pending_extraction: 'Pending extraction',
  extracted: 'Extracted',
  needs_review: 'Needs review',
  matched: 'Matched',
  rejected: 'Rejected',
}

const STATUS_COLOURS: Record<string, string> = {
  pending_extraction: 'bg-amber-50 text-amber-700 border-amber-200',
  extracted: 'bg-blue-50 text-blue-700 border-blue-200',
  needs_review: 'bg-red-50 text-red-700 border-red-200',
  matched: 'bg-green-50 text-green-700 border-green-200',
  rejected: 'bg-slate-100 text-slate-500',
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function ConfidencePill({ value }: { value: number | null }) {
  if (value == null) return <span className="text-xs text-slate-400">—</span>
  const pct = Math.round(value * 100)
  const cls =
    value >= 0.8
      ? 'bg-green-50 text-green-700'
      : value >= 0.5
      ? 'bg-amber-50 text-amber-700'
      : 'bg-red-50 text-red-700'
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {pct}%
    </span>
  )
}

export default async function ReceiptsPage({ searchParams }: Props) {
  const { status } = await searchParams
  const showAll = status === 'all'

  const receipts = await getStandaloneReceipts(showAll ? 'all' : 'pending')

  const pendingCount = receipts.filter((r) =>
    ['pending_extraction', 'extracted', 'needs_review'].includes(r.status)
  ).length

  return (
    <div className="px-6 py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Dealer Receipts</h1>
        <p className="mt-1 text-sm text-slate-500">
          Receipts uploaded directly by dealers — review and confirm payments.
        </p>
      </div>

      {/* Filter tabs */}
      <div className="mb-6 flex gap-1 rounded-lg border bg-subtle p-1 w-fit">
        <Link
          href="/receipts"
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
            !showAll
              ? 'bg-card text-heading shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Pending review
          <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-xs text-amber-700">
            {pendingCount}
          </span>
        </Link>
        <Link
          href="/receipts?status=all"
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
            showAll
              ? 'bg-card text-heading shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          All
        </Link>
      </div>

      {receipts.length === 0 ? (
        <div className="rounded-xl border bg-white px-6 py-16 text-center">
          <p className="text-sm text-slate-500">No receipts to review.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">Dealer</th>
                <th className="px-4 py-3">Uploaded</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Confidence</th>
                <th className="px-4 py-3">Linked order</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {receipts.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-3 font-medium text-slate-900">{r.business_name}</td>
                  <td className="px-4 py-3 text-slate-500">{formatDateTime(r.created_at)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                        STATUS_COLOURS[r.status] ?? 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {STATUS_LABELS[r.status] ?? r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {r.is_payment_receipt === false ? (
                      <span className="text-xs text-slate-400">Not a receipt</span>
                    ) : (
                      <ConfidencePill value={r.overall_confidence} />
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {r.linked_order_id ? (
                      <Link
                        href={`/dealer-orders/${r.linked_order_id}`}
                        className="text-blue-600 hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {r.linked_order_id.slice(0, 8)}…
                      </Link>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/receipts/${r.id}`}
                      className="text-xs font-medium text-blue-600 hover:underline"
                    >
                      Review →
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
