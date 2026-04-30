import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/admin/page-header'
import { DealerOrderForm } from '@/components/admin/dealer-order-form'
import type { DealerOption, ProductOption } from '@/components/admin/dealer-order-form'

type Props = {
  searchParams: Promise<{ dealer?: string }>
}

type RawDealer = {
  id: string
  business_name: string
  city: string
  state: string
}

type RawProduct = {
  id: string
  sku_code: string
  display_name: string
  sell_price_naira: number | null
}

async function getFormData(): Promise<{ dealers: DealerOption[]; products: ProductOption[] }> {
  const db = await createClient()

  const [dealersResult, productsResult] = await Promise.all([
    db
      .from('dealers')
      .select('id, business_name, city, state')
      .eq('active', true)
      .is('deleted_at', null)
      .order('business_name'),

    db
      .from('products')
      .select('id, sku_code, display_name, sell_price_naira')
      .eq('active', true)
      .order('display_name'),
  ])

  if (dealersResult.error) throw dealersResult.error
  if (productsResult.error) throw productsResult.error

  const dealers = ((dealersResult.data ?? []) as unknown as RawDealer[]).map((d) => ({
    id: d.id,
    business_name: d.business_name,
    city: d.city,
    state: d.state,
  }))

  const products = ((productsResult.data ?? []) as unknown as RawProduct[]).map((p) => ({
    id: p.id,
    sku_code: p.sku_code,
    display_name: p.display_name,
    sell_price_naira: p.sell_price_naira,
  }))

  return { dealers, products }
}

export default async function NewDealerOrderPage({ searchParams }: Props) {
  const { dealer: defaultDealerId } = await searchParams
  const { dealers, products } = await getFormData()

  return (
    <div className="px-6 py-10">
      <PageHeader
        title="New dealer order"
        subtitle="Record what a dealer has requested — over phone, WhatsApp, or in person."
      />
      <DealerOrderForm
        dealers={dealers}
        products={products}
        defaultDealerId={defaultDealerId}
      />
    </div>
  )
}
