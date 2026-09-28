import { createClient } from '@/lib/supabase/server'
import type { PartnerDelivery, WarehouseSummary, WarehouseStockRow } from '@/types/warehouses'

type RawWarehouse = {
  id: string
  code: string
  name: string
  city: string
  state: string
  is_import_base: boolean
  partner_dealer_id: string | null
  partner: { business_name: string } | null
  warehouse_stock: Array<{
    quantity: number
    products: { display_name: string; category: string; unit_label: string } | null
  }>
}

type RawStockRow = {
  product_id: string
  quantity: number
  products: {
    sku_code: string
    display_name: string
    category: string
    unit_label: string
    color: string | null
  } | null
}

const WAREHOUSE_SELECT =
  'id, code, name, city, state, is_import_base, partner_dealer_id, partner:dealers!warehouses_partner_dealer_id_fkey(business_name), warehouse_stock(quantity, products(display_name, category, unit_label))'

function toSummary(w: RawWarehouse): WarehouseSummary {
  // Bikes and cartons of parts don't add up to one meaningful number, so the
  // headline total is vehicles only and spare parts are listed beside it.
  const vehicles = w.warehouse_stock.filter((s) => s.products?.category !== 'spare_part')
  const parts = w.warehouse_stock.filter((s) => s.products?.category === 'spare_part' && s.quantity > 0)
  return {
    id: w.id,
    code: w.code,
    name: w.name,
    city: w.city,
    state: w.state,
    is_import_base: w.is_import_base,
    partner_dealer_id: w.partner_dealer_id,
    partner_dealer_name: w.partner?.business_name ?? null,
    total_units: vehicles.reduce((sum, s) => sum + (s.quantity ?? 0), 0),
    spare_part_lines: parts.map((s) => ({
      display_name: s.products!.display_name,
      unit_label: s.products!.unit_label,
      quantity: s.quantity,
    })),
  }
}

export async function getWarehouses(): Promise<WarehouseSummary[]> {
  const db = await createClient()

  const { data, error } = await db
    .from('warehouses')
    .select(WAREHOUSE_SELECT)
    .eq('active', true)
    .order('is_import_base', { ascending: false }) // Lagos (import base) first

  if (error) throw error

  return ((data ?? []) as unknown as RawWarehouse[]).map(toSummary)
}

export async function getWarehouse(id: string): Promise<WarehouseSummary | null> {
  const db = await createClient()

  const { data, error } = await db
    .from('warehouses')
    .select(WAREHOUSE_SELECT)
    .eq('id', id)
    .single()

  if (error) return null

  return toSummary(data as unknown as RawWarehouse)
}

type RawDelivery = {
  id: string
  status: string
  dispatched_at: string | null
  created_at: string
  notes: string | null
  shipment_items: Array<{
    quantity: number
    color: string | null
    products: { display_name: string; category: string; unit_label: string } | null
  }>
}

/**
 * Everything we have sent to a partner warehouse, newest first. A partner's
 * warehouse holds their stock, not ours, so this is the only view of it we
 * keep — what went, when, and in what colours.
 */
export async function getPartnerDeliveries(warehouseId: string): Promise<PartnerDelivery[]> {
  const db = await createClient()

  const { data, error } = await db
    .from('shipments')
    .select('id, status, dispatched_at, created_at, notes, shipment_items(quantity, color, products(display_name, category, unit_label))')
    .eq('destination_warehouse_id', warehouseId)
    .is('deleted_at', null)
    .neq('status', 'cancelled')
    .order('created_at', { ascending: false })

  if (error) throw error

  return ((data ?? []) as unknown as RawDelivery[]).map((d) => ({
    shipment_id: d.id,
    status: d.status,
    dispatched_at: d.dispatched_at,
    created_at: d.created_at,
    notes: d.notes,
    items: d.shipment_items.map((i) => ({
      display_name: i.products?.display_name ?? '—',
      category: i.products?.category ?? '—',
      unit_label: i.products?.unit_label ?? 'unit',
      color: i.color,
      quantity: i.quantity,
    })),
  }))
}

export async function getWarehouseStockForProducts(
  warehouseId: string,
  productIds: string[]
): Promise<Map<string, number>> {
  if (!productIds.length) return new Map()
  const db = await createClient()
  const { data, error } = await db
    .from('warehouse_stock')
    .select('product_id, quantity')
    .eq('warehouse_id', warehouseId)
    .in('product_id', productIds)

  if (error) return new Map()
  const map = new Map<string, number>()
  for (const row of (data ?? []) as { product_id: string; quantity: number }[]) {
    map.set(row.product_id, row.quantity)
  }
  return map
}

export async function getAllWarehouseStockForProducts(
  warehouseIds: string[],
  productIds: string[]
): Promise<Record<string, Record<string, number>>> {
  if (!warehouseIds.length || !productIds.length) return {}
  const db = await createClient()
  const { data, error } = await db
    .from('warehouse_stock')
    .select('warehouse_id, product_id, quantity')
    .in('warehouse_id', warehouseIds)
    .in('product_id', productIds)

  if (error) return {}
  const result: Record<string, Record<string, number>> = {}
  for (const row of (data ?? []) as { warehouse_id: string; product_id: string; quantity: number }[]) {
    if (!result[row.warehouse_id]) result[row.warehouse_id] = {}
    result[row.warehouse_id][row.product_id] = row.quantity
  }
  return result
}

export async function getWarehouseStock(warehouseId: string): Promise<WarehouseStockRow[]> {
  const db = await createClient()

  const { data, error } = await db
    .from('warehouse_stock')
    .select('product_id, quantity, products(sku_code, display_name, category, unit_label, color)')
    .eq('warehouse_id', warehouseId)
    .order('quantity', { ascending: false })

  if (error) throw error

  return ((data ?? []) as unknown as RawStockRow[]).map((r) => ({
    product_id: r.product_id,
    sku_code: r.products?.sku_code ?? '—',
    display_name: r.products?.display_name ?? '—',
    category: r.products?.category ?? '—',
    unit_label: r.products?.unit_label ?? 'unit',
    color: r.products?.color ?? null,
    quantity: r.quantity,
  }))
}
