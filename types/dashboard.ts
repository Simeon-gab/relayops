export interface WarehouseStockMetric {
  /** Motorcycles and e-bikes in warehouses we own. Partner warehouses (Kano) are excluded. */
  total: number
  lagos: number
  /** "13 cartons spare parts · 10 pieces tyre with alloy wheel", or null when none. */
  parts: string | null
}

export interface ActiveShipmentsMetric {
  total: number
  dealer: number
  transfer: number
}

export interface PendingPaymentsMetric {
  totalFormatted: string
  totalRaw: number
  shipmentCount: number
}

export interface AttentionMetric {
  total: number
  receipts: number
  messages: number
  overdue: number
  pending_containers: number
}

export interface PendingOrdersMetric {
  total: number
  pending: number
  partially_fulfilled: number
}

export interface DashboardStats {
  warehouseStock: WarehouseStockMetric | null
  activeShipments: ActiveShipmentsMetric | null
  pendingPayments: PendingPaymentsMetric | null
  attention: AttentionMetric | null
  pendingOrders: PendingOrdersMetric | null
}
