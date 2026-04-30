'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Client } from 'pg'
import { revalidatePath } from 'next/cache'
import { randomUUID } from 'crypto'

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

    return { success: true, messageId, receiptId: receiptId ?? undefined }
  } catch (err) {
    await client.query('ROLLBACK')
    const message = err instanceof Error ? err.message : 'Unknown error occurred.'
    return { success: false, error: message }
  } finally {
    await client.end()
  }
}
