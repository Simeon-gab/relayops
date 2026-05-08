import { createClient } from '@/lib/supabase/server'
import type { DealerOrderSummary, DealerOrderDetail, DealerOrderItemDetail } from '@/types/dealer-orders'

export interface LinkedShipmentSummary {
  id: string
  status: string
  total_amount_naira: number | null
  dispatched_at: string | null
  delivered_at: string | null
  items_count: number
}

const STATUS_PRIORITY: Record<string, number> = {
  pending: 1,
  partially_fulfilled: 2,
  fulfilled: 3,
  cancelled: 4,
}

function byStatusPriority(a: { status: string; created_at: string }, b: { status: string; created_at: string }): number {
  const diff = (STATUS_PRIORITY[a.status] ?? 5) - (STATUS_PRIORITY[b.status] ?? 5)
  if (diff !== 0) return diff
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
}

type RawOrderRow = {
  id: string
  status: string
  requested_at: string
  created_at: string
  dealers: { id: string; business_name: string; city: string; state: string } | null
  dealer_order_items: Array<{
    quantity_requested: number
    products: { sku_code: string } | null
  }>
}

type RawOrderDetail = {
  id: string
  status: string
  requested_at: string
  notes: string | null
  source: string
  dealers: { id: string; business_name: string; city: string; state: string; preferred_language: string } | null
  dealer_order_items: Array<{
    id: string
    quantity_requested: number
    quantity_fulfilled: number
    unit_price_naira: number | null
    notes: string | null
    products: {
      id: string
      sku_code: string
      display_name: string
      color: string | null
      category: string
    } | null
  }>
}

export async function getDealerOrders(statusFilter?: string): Promise<DealerOrderSummary[]> {
  const db = await createClient()

  let query = db
    .from('dealer_orders')
    .select(
      'id, status, requested_at, created_at, dealers(id, business_name, city, state), dealer_order_items(quantity_requested, products(sku_code))'
    )
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (statusFilter && statusFilter !== 'all') {
    query = query.eq('status', statusFilter)
  }

  const { data, error } = await query
  if (error) throw error

  const rows = ((data ?? []) as unknown as RawOrderRow[])
  // When no status filter is active, apply priority sort in JS (CASE expression
  // not supported by PostgREST .order()). When filtered to a single status the
  // sort still works — all rows share the same priority so they sort by
  // created_at desc.
  if (!statusFilter || statusFilter === 'all') {
    rows.sort(byStatusPriority)
  }

  return rows.map((o) => {
    const items = o.dealer_order_items.map((i) => ({
      sku_code: i.products?.sku_code ?? '—',
      quantity: i.quantity_requested,
    }))
    const total_qty = items.reduce((sum, i) => sum + i.quantity, 0)
    return {
      id: o.id,
      status: o.status,
      requested_at: o.requested_at,
      dealer_id: o.dealers?.id ?? '',
      business_name: o.dealers?.business_name ?? '—',
      city: o.dealers?.city ?? '',
      state: o.dealers?.state ?? '',
      total_qty,
      items,
    }
  })
}

export async function getDealerOrder(orderId: string): Promise<DealerOrderDetail | null> {
  const db = await createClient()

  const { data, error } = await db
    .from('dealer_orders')
    .select(
      'id, status, requested_at, notes, source, dealers(id, business_name, city, state, preferred_language), dealer_order_items(id, quantity_requested, quantity_fulfilled, unit_price_naira, notes, products(id, sku_code, display_name, color, category))'
    )
    .eq('id', orderId)
    .is('deleted_at', null)
    .single()

  if (error) return null

  const o = data as unknown as RawOrderDetail

  const items: DealerOrderItemDetail[] = o.dealer_order_items.map((i) => ({
    id: i.id,
    product_id: i.products?.id ?? '',
    sku_code: i.products?.sku_code ?? '—',
    display_name: i.products?.display_name ?? '—',
    color: i.products?.color ?? null,
    category: i.products?.category ?? '—',
    quantity_requested: i.quantity_requested,
    quantity_fulfilled: i.quantity_fulfilled,
    unit_price_naira: i.unit_price_naira != null ? Number(i.unit_price_naira) : null,
    notes: i.notes,
  }))

  return {
    id: o.id,
    status: o.status,
    requested_at: o.requested_at,
    notes: o.notes,
    source: o.source,
    dealer_id: o.dealers?.id ?? '',
    business_name: o.dealers?.business_name ?? '—',
    city: o.dealers?.city ?? '',
    state: o.dealers?.state ?? '',
    preferred_language: o.dealers?.preferred_language ?? 'en',
    items,
  }
}

export async function getOrderLinkedShipments(
  orderId: string
): Promise<LinkedShipmentSummary[]> {
  const db = await createClient()

  const { data: orderItems } = await db
    .from('dealer_order_items')
    .select('id')
    .eq('dealer_order_id', orderId)

  const orderItemIds = (orderItems ?? []).map((i: { id: string }) => i.id)
  if (!orderItemIds.length) return []

  const { data: links } = await db
    .from('shipment_items')
    .select('shipment_id')
    .in('dealer_order_item_id', orderItemIds)

  const shipmentIds = [...new Set((links ?? []).map((l: { shipment_id: string }) => l.shipment_id))]
  if (!shipmentIds.length) return []

  const { data: shipments } = await db
    .from('shipments')
    .select('id, status, total_amount_naira, dispatched_at, delivered_at, shipment_items(id)')
    .in('id', shipmentIds)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  return ((shipments ?? []) as unknown as Array<{
    id: string
    status: string
    total_amount_naira: number | null
    dispatched_at: string | null
    delivered_at: string | null
    shipment_items: Array<{ id: string }>
  }>).map((s) => ({
    id: s.id,
    status: s.status,
    total_amount_naira: s.total_amount_naira != null ? Number(s.total_amount_naira) : null,
    dispatched_at: s.dispatched_at,
    delivered_at: s.delivered_at,
    items_count: s.shipment_items.length,
  }))
}
