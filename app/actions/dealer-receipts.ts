'use server'

import { createClient } from '@/lib/supabase/server'
import { Client } from 'pg'
import { revalidatePath } from 'next/cache'
import { notifyAllAdmins } from '@/lib/notifications'
import { runExtractionForReceipt } from '@/lib/receipts/extract'

const MAX_BYTES = 10 * 1024 * 1024
const ACCEPTED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf']

function mimeToExt(mimeType: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg':  'jpg',
    'image/png':  'png',
    'application/pdf': 'pdf',
  }
  return map[mimeType] ?? 'jpg'
}

export type UploadDealerReceiptResult =
  | { success: true; receiptId: string }
  | { success: false; error: string }

export async function uploadDealerReceipt(formData: FormData): Promise<UploadDealerReceiptResult> {

  // ── 1. Auth ────────────────────────────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated.' }

  const { data: profile } = await supabase
    .from('users')
    .select('role, dealer_id')
    .eq('id', user.id)
    .single()

  if (!profile || (profile as { role: string }).role !== 'dealer') {
    return { success: false, error: 'Unauthorized.' }
  }

  const dealerId = (profile as { role: string; dealer_id: string | null }).dealer_id
  if (!dealerId) {
    return { success: false, error: 'No dealer profile linked to this account.' }
  }

  // ── 2. Parse FormData ──────────────────────────────────────────────────────
  const file = formData.get('file')
  const orderId  = formData.get('order_id')?.toString()  || null
  const notes    = formData.get('notes')?.toString()     || null

  // ── 3. Validate ────────────────────────────────────────────────────────────
  if (!(file instanceof File)) {
    return { success: false, error: 'No file provided.' }
  }
  if (file.size > MAX_BYTES) {
    return { success: false, error: 'File too large. Maximum is 10 MB.' }
  }
  if (!ACCEPTED_TYPES.includes(file.type)) {
    return { success: false, error: 'Only JPEG, PNG, and PDF files are accepted.' }
  }

  // Verify the linked order belongs to this dealer (RLS enforces it too, but
  // this gives a clean error message instead of a cryptic RLS violation).
  if (orderId) {
    const { data: order } = await supabase
      .from('dealer_orders')
      .select('id')
      .eq('id', orderId)
      .eq('dealer_id', dealerId)
      .is('deleted_at', null)
      .single()

    if (!order) {
      return { success: false, error: 'Selected order not found or does not belong to your account.' }
    }
  }

  // ── 4. Generate stable IDs for receipt row and storage path ───────────────
  const receiptId  = crypto.randomUUID()
  const ext        = mimeToExt(file.type)
  const storagePath = `${dealerId}/${receiptId}.${ext}`

  // ── 5. Upload to Supabase Storage (dealer session — RLS enforces folder) ──
  const fileBuffer = Buffer.from(await file.arrayBuffer())

  const { error: uploadError } = await supabase.storage
    .from('receipts')
    .upload(storagePath, fileBuffer, {
      contentType: file.type,
      upsert: false,
    })

  if (uploadError) {
    return { success: false, error: `Upload failed: ${uploadError.message}` }
  }

  // ── 6. Insert receipts row + audit log (transactional) ────────────────────
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  await client.connect()

  let dbError: Error | null = null
  try {
    await client.query('BEGIN')

    await client.query(
      `INSERT INTO receipts
         (id, dealer_id, storage_path, file_type, uploaded_by,
          upload_source, status, linked_order_id, notes)
       VALUES ($1, $2, $3, $4, $5, 'dealer_portal', 'pending_extraction', $6, $7)`,
      [receiptId, dealerId, storagePath, file.type, user.id, orderId, notes],
    )

    await client.query(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id, changes)
       VALUES ($1, 'dealer_receipt_uploaded', 'receipt', $2, $3)`,
      [
        user.id,
        receiptId,
        JSON.stringify({ dealer_id: dealerId, order_id: orderId, storage_path: storagePath }),
      ],
    )

    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    dbError = err instanceof Error ? err : new Error('Database error.')
  } finally {
    await client.end()
  }

  if (dbError) {
    // Remove the uploaded file so storage and DB stay consistent.
    await supabase.storage.from('receipts').remove([storagePath]).catch(() => {})
    return { success: false, error: dbError.message }
  }

  // ── 7. Notify admins of the new upload ────────────────────────────────────
  notifyAllAdmins({
    eventType: 'dealer_receipt_uploaded',
    title: 'New receipt uploaded by dealer',
    description: orderId ? 'Linked to an order' : 'No linked order',
    entityType: 'receipt',
    entityId: receiptId,
  }).catch((err) => console.error('[notifications] broadcast failed:', err))

  // ── 8. Trigger AI extraction (best-effort — upload already committed) ──────
  // If extraction fails for any reason the receipt stays at pending_extraction
  // and an admin can trigger it manually from the receipt review UI.
  try {
    await runExtractionForReceipt(receiptId, user.id)
  } catch (err) {
    console.error('[dealer-receipts] extraction failed (non-fatal):', err)
  }

  revalidatePath('/portal/payments')

  return { success: true, receiptId }
}
