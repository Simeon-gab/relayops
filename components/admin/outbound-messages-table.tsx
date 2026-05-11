'use client'

import { Badge } from '@/components/ui/badge'
import type { OutboundMessageSummary } from '@/types/messages'

const CHANNEL_LABELS: Record<string, string> = {
  whatsapp: 'WhatsApp',
  sms: 'SMS',
  dealer_portal: 'Portal',
}

const LANG_LABELS: Record<string, string> = {
  en: 'EN',
  ha: 'HA',
  yo: 'YO',
  ig: 'IG',
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
  messages: OutboundMessageSummary[]
}

export function OutboundMessagesTable({ messages }: Props) {
  if (messages.length === 0) {
    return (
      <div className="py-16 text-center text-sm text-slate-400">
        No outbound messages sent yet.
      </div>
    )
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b bg-subtle text-left">
          <th className="px-4 py-3 font-medium text-slate-600">Date</th>
          <th className="px-4 py-3 font-medium text-slate-600">Dealer</th>
          <th className="px-4 py-3 font-medium text-slate-600">Channel</th>
          <th className="px-4 py-3 font-medium text-slate-600">Message</th>
          <th className="px-4 py-3 font-medium text-slate-600">Lang</th>
          <th className="px-4 py-3 font-medium text-slate-600">Translation</th>
        </tr>
      </thead>
      <tbody className="divide-y">
        {messages.map((msg) => (
          <tr key={msg.id} className="hover:bg-subtle">
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
            <td className="px-4 py-3 text-xs font-medium text-slate-500 uppercase">
              {msg.language ? (LANG_LABELS[msg.language] ?? msg.language.toUpperCase()) : 'EN'}
            </td>
            <td className="max-w-xs px-4 py-3">
              {msg.translated_text ? (
                <p className="truncate text-xs italic text-slate-400">
                  {msg.translated_text.length > 70
                    ? msg.translated_text.slice(0, 70) + '…'
                    : msg.translated_text}
                </p>
              ) : (
                <span className="text-xs text-slate-300">—</span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
