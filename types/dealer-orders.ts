export interface OrderSummaryItem {
  sku_code: string
  quantity: number
}

export interface DealerOrderSummary {
  id: string
  status: string
  requested_at: string
  dealer_id: string
  business_name: string
  city: string
  state: string
  total_qty: number
  items: OrderSummaryItem[]
}

export interface DealerOrderItemDetail {
  id: string
  product_id: string
  sku_code: string
  display_name: string
  color: string | null
  category: string
  quantity_requested: number
  quantity_fulfilled: number
  unit_price_naira: number | null
  notes: string | null
}

export interface DealerOrderDetail {
  id: string
  status: string
  requested_at: string
  notes: string | null
  source: string
  dealer_id: string
  business_name: string
  city: string
  state: string
  items: DealerOrderItemDetail[]
}
