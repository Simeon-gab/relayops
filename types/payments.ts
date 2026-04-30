export interface PaymentSummary {
  id: string
  amount_naira: number
  payment_date: string
  payment_method: string | null
  payment_reference: string | null
  recorded_at: string
  source: string
  dealer_id: string
  business_name: string
  city: string
  shipment_id: string | null
}

export interface PaymentDetail {
  id: string
  amount_naira: number
  payment_date: string
  payment_method: string | null
  payment_reference: string | null
  recorded_at: string
  source: string
  notes: string | null
  dealer_id: string
  business_name: string
  city: string
  state: string
  shipment_id: string | null
  shipment_status: string | null
  shipment_dispatched_at: string | null
  shipment_total: number | null
  shipment_paid: number | null
  recorded_by_email: string
}

export interface OutstandingShipment {
  id: string
  dispatched_at: string | null
  total_amount_naira: number
  amount_paid_naira: number
}
