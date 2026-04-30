import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { MessageSummary, MessageDetail, MessageFilters, MessageReceipt, MessageParseResult } from '@/types/messages'

// ─── getMessages ──────────────────────────────────────────────────────────────

type RawMessageRow = {
  id: string
  channel: string
  language: string | null
  original_text: string
  created_at: string
  dealers: { id: string; business_name: string; city: string } | null
  receipts: Array<{ id: string }>
  message_parse_results: Array<{ id: string }>
}

export async function getMessages(filters: MessageFilters = {}): Promise<MessageSummary[]> {
  const db = await createClient()

  let query = db
    .from('messages')
    .select(`
      id, channel, language, original_text, created_at,
      dealers!dealer_id(id, business_name, city),
      receipts!message_id(id),
      message_parse_results!message_id(id)
    `)
    .eq('direction', 'inbound')
    .order('created_at', { ascending: false })
    .limit(100)

  if (filters.dealer_id) {
    query = query.eq('dealer_id', filters.dealer_id)
  }
  if (filters.channel) {
    query = query.eq('channel', filters.channel)
  }

  const { data, error } = await query
  if (error) throw error

  let rows = ((data ?? []) as unknown as RawMessageRow[]).map((m) => ({
    id: m.id,
    dealer_id: m.dealers?.id ?? '',
    business_name: m.dealers?.business_name ?? '—',
    city: m.dealers?.city ?? '',
    channel: m.channel,
    language: m.language,
    original_text: m.original_text,
    created_at: m.created_at,
    has_receipt: m.receipts.length > 0,
    has_parse_result: m.message_parse_results.length > 0,
  }))

  if (filters.parse_status === 'parsed') {
    rows = rows.filter((r) => r.has_parse_result)
  } else if (filters.parse_status === 'unparsed') {
    rows = rows.filter((r) => !r.has_parse_result)
  }

  // Unparsed first, then by date desc (already ordered by created_at desc from query)
  rows.sort((a, b) => {
    if (a.has_parse_result !== b.has_parse_result) return a.has_parse_result ? 1 : -1
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  return rows
}

// ─── getMessage ───────────────────────────────────────────────────────────────

type RawMessageDetail = {
  id: string
  channel: string
  language: string | null
  original_text: string
  translated_text: string | null
  created_at: string
  dealers: { id: string; business_name: string; city: string; state: string } | null
  users: { email: string } | null
  receipts: Array<{
    id: string
    storage_path: string
    file_type: string
    status: string
    created_at: string
  }>
  message_parse_results: Array<{
    id: string
    parsed_intent: string
    extracted_data: Record<string, unknown>
    confidence: number
    ai_notes: string | null
    created_at: string
  }>
}

export async function getMessage(messageId: string): Promise<MessageDetail | null> {
  const db = await createClient()

  const { data, error } = await db
    .from('messages')
    .select(`
      id, channel, language, original_text, translated_text, created_at,
      dealers!dealer_id(id, business_name, city, state),
      users!created_by(email),
      receipts!message_id(id, storage_path, file_type, status, created_at),
      message_parse_results!message_id(id, parsed_intent, extracted_data, confidence, ai_notes, created_at)
    `)
    .eq('id', messageId)
    .single()

  if (error) return null

  const m = data as unknown as RawMessageDetail

  const receipts: MessageReceipt[] = m.receipts.map((r) => ({
    id: r.id,
    storage_path: r.storage_path,
    file_type: r.file_type,
    status: r.status,
    created_at: r.created_at,
  }))

  const parseResults = [...m.message_parse_results].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )
  const parse_result: MessageParseResult | null = parseResults[0]
    ? {
        id: parseResults[0].id,
        parsed_intent: parseResults[0].parsed_intent,
        extracted_data: parseResults[0].extracted_data,
        confidence: parseResults[0].confidence,
        ai_notes: parseResults[0].ai_notes,
        created_at: parseResults[0].created_at,
      }
    : null

  return {
    id: m.id,
    dealer_id: m.dealers?.id ?? '',
    business_name: m.dealers?.business_name ?? '—',
    city: m.dealers?.city ?? '',
    state: m.dealers?.state ?? '',
    channel: m.channel,
    language: m.language,
    original_text: m.original_text,
    translated_text: m.translated_text,
    created_at: m.created_at,
    recorded_by_email: m.users?.email ?? null,
    receipts,
    parse_result,
  }
}

// ─── getReceiptSignedUrl ──────────────────────────────────────────────────────

export async function getReceiptSignedUrl(storagePath: string): Promise<string | null> {
  const adminDb = createAdminClient()
  const { data, error } = await adminDb.storage
    .from('receipts')
    .createSignedUrl(storagePath, 3600) // 1 hour

  if (error || !data?.signedUrl) return null
  return data.signedUrl
}

// ─── getMessageCounts ─────────────────────────────────────────────────────────

export async function getMessageCounts(): Promise<{ total: number; unparsed: number; parsed: number }> {
  const db = await createClient()

  const { data } = await db
    .from('messages')
    .select('id, message_parse_results!message_id(id)')
    .eq('direction', 'inbound')

  const rows = (data ?? []) as unknown as Array<{ id: string; message_parse_results: Array<{ id: string }> }>
  const total = rows.length
  const parsed = rows.filter((r) => r.message_parse_results.length > 0).length
  const unparsed = total - parsed

  return { total, unparsed, parsed }
}
