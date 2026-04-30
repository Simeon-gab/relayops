import { createClient } from '@/lib/supabase/server'
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

export async function getShipmentForMatch(shipmentId: string) {
  const db = await createClient()
  const { data } = await db
    .from('shipments')
    .select('id, total_amount_naira, amount_paid_naira, dispatched_at, status, destination_dealer_id')
    .eq('id', shipmentId)
    .single()
  return data
}
