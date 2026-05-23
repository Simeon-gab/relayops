import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { ReceiptExtraction, PaymentMethod } from '@/types/receipts'

type RawExtraction = {
  id: string
  receipt_id: string
  extracted_amount_naira: number | null
  extracted_date: string | null
  extracted_reference: string | null
  extracted_payer_name: string | null
  extracted_recipient: string | null
  extracted_method: string | null
  field_confidences: Record<string, number>
  overall_confidence: number
  ai_notes: string | null
  ai_model: string
  is_payment_receipt: boolean
  shipment_match_id: string | null
  created_at: string
  raw_response: Record<string, unknown>
}

export async function getReceiptExtraction(receiptId: string): Promise<ReceiptExtraction | null> {
  const db = await createClient()

  const { data, error } = await db
    .from('receipt_extractions')
    .select(
      'id, receipt_id, extracted_amount_naira, extracted_date, extracted_reference, extracted_payer_name, extracted_recipient, extracted_method, field_confidences, overall_confidence, ai_notes, ai_model, is_payment_receipt, shipment_match_id, created_at, raw_response'
    )
    .eq('receipt_id', receiptId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (error) return null

  const r = data as unknown as RawExtraction

  return {
    id: r.id,
    receipt_id: r.receipt_id,
    extracted_amount_naira: r.extracted_amount_naira,
    extracted_date: r.extracted_date,
    extracted_reference: r.extracted_reference,
    extracted_payer_name: r.extracted_payer_name,
    extracted_recipient: r.extracted_recipient,
    extracted_method: (r.extracted_method as PaymentMethod) ?? null,
    field_confidences: {
      amount: r.field_confidences?.amount ?? 0,
      date: r.field_confidences?.date ?? 0,
      reference: r.field_confidences?.reference ?? 0,
      payer_name: r.field_confidences?.payer_name ?? 0,
      recipient: r.field_confidences?.recipient ?? 0,
      method: r.field_confidences?.method ?? 0,
    },
    overall_confidence: Number(r.overall_confidence),
    ai_notes: r.ai_notes,
    ai_model: r.ai_model,
    is_payment_receipt: r.is_payment_receipt,
    shipment_match_id: r.shipment_match_id,
    created_at: r.created_at,
    raw_response: r.raw_response,
  }
}

// ─── Standalone (dealer-portal) receipt helpers ────────────────────────────────

export type StandaloneReceiptSummary = {
  id: string
  dealer_id: string
  business_name: string
  status: string
  file_type: string
  linked_order_id: string | null
  notes: string | null
  created_at: string
  overall_confidence: number | null
  is_payment_receipt: boolean | null
}

export type StandaloneReceiptDetail = {
  id: string
  dealer_id: string
  business_name: string
  city: string
  state: string
  status: string
  file_type: string
  storage_path: string
  linked_order_id: string | null
  notes: string | null
  created_at: string
}

type RawReceiptRow = {
  id: string
  dealer_id: string
  status: string
  file_type: string
  linked_order_id: string | null
  notes: string | null
  created_at: string
  dealers: { business_name: string; city: string; state: string } | null
  receipt_extractions: Array<{ overall_confidence: number; is_payment_receipt: boolean }>
}

export async function getStandaloneReceipts(
  statusFilter?: 'pending' | 'all'
): Promise<StandaloneReceiptSummary[]> {
  const db = await createClient()

  let query = db
    .from('receipts')
    .select(`
      id, dealer_id, status, file_type, linked_order_id, notes, created_at,
      dealers!dealer_id(business_name, city, state),
      receipt_extractions!receipt_id(overall_confidence, is_payment_receipt)
    `)
    .eq('upload_source', 'dealer_portal')
    .order('created_at', { ascending: false })
    .limit(200)

  if (statusFilter === 'pending') {
    query = query.in('status', ['pending_extraction', 'extracted', 'needs_review'])
  }

  const { data, error } = await query
  if (error) throw error

  return ((data ?? []) as unknown as RawReceiptRow[]).map((r) => {
    const latestExtraction = r.receipt_extractions?.[0] ?? null
    return {
      id: r.id,
      dealer_id: r.dealer_id,
      business_name: r.dealers?.business_name ?? '—',
      status: r.status,
      file_type: r.file_type,
      linked_order_id: r.linked_order_id,
      notes: r.notes,
      created_at: r.created_at,
      overall_confidence: latestExtraction?.overall_confidence ?? null,
      is_payment_receipt: latestExtraction?.is_payment_receipt ?? null,
    }
  })
}

type RawReceiptDetailRow = {
  id: string
  dealer_id: string
  status: string
  file_type: string
  storage_path: string
  linked_order_id: string | null
  notes: string | null
  created_at: string
  dealers: { business_name: string; city: string; state: string } | null
}

export async function getStandaloneReceiptById(
  id: string
): Promise<StandaloneReceiptDetail | null> {
  const db = await createClient()
  const { data, error } = await db
    .from('receipts')
    .select(`
      id, dealer_id, status, file_type, storage_path, linked_order_id, notes, created_at,
      dealers!dealer_id(business_name, city, state)
    `)
    .eq('id', id)
    .single()

  if (error || !data) return null

  const r = data as unknown as RawReceiptDetailRow
  return {
    id: r.id,
    dealer_id: r.dealer_id,
    business_name: r.dealers?.business_name ?? '—',
    city: r.dealers?.city ?? '',
    state: r.dealers?.state ?? '',
    status: r.status,
    file_type: r.file_type,
    storage_path: r.storage_path,
    linked_order_id: r.linked_order_id,
    notes: r.notes,
    created_at: r.created_at,
  }
}

export async function getReceiptSignedUrl(storagePath: string): Promise<string | null> {
  const adminDb = createAdminClient()
  const { data, error } = await adminDb.storage
    .from('receipts')
    .createSignedUrl(storagePath, 3600)

  if (error || !data?.signedUrl) return null
  return data.signedUrl
}

export async function getShipmentForMatch(shipmentId: string) {
  const db = await createClient()
  const { data } = await db
    .from('shipments')
    .select('id, total_amount_naira, amount_paid_naira, dispatched_at, status, destination_dealer_id')
    .eq('id', shipmentId)
    .single()
  return data
}
