import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { getMessage, getReceiptSignedUrl } from '@/lib/db/messages'
import { getReceiptExtraction } from '@/lib/db/receipts'
import { createClient } from '@/lib/supabase/server'
import { ExtractReceiptButton } from '@/components/admin/extract-receipt-button'
import { ReceiptExtractionReview } from '@/components/admin/receipt-extraction-review'
import { ParseMessageButton } from '@/components/admin/parse-message-button'
import { MessageParseReview } from '@/components/admin/message-parse-review'
import { formatNairaCurrency } from '@/lib/utils/format'

type Props = {
  params: Promise<{ id: string }>
}

const CHANNEL_LABELS: Record<string, string> = {
  whatsapp: 'Pasted from WhatsApp',
  sms: 'Pasted from SMS',
  dealer_portal: 'From dealer portal',
}

const LANG_LABELS: Record<string, string> = {
  en: 'English',
  ha: 'Hausa',
  yo: 'Yoruba',
  ig: 'Igbo',
}

const RECEIPT_STATUS_LABELS: Record<string, string> = {
  pending_extraction: 'Pending extraction',
  extracted: 'Extracted',
  matched: 'Matched to payment',
  needs_review: 'Needs review',
  rejected: 'Rejected',
}

const INTENT_LABELS: Record<string, string> = {
  order_request: 'Order request',
  status_question: 'Status question',
  complaint: 'Complaint',
  confirmation: 'Confirmation',
  payment_notification: 'Payment notification',
  other: 'Other',
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

function ReceiptStatusBadge({ status }: { status: string }) {
  const colours: Record<string, string> = {
    pending_extraction: 'bg-amber-50 text-amber-700 border-amber-200',
    extracted: 'bg-blue-50 text-blue-700 border-blue-200',
    matched: 'bg-green-50 text-green-700 border-green-200',
    needs_review: 'bg-red-50 text-red-700 border-red-200',
    rejected: 'bg-slate-100 text-slate-500',
  }
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${colours[status] ?? 'bg-slate-100 text-slate-600'}`}
    >
      {RECEIPT_STATUS_LABELS[status] ?? status}
    </span>
  )
}

export default async function MessageDetailPage({ params }: Props) {
  const { id } = await params
  const message = await getMessage(id)
  if (!message) notFound()

  // Fetch signed URLs + extraction data for each receipt
  const receiptsWithData = await Promise.all(
    message.receipts.map(async (r) => {
      const [signedUrl, extraction] = await Promise.all([
        getReceiptSignedUrl(r.storage_path),
        ['pending_extraction'].includes(r.status) ? null : getReceiptExtraction(r.id),
      ])
      return { ...r, signedUrl, extraction }
    })
  )

  // Fetch dealer's outstanding shipments + active products for the review components
  const db = await createClient()
  const { data: rawShipments } = await db
    .from('shipments')
    .select('id, total_amount_naira, amount_paid_naira, dispatched_at, status')
    .eq('destination_dealer_id', message.dealer_id)
    .in('status', ['dispatched', 'in_transit', 'delivered'])
    .is('deleted_at', null)
    .not('total_amount_naira', 'is', null)
    .order('dispatched_at', { ascending: false })
    .limit(10)

  type RawShipment = { id: string; total_amount_naira: number; amount_paid_naira: number; dispatched_at: string | null; status: string }
  const dealerShipments = ((rawShipments ?? []) as unknown as RawShipment[])
    .filter((s) => Number(s.total_amount_naira) > Number(s.amount_paid_naira))
    .map((s) => ({
      id: s.id,
      outstanding: Number(s.total_amount_naira) - Number(s.amount_paid_naira),
      dispatched_at: s.dispatched_at,
      status: s.status,
    }))

  // Active products for SKU resolution dropdowns
  const { data: rawProducts } = await db
    .from('products')
    .select('id, sku_code, display_name, category')
    .eq('active', true)
    .is('deleted_at', null)
    .order('display_name')

  type RawProduct = { id: string; sku_code: string; display_name: string; category: string }
  const availableProducts = (rawProducts ?? []) as unknown as RawProduct[]

  return (
    <div className="px-6 py-10">
      {/* Back link */}
      <Link
        href="/messages"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to messages
      </Link>

      {/* Header */}
      <div className="mb-8 mt-4">
        <h1 className="text-2xl font-semibold text-slate-900">
          Message from{' '}
          <Link href={`/dealers/${message.dealer_id}`} className="hover:underline">
            {message.business_name}
          </Link>
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-500">
          <span>{message.city}, {message.state}</span>
          <span>·</span>
          <Badge variant="outline" className="text-xs">
            {CHANNEL_LABELS[message.channel] ?? message.channel}
          </Badge>
          {message.language && (
            <>
              <span>·</span>
              <span>{LANG_LABELS[message.language] ?? message.language.toUpperCase()}</span>
            </>
          )}
          <span>·</span>
          <span>{formatDateTime(message.created_at)}</span>
        </div>
      </div>

      {/* Original message */}
      <section className="mb-8">
        <h2 className="mb-3 text-base font-semibold text-slate-800">Original message</h2>
        <div className="rounded-xl border bg-white">
          {message.language && message.language !== 'en' && (
            <div className="border-b px-4 py-2">
              <Badge variant="outline" className="text-xs">
                {LANG_LABELS[message.language] ?? message.language.toUpperCase()}
              </Badge>
            </div>
          )}
          <pre className="whitespace-pre-wrap break-words px-4 py-4 font-mono text-sm leading-relaxed text-slate-800">
            {message.original_text}
          </pre>
        </div>
        {(() => {
          // Show AI translation from parse result if available, otherwise fall back to translated_text
          const aiTranslation = message.parse_result
            ? ((message.parse_result.extracted_data as Record<string, unknown>)?.message_translation_english as string | null) ?? null
            : null
          const displayTranslation = aiTranslation ?? message.translated_text
          if (!displayTranslation) return null
          return (
            <div className="mt-2 flex items-start gap-2 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3">
              <span className="mt-0.5 text-sm">🌐</span>
              <div>
                <span className="text-xs font-medium text-blue-500">English: </span>
                <span className="text-sm italic text-blue-900">{displayTranslation}</span>
              </div>
            </div>
          )
        })()}
      </section>

      {/* Attached receipts */}
      {receiptsWithData.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-base font-semibold text-slate-800">Attached receipt</h2>
          <div className="space-y-6">
            {receiptsWithData.map((r) => (
              <div key={r.id} className="overflow-hidden rounded-xl border bg-white">
                {/* Image preview */}
                {r.file_type.startsWith('image/') && r.signedUrl && (
                  <div className="border-b bg-slate-100 p-4">
                    <img
                      src={r.signedUrl}
                      alt="Receipt"
                      className="mx-auto max-h-64 rounded object-contain"
                    />
                  </div>
                )}

                {/* Status row */}
                <div className="flex items-center justify-between gap-4 border-b px-4 py-3">
                  <div className="flex items-center gap-3">
                    <ReceiptStatusBadge status={r.status} />
                    <span className="text-xs text-slate-500">{formatDateTime(r.created_at)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {r.signedUrl && (
                      <a
                        href={r.signedUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                      >
                        Open
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                    {r.status === 'pending_extraction' && (
                      <ExtractReceiptButton receiptId={r.id} />
                    )}
                  </div>
                </div>

                {/* Extraction panel */}
                {r.extraction && r.status !== 'matched' && (
                  <div className="p-4">
                    <ReceiptExtractionReview
                      extraction={r.extraction}
                      receiptId={r.id}
                      dealerShipments={dealerShipments}
                    />
                  </div>
                )}

                {/* Matched payment summary */}
                {r.status === 'matched' && r.extraction && (
                  <div className="bg-green-50 px-4 py-3">
                    <p className="text-sm font-medium text-green-800">
                      Payment confirmed:{' '}
                      {r.extraction.extracted_amount_naira != null
                        ? formatNairaCurrency(r.extraction.extracted_amount_naira)
                        : '—'}{' '}
                      on {r.extraction.extracted_date ?? '—'}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* AI parse result */}
      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between gap-4">
          <h2 className="text-base font-semibold text-slate-800">AI parse result</h2>
          {!message.parse_result && (
            <ParseMessageButton messageId={message.id} />
          )}
        </div>
        {message.parse_result ? (
          <MessageParseReview
            parseResult={message.parse_result}
            messageId={message.id}
            availableProducts={availableProducts}
          />
        ) : (
          <div className="rounded-xl border bg-slate-50 px-4 py-8 text-center">
            <p className="text-sm text-slate-500">Message has not been parsed yet.</p>
            <p className="mt-1 text-xs text-slate-400">Click "Parse message" above to extract intent and structured data.</p>
          </div>
        )}
      </section>

      {/* Recorded by */}
      <section>
        <h2 className="mb-3 text-base font-semibold text-slate-800">Recorded by</h2>
        <div className="rounded-xl border bg-white px-4 py-3">
          <p className="text-sm text-slate-900">{message.recorded_by_email ?? 'Unknown'}</p>
          <p className="mt-0.5 text-xs text-slate-500">{formatDateTime(message.created_at)}</p>
        </div>
      </section>
    </div>
  )
}
