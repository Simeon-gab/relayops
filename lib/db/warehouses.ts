import { createClient } from '@/lib/supabase/server'
import type { WarehouseSummary, WarehouseStockRow } from '@/types/warehouses'

type RawWarehouse = {
  id: string
  code: string
  name: string
  city: string
  state: string
  is_import_base: boolean
  warehouse_stock: Array<{ quantity: number }>
}

type RawStockRow = {
  product_id: string
  quantity: number
  products: {
    sku_code: string
    display_name: string
    category: string
    color: string | null
  } | null
}

function toSummary(w: RawWarehouse): WarehouseSummary {
  return {
    id: w.id,
    code: w.code,
    name: w.name,
    city: w.city,
    state: w.state,
    is_import_base: w.is_import_base,
    total_units: w.warehouse_stock.reduce((sum, s) => sum + (s.quantity ?? 0), 0),
  }
}

export async function getWarehouses(): Promise<WarehouseSummary[]> {
  const db = await createClient()

  const { data, error } = await db
    .from('warehouses')
    .select('id, code, name, city, state, is_import_base, warehouse_stock(quantity)')
    .eq('active', true)
    .order('is_import_base', { ascending: false }) // Lagos (import base) first

  if (error) throw error

  return ((data ?? []) as unknown as RawWarehouse[]).map(toSummary)
}

export async function getWarehouse(id: string): Promise<WarehouseSummary | null> {
  const db = await createClient()

  const { data, error } = await db
    .from('warehouses')
    .select('id, code, name, city, state, is_import_base, warehouse_stock(quantity)')
    .eq('id', id)
    .single()

  if (error) return null

  return toSummary(data as unknown as RawWarehouse)
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
    .select('product_id, quantity, products(sku_code, display_name, category, color)')
    .eq('warehouse_id', warehouseId)
    .order('quantity', { ascending: false })

  if (error) throw error

  return ((data ?? []) as unknown as RawStockRow[]).map((r) => ({
    product_id: r.product_id,
    sku_code: r.products?.sku_code ?? '—',
    display_name: r.products?.display_name ?? '—',
    category: r.products?.category ?? '—',
    color: r.products?.color ?? null,
    quantity: r.quantity,
  }))
}
