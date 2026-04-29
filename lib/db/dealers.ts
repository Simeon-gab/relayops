import { createClient } from '@/lib/supabase/server'
import type {
  DealerSummary,
  DealerDetail,
  DealerActivity,
  DealerShipment,
  DealerPayment,
  DealerMessage,
  DealerOrder,
} from '@/types/dealers'

type Supabase = Awaited<ReturnType<typeof createClient>>

// ─── getDealers ──────────────────────────────────────────────────────────────

type RawDealer = {
  id: string
  business_name: string
  contact_name: string
  phone: string
  city: string
  state: string
  preferred_language: string
  warehouses: { code: string } | null
}

type RawShipmentBalance = {
  destination_dealer_id: string
  status: string
  total_amount_naira: number | null
  amount_paid_naira: number
}

export async function getDealers(): Promise<DealerSummary[]> {
  const db = await createClient()

  const [dealersResult, shipmentsResult] = await Promise.all([
    db
      .from('dealers')
      .select('id, business_name, contact_name, phone, city, state, preferred_language, warehouses(code)')
      .eq('active', true)
      .is('deleted_at', null)
      .order('business_name'),

    db
      .from('shipments')
      .select('destination_dealer_id, status, total_amount_naira, amount_paid_naira')
      .eq('shipment_type', 'dealer')
      .is('deleted_at', null)
      .not('destination_dealer_id', 'is', null),
  ])

  if (dealersResult.error) throw dealersResult.error

  const shipments = ((shipmentsResult.data ?? []) as unknown as RawShipmentBalance[])
  const activeStatuses = new Set(['pending', 'dispatched', 'in_transit'])

  const activeCountMap = new Map<string, number>()
  const balanceMap = new Map<string, number>()

  for (const s of shipments) {
    const did = s.destination_dealer_id
    if (activeStatuses.has(s.status)) {
      activeCountMap.set(did, (activeCountMap.get(did) ?? 0) + 1)
    }
    const total = Number(s.total_amount_naira ?? 0)
    const paid = Number(s.amount_paid_naira ?? 0)
    if (total > paid) {
      balanceMap.set(did, (balanceMap.get(did) ?? 0) + (total - paid))
    }
  }

  return ((dealersResult.data ?? []) as unknown as RawDealer[]).map((d) => ({
    id: d.id,
    business_name: d.business_name,
    contact_name: d.contact_name,
    phone: d.phone,
    city: d.city,
    state: d.state,
    preferred_language: d.preferred_language,
    served_by_warehouse_code: d.warehouses?.code ?? '—',
    active_shipments_count: activeCountMap.get(d.id) ?? 0,
    outstanding_balance_naira: balanceMap.get(d.id) ?? 0,
  }))
}

// ─── getDealer ───────────────────────────────────────────────────────────────

type RawDealerDetail = {
  id: string
  business_name: string
  contact_name: string
  phone: string
  email: string | null
  city: string
  state: string
  preferred_language: string
  credit_limit_naira: number | null
  active: boolean
  notes: string | null
  warehouses: { code: string; name: string } | null
}

type RawShipmentStat = {
  status: string
  total_amount_naira: number | null
  amount_paid_naira: number
}

export async function getDealer(dealerId: string): Promise<DealerDetail | null> {
  const db = await createClient()

  const [dealerResult, shipmentsResult, ordersResult] = await Promise.all([
    db
      .from('dealers')
      .select('id, business_name, contact_name, phone, email, city, state, preferred_language, credit_limit_naira, active, notes, warehouses(code, name)')
      .eq('id', dealerId)
      .eq('active', true)
      .is('deleted_at', null)
      .single(),

    db
      .from('shipments')
      .select('status, total_amount_naira, amount_paid_naira')
      .eq('destination_dealer_id', dealerId)
      .eq('shipment_type', 'dealer')
      .is('deleted_at', null),

    db
      .from('dealer_orders')
      .select('id', { count: 'exact', head: true })
      .eq('dealer_id', dealerId)
      .is('deleted_at', null),
  ])

  if (dealerResult.error) return null

  const d = dealerResult.data as unknown as RawDealerDetail
  const shipments = ((shipmentsResult.data ?? []) as unknown as RawShipmentStat[])
  const activeStatuses = new Set(['pending', 'dispatched', 'in_transit'])

  let total_paid_naira = 0
  let outstanding_balance_naira = 0
  let active_shipments = 0

  for (const s of shipments) {
    const total = Number(s.total_amount_naira ?? 0)
    const paid = Number(s.amount_paid_naira ?? 0)
    total_paid_naira += paid
    if (total > paid) outstanding_balance_naira += total - paid
    if (activeStatuses.has(s.status)) active_shipments++
  }

  return {
    id: d.id,
    business_name: d.business_name,
    contact_name: d.contact_name,
    phone: d.phone,
    email: d.email,
    city: d.city,
    state: d.state,
    preferred_language: d.preferred_language,
    credit_limit_naira: d.credit_limit_naira,
    active: d.active,
    notes: d.notes,
    served_by_warehouse_code: d.warehouses?.code ?? '—',
    served_by_warehouse_name: d.warehouses?.name ?? '—',
    total_shipments: shipments.length,
    active_shipments,
    total_paid_naira,
    outstanding_balance_naira,
    total_orders: ordersResult.count ?? 0,
  }
}

// ─── getDealerActivity ───────────────────────────────────────────────────────

type RawActivityShipment = {
  id: string
  status: string
  dispatched_at: string | null
  total_amount_naira: number | null
  amount_paid_naira: number
  shipment_items: Array<{ id: string }>
}

type RawActivityPayment = {
  id: string
  amount_naira: number
  payment_date: string
  payment_reference: string | null
  shipment_id: string | null
}

type RawActivityMessage = {
  id: string
  direction: string
  original_text: string
  language: string | null
  created_at: string
  message_parse_results: Array<{ parsed_intent: string; created_at: string }>
}

type RawActivityOrder = {
  id: string
  status: string
  requested_at: string
  dealer_order_items: Array<{ id: string }>
}

export async function getDealerActivity(dealerId: string): Promise<DealerActivity> {
  const db = await createClient()

  const [shipmentsResult, paymentsResult, messagesResult, ordersResult] = await Promise.all([
    db
      .from('shipments')
      .select('id, status, dispatched_at, total_amount_naira, amount_paid_naira, shipment_items(id)')
      .eq('destination_dealer_id', dealerId)
      .eq('shipment_type', 'dealer')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(20),

    db
      .from('payments')
      .select('id, amount_naira, payment_date, payment_reference, shipment_id')
      .eq('dealer_id', dealerId)
      .is('deleted_at', null)
      .order('payment_date', { ascending: false })
      .limit(20),

    db
      .from('messages')
      .select('id, direction, original_text, language, created_at, message_parse_results(parsed_intent, created_at)')
      .eq('dealer_id', dealerId)
      .order('created_at', { ascending: false })
      .limit(20),

    db
      .from('dealer_orders')
      .select('id, status, requested_at, dealer_order_items(id)')
      .eq('dealer_id', dealerId)
      .is('deleted_at', null)
      .order('requested_at', { ascending: false })
      .limit(10),
  ])

  const shipments: DealerShipment[] = ((shipmentsResult.data ?? []) as unknown as RawActivityShipment[]).map(
    (s) => ({
      id: s.id,
      status: s.status,
      dispatched_at: s.dispatched_at,
      total_amount_naira: s.total_amount_naira != null ? Number(s.total_amount_naira) : null,
      amount_paid_naira: Number(s.amount_paid_naira),
      item_count: s.shipment_items.length,
    })
  )

  const payments: DealerPayment[] = ((paymentsResult.data ?? []) as unknown as RawActivityPayment[]).map(
    (p) => ({
      id: p.id,
      amount_naira: Number(p.amount_naira),
      payment_date: p.payment_date,
      payment_reference: p.payment_reference,
      shipment_id: p.shipment_id,
    })
  )

  const messages: DealerMessage[] = ((messagesResult.data ?? []) as unknown as RawActivityMessage[]).map(
    (m) => {
      const results = m.message_parse_results ?? []
      const latest = results.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )[0]
      return {
        id: m.id,
        direction: m.direction,
        original_text: m.original_text.length > 200 ? m.original_text.slice(0, 200) + '…' : m.original_text,
        language: m.language,
        created_at: m.created_at,
        parsed_intent: latest?.parsed_intent ?? null,
      }
    }
  )

  const orders: DealerOrder[] = ((ordersResult.data ?? []) as unknown as RawActivityOrder[]).map(
    (o) => ({
      id: o.id,
      status: o.status,
      requested_at: o.requested_at,
      item_count: o.dealer_order_items.length,
    })
  )

  return { shipments, payments, messages, orders }
}
