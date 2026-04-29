export interface DealerSummary {
  id: string
  business_name: string
  contact_name: string
  phone: string
  city: string
  state: string
  preferred_language: string
  served_by_warehouse_code: string
  active_shipments_count: number
  outstanding_balance_naira: number
}

export interface DealerDetail {
  id: string
  business_name: string
  contact_name: string
  phone: string
  email: string | null
  city: string
  state: string
  preferred_language: string
  credit_limit_naira: number | null
  active: boolean
  notes: string | null
  served_by_warehouse_code: string
  served_by_warehouse_name: string
  // aggregate stats
  total_shipments: number
  active_shipments: number
  total_paid_naira: number
  outstanding_balance_naira: number
  total_orders: number
}

export interface DealerShipment {
  id: string
  status: string
  dispatched_at: string | null
  total_amount_naira: number | null
  amount_paid_naira: number
  item_count: number
}

export interface DealerPayment {
  id: string
  amount_naira: number
  payment_date: string
  payment_reference: string | null
  shipment_id: string | null
}

export interface DealerMessage {
  id: string
  direction: string
  original_text: string
  language: string | null
  created_at: string
  parsed_intent: string | null
}

export interface DealerOrder {
  id: string
  status: string
  requested_at: string
  item_count: number
}

export interface DealerActivity {
  shipments: DealerShipment[]
  payments: DealerPayment[]
  messages: DealerMessage[]
  orders: DealerOrder[]
}
