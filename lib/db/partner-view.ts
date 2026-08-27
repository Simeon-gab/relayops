import { createClient } from '@/lib/supabase/server'
import { WATCHDOG } from '@/lib/policy'

/**
 * Data for the business partner's dashboard.
 *
 * He is in China and owns the physical chain: what goes in the container,
 * when it lands, how it gets split, and where every unit ended up. Every
 * query here deliberately omits naira — no unit prices, no shipment values,
 * no payment state. Enforced for payments/receipts at the RLS layer in
 * migration 0015; kept out of these selects so nothing leaks through a join.
 */

export interface PipelineContainer {
  id: string
  container_number: string
  status: string
  origin_port: string | null
  shipping_line: string | null
  expected_arrival_date: string | null
  arrived_at: string | null
  total_units: number
  sku_count: number
  /** Negative = still to come, positive = days since landing. Null when undated. */
  days_from_arrival: number | null
  /** Actual arrival later than expected, in days. Null when not yet landed. */
  slip_days: number | null
}

export interface DestinationRow {
  city: string
  state: string
  units: number
  shipments: number
  delivered: number
  in_transit: number
}

export interface SkuFlowRow {
  sku_code: string
  display_name: string
  in_lagos: number
  in_kano: number
  dispatched: number
}

export interface PartnerView {
  pipeline: PipelineContainer[]
  destinations: DestinationRow[]
  skuFlow: SkuFlowRow[]
  awaitingAllocation: number
  inTransitShipments: number
  unitsOnTheRoad: number
}

function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 86_400_000)
}

async function fetchPipeline(
  db: Awaited<ReturnType<typeof createClient>>
): Promise<PipelineContainer[]> {
  const { data, error } = await db
    .from('containers')
    .select(
      'id, container_number, status, origin_port, shipping_line, expected_arrival_date, arrived_at, container_items(quantity)'
    )
    .is('deleted_at', null)
    .order('expected_arrival_date', { ascending: true, nullsFirst: false })
    .limit(20)

  if (error) throw error

  type Row = {
    id: string
    container_number: string
    status: string
    origin_port: string | null
    shipping_line: string | null
    expected_arrival_date: string | null
    arrived_at: string | null
    container_items: Array<{ quantity: number }>
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return ((data ?? []) as unknown as Row[]).map((c) => {
    const items = c.container_items ?? []
    const arrived = c.arrived_at ? new Date(c.arrived_at) : null
    const expected = c.expected_arrival_date ? new Date(c.expected_arrival_date) : null

    return {
      id: c.id,
      container_number: c.container_number,
      status: c.status,
      origin_port: c.origin_port,
      shipping_line: c.shipping_line,
      expected_arrival_date: c.expected_arrival_date,
      arrived_at: c.arrived_at,
      total_units: items.reduce((sum, i) => sum + (i.quantity ?? 0), 0),
      sku_count: items.length,
      days_from_arrival: arrived
        ? daysBetween(arrived, today)
        : expected
          ? daysBetween(today, expected) * -1
          : null,
      slip_days: arrived && expected ? daysBetween(expected, arrived) : null,
    }
  })
}

/**
 * Where units physically went, grouped by destination city.
 *
 * Quantities by SKU per city — not individual machines. container_items and
 * shipment_items are quantity-based, so unit-level tracing ("this chassis
 * went to Kaduna") is not possible without a per-unit table.
 */
async function fetchDestinations(
  db: Awaited<ReturnType<typeof createClient>>
): Promise<{ destinations: DestinationRow[]; unitsOnTheRoad: number; inTransit: number }> {
  const { data, error } = await db
    .from('shipments')
    .select('id, status, destination_city, destination_state, shipment_items(quantity)')
    .eq('shipment_type', 'dealer')
    .in('status', ['dispatched', 'in_transit', 'delivered'])
    .is('deleted_at', null)

  if (error) throw error

  type Row = {
    id: string
    status: string
    destination_city: string | null
    destination_state: string | null
    shipment_items: Array<{ quantity: number }>
  }

  const byCity = new Map<string, DestinationRow>()
  let unitsOnTheRoad = 0
  let inTransit = 0

  for (const s of (data ?? []) as unknown as Row[]) {
    const city = s.destination_city?.trim() || 'Unspecified'
    const state = s.destination_state?.trim() || ''
    const key = `${city}|${state}`
    const units = (s.shipment_items ?? []).reduce((sum, i) => sum + (i.quantity ?? 0), 0)

    const row = byCity.get(key) ?? {
      city,
      state,
      units: 0,
      shipments: 0,
      delivered: 0,
      in_transit: 0,
    }
    row.units += units
    row.shipments += 1
    if (s.status === 'delivered') row.delivered += 1
    else {
      row.in_transit += 1
      unitsOnTheRoad += units
      inTransit += 1
    }
    byCity.set(key, row)
  }

  return {
    destinations: [...byCity.values()].sort((a, b) => b.units - a.units),
    unitsOnTheRoad,
    inTransit,
  }
}

/** Per-SKU position: what is sitting in each warehouse vs already gone out. */
async function fetchSkuFlow(
  db: Awaited<ReturnType<typeof createClient>>
): Promise<SkuFlowRow[]> {
  const [stockRes, movesRes] = await Promise.all([
    db.from('warehouse_stock').select('quantity, warehouses(code), products(sku_code, display_name)'),
    db
      .from('stock_movements')
      .select('quantity_delta, products(sku_code)')
      .eq('change_type', 'shipment_dispatch'),
  ])

  if (stockRes.error) throw stockRes.error

  type StockRow = {
    quantity: number
    warehouses: { code: string } | null
    products: { sku_code: string; display_name: string } | null
  }
  type MoveRow = { quantity_delta: number; products: { sku_code: string } | null }

  const bySku = new Map<string, SkuFlowRow>()

  for (const r of (stockRes.data ?? []) as unknown as StockRow[]) {
    const sku = r.products?.sku_code
    if (!sku) continue
    const row = bySku.get(sku) ?? {
      sku_code: sku,
      display_name: r.products?.display_name ?? sku,
      in_lagos: 0,
      in_kano: 0,
      dispatched: 0,
    }
    if (r.warehouses?.code === 'LAGOS') row.in_lagos += r.quantity ?? 0
    else if (r.warehouses?.code === 'KANO') row.in_kano += r.quantity ?? 0
    bySku.set(sku, row)
  }

  // quantity_delta is negative on dispatch, so flip the sign for display.
  for (const m of (movesRes.data ?? []) as unknown as MoveRow[]) {
    const sku = m.products?.sku_code
    if (!sku) continue
    const row = bySku.get(sku)
    if (row) row.dispatched += Math.abs(m.quantity_delta ?? 0)
  }

  return [...bySku.values()].sort((a, b) => b.dispatched - a.dispatched)
}

const EMPTY: PartnerView = {
  pipeline: [],
  destinations: [],
  skuFlow: [],
  awaitingAllocation: 0,
  inTransitShipments: 0,
  unitsOnTheRoad: 0,
}

export async function fetchPartnerView(): Promise<PartnerView> {
  try {
    const db = await createClient()

    const [pipeline, destinationData, skuFlow] = await Promise.all([
      fetchPipeline(db),
      fetchDestinations(db),
      fetchSkuFlow(db),
    ])

    return {
      pipeline,
      destinations: destinationData.destinations,
      skuFlow,
      awaitingAllocation: pipeline.filter((c) => c.status === 'pending_allocation').length,
      inTransitShipments: destinationData.inTransit,
      unitsOnTheRoad: destinationData.unitsOnTheRoad,
    }
  } catch (err) {
    console.error('[partner-view] failed:', err instanceof Error ? err.message : err)
    return EMPTY
  }
}

/** Containers due to land inside the watchdog horizon, soonest first. */
export function arrivingSoon(pipeline: PipelineContainer[]): PipelineContainer[] {
  return pipeline
    .filter(
      (c) =>
        !c.arrived_at &&
        c.days_from_arrival !== null &&
        c.days_from_arrival <= 0 &&
        Math.abs(c.days_from_arrival) <= WATCHDOG.ARRIVAL_HORIZON_DAYS
    )
    .sort((a, b) => (b.days_from_arrival ?? 0) - (a.days_from_arrival ?? 0))
}
