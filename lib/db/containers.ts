import { createClient } from '@/lib/supabase/server'
import type { ContainerSummary, ContainerDetail, ContainerItem } from '@/types/containers'

type RawContainer = {
  id: string
  container_number: string
  arrived_at: string
  status: string
  notes: string | null
  container_items: Array<{ quantity: number }>
}

type RawContainerDetail = {
  id: string
  container_number: string
  arrived_at: string
  status: string
  notes: string | null
  bill_of_lading: string | null
  shipping_line: string | null
  expected_arrival_date: string | null
  origin_port: string | null
  container_items: Array<{
    product_id: string
    quantity: number
    products: {
      sku_code: string
      display_name: string
      category: string
      color: string | null
    } | null
  }>
}

export async function getContainers(): Promise<ContainerSummary[]> {
  const db = await createClient()

  const { data, error } = await db
    .from('containers')
    .select('id, container_number, arrived_at, status, notes, container_items(quantity)')
    .is('deleted_at', null)
    .order('arrived_at', { ascending: false })

  if (error) throw error

  return ((data ?? []) as unknown as RawContainer[]).map((c) => ({
    id: c.id,
    container_number: c.container_number,
    arrived_at: c.arrived_at,
    status: c.status,
    notes: c.notes,
    total_units: c.container_items.reduce((sum, i) => sum + (i.quantity ?? 0), 0),
    sku_count: c.container_items.length,
  }))
}

export async function getContainer(containerId: string): Promise<ContainerDetail | null> {
  const db = await createClient()

  const { data, error } = await db
    .from('containers')
    .select(
      'id, container_number, arrived_at, status, notes, bill_of_lading, shipping_line, expected_arrival_date, origin_port, container_items(product_id, quantity, products(sku_code, display_name, category, color))'
    )
    .eq('id', containerId)
    .is('deleted_at', null)
    .single()

  if (error) return null

  const c = data as unknown as RawContainerDetail

  const items: ContainerItem[] = c.container_items
    .map((i) => ({
      product_id: i.product_id,
      sku_code: i.products?.sku_code ?? '—',
      display_name: i.products?.display_name ?? '—',
      category: i.products?.category ?? '—',
      color: i.products?.color ?? null,
      quantity: i.quantity,
    }))
    .sort((a, b) => b.quantity - a.quantity)

  return {
    id: c.id,
    container_number: c.container_number,
    arrived_at: c.arrived_at,
    status: c.status,
    notes: c.notes,
    bill_of_lading: c.bill_of_lading,
    shipping_line: c.shipping_line,
    expected_arrival_date: c.expected_arrival_date,
    origin_port: c.origin_port,
    items,
  }
}
