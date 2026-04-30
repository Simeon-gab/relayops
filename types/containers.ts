export interface ContainerSummary {
  id: string
  container_number: string
  arrived_at: string
  status: string
  notes: string | null
  total_units: number
  sku_count: number
}

export interface ContainerItem {
  product_id: string
  sku_code: string
  display_name: string
  category: string
  color: string | null
  quantity: number
}

export interface ContainerDetail {
  id: string
  container_number: string
  arrived_at: string
  status: string
  notes: string | null
  bill_of_lading: string | null
  shipping_line: string | null
  expected_arrival_date: string | null
  origin_port: string | null
  items: ContainerItem[]
}
