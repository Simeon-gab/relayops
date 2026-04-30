import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/admin/page-header'
import { ContainerForm } from '@/components/admin/container-form'
import type { ProductSummary } from '@/types/products'

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
  warehouse_stock: Array<{ quantity: number }>
}

async function getActiveProducts(): Promise<ProductSummary[]> {
  const db = await createClient()

  const { data, error } = await db
    .from('products')
    .select('id, sku_code, display_name, category, color, engine_size_cc, import_cost_naira, sell_price_naira, active, warehouse_stock(quantity)')
    .eq('active', true)
    .order('display_name')

  if (error) throw error

  return ((data ?? []) as unknown as RawProduct[]).map((p) => ({
    id: p.id,
    sku_code: p.sku_code,
    display_name: p.display_name,
    category: p.category,
    color: p.color,
    engine_size_cc: p.engine_size_cc,
    import_cost_naira: p.import_cost_naira,
    sell_price_naira: p.sell_price_naira,
    active: p.active,
    total_stock: p.warehouse_stock.reduce((sum, s) => sum + (s.quantity ?? 0), 0),
    image_path: null,
  }))
}

export default async function NewContainerPage() {
  const products = await getActiveProducts()

  return (
    <div className="px-6 py-10">
      <PageHeader
        title="Record container"
        subtitle="Log a new container arrival and update Lagos stock levels."
      />
      <ContainerForm products={products} />
    </div>
  )
}
