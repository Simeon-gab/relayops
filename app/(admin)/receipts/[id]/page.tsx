import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import { getStandaloneReceiptById, getReceiptExtraction, getReceiptSignedUrl } from '@/lib/db/receipts'
import { createClient } from '@/lib/supabase/server'
import { ExtractReceiptButton } from '@/components/admin/extract-receipt-button'
import { ReceiptExtractionReview } from '@/components/admin/receipt-extraction-review'
import { formatNairaCurrency } from '@/lib/utils/format'

type Props = {
  params: Promise<{ id: string }>
}

const STATUS_LABELS: Record<string, string> = {
  pending_extraction: 'Pending extraction',
  extracted: 'Extracted',
  needs_review: 'Needs review',
  matched: 'Matched to payment',
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
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

export default async function ReceiptDetailPage({ params }: Props) {
  const { id } = await params
  const receipt = await getStandaloneReceiptById(id)
  if (!receipt) notFound()

  const [signedUrl, extraction] = await Promise.all([
    getReceiptSignedUrl(receipt.storage_path),
    receipt.status !== 'pending_extraction' ? getReceiptExtraction(id) : null,
  ])

  // Fetch dealer's outstanding shipments for the review component
  const db = await createClient()
  const { data: rawShipments } = await db
    .from('shipments')
    .select('id, total_amount_naira, amount_paid_naira, dispatched_at, status')
    .eq('destination_dealer_id', receipt.dealer_id)
    .in('status', ['dispatched', 'in_transit', 'delivered'])
    .is('deleted_at', null)
    .not('total_amount_naira', 'is', null)
    .order('dispatched_at', { ascending: false })
    .limit(10)

  type RawShipment = {
    id: string
    total_amount_naira: number
    amount_paid_naira: number
    dispatched_at: string | null
    status: string
  }

  const dealerShipments = ((rawShipments ?? []) as unknown as RawShipment[])
    .filter((s) => Number(s.total_amount_naira) > Number(s.amount_paid_naira))
    .map((s) => ({
      id: s.id,
      outstanding: Number(s.total_amount_naira) - Number(s.amount_paid_naira),
      dispatched_at: s.dispatched_at,
      status: s.status,
    }))

  return (
    <div className="px-6 py-10">
      <Link
        href="/receipts"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-heading"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to receipts
      </Link>

      <div className="mb-8 mt-4">
        <h1 className="text-2xl font-semibold text-heading">
          Receipt from{' '}
          <Link href={`/dealers/${receipt.dealer_id}`} className="hover:underline">
            {receipt.business_name}
          </Link>
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {receipt.city && <span>{receipt.city}{receipt.state ? `, ${receipt.state}` : ''}</span>}
          <span>·</span>
          <span>{formatDateTime(receipt.created_at)}</span>
          {receipt.linked_order_id && (
            <>
              <span>·</span>
              <Link
                href={`/dealer-orders/${receipt.linked_order_id}`}
                className="text-blue-600 hover:underline"
              >
                Linked order {receipt.linked_order_id.slice(0, 8)}…
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Notes from dealer */}
      {receipt.notes && (
        <section className="mb-6">
          <h2 className="mb-2 text-base font-semibold text-foreground">Dealer note</h2>
          <div className="rounded-xl border bg-white px-4 py-3">
            <p className="text-sm text-slate-700">{receipt.notes}</p>
          </div>
        </section>
      )}

      {/* Receipt image + review panel */}
      <section className="mb-8">
        <h2 className="mb-3 text-base font-semibold text-foreground">Receipt</h2>
        <div className="overflow-hidden rounded-xl border bg-white">
          {/* Image preview */}
          {receipt.file_type.startsWith('image/') && signedUrl && (
            <div className="border-b bg-slate-100 p-4">
              <img
                src={signedUrl}
                alt="Receipt"
                className="mx-auto max-h-96 rounded object-contain"
              />
            </div>
          )}

          {/* Status + actions row */}
          <div className="flex items-center justify-between gap-4 border-b px-4 py-3">
            <div className="flex items-center gap-3">
              <span
                className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                  STATUS_COLOURS[receipt.status] ?? 'bg-slate-100 text-slate-500'
                }`}
              >
                {STATUS_LABELS[receipt.status] ?? receipt.status}
              </span>
              <span className="text-xs text-muted-foreground">{formatDateTime(receipt.created_at)}</span>
            </div>
            <div className="flex items-center gap-2">
              {signedUrl && (
                <a
                  href={signedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                >
                  Open full size
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
              {receipt.status === 'pending_extraction' && (
                <ExtractReceiptButton receiptId={receipt.id} />
              )}
            </div>
          </div>

          {/* AI extraction review */}
          {extraction && receipt.status !== 'matched' && (
            <div className="p-4">
              <ReceiptExtractionReview
                extraction={extraction}
                receiptId={receipt.id}
                dealerShipments={dealerShipments}
              />
            </div>
          )}

          {/* Matched payment summary */}
          {receipt.status === 'matched' && extraction && (
            <div className="bg-green-50 px-4 py-3">
              <p className="text-sm font-medium text-green-800">
                Payment confirmed:{' '}
                {extraction.extracted_amount_naira != null
                  ? formatNairaCurrency(extraction.extracted_amount_naira)
                  : '—'}{' '}
                on {extraction.extracted_date ?? '—'}
              </p>
            </div>
          )}

          {/* Pending extraction state */}
          {receipt.status === 'pending_extraction' && (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-muted-foreground">
                AI extraction has not run yet. Click "Extract" above to process this receipt.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Outstanding shipments for this dealer */}
      {dealerShipments.length > 0 && (
        <section>
          <h2 className="mb-3 text-base font-semibold text-foreground">
            Outstanding shipments for {receipt.business_name}
          </h2>
          <div className="overflow-hidden rounded-xl border bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">Dispatched</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Outstanding</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {dealerShipments.map((s) => (
                  <tr key={s.id}>
                    <td className="px-4 py-3 text-slate-700">
                      <Link
                        href={`/shipments/${s.id}`}
                        className="text-blue-600 hover:underline"
                      >
                        {s.dispatched_at?.slice(0, 10) ?? 'pending'}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{s.status}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {formatNairaCurrency(s.outstanding)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
