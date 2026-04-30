import { createClient } from '@/lib/supabase/server'
import type { ProductSummary, ProductDetail } from '@/types/products'

type RawProduct = {
  id: string
  sku_code: string
  display_name: string
  category: string
  color: string | null
  engine_size_cc: number | null
  import_cost_naira: number | null
  sell_price_naira: number | null
  active: boolean
  image_path: string | null
  warehouse_stock: Array<{
    quantity: number
    warehouses: { id: string; name: string; code: string } | null
  }>
}

function toSummary(p: RawProduct): ProductSummary {
  const total_stock = p.warehouse_stock.reduce((sum, s) => sum + (s.quantity ?? 0), 0)
  return {
    id: p.id,
    sku_code: p.sku_code,
    display_name: p.display_name,
    category: p.category,
    color: p.color,
    engine_size_cc: p.engine_size_cc,
    import_cost_naira: p.import_cost_naira,
    sell_price_naira: p.sell_price_naira,
    active: p.active,
    total_stock,
    image_path: p.image_path,
  }
}

export async function getProducts(): Promise<ProductSummary[]> {
  const db = await createClient()

  const { data, error } = await db
    .from('products')
    .select(
      'id, sku_code, display_name, category, color, engine_size_cc, import_cost_naira, sell_price_naira, active, image_path, warehouse_stock(quantity, warehouses(id, name, code))'
    )
    .eq('active', true)
    .order('display_name')

  if (error) throw error

  return ((data ?? []) as unknown as RawProduct[]).map(toSummary)
}

export async function getProduct(productId: string): Promise<ProductDetail | null> {
  const db = await createClient()

  const { data, error } = await db
    .from('products')
    .select(
      'id, sku_code, display_name, category, color, engine_size_cc, import_cost_naira, sell_price_naira, active, image_path, warehouse_stock(quantity, warehouses(id, name, code))'
    )
    .eq('id', productId)
    .single()

  if (error) return null

  const p = data as unknown as RawProduct

  const stock_by_warehouse = p.warehouse_stock
    .filter((s) => s.warehouses != null)
    .map((s) => ({
      warehouse_id: s.warehouses!.id,
      warehouse_name: s.warehouses!.name,
      warehouse_code: s.warehouses!.code,
      quantity: s.quantity,
    }))
    .sort((a, b) => b.quantity - a.quantity)

  return {
    ...toSummary(p),
    stock_by_warehouse,
  }
}
