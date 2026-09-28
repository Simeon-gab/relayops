import { createClient } from '@/lib/supabase/server'
import type { LoadingOptions } from '@/types/loading'

type RawWarehouse = {
  id: string
  name: string
  city: string
  state: string
  is_import_base: boolean
  partner_dealer_id: string | null
}

/**
 * Everything the loading form needs to turn a WhatsApp message into loads:
 * products with Lagos stock, and every dealer or warehouse a truck can go to.
 * Trucks always leave from the import base.
 */
export async function getLoadingOptions(): Promise<LoadingOptions> {
  const db = await createClient()

  const [whRes, productRes, dealerRes] = await Promise.all([
    db.from('warehouses').select('id, name, city, state, is_import_base, partner_dealer_id').eq('active', true),
    db
      .from('products')
      .select('id, sku_code, display_name, category, unit_label')
      .eq('active', true)
      .is('deleted_at', null)
      .order('category')
      .order('display_name'),
    db
      .from('dealers')
      .select('id, business_name, city, state')
      .eq('active', true)
      .is('deleted_at', null)
      .order('business_name'),
  ])

  if (whRes.error) throw whRes.error
  if (productRes.error) throw productRes.error
  if (dealerRes.error) throw dealerRes.error

  const warehouses = (whRes.data ?? []) as RawWarehouse[]
  const origin = warehouses.find((w) => w.is_import_base)
  if (!origin) throw new Error('No import-base warehouse is set up.')

  const { data: stock, error: stockErr } = await db
    .from('warehouse_stock')
    .select('product_id, quantity')
    .eq('warehouse_id', origin.id)
  if (stockErr) throw stockErr
  const stockMap = new Map((stock ?? []).map((s: { product_id: string; quantity: number }) => [s.product_id, s.quantity]))

  return {
    origin_warehouse_id: origin.id,
    origin_warehouse_name: origin.name,
    products: (productRes.data ?? []).map((p: { id: string; sku_code: string; display_name: string; category: string; unit_label: string }) => ({
      ...p,
      lagos_stock: stockMap.get(p.id) ?? 0,
    })),
    destinations: [
      ...warehouses
        .filter((w) => !w.is_import_base)
        .map((w) => ({
          key: `warehouse:${w.id}`,
          kind: 'warehouse' as const,
          id: w.id,
          name: w.name,
          city: w.city,
          state: w.state,
          partner: !!w.partner_dealer_id,
        })),
      ...(dealerRes.data ?? []).map((d: { id: string; business_name: string; city: string; state: string }) => ({
        key: `dealer:${d.id}`,
        kind: 'dealer' as const,
        id: d.id,
        name: d.business_name,
        city: d.city,
        state: d.state,
        partner: false,
      })),
    ],
  }
}
