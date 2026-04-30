export type PaymentMethod = 'bank_transfer' | 'cash' | 'pos' | 'mobile_money' | 'other'

export interface ReceiptExtraction {
  id: string
  receipt_id: string
  extracted_amount_naira: number | null
  extracted_date: string | null
  extracted_reference: string | null
  extracted_payer_name: string | null
  extracted_recipient: string | null
  extracted_method: PaymentMethod | null
  field_confidences: {
    amount: number
    date: number
    reference: number
    payer_name: number
    recipient: number
    method: number
  }
  overall_confidence: number
  ai_notes: string | null
  ai_model: string
  is_payment_receipt: boolean
  shipment_match_id: string | null
  created_at: string
  raw_response: Record<string, unknown>
}

export interface ShipmentMatchSuggestion {
  shipment_id: string
  outstanding_naira: number
  dispatched_at: string | null
  status: string
  confidence: number
}

export type ExtractionResult =
  | { success: true; extractionId: string; status: string; confidence: number }
  | { success: false; error: string }

export interface CreatePaymentFromReceiptInput {
  amount_naira: number
  payment_date: string
  payment_reference: string | null
  payment_method: string | null
  shipment_id: string | null
  notes: string | null
}
