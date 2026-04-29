export interface ShipmentFilters {
  status?: string[]
  type?: 'transfer' | 'dealer'
  search?: string
}

export interface ShipmentSummary {
  id: string
  shipment_type: string
  status: string
  origin_warehouse_code: string
  destination_warehouse_code: string | null
  destination_dealer_name: string | null
  destination_city: string | null
  dispatched_at: string | null
  total_amount_naira: number | null
  amount_paid_naira: number
  item_count: number
}

export interface StatusEvent {
  id: string
  from_status: string | null
  to_status: string
  event_at: string
  recorded_at: string
  source: string
  notes: string | null
}

export interface ShipmentItemRow {
  product_id: string
  sku_code: string
  display_name: string
  color: string | null
  quantity: number
  unit_price_naira: number | null
}

export interface ShipmentDetail {
  id: string
  shipment_type: string
  status: string
  destination_city: string | null
  destination_state: string | null
  total_amount_naira: number | null
  amount_paid_naira: number
  notes: string | null
  dispatched_at: string | null
  delivered_at: string | null
  created_at: string
  origin_warehouse: { code: string; name: string }
  destination_warehouse: { code: string; name: string } | null
  destination_dealer: {
    id: string
    business_name: string
    contact_name: string
    phone: string
    city: string
    state: string
    preferred_language: string
  } | null
  items: ShipmentItemRow[]
  status_events: StatusEvent[]
}

export interface ShipmentStatusCounts {
  pending: number
  dispatched: number
  in_transit: number
  delivered: number
  all_active: number
}
