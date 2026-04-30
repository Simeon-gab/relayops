import { createClient } from '@/lib/supabase/server'
import { formatNaira } from '@/lib/utils/format'
import type {
  DashboardStats,
  WarehouseStockMetric,
  ActiveShipmentsMetric,
  PendingPaymentsMetric,
  AttentionMetric,
  PendingOrdersMetric,
} from '@/types/dashboard'

type Supabase = Awaited<ReturnType<typeof createClient>>

async function fetchWarehouseStock(db: Supabase): Promise<WarehouseStockMetric | null> {
  try {
    const { data, error } = await db
      .from('warehouse_stock')
      .select('quantity, warehouses(code)')

    if (error) throw error

    type Row = { quantity: number; warehouses: { code: string } | null }
    let lagos = 0
    let kano = 0

    for (const row of (data ?? []) as unknown as Row[]) {
      const qty = row.quantity ?? 0
      const code = row.warehouses?.code
      if (code === 'LAGOS') lagos += qty
      else if (code === 'KANO') kano += qty
    }

    return { total: lagos + kano, lagos, kano }
  } catch {
    return null
  }
}

async function fetchActiveShipments(db: Supabase): Promise<ActiveShipmentsMetric | null> {
  try {
    const { data, error } = await db
      .from('shipments')
      .select('shipment_type')
      .in('status', ['dispatched', 'in_transit'])
      .is('deleted_at', null)

    if (error) throw error

    type Row = { shipment_type: string }
    let dealer = 0
    let transfer = 0

    for (const row of (data ?? []) as Row[]) {
      if (row.shipment_type === 'dealer') dealer++
      else if (row.shipment_type === 'transfer') transfer++
    }

    return { total: dealer + transfer, dealer, transfer }
  } catch {
    return null
  }
}

async function fetchPendingPayments(db: Supabase): Promise<PendingPaymentsMetric | null> {
  try {
    const { data, error } = await db
      .from('shipments')
      .select('total_amount_naira, amount_paid_naira')
      .eq('shipment_type', 'dealer')
      .in('status', ['delivered', 'in_transit'])
      .is('deleted_at', null)
      .not('total_amount_naira', 'is', null)

    if (error) throw error

    type Row = { total_amount_naira: number; amount_paid_naira: number }
    const outstanding = ((data ?? []) as Row[]).filter(
      (r) => Number(r.total_amount_naira) > Number(r.amount_paid_naira)
    )

    const totalRaw = outstanding.reduce(
      (sum, r) => sum + (Number(r.total_amount_naira) - Number(r.amount_paid_naira)),
      0
    )

    return {
      totalFormatted: formatNaira(totalRaw),
      totalRaw,
      shipmentCount: outstanding.length,
    }
  } catch {
    return null
  }
}

async function fetchAttentionItems(db: Supabase): Promise<AttentionMetric | null> {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

    const [receiptsResult, messagesResult, overdueResult] = await Promise.all([
      db
        .from('receipts')
        .select('*', { count: 'exact', head: true })
        .in('status', ['pending_extraction', 'needs_review']),

      db
        .from('message_parse_results')
        .select('*', { count: 'exact', head: true })
        .lt('confidence', 0.7),

      db
        .from('shipments')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'dispatched')
        .lt('dispatched_at', sevenDaysAgo)
        .is('deleted_at', null),
    ])

    if (receiptsResult.error) throw receiptsResult.error
    if (messagesResult.error) throw messagesResult.error
    if (overdueResult.error) throw overdueResult.error

    const receipts = receiptsResult.count ?? 0
    const messages = messagesResult.count ?? 0
    const overdue = overdueResult.count ?? 0

    return { total: receipts + messages + overdue, receipts, messages, overdue }
  } catch {
    return null
  }
}

async function fetchPendingOrders(db: Supabase): Promise<PendingOrdersMetric | null> {
  try {
    const { data, error } = await db
      .from('dealer_orders')
      .select('status')
      .in('status', ['pending', 'partially_fulfilled'])
      .is('deleted_at', null)

    if (error) throw error

    type Row = { status: string }
    let pending = 0
    let partially_fulfilled = 0

    for (const row of (data ?? []) as Row[]) {
      if (row.status === 'pending') pending++
      else if (row.status === 'partially_fulfilled') partially_fulfilled++
    }

    return { total: pending + partially_fulfilled, pending, partially_fulfilled }
  } catch {
    return null
  }
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const db = await createClient()

  const [warehouseStock, activeShipments, pendingPayments, attention, pendingOrders] =
    await Promise.all([
      fetchWarehouseStock(db),
      fetchActiveShipments(db),
      fetchPendingPayments(db),
      fetchAttentionItems(db),
      fetchPendingOrders(db),
    ])

  return { warehouseStock, activeShipments, pendingPayments, attention, pendingOrders }
}
