import { createClient } from '@/lib/supabase/server'
import type { DailySummaryMetrics } from '@/lib/ai/prompts/daily-summary'

export type { DailySummaryMetrics }

const EMPTY: DailySummaryMetrics = {
  shipments_dispatched_yesterday: 0,
  deliveries_confirmed_yesterday: 0,
  payments_received_yesterday_naira: 0,
  new_orders_yesterday: 0,
  pending_orders_total: 0,
  overdue_shipments: [],
  low_stock_items: [],
}

export async function fetchDailyMetrics(): Promise<DailySummaryMetrics> {
  try {
    const db = await createClient()

    const now = new Date()
    const todayStart = new Date(now)
    todayStart.setHours(0, 0, 0, 0)

    const yesterdayStart = new Date(todayStart)
    yesterdayStart.setDate(yesterdayStart.getDate() - 1)

    const sevenDaysAgo = new Date(todayStart)
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const [
      dispatchedRes,
      deliveredRes,
      paymentsRes,
      ordersRes,
      pendingOrdersRes,
      overdueRes,
      lowStockRes,
    ] = await Promise.all([
      db
        .from('shipments')
        .select('id', { count: 'exact', head: true })
        .gte('dispatched_at', yesterdayStart.toISOString())
        .lt('dispatched_at', todayStart.toISOString())
        .is('deleted_at', null),

      db
        .from('shipments')
        .select('id', { count: 'exact', head: true })
        .gte('delivered_at', yesterdayStart.toISOString())
        .lt('delivered_at', todayStart.toISOString())
        .is('deleted_at', null),

      db
        .from('payments')
        .select('amount_naira')
        .gte('recorded_at', yesterdayStart.toISOString())
        .lt('recorded_at', todayStart.toISOString())
        .is('deleted_at', null),

      db
        .from('dealer_orders')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', yesterdayStart.toISOString())
        .lt('created_at', todayStart.toISOString())
        .is('deleted_at', null),

      db
        .from('dealer_orders')
        .select('id', { count: 'exact', head: true })
        .in('status', ['pending', 'partially_fulfilled'])
        .is('deleted_at', null),

      db
        .from('shipments')
        .select('destination_city, destination_state, dispatched_at')
        .eq('status', 'dispatched')
        .lt('dispatched_at', sevenDaysAgo.toISOString())
        .is('deleted_at', null)
        .limit(10),

      db
        .from('warehouse_stock')
        .select('quantity, warehouses(code), products(display_name, sku_code)')
        .lt('quantity', 5)
        .gt('quantity', 0),
    ])

    type PayRow = { amount_naira: number }
    const paymentsNaira = ((paymentsRes.data ?? []) as PayRow[]).reduce(
      (sum, r) => sum + Number(r.amount_naira),
      0
    )

    type OverdueRow = {
      destination_city: string | null
      destination_state: string | null
      dispatched_at: string | null
    }
    const overdueShipments = ((overdueRes.data ?? []) as OverdueRow[]).map(s => ({
      destination:
        [s.destination_city, s.destination_state].filter(Boolean).join(', ') || 'unknown location',
      dispatched_at: s.dispatched_at,
    }))

    type StockRow = {
      quantity: number
      warehouses: { code: string } | null
      products: { display_name: string; sku_code: string } | null
    }
    const lowStockItems = ((lowStockRes.data ?? []) as unknown as StockRow[]).map(r => ({
      product: r.products?.display_name ?? 'Unknown',
      sku: r.products?.sku_code ?? '',
      warehouse: r.warehouses?.code ?? 'Unknown',
      quantity: r.quantity,
    }))

    return {
      shipments_dispatched_yesterday: dispatchedRes.count ?? 0,
      deliveries_confirmed_yesterday: deliveredRes.count ?? 0,
      payments_received_yesterday_naira: paymentsNaira,
      new_orders_yesterday: ordersRes.count ?? 0,
      pending_orders_total: pendingOrdersRes.count ?? 0,
      overdue_shipments: overdueShipments,
      low_stock_items: lowStockItems,
    }
  } catch (err) {
    console.error('[fetchDailyMetrics]', err)
    return EMPTY
  }
}
