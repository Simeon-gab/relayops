'use client'

import { useRouter } from 'next/navigation'
import { Paperclip } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { MessageSummary } from '@/types/messages'

const CHANNEL_LABELS: Record<string, string> = {
  whatsapp: 'WhatsApp',
  sms: 'SMS',
  dealer_portal: 'Portal',
}

const INTENT_LABELS: Record<string, string> = {
  order_request: 'Order request',
  payment_notification: 'Payment',
  delivery_status: 'Delivery',
  question_inquiry: 'Question',
  general: 'General',
}

const INTENT_COLOURS: Record<string, string> = {
  order_request:        'bg-blue-50 text-blue-700 border-blue-100',
  payment_notification: 'bg-green-50 text-green-700 border-green-100',
  delivery_status:      'bg-purple-50 text-purple-700 border-purple-100',
  question_inquiry:     'bg-amber-50 text-amber-700 border-amber-100',
  general:              'bg-slate-100 text-slate-500',
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

interface Props {
  messages: MessageSummary[]
}

export function MessagesTable({ messages }: Props) {
  const router = useRouter()

  if (messages.length === 0) {
    return (
      <div className="py-16 text-center text-sm text-slate-400">
        No messages found.{' '}
        <button
          className="text-blue-600 hover:underline"
          onClick={() => router.push('/messages/new')}
        >
          Record one
        </button>
        .
      </div>
    )
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b bg-slate-50 text-left">
          <th className="px-4 py-3 font-medium text-slate-600">Date</th>
          <th className="px-4 py-3 font-medium text-slate-600">Dealer</th>
          <th className="px-4 py-3 font-medium text-slate-600">Channel</th>
          <th className="px-4 py-3 font-medium text-slate-600">Preview</th>
          <th className="px-4 py-3 font-medium text-slate-600">Lang</th>
          <th className="px-4 py-3 text-center font-medium text-slate-600">Receipt</th>
          <th className="px-4 py-3 font-medium text-slate-600">Intent</th>
        </tr>
      </thead>
      <tbody className="divide-y">
        {messages.map((msg) => (
          <tr
            key={msg.id}
            className="cursor-pointer hover:bg-slate-50"
            onClick={() => router.push(`/messages/${msg.id}`)}
          >
            <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
              {formatDateTime(msg.created_at)}
            </td>
            <td className="px-4 py-3">
              <p className="font-medium text-slate-900">{msg.business_name}</p>
              <p className="text-xs text-slate-400">{msg.city}</p>
            </td>
            <td className="px-4 py-3">
              <Badge variant="outline" className="text-xs">
                {CHANNEL_LABELS[msg.channel] ?? msg.channel}
              </Badge>
            </td>
            <td className="max-w-xs px-4 py-3">
              <p className="truncate text-slate-700">
                {msg.original_text.length > 80
                  ? msg.original_text.slice(0, 80) + '…'
                  : msg.original_text}
              </p>
            </td>
            <td className="px-4 py-3 text-xs text-slate-500 uppercase">
              {msg.language ?? '—'}
            </td>
            <td className="px-4 py-3 text-center">
              {msg.has_receipt && (
                <Paperclip className="mx-auto h-4 w-4 text-slate-400" aria-label="Has receipt" />
              )}
            </td>
            <td className="px-4 py-3">
              {msg.parse_intent ? (
                <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${INTENT_COLOURS[msg.parse_intent] ?? 'bg-slate-100 text-slate-600'}`}>
                  {INTENT_LABELS[msg.parse_intent] ?? msg.parse_intent}
                </span>
              ) : (
                <Badge variant="outline" className="text-slate-400 text-xs">Unparsed</Badge>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
