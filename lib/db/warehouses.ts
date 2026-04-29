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
