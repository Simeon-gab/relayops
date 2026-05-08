'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Client } from 'pg'
import { revalidatePath } from 'next/cache'
import { callClaudeWithVision } from '@/lib/ai/client'
import {
  getReceiptExtractionSystemPrompt,
  getReceiptExtractionUserPrompt,
} from '@/lib/ai/prompts/receipt-extraction'
import type { ExtractionResult, CreatePaymentFromReceiptInput } from '@/types/receipts'

async function getAdminUser() {
  const db = await createClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) return null
  const { data } = await db.from('users').select('role').eq('id', user.id).single()
  if (data?.role !== 'admin') return null
  return { db, user }
}

// ─── extractReceipt ────────────────────────────────────────────────────────────

export async function extractReceipt(receiptId: string): Promise<ExtractionResult> {
  const admin = await getAdminUser()
  if (!admin) return { success: false, error: 'Not authenticated or not an admin.' }

  // 1. Load receipt row
  const { data: receipt, error: receiptErr } = await admin.db
    .from('receipts')
    .select('id, dealer_id, storage_path, file_type, status, message_id')
    .eq('id', receiptId)
    .single()

  if (receiptErr || !receipt) return { success: false, error: 'Receipt not found.' }
  if (receipt.status !== 'pending_extraction') {
    return { success: false, error: `Receipt status is "${receipt.status}" — can only extract pending receipts.` }
  }

  // 2. Load dealer info
  const { data: dealer } = await admin.db
    .from('dealers')
    .select('id, business_name')
    .eq('id', receipt.dealer_id)
    .single()

  const businessName = dealer?.business_name ?? 'Unknown dealer'

  // 3. Load dealer's outstanding shipments for matching context
  const { data: shipments } = await admin.db
    .from('shipments')
    .select('id, total_amount_naira, amount_paid_naira, dispatched_at, status')
    .eq('destination_dealer_id', receipt.dealer_id)
    .in('status', ['dispatched', 'in_transit', 'delivered'])
    .is('deleted_at', null)
    .not('total_amount_naira', 'is', null)
    .order('dispatched_at', { ascending: false })
    .limit(10)

  const outstandingShipments = ((shipments ?? []) as Array<{
    id: string
    total_amount_naira: number
    amount_paid_naira: number
    dispatched_at: string | null
    status: string
  }>)
    .filter((s) => Number(s.total_amount_naira) > Number(s.amount_paid_naira))
    .map((s) => ({
      id: s.id,
      total_amount_naira: Number(s.total_amount_naira),
      amount_paid_naira: Number(s.amount_paid_naira),
      outstanding: Number(s.total_amount_naira) - Number(s.amount_paid_naira),
      dispatched_at: s.dispatched_at,
      status: s.status,
    }))

  // 4. Download image from storage
  const storage = createAdminClient().storage.from('receipts')
  const { data: fileBlob, error: dlErr } = await storage.download(receipt.storage_path)

  if (dlErr || !fileBlob) {
    return { success: false, error: `Could not download receipt image: ${dlErr?.message ?? 'unknown'}` }
  }

  const arrayBuffer = await fileBlob.arrayBuffer()
  const imageBase64 = Buffer.from(arrayBuffer).toString('base64')
  const mimeType = receipt.file_type || 'image/jpeg'

  // 5. Call Claude
  const systemPrompt = getReceiptExtractionSystemPrompt()
  const userPrompt = getReceiptExtractionUserPrompt({ businessName, outstandingShipments })

  let rawText: string
  try {
    rawText = await callClaudeWithVision(imageBase64, mimeType, systemPrompt, userPrompt)
  } catch (err) {
    return { success: false, error: `Claude API error: ${err instanceof Error ? err.message : String(err)}` }
  }

  // 6. Parse Claude's JSON response
  let parsed: {
    extracted: {
      amount_naira: number | null
      amount_confidence: number
      date: string | null
      date_confidence: number
      payment_reference: string | null
      payment_reference_confidence: number
      payer_name: string | null
      payer_name_confidence: number
      recipient: string | null
      recipient_confidence: number
      payment_method: string | null
      method_confidence: number
    }
    overall_confidence: number
    issues: string[]
    is_payment_receipt: boolean
    reasoning: string
  }

  try {
    const jsonText = rawText.trim().replace(/^```json\s*/i, '').replace(/\s*```$/, '')
    parsed = JSON.parse(jsonText)
  } catch {
    const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
    await client.connect()
    try {
      await client.query(
        `UPDATE receipts SET status='needs_review' WHERE id=$1`,
        [receiptId]
      )
      await client.query(
        `INSERT INTO audit_log (user_id, action, entity_type, entity_id, changes)
         VALUES ($1, 'receipt_extract_failed', 'receipt', $2, $3)`,
        [admin.user.id, receiptId, JSON.stringify({ error: 'JSON parse failed', raw: rawText.slice(0, 500) })]
      )
    } finally {
      await client.end()
    }
    return { success: false, error: 'Claude returned invalid JSON — receipt marked for review.' }
  }

  const e = parsed.extracted

  // 7. Determine shipment match
  let shipmentMatchId: string | null = null
  if (e.amount_naira && outstandingShipments.length > 0) {
    const tolerance = e.amount_naira * 0.05
    const match = outstandingShipments.find(
      (s) => Math.abs(s.outstanding - e.amount_naira!) <= tolerance
    )
    if (match) shipmentMatchId = match.id
  }

  // 8. Determine new receipt status
  const isReceipt = parsed.is_payment_receipt
  const confidence = parsed.overall_confidence
  const hasLowFieldConfidence =
    e.amount_confidence < 0.7 || e.date_confidence < 0.7

  let newStatus: string
  if (!isReceipt) {
    newStatus = 'rejected'
  } else if (confidence >= 0.8 && !hasLowFieldConfidence && parsed.issues.length === 0) {
    newStatus = 'extracted'
  } else {
    newStatus = 'needs_review'
  }

  // 9. Write to DB
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  await client.connect()

  let extractionId: string
  try {
    await client.query('BEGIN')

    const aiNotesObj = {
      issues: parsed.issues,
      reasoning: parsed.reasoning,
    }

    const insertRes = await client.query(
      `INSERT INTO receipt_extractions
         (receipt_id, extracted_amount_naira, extracted_date, extracted_reference,
          extracted_payer_name, extracted_recipient, extracted_method,
          field_confidences, overall_confidence, raw_response, ai_model, ai_notes,
          is_payment_receipt, shipment_match_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING id`,
      [
        receiptId,
        e.amount_naira,
        e.date,
        e.payment_reference,
        e.payer_name,
        e.recipient,
        e.payment_method,
        JSON.stringify({
          amount: e.amount_confidence,
          date: e.date_confidence,
          reference: e.payment_reference_confidence,
          payer_name: e.payer_name_confidence,
          recipient: e.recipient_confidence,
          method: e.method_confidence,
        }),
        confidence,
        JSON.stringify(parsed),
        'claude-sonnet-4-6',
        JSON.stringify(aiNotesObj),
        isReceipt,
        shipmentMatchId,
      ]
    )

    extractionId = insertRes.rows[0].id

    await client.query(
      `UPDATE receipts SET status=$1 WHERE id=$2`,
      [newStatus, receiptId]
    )

    await client.query(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id, changes)
       VALUES ($1, 'receipt_extracted', 'receipt', $2, $3)`,
      [
        admin.user.id,
        receiptId,
        JSON.stringify({ status: newStatus, confidence, shipment_match_id: shipmentMatchId }),
      ]
    )

    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    return { success: false, error: err instanceof Error ? err.message : 'Database error.' }
  } finally {
    await client.end()
  }

  // 10. Revalidate
  if (receipt.message_id) {
    revalidatePath(`/messages/${receipt.message_id}`)
  }
  revalidatePath('/messages')
  revalidatePath('/dashboard')

  if (newStatus === 'extracted' || newStatus === 'needs_review') {
    const { notifyAllAdmins } = await import('@/lib/notifications')
    notifyAllAdmins({
      eventType: 'receipt_extracted',
      title: e.amount_naira
        ? `Receipt extracted: ₦${Number(e.amount_naira).toLocaleString()}`
        : 'Receipt extracted',
      description: confidence < 0.8 ? 'Needs review — low confidence' : 'High confidence extraction',
      entityType: 'receipt',
      entityId: receiptId,
    }).catch(() => {})
  }

  return { success: true, extractionId, status: newStatus, confidence }
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

  // Verify receipt exists and has been extracted
  const { data: receipt } = await admin.db
    .from('receipts')
    .select('id, dealer_id, status, message_id')
    .eq('id', receiptId)
    .single()

  if (!receipt) return { success: false, error: 'Receipt not found.' }
  if (!['extracted', 'needs_review'].includes(receipt.status)) {
    return { success: false, error: `Receipt must be in extracted or needs_review status.` }
  }

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
        receipt.dealer_id,
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

    // Update shipment amount_paid_naira if linked
    if (values.shipment_id) {
      await client.query(
        `UPDATE shipments
         SET amount_paid_naira = amount_paid_naira + $1, updated_at = now()
         WHERE id = $2`,
        [values.amount_naira, values.shipment_id]
      )
    }

    // Mark receipt as matched
    await client.query(
      `UPDATE receipts SET status='matched' WHERE id=$1`,
      [receiptId]
    )

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

  if (receipt.message_id) revalidatePath(`/messages/${receipt.message_id}`)
  revalidatePath('/messages')
  revalidatePath('/dashboard')
  if (values.shipment_id) revalidatePath(`/shipments/${values.shipment_id}`)

  return { success: true, paymentId }
}
