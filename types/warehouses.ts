export interface WarehouseSummary {
  id: string
  code: string
  name: string
  city: string
  state: string
  is_import_base: boolean
  /** Set when the warehouse belongs to a dealer (Kano → Mr Kabiru). Its stock is not ours. */
  partner_dealer_id: string | null
  partner_dealer_name: string | null
  /** Motorcycles and e-bikes only — spare parts are counted separately. */
  total_units: number
  spare_part_lines: { display_name: string; unit_label: string; quantity: number }[]
}

export interface PartnerDelivery {
  shipment_id: string
  status: string
  dispatched_at: string | null
  created_at: string
  notes: string | null
  items: { display_name: string; category: string; unit_label: string; color: string | null; quantity: number }[]
}

export interface WarehouseStockRow {
  product_id: string
  sku_code: string
  display_name: string
  category: string
  unit_label: string
  color: string | null
  quantity: number
}
