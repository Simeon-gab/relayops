'use server'

import { can } from '@/lib/auth/roles'
import { createClient } from '@/lib/supabase/server'
import { Client } from 'pg'
import { revalidatePath } from 'next/cache'
import type { ExtractionResult, CreatePaymentFromReceiptInput } from '@/types/receipts'
import { runExtractionForReceipt } from '@/lib/receipts/extract'

async function getAdminUser() {
  const db = await createClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) return null
  const { data } = await db.from('users').select('role').eq('id', user.id).single()
  if (!can(data?.role, 'review_receipts')) return null
  return { db, user }
}

// ─── extractReceipt ────────────────────────────────────────────────────────────

export async function extractReceipt(receiptId: string): Promise<ExtractionResult> {
  const admin = await getAdminUser()
  if (!admin) return { success: false, error: 'Not authenticated or not an admin.' }

  const result = await runExtractionForReceipt(receiptId, admin.user.id)

  if (result.success) {
    if (result.messageId) revalidatePath(`/messages/${result.messageId}`)
    revalidatePath('/messages')
    revalidatePath('/receipts')
    revalidatePath(`/receipts/${receiptId}`)
    revalidatePath('/dashboard')
    return {
      success: true,
      extractionId: result.extractionId,
      status: result.status,
      confidence: result.confidence,
    }
  }

  return result
}

// ─── createPaymentFromReceipt ─────────────────────────────────────────────────

export async function createPaymentFromReceipt(
  receiptId: string,
  values: CreatePaymentFromReceiptInput
): Promise<{ success: true; paymentId: string } | { success: false; error: string }> {
  const admin = await getAdminUser()
  if (!admin) return { success: false, error: 'Not authenticated or not an admin.' }

  if (!values.amount_naira || values.amount_naira <= 0)
    return { success: false, error: 'Amount is required and must be positive.' }
  if (!values.payment_date)
    return { success: false, error: 'Payment date is required.' }

  const { data: receipt } = await admin.db
    .from('receipts')
    .select('id, dealer_id, status, message_id')
    .eq('id', receiptId)
    .single()

  if (!receipt) return { success: false, error: 'Receipt not found.' }
  if (!['extracted', 'needs_review'].includes((receipt as { status: string }).status)) {
    return { success: false, error: 'Receipt must be in extracted or needs_review status.' }
  }

  const rec = receipt as { id: string; dealer_id: string; status: string; message_id: string | null }

  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  await client.connect()

  let paymentId: string
  try {
    await client.query('BEGIN')

    const payRes = await client.query(
      `INSERT INTO payments
         (dealer_id, shipment_id, amount_naira, payment_date, payment_reference,
          payment_method, recorded_by, source, receipt_id, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'receipt_extraction',$8,$9)
       RETURNING id`,
      [
        rec.dealer_id,
        values.shipment_id,
        values.amount_naira,
        values.payment_date,
        values.payment_reference,
        values.payment_method,
        admin.user.id,
        receiptId,
        values.notes,
      ]
    )

    paymentId = payRes.rows[0].id

    if (values.shipment_id) {
      await client.query(
        `UPDATE shipments
         SET amount_paid_naira = amount_paid_naira + $1, updated_at = now()
         WHERE id = $2`,
        [values.amount_naira, values.shipment_id]
      )
    }

    await client.query(`UPDATE receipts SET status='matched' WHERE id=$1`, [receiptId])

    await client.query(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id, changes)
       VALUES ($1, 'payment_created_from_receipt', 'payment', $2, $3)`,
      [
        admin.user.id,
        paymentId,
        JSON.stringify({ receipt_id: receiptId, amount_naira: values.amount_naira, shipment_id: values.shipment_id }),
      ]
    )

    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    return { success: false, error: err instanceof Error ? err.message : 'Database error.' }
  } finally {
    await client.end()
  }

  if (rec.message_id) revalidatePath(`/messages/${rec.message_id}`)
  revalidatePath('/messages')
  revalidatePath('/receipts')
  revalidatePath(`/receipts/${receiptId}`)
  revalidatePath('/dashboard')
  if (values.shipment_id) revalidatePath(`/shipments/${values.shipment_id}`)

  return { success: true, paymentId }
}
