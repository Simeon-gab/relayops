import { createClient } from '@/lib/supabase/server'

export interface StatementLine {
  shipment_id: string
  /** YYYY-MM-DD in Lagos time. */
  date: string
  description: string
  color: string | null
  quantity: number
  unit_label: string
  destination: string
}

export interface StatementBalanceRow {
  display_name: string
  quantity: number
  unit_label: string
}

export interface LoadingStatement {
  lines: StatementLine[]
  /** True when every load went truck-to-truck and never touched warehouse stock. */
  allTransload: boolean
  anyTransload: boolean
  warehouse_name: string
  /** What the warehouse holds right now — only meaningful for loads that came out of it. */
  balance: StatementBalanceRow[]
}

type RawShipment = {
  id: string
  dispatched_at: string | null
  created_at: string
  notes: string | null
  origin_warehouse: { id: string; name: string } | null
  destination_warehouse: { name: string; city: string | null } | null
  destination_dealer: { business_name: string; city: string | null } | null
  shipment_items: Array<{
    quantity: number
    color: string | null
    products: { display_name: string; unit_label: string } | null
  }>
  status_events: Array<{ notes: string | null }>
}

const lagosDay = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Africa/Lagos' })

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * The loads behind a printable statement: one line per item, oldest first.
 * A transload is recognised by the marker the loading form leaves on its
 * first status event (or the note the October import wrote).
 */
export async function getLoadingStatement(ids: string[]): Promise<LoadingStatement | null> {
  const clean = [...new Set(ids.filter((id) => UUID_RE.test(id)))].slice(0, 50)
  if (!clean.length) return null

  const db = await createClient()

  const { data, error } = await db
    .from('shipments')
    .select(`
      id, dispatched_at, created_at, notes,
      origin_warehouse:warehouses!origin_warehouse_id(id, name),
      destination_warehouse:warehouses!destination_warehouse_id(name, city),
      destination_dealer:dealers!destination_dealer_id(business_name, city),
      shipment_items(quantity, color, products(display_name, unit_label)),
      status_events(notes)
    `)
    .in('id', clean)
    .is('deleted_at', null)

  if (error) throw error

  const shipments = ((data ?? []) as unknown as RawShipment[]).sort(
    (a, b) =>
      new Date(a.dispatched_at ?? a.created_at).getTime() - new Date(b.dispatched_at ?? b.created_at).getTime()
  )
  if (!shipments.length) return null

  const isTransload = (s: RawShipment) =>
    s.status_events.some((e) => e.notes === 'transloaded_from_whatsapp') || /^transloaded/i.test(s.notes ?? '')

  const lines: StatementLine[] = shipments.flatMap((s) => {
    const dealer = s.destination_dealer
    const destination = dealer
      ? [dealer.business_name, dealer.city].filter(Boolean).join(' / ')
      : s.destination_warehouse?.name ?? '—'
    return s.shipment_items.map((i) => ({
      shipment_id: s.id,
      date: lagosDay(s.dispatched_at ?? s.created_at),
      description: i.products?.display_name ?? '—',
      color: i.color,
      quantity: i.quantity,
      unit_label: i.products?.unit_label ?? 'unit',
      destination,
    }))
  })

  const origin = shipments[0].origin_warehouse
  let balance: StatementBalanceRow[] = []

  if (origin && !shipments.every(isTransload)) {
    const { data: stock, error: stockErr } = await db
      .from('warehouse_stock')
      .select('quantity, products(display_name, unit_label)')
      .eq('warehouse_id', origin.id)
    if (stockErr) throw stockErr

    type StockRow = { quantity: number; products: { display_name: string; unit_label: string } | null }
    const onStatement = new Set(lines.map((l) => l.description))

    balance = ((stock ?? []) as unknown as StockRow[])
      .filter((r) => r.products && (r.quantity > 0 || onStatement.has(r.products.display_name)))
      .map((r) => ({
        display_name: r.products!.display_name,
        quantity: r.quantity,
        unit_label: r.products!.unit_label,
      }))
      .sort((a, b) => b.quantity - a.quantity)
  }

  return {
    lines,
    allTransload: shipments.every(isTransload),
    anyTransload: shipments.some(isTransload),
    warehouse_name: origin?.name ?? 'Warehouse',
    balance,
  }
}
