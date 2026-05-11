'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Client } from 'pg'
import { revalidatePath } from 'next/cache'
import { randomUUID } from 'crypto'
import { callClaudeText } from '@/lib/ai/client'
import { getMessageParsingSystemPrompt, getMessageParsingUserPrompt } from '@/lib/ai/prompts/message-parsing'
import { getDispatchDraftingSystemPrompt, getDispatchDraftingUserPrompt, type DispatchDraftContext } from '@/lib/ai/prompts/dispatch-drafting'
import { getDealerRecentOrders } from '@/lib/db/messages'
import { notifyAllAdmins } from '@/lib/notifications'

const VALID_CHANNELS = ['dealer_portal', 'whatsapp', 'sms'] as const
type Channel = typeof VALID_CHANNELS[number]

const VALID_LANGUAGES = ['en', 'ha', 'yo', 'ig'] as const

export interface CreateMessageInput {
  dealer_id: string
  original_text: string
  channel: Channel
  language?: string | null
  receipt_file?: File | null
}

export type CreateMessageResult =
  | { success: true; messageId: string; receiptId?: string }
  | { success: false; error: string }

export async function createInboundMessage(
  input: CreateMessageInput
): Promise<CreateMessageResult> {
  const db = await createClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated.' }

  const { data: adminUser } = await db
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (adminUser?.role !== 'admin') {
    return { success: false, error: 'Unauthorized — admin access required.' }
  }

  if (!input.dealer_id?.trim()) return { success: false, error: 'Dealer is required.' }
  if (!input.original_text?.trim() || input.original_text.trim().length < 5) {
    return { success: false, error: 'Message text must be at least 5 characters.' }
  }
  if (!VALID_CHANNELS.includes(input.channel as Channel)) {
    return { success: false, error: 'Invalid channel.' }
  }

  const language =
    input.language && VALID_LANGUAGES.includes(input.language as typeof VALID_LANGUAGES[number])
      ? input.language
      : null

  const { data: dealer } = await db
    .from('dealers')
    .select('id')
    .eq('id', input.dealer_id)
    .eq('active', true)
    .is('deleted_at', null)
    .single()

  if (!dealer) return { success: false, error: 'Selected dealer does not exist or is inactive.' }

  let receiptStoragePath: string | null = null
  let receiptFileType: string | null = null

  if (input.receipt_file) {
    const file = input.receipt_file
    const uuid = randomUUID()
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    receiptStoragePath = `receipts/${input.dealer_id}/${uuid}-${safeName}`
    receiptFileType = file.type || 'application/octet-stream'

    const adminDb = createAdminClient()
    const fileBuffer = Buffer.from(await file.arrayBuffer())

    const { error: uploadError } = await adminDb.storage
      .from('receipts')
      .upload(receiptStoragePath, fileBuffer, {
        contentType: receiptFileType,
        upsert: false,
      })

    if (uploadError) {
      return { success: false, error: `Receipt upload failed: ${uploadError.message}` }
    }
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  })
  await client.connect()

  try {
    await client.query('BEGIN')

    const msgRes = await client.query(
      `INSERT INTO messages (dealer_id, direction, channel, language, original_text, created_by)
       VALUES ($1, 'inbound', $2, $3, $4, $5)
       RETURNING id`,
      [input.dealer_id, input.channel, language, input.original_text.trim(), user.id]
    )
    const messageId: string = msgRes.rows[0].id

    let receiptId: string | null = null

    if (receiptStoragePath && receiptFileType) {
      const rcptRes = await client.query(
        `INSERT INTO receipts (dealer_id, storage_path, file_type, uploaded_by, upload_source, status, message_id)
         VALUES ($1, $2, $3, $4, 'admin_upload', 'pending_extraction', $5)
         RETURNING id`,
        [input.dealer_id, receiptStoragePath, receiptFileType, user.id, messageId]
      )
      receiptId = rcptRes.rows[0].id
    }

    await client.query(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id, changes)
       VALUES ($1, 'inbound_message_recorded', 'message', $2, $3)`,
      [
        user.id,
        messageId,
        JSON.stringify({
          dealer_id: input.dealer_id,
          channel: input.channel,
          has_receipt: !!receiptId,
        }),
      ]
    )

    await client.query('COMMIT')

    revalidatePath('/messages')
    revalidatePath(`/dealers/${input.dealer_id}`)
    revalidatePath('/dashboard')

    const { data: dealerInfo } = await db
      .from('dealers')
      .select('business_name')
      .eq('id', input.dealer_id)
      .single()

    notifyAllAdmins({
      eventType: 'message_received',
      title: `New message from ${dealerInfo?.business_name ?? 'dealer'}`,
      description: input.original_text.slice(0, 80),
      entityType: 'message',
      entityId: messageId,
    }).catch((err) => console.error('[notifications] broadcast failed:', err))

    return { success: true, messageId, receiptId: receiptId ?? undefined }
  } catch (err) {
    await client.query('ROLLBACK')
    const message = err instanceof Error ? err.message : 'Unknown error occurred.'
    return { success: false, error: message }
  } finally {
    await client.end()
  }
}

// ─── parseMessage ─────────────────────────────────────────────────────────────

export type ParseMessageResult =
  | { success: true; parseResultId: string; intent: string; confidence: number }
  | { success: false; error: string }

export async function parseMessage(messageId: string): Promise<ParseMessageResult> {
  const db = await createClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated.' }
  const { data: adminUser } = await db.from('users').select('role').eq('id', user.id).single()
  if (adminUser?.role !== 'admin') return { success: false, error: 'Unauthorized.' }

  // 1. Load message + dealer
  const { data: msg } = await db
    .from('messages')
    .select('id, original_text, dealer_id, dealers!dealer_id(id, business_name, city, preferred_language)')
    .eq('id', messageId)
    .single()

  if (!msg) return { success: false, error: 'Message not found.' }

  type MsgRow = {
    id: string
    original_text: string
    dealer_id: string
    dealers: { id: string; business_name: string; city: string; preferred_language: string | null } | null
  }
  const m = msg as unknown as MsgRow
  const dealer = m.dealers

  // 2. Recent orders for context
  const recentOrders = await getDealerRecentOrders(m.dealer_id, 3)

  // 3. Active product catalog for SKU resolution
  const { data: products } = await db
    .from('products')
    .select('id, sku_code, display_name, category, color, engine_size_cc')
    .eq('active', true)
    .is('deleted_at', null)
    .order('display_name')

  type ProductRow = { id: string; sku_code: string; display_name: string; category: string; color: string | null; engine_size_cc: number | null }

  // 4. Call Claude
  const systemPrompt = getMessageParsingSystemPrompt()
  const userPrompt = getMessageParsingUserPrompt({
    messageText: m.original_text,
    dealerName: dealer?.business_name ?? 'Unknown',
    dealerCity: dealer?.city ?? '',
    preferredLanguage: dealer?.preferred_language ?? null,
    recentOrders,
    productCatalog: ((products ?? []) as unknown as ProductRow[]).map((p) => ({
      id: p.id,
      sku_code: p.sku_code,
      display_name: p.display_name,
      category: p.category,
      color: p.color,
      engine_size_cc: p.engine_size_cc,
    })),
  })

  let rawText: string
  try {
    rawText = await callClaudeText(systemPrompt, userPrompt)
  } catch (err) {
    return { success: false, error: `Claude API error: ${err instanceof Error ? err.message : String(err)}` }
  }

  // 5. Parse JSON
  let parsed: Record<string, unknown>
  try {
    const jsonText = rawText.trim().replace(/^```json\s*/i, '').replace(/\s*```$/, '')
    parsed = JSON.parse(jsonText)
  } catch {
    return { success: false, error: 'Claude returned invalid JSON — check server logs.' }
  }

  const VALID_INTENTS = ['order_request', 'payment_notification', 'delivery_status', 'question_inquiry', 'general'] as const
  const rawIntent = ((parsed.intent as string) ?? '').trim().toLowerCase()
  const intent = (VALID_INTENTS as readonly string[]).includes(rawIntent) ? rawIntent : 'general'
  const confidence = (parsed.overall_confidence as number) ?? 0
  const reasoning = (parsed.reasoning as string) ?? ''

  // 6. Write to DB
  const pgClient = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  await pgClient.connect()

  let parseResultId: string
  try {
    const res = await pgClient.query(
      `INSERT INTO message_parse_results
         (message_id, parsed_intent, extracted_data, confidence, ai_model, ai_notes, raw_response, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING id`,
      [
        messageId,
        intent,
        JSON.stringify(parsed),
        confidence,
        'claude-sonnet-4-6',
        reasoning,
        JSON.stringify({ text: rawText }),
        user.id,
      ]
    )
    parseResultId = res.rows[0].id

    await pgClient.query(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id, changes)
       VALUES ($1,'message_parsed','message',$2,$3)`,
      [user.id, messageId, JSON.stringify({ intent, confidence })]
    )
  } finally {
    await pgClient.end()
  }

  revalidatePath(`/messages/${messageId}`)
  revalidatePath('/messages')
  revalidatePath('/dashboard')

  return { success: true, parseResultId, intent, confidence }
}

// ─── convertParseToOrder ──────────────────────────────────────────────────────

export interface ConvertOrderItem {
  product_id: string
  quantity: number
  description: string
}

export type ConvertParseResult =
  | { success: true; orderId: string }
  | { success: false; error: string }

export async function convertParseToOrder(
  messageId: string,
  items: ConvertOrderItem[]
): Promise<ConvertParseResult> {
  const db = await createClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated.' }
  const { data: adminUser } = await db.from('users').select('role').eq('id', user.id).single()
  if (adminUser?.role !== 'admin') return { success: false, error: 'Unauthorized.' }

  if (!items.length) return { success: false, error: 'At least one item is required.' }

  for (const item of items) {
    if (!item.product_id) return { success: false, error: 'Each item must have a product selected.' }
    if (!item.quantity || item.quantity < 1) return { success: false, error: 'Each item must have quantity ≥ 1.' }
  }

  // Get dealer_id from message
  const { data: msg } = await db
    .from('messages')
    .select('dealer_id')
    .eq('id', messageId)
    .single()

  if (!msg) return { success: false, error: 'Message not found.' }

  const dealerId = (msg as { dealer_id: string }).dealer_id

  const pgClient = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  await pgClient.connect()

  let orderId: string
  try {
    await pgClient.query('BEGIN')

    const orderRes = await pgClient.query(
      `INSERT INTO dealer_orders
         (dealer_id, status, requested_at, notes, source, source_message_id)
       VALUES ($1, 'pending', now(), $2, 'ai_parsed_message', $3)
       RETURNING id`,
      [dealerId, `Created from AI parse of inbound message`, messageId]
    )
    orderId = orderRes.rows[0].id

    for (const item of items) {
      await pgClient.query(
        `INSERT INTO dealer_order_items
           (dealer_order_id, product_id, quantity_requested, quantity_fulfilled)
         VALUES ($1,$2,$3,0)`,
        [orderId, item.product_id, item.quantity]
      )
    }

    await pgClient.query(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id, changes)
       VALUES ($1,'order_created_from_parse','dealer_order',$2,$3)`,
      [user.id, orderId, JSON.stringify({ message_id: messageId, item_count: items.length })]
    )

    await pgClient.query('COMMIT')
  } catch (err) {
    await pgClient.query('ROLLBACK')
    return { success: false, error: err instanceof Error ? err.message : 'Database error.' }
  } finally {
    await pgClient.end()
  }

  revalidatePath(`/messages/${messageId}`)
  revalidatePath(`/dealers/${dealerId}`)
  revalidatePath('/dealer-orders')
  revalidatePath('/dashboard')

  const { data: dealerNameRow } = await db
    .from('dealers')
    .select('business_name')
    .eq('id', dealerId)
    .single()

  notifyAllAdmins({
    eventType: 'order_created',
    title: `[AI parsed] New order from ${dealerNameRow?.business_name ?? 'dealer'}`,
    description: `${items.length} item(s) extracted from message`,
    entityType: 'order',
    entityId: orderId,
  }).catch((err) => console.error('[notifications] broadcast failed:', err))

  return { success: true, orderId }
}

// ─── rejectParseResult ────────────────────────────────────────────────────────

export async function rejectParseResult(
  parseResultId: string
): Promise<{ success: true } | { success: false; error: string }> {
  const db = await createClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated.' }
  const { data: adminUser } = await db.from('users').select('role').eq('id', user.id).single()
  if (adminUser?.role !== 'admin') return { success: false, error: 'Unauthorized.' }

  // Merge rejected flag into extracted_data
  const { data: existing } = await db
    .from('message_parse_results')
    .select('id, extracted_data, message_id')
    .eq('id', parseResultId)
    .single()

  if (!existing) return { success: false, error: 'Parse result not found.' }

  type Row = { id: string; extracted_data: Record<string, unknown>; message_id: string }
  const row = existing as unknown as Row

  const pgClient = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  await pgClient.connect()
  try {
    const updated = { ...row.extracted_data, rejected: true }
    await pgClient.query(
      `UPDATE message_parse_results SET extracted_data=$1 WHERE id=$2`,
      [JSON.stringify(updated), parseResultId]
    )
  } finally {
    await pgClient.end()
  }

  revalidatePath(`/messages/${row.message_id}`)

  return { success: true }
}

// ─── draftDispatchMessage ─────────────────────────────────────────────────────

export interface DraftDispatchInput extends DispatchDraftContext {}

export type DraftDispatchResult =
  | { success: true; messageInLanguage: string; language: string; englishTranslation: string; notes: string }
  | { success: false; error: string }

export async function draftDispatchMessage(input: DraftDispatchInput): Promise<DraftDispatchResult> {
  const db = await createClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated.' }
  const { data: adminUser } = await db.from('users').select('role').eq('id', user.id).single()
  if (adminUser?.role !== 'admin') return { success: false, error: 'Unauthorized.' }

  const systemPrompt = getDispatchDraftingSystemPrompt()
  const userPrompt = getDispatchDraftingUserPrompt(input)

  let rawText: string
  try {
    rawText = await callClaudeText(systemPrompt, userPrompt)
  } catch (err) {
    return { success: false, error: `Claude API error: ${err instanceof Error ? err.message : String(err)}` }
  }

  let parsed: Record<string, unknown>
  try {
    const jsonText = rawText.trim().replace(/^```json\s*/i, '').replace(/\s*```$/, '')
    parsed = JSON.parse(jsonText)
  } catch {
    return { success: false, error: 'Claude returned invalid JSON.' }
  }

  return {
    success: true,
    messageInLanguage: (parsed.message_in_language as string) ?? '',
    language: (parsed.language as string) ?? input.preferredLanguage,
    englishTranslation: (parsed.english_translation as string) ?? '',
    notes: (parsed.notes as string) ?? '',
  }
}

// ─── saveOutboundMessage ──────────────────────────────────────────────────────

export interface SaveOutboundMessageInput {
  dealer_id: string
  messageInLanguage: string
  englishTranslation: string
  language: string
  channel: 'whatsapp' | 'sms' | 'dealer_portal'
  context_type?: string | null
  context_id?: string | null
}

export type SaveOutboundResult =
  | { success: true; messageId: string }
  | { success: false; error: string }

export async function saveOutboundMessage(input: SaveOutboundMessageInput): Promise<SaveOutboundResult> {
  const db = await createClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated.' }
  const { data: adminUser } = await db.from('users').select('role').eq('id', user.id).single()
  if (adminUser?.role !== 'admin') return { success: false, error: 'Unauthorized.' }

  if (!input.dealer_id?.trim()) return { success: false, error: 'Dealer is required.' }
  if (!input.messageInLanguage?.trim()) return { success: false, error: 'Message text is required.' }

  const pgClient = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  await pgClient.connect()

  let messageId: string
  try {
    await pgClient.query('BEGIN')

    const res = await pgClient.query(
      `INSERT INTO messages (dealer_id, direction, channel, language, original_text, translated_text, created_by)
       VALUES ($1, 'outbound', $2, $3, $4, $5, $6)
       RETURNING id`,
      [
        input.dealer_id,
        input.channel,
        input.language !== 'en' ? input.language : null,
        input.messageInLanguage.trim(),
        input.language !== 'en' ? input.englishTranslation.trim() : null,
        user.id,
      ]
    )
    messageId = res.rows[0].id

    await pgClient.query(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id, changes)
       VALUES ($1, 'outbound_message_sent', 'message', $2, $3)`,
      [
        user.id,
        messageId,
        JSON.stringify({
          dealer_id: input.dealer_id,
          channel: input.channel,
          language: input.language,
          context_type: input.context_type ?? null,
          context_id: input.context_id ?? null,
        }),
      ]
    )

    await pgClient.query('COMMIT')
  } catch (err) {
    await pgClient.query('ROLLBACK')
    return { success: false, error: err instanceof Error ? err.message : 'Database error.' }
  } finally {
    await pgClient.end()
  }

  revalidatePath('/messages')
  revalidatePath(`/dealers/${input.dealer_id}`)
  if (input.context_type === 'shipment' && input.context_id) {
    revalidatePath(`/shipments/${input.context_id}`)
  }

  return { success: true, messageId }
}
