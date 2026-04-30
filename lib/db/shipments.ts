import { createClient } from '@/lib/supabase/server'
import type {
  ShipmentFilters,
  ShipmentSummary,
  ShipmentDetail,
  ShipmentStatusCounts,
  ShipmentItemRow,
  StatusEvent,
} from '@/types/shipments'

type Supabase = Awaited<ReturnType<typeof createClient>>

// ─── getShipments ─────────────────────────────────────────────────────────────

const SHIPMENT_STATUS_PRIORITY: Record<string, number> = {
  pending: 1,
  dispatched: 2,
  in_transit: 3,
  delivered: 4,
  cancelled: 5,
}

type RawSummary = {
  id: string
  shipment_type: string
  status: string
  created_at: string
  destination_city: string | null
  dispatched_at: string | null
  total_amount_naira: number | null
  amount_paid_naira: number
  origin_warehouse: { code: string } | null
  destination_warehouse: { code: string } | null
  destination_dealer: { business_name: string } | null
  shipment_items: Array<{ id: string }>
}

function byShipmentPriority(a: RawSummary, b: RawSummary): number {
  const pa = SHIPMENT_STATUS_PRIORITY[a.status] ?? 6
  const pb = SHIPMENT_STATUS_PRIORITY[b.status] ?? 6
  if (pa !== pb) return pa - pb

  // Within delivered: unpaid/partial ahead of fully paid
  if (a.status === 'delivered') {
    const aOwed = Number(a.total_amount_naira ?? 0) - Number(a.amount_paid_naira) > 0
    const bOwed = Number(b.total_amount_naira ?? 0) - Number(b.amount_paid_naira) > 0
    if (aOwed !== bOwed) return aOwed ? -1 : 1
  }

  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
}

export async function getShipments(filters: ShipmentFilters = {}): Promise<ShipmentSummary[]> {
  const db = await createClient()

  let query = db
    .from('shipments')
    .select(`
      id, shipment_type, status, created_at, destination_city, dispatched_at,
      total_amount_naira, amount_paid_naira,
      origin_warehouse:warehouses!origin_warehouse_id(code),
      destination_warehouse:warehouses!destination_warehouse_id(code),
      destination_dealer:dealers!destination_dealer_id(business_name),
      shipment_items(id)
    `)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(100)

  if (filters.status && filters.status.length > 0) {
    query = query.in('status', filters.status)
  }
  if (filters.type) {
    query = query.eq('shipment_type', filters.type)
  }

  const { data, error } = await query
  if (error) throw error

  const raw = ((data ?? []) as unknown as RawSummary[])
  raw.sort(byShipmentPriority)

  let rows = raw.map((s) => ({
    id: s.id,
    shipment_type: s.shipment_type,
    status: s.status,
    origin_warehouse_code: s.origin_warehouse?.code ?? '—',
    destination_warehouse_code: s.destination_warehouse?.code ?? null,
    destination_dealer_name: s.destination_dealer?.business_name ?? null,
    destination_city: s.destination_city,
    dispatched_at: s.dispatched_at,
    total_amount_naira: s.total_amount_naira != null ? Number(s.total_amount_naira) : null,
    amount_paid_naira: Number(s.amount_paid_naira),
    item_count: s.shipment_items.length,
  }))

  if (filters.search) {
    const q = filters.search.toLowerCase()
    rows = rows.filter(
      (r) =>
        r.destination_dealer_name?.toLowerCase().includes(q) ||
        r.destination_city?.toLowerCase().includes(q) ||
        r.id.includes(filters.search!)
    )
  }

  return rows
}

// ─── getShipment ──────────────────────────────────────────────────────────────

type RawDetail = {
  id: string
  shipment_type: string
  status: string
  destination_city: string | null
  destination_state: string | null
  total_amount_naira: number | null
  amount_paid_naira: number
  notes: string | null
  dispatched_at: string | null
  delivered_at: string | null
  created_at: string
  origin_warehouse: { code: string; name: string } | null
  destination_warehouse: { code: string; name: string } | null
  destination_dealer: {
    id: string
    business_name: string
    contact_name: string
    phone: string
    city: string
    state: string
    preferred_language: string
  } | null
  shipment_items: Array<{
    product_id: string
    quantity: number
    unit_price_naira: number | null
    products: { sku_code: string; display_name: string; color: string | null } | null
  }>
}

type RawStatusEvent = {
  id: string
  from_status: string | null
  to_status: string
  event_at: string
  recorded_at: string
  source: string
  notes: string | null
}

export async function getShipment(shipmentId: string): Promise<ShipmentDetail | null> {
  const db = await createClient()

  const [shipmentResult, eventsResult] = await Promise.all([
    db
      .from('shipments')
      .select(`
        id, shipment_type, status, destination_city, destination_state,
        total_amount_naira, amount_paid_naira, notes, dispatched_at, delivered_at, created_at,
        origin_warehouse:warehouses!origin_warehouse_id(code, name),
        destination_warehouse:warehouses!destination_warehouse_id(code, name),
        destination_dealer:dealers!destination_dealer_id(id, business_name, contact_name, phone, city, state, preferred_language),
        shipment_items(product_id, quantity, unit_price_naira, products(sku_code, display_name, color))
      `)
      .eq('id', shipmentId)
      .is('deleted_at', null)
      .single(),

    db
      .from('status_events')
      .select('id, from_status, to_status, event_at, recorded_at, source, notes')
      .eq('shipment_id', shipmentId)
      .order('event_at', { ascending: true }),
  ])

  if (shipmentResult.error) return null

  const s = shipmentResult.data as unknown as RawDetail

  const items: ShipmentItemRow[] = s.shipment_items.map((i) => ({
    product_id: i.product_id,
    sku_code: i.products?.sku_code ?? '—',
    display_name: i.products?.display_name ?? '—',
    color: i.products?.color ?? null,
    quantity: i.quantity,
    unit_price_naira: i.unit_price_naira != null ? Number(i.unit_price_naira) : null,
  }))

  const status_events: StatusEvent[] = ((eventsResult.data ?? []) as unknown as RawStatusEvent[]).map(
    (e) => ({
      id: e.id,
      from_status: e.from_status,
      to_status: e.to_status,
      event_at: e.event_at,
      recorded_at: e.recorded_at,
      source: e.source,
      notes: e.notes,
    })
  )

  return {
    id: s.id,
    shipment_type: s.shipment_type,
    status: s.status,
    destination_city: s.destination_city,
    destination_state: s.destination_state,
    total_amount_naira: s.total_amount_naira != null ? Number(s.total_amount_naira) : null,
    amount_paid_naira: Number(s.amount_paid_naira),
    notes: s.notes,
    dispatched_at: s.dispatched_at,
    delivered_at: s.delivered_at,
    created_at: s.created_at,
    origin_warehouse: s.origin_warehouse ?? { code: '—', name: '—' },
    destination_warehouse: s.destination_warehouse ?? null,
    destination_dealer: s.destination_dealer ?? null,
    items,
    status_events,
  }
}

// ─── getShipmentStatusCounts ─────────────────────────────────────────────────

export async function getShipmentStatusCounts(): Promise<ShipmentStatusCounts> {
  const db = await createClient()

  const { data } = await db
    .from('shipments')
    .select('status')
    .is('deleted_at', null)

  const counts: ShipmentStatusCounts = {
    pending: 0,
    dispatched: 0,
    in_transit: 0,
    delivered: 0,
    all_active: 0,
  }

  for (const row of (data ?? []) as Array<{ status: string }>) {
    const s = row.status as keyof ShipmentStatusCounts
    if (s in counts) counts[s]++
    if (!['delivered', 'cancelled'].includes(row.status)) counts.all_active++
  }

  return counts
}
