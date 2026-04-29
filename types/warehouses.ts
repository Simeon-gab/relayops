export interface WarehouseSummary {
  id: string
  code: string
  name: string
  city: string
  state: string
  is_import_base: boolean
  total_units: number
}

export interface WarehouseStockRow {
  product_id: string
  sku_code: string
  display_name: string
  category: string
  color: string | null
  quantity: number
}
