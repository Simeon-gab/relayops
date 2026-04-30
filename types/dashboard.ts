export interface WarehouseStockMetric {
  total: number
  lagos: number
  kano: number
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
