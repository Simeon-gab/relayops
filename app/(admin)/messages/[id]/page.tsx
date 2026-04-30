import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { getMessage, getReceiptSignedUrl } from '@/lib/db/messages'

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

  // Fetch signed URLs for any receipts
  const receiptsWithUrls = await Promise.all(
    message.receipts.map(async (r) => ({
      ...r,
      signedUrl: await getReceiptSignedUrl(r.storage_path),
    }))
  )

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
          <pre className="whitespace-pre-wrap break-words px-4 py-4 font-mono text-sm text-slate-800 leading-relaxed">
            {message.original_text}
          </pre>
        </div>
        {message.translated_text && (
          <div className="mt-3 rounded-xl border bg-slate-50 px-4 py-4">
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">
              English translation
            </p>
            <p className="text-sm text-slate-700">{message.translated_text}</p>
          </div>
        )}
      </section>

      {/* Attached receipts */}
      {receiptsWithUrls.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-base font-semibold text-slate-800">Attached receipt</h2>
          <div className="space-y-3">
            {receiptsWithUrls.map((r) => (
              <div key={r.id} className="overflow-hidden rounded-xl border bg-white">
                {r.file_type.startsWith('image/') && r.signedUrl && (
                  <div className="border-b bg-slate-100 p-4">
                    <img
                      src={r.signedUrl}
                      alt="Receipt"
                      className="mx-auto max-h-64 rounded object-contain"
                    />
                  </div>
                )}
                <div className="flex items-center justify-between gap-4 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <ReceiptStatusBadge status={r.status} />
                    <span className="text-xs text-slate-500">
                      {formatDateTime(r.created_at)}
                    </span>
                  </div>
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
                </div>
                <div className="border-t bg-amber-50 px-4 py-2">
                  <p className="text-xs text-amber-700">
                    Receipt will be processed by AI in the next phase.
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* AI parse result */}
      <section className="mb-8">
        <h2 className="mb-3 text-base font-semibold text-slate-800">AI parse result</h2>
        {message.parse_result ? (
          <div className="rounded-xl border bg-white divide-y">
            <div className="flex items-baseline gap-4 px-4 py-3">
              <dt className="w-28 shrink-0 text-xs font-medium uppercase tracking-wide text-slate-400">Intent</dt>
              <dd className="text-sm font-medium text-slate-900">
                {INTENT_LABELS[message.parse_result.parsed_intent] ?? message.parse_result.parsed_intent}
              </dd>
            </div>
            <div className="flex items-baseline gap-4 px-4 py-3">
              <dt className="w-28 shrink-0 text-xs font-medium uppercase tracking-wide text-slate-400">Confidence</dt>
              <dd className="text-sm text-slate-900">
                {Math.round(message.parse_result.confidence * 100)}%
              </dd>
            </div>
            {message.parse_result.ai_notes && (
              <div className="flex items-baseline gap-4 px-4 py-3">
                <dt className="w-28 shrink-0 text-xs font-medium uppercase tracking-wide text-slate-400">Notes</dt>
                <dd className="text-sm italic text-slate-600">{message.parse_result.ai_notes}</dd>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-xl border bg-slate-50 px-4 py-8 text-center">
            <p className="text-sm text-slate-500">
              Message has not been processed yet.
            </p>
            <p className="mt-1 text-xs text-slate-400">
              AI parsing will be available in the next phase.
            </p>
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
