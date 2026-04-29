export interface ProductSummary {
  id: string
  sku_code: string
  display_name: string
  category: string
  color: string | null
  engine_size_cc: number | null
  import_cost_naira: number | null
  sell_price_naira: number | null
  active: boolean
  total_stock: number
}

export interface StockByWarehouse {
  warehouse_id: string
  warehouse_name: string
  warehouse_code: string
  quantity: number
}

export interface ProductDetail extends ProductSummary {
  stock_by_warehouse: StockByWarehouse[]
}
