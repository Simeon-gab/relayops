import { createAdminClient } from '@/lib/supabase/admin'
import { Client } from 'pg'
import { callClaudeWithVision } from '@/lib/ai/client'
import {
  getReceiptExtractionSystemPrompt,
  getReceiptExtractionUserPrompt,
} from '@/lib/ai/prompts/receipt-extraction'
import { notifyAllAdmins } from '@/lib/notifications'

// Extended result that includes messageId so callers can revalidate paths if needed.
export type ExtractionCoreResult =
  | { success: true; extractionId: string; status: string; confidence: number; messageId: string | null }
  | { success: false; error: string }

/**
 * Core extraction logic — shared by the admin extractReceipt action and the
 * dealer uploadDealerReceipt action.  Does NOT check auth; callers are
 * responsible for verifying the actor has permission to trigger extraction.
 * Uses the admin Supabase client for all storage/DB reads so RLS is bypassed.
 */
export async function runExtractionForReceipt(
  receiptId: string,
  actorUserId: string,
): Promise<ExtractionCoreResult> {
  const adminDb = createAdminClient()

  // 1. Load receipt row
  const { data: receipt, error: receiptErr } = await adminDb
    .from('receipts')
    .select('id, dealer_id, storage_path, file_type, status, message_id')
    .eq('id', receiptId)
    .single()

  if (receiptErr || !receipt) return { success: false, error: 'Receipt not found.' }
  if ((receipt as { status: string }).status !== 'pending_extraction') {
    return {
      success: false,
      error: `Receipt status is "${(receipt as { status: string }).status}" — can only extract pending receipts.`,
    }
  }

  const rec = receipt as {
    id: string
    dealer_id: string
    storage_path: string
    file_type: string
    status: string
    message_id: string | null
  }

  // 2. Load dealer info
  const { data: dealer } = await adminDb
    .from('dealers')
    .select('id, business_name')
    .eq('id', rec.dealer_id)
    .single()

  const businessName = (dealer as { business_name: string } | null)?.business_name ?? 'Unknown dealer'

  // 3. Load dealer's outstanding shipments for Claude matching context
  const { data: shipments } = await adminDb
    .from('shipments')
    .select('id, total_amount_naira, amount_paid_naira, dispatched_at, status')
    .eq('destination_dealer_id', rec.dealer_id)
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

  // 4. Download file from storage (admin client bypasses RLS)
  const { data: fileBlob, error: dlErr } = await adminDb.storage
    .from('receipts')
    .download(rec.storage_path)

  if (dlErr || !fileBlob) {
    return {
      success: false,
      error: `Could not download receipt file: ${dlErr?.message ?? 'unknown'}`,
    }
  }

  const arrayBuffer = await fileBlob.arrayBuffer()
  const imageBase64 = Buffer.from(arrayBuffer).toString('base64')
  const mimeType = rec.file_type || 'image/jpeg'

  // 5. Call Claude vision
  const systemPrompt = getReceiptExtractionSystemPrompt()
  const userPrompt = getReceiptExtractionUserPrompt({ businessName, outstandingShipments })

  let rawText: string
  try {
    rawText = await callClaudeWithVision(imageBase64, mimeType, systemPrompt, userPrompt)
  } catch (err) {
    return {
      success: false,
      error: `Claude API error: ${err instanceof Error ? err.message : String(err)}`,
    }
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
      await client.query(`UPDATE receipts SET status='needs_review' WHERE id=$1`, [receiptId])
      await client.query(
        `INSERT INTO audit_log (user_id, action, entity_type, entity_id, changes)
         VALUES ($1, 'receipt_extract_failed', 'receipt', $2, $3)`,
        [actorUserId, receiptId, JSON.stringify({ error: 'JSON parse failed', raw: rawText.slice(0, 500) })],
      )
    } finally {
      await client.end()
    }
    return { success: false, error: 'Claude returned invalid JSON — receipt marked for review.' }
  }

  const e = parsed.extracted

  // 7. Determine shipment match (within 5% tolerance)
  let shipmentMatchId: string | null = null
  if (e.amount_naira && outstandingShipments.length > 0) {
    const tolerance = e.amount_naira * 0.05
    const match = outstandingShipments.find(
      (s) => Math.abs(s.outstanding - e.amount_naira!) <= tolerance,
    )
    if (match) shipmentMatchId = match.id
  }

  // 8. Determine new receipt status
  const isReceipt = parsed.is_payment_receipt
  const confidence = parsed.overall_confidence
  const hasLowFieldConfidence = e.amount_confidence < 0.7 || e.date_confidence < 0.7

  let newStatus: string
  if (!isReceipt) {
    newStatus = 'rejected'
  } else if (confidence >= 0.8 && !hasLowFieldConfidence && parsed.issues.length === 0) {
    newStatus = 'extracted'
  } else {
    newStatus = 'needs_review'
  }

  // 9. Write extraction row + update receipt status + audit log
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  await client.connect()

  let extractionId: string
  try {
    await client.query('BEGIN')

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
        JSON.stringify({ issues: parsed.issues, reasoning: parsed.reasoning }),
        isReceipt,
        shipmentMatchId,
      ],
    )

    extractionId = insertRes.rows[0].id

    await client.query(`UPDATE receipts SET status=$1 WHERE id=$2`, [newStatus, receiptId])

    await client.query(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id, changes)
       VALUES ($1, 'receipt_extracted', 'receipt', $2, $3)`,
      [
        actorUserId,
        receiptId,
        JSON.stringify({ status: newStatus, confidence, shipment_match_id: shipmentMatchId }),
      ],
    )

    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    return { success: false, error: err instanceof Error ? err.message : 'Database error.' }
  } finally {
    await client.end()
  }

  // 10. Notify admins that extraction completed
  if (newStatus === 'extracted' || newStatus === 'needs_review') {
    notifyAllAdmins({
      eventType: 'receipt_extracted',
      title: e.amount_naira
        ? `Receipt extracted: ₦${Number(e.amount_naira).toLocaleString()}`
        : 'Receipt extracted',
      description: confidence < 0.8 ? 'Needs review — low confidence' : 'High confidence extraction',
      entityType: 'receipt',
      entityId: receiptId,
    }).catch((err) => console.error('[notifications] broadcast failed:', err))
  }

  return {
    success: true,
    extractionId,
    status: newStatus,
    confidence,
    messageId: rec.message_id ?? null,
  }
}
