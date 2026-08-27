import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { MessageSummary, MessageDetail, MessageFilters, MessageReceipt, MessageParseResult, OutboundMessageSummary } from '@/types/messages'

// ─── getMessages ──────────────────────────────────────────────────────────────

type RawMessageRow = {
  id: string
  channel: string
  language: string | null
  original_text: string
  created_at: string
  dealers: { id: string; business_name: string; city: string } | null
  receipts: Array<{ id: string }>
  message_parse_results: Array<{ id: string; parsed_intent: string }>
}

export async function getMessages(filters: MessageFilters = {}): Promise<MessageSummary[]> {
  const db = await createClient()

  let query = db
    .from('messages')
    .select(`
      id, channel, language, original_text, created_at,
      dealers!dealer_id(id, business_name, city),
      receipts!message_id(id),
      message_parse_results!message_id(id, parsed_intent)
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

  let rows = ((data ?? []) as unknown as RawMessageRow[]).map((m) => {
    // message_parse_results is ordered by created_at desc in some DBs; take last inserted
    const latestParse = m.message_parse_results[m.message_parse_results.length - 1]
    return {
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
      parse_intent: latestParse?.parsed_intent ?? null,
    }
  })

  if (filters.parse_status === 'parsed') {
    rows = rows.filter((r) => r.has_parse_result)
  } else if (filters.parse_status === 'unparsed') {
    rows = rows.filter((r) => !r.has_parse_result)
  }
  if (filters.intent) {
    rows = rows.filter((r) => r.parse_intent === filters.intent)
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

export async function getMessageCounts(): Promise<{
  total: number
  unparsed: number
  parsed: number
  order_requests: number
  payments: number
  other_parsed: number
}> {
  const db = await createClient()

  const { data } = await db
    .from('messages')
    .select('id, message_parse_results!message_id(id, parsed_intent)')
    .eq('direction', 'inbound')

  type Row = { id: string; message_parse_results: Array<{ id: string; parsed_intent: string }> }
  const rows = (data ?? []) as unknown as Row[]
  const total = rows.length

  let unparsed = 0, order_requests = 0, payments = 0, other_parsed = 0
  for (const row of rows) {
    if (row.message_parse_results.length === 0) {
      unparsed++
    } else {
      const intent = row.message_parse_results[row.message_parse_results.length - 1]?.parsed_intent
      if (intent === 'order_request') order_requests++
      else if (intent === 'payment_notification') payments++
      else other_parsed++
    }
  }

  return { total, unparsed, parsed: total - unparsed, order_requests, payments, other_parsed }
}

// ─── getMessageActionQueue ────────────────────────────────────────────────────

export type MessageQueueItem = {
  id: string
  business_name: string
  city: string
  channel: string
  original_text: string
  created_at: string
  state: 'unparsed' | 'order_ready' | 'payment_ready'
}

type RawQueueRow = {
  id: string
  channel: string
  original_text: string
  created_at: string
  dealers: { business_name: string; city: string } | null
  receipts: Array<{ id: string; status: string }>
  message_parse_results: Array<{ id: string; parsed_intent: string }>
}

/**
 * Inbound messages still waiting on a human decision:
 * unparsed, or parsed as an order request with no order created from it yet,
 * or a payment notification whose receipt hasn't been matched or rejected.
 */
export async function getMessageActionQueue(): Promise<MessageQueueItem[]> {
  const db = await createClient()

  const { data, error } = await db
    .from('messages')
    .select(`
      id, channel, original_text, created_at,
      dealers!dealer_id(business_name, city),
      receipts!message_id(id, status),
      message_parse_results!message_id(id, parsed_intent)
    `)
    .eq('direction', 'inbound')
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) throw error
  const rows = (data ?? []) as unknown as RawQueueRow[]
  if (rows.length === 0) return []

  const { data: linkedOrders } = await db
    .from('dealer_orders')
    .select('source_message_id')
    .in('source_message_id', rows.map((r) => r.id))

  const actioned = new Set(
    ((linkedOrders ?? []) as Array<{ source_message_id: string | null }>)
      .map((o) => o.source_message_id)
      .filter(Boolean)
  )

  const queue: MessageQueueItem[] = []
  for (const m of rows) {
    const latestParse = m.message_parse_results[m.message_parse_results.length - 1]

    let state: MessageQueueItem['state'] | null = null
    if (!latestParse) {
      state = 'unparsed'
    } else if (latestParse.parsed_intent === 'order_request' && !actioned.has(m.id)) {
      state = 'order_ready'
    } else if (
      latestParse.parsed_intent === 'payment_notification' &&
      m.receipts.some((r) => !['matched', 'rejected'].includes(r.status))
    ) {
      state = 'payment_ready'
    }

    if (state) {
      queue.push({
        id: m.id,
        business_name: m.dealers?.business_name ?? '—',
        city: m.dealers?.city ?? '',
        channel: m.channel,
        original_text: m.original_text,
        created_at: m.created_at,
        state,
      })
    }
  }

  return queue
}

// ─── getOutboundMessages ──────────────────────────────────────────────────────

type RawOutboundRow = {
  id: string
  channel: string
  language: string | null
  original_text: string
  translated_text: string | null
  created_at: string
  dealers: { id: string; business_name: string; city: string } | null
}

export async function getOutboundMessages(dealerId?: string): Promise<OutboundMessageSummary[]> {
  const db = await createClient()

  let query = db
    .from('messages')
    .select('id, channel, language, original_text, translated_text, created_at, dealers!dealer_id(id, business_name, city)')
    .eq('direction', 'outbound')
    .order('created_at', { ascending: false })
    .limit(100)

  if (dealerId) {
    query = query.eq('dealer_id', dealerId)
  }

  const { data, error } = await query
  if (error) throw error

  return ((data ?? []) as unknown as RawOutboundRow[]).map((m) => ({
    id: m.id,
    dealer_id: m.dealers?.id ?? '',
    business_name: m.dealers?.business_name ?? '—',
    city: m.dealers?.city ?? '',
    channel: m.channel,
    language: m.language,
    original_text: m.original_text,
    translated_text: m.translated_text,
    created_at: m.created_at,
  }))
}

// ─── getDealerRecentOrders ────────────────────────────────────────────────────

type RawOrderRow = {
  id: string
  status: string
  requested_at: string
  dealer_order_items: Array<{
    quantity_requested: number
    products: { sku_code: string; display_name: string } | null
  }>
}

export async function getDealerRecentOrders(
  dealerId: string,
  limit = 3
): Promise<Array<{ id: string; status: string; requested_at: string; items: Array<{ sku_code: string; display_name: string; quantity: number }> }>> {
  const db = await createClient()

  const { data } = await db
    .from('dealer_orders')
    .select('id, status, requested_at, dealer_order_items(quantity_requested, products(sku_code, display_name))')
    .eq('dealer_id', dealerId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(limit)

  return ((data ?? []) as unknown as RawOrderRow[]).map((o) => ({
    id: o.id,
    status: o.status,
    requested_at: o.requested_at,
    items: o.dealer_order_items
      .filter((i) => i.products != null)
      .map((i) => ({
        sku_code: i.products!.sku_code,
        display_name: i.products!.display_name,
        quantity: i.quantity_requested,
      })),
  }))
}
