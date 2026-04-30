import { createClient } from '@/lib/supabase/server'
import type { PaymentSummary, PaymentDetail, OutstandingShipment } from '@/types/payments'

export interface PaymentFilters {
  date_from?: string
  date_to?: string
}

// ─── Raw join shapes ──────────────────────────────────────────────────────────

type RawPaymentRow = {
  id: string
  amount_naira: number
  payment_date: string
  payment_method: string | null
  payment_reference: string | null
  recorded_at: string
  source: string
  dealer_id: string
  shipment_id: string | null
  dealers: { business_name: string; city: string } | null
  shipments: { id: string } | null
}

type RawPaymentDetail = {
  id: string
  amount_naira: number
  payment_date: string
  payment_method: string | null
  payment_reference: string | null
  recorded_at: string
  source: string
  notes: string | null
  dealer_id: string
  shipment_id: string | null
  dealers: { id: string; business_name: string; city: string; state: string; preferred_language: string } | null
  shipments: {
    id: string
    status: string
    dispatched_at: string | null
    total_amount_naira: number | null
    amount_paid_naira: number
  } | null
  users: { email: string } | null
}

type RawOutstandingShipment = {
  id: string
  dispatched_at: string | null
  total_amount_naira: number
  amount_paid_naira: number
}

// ─── Queries ─────────────────────────────────────────────────────────────────

export async function getPayments(filters?: PaymentFilters): Promise<PaymentSummary[]> {
  const db = await createClient()

  let query = db
    .from('payments')
    .select(
      'id, amount_naira, payment_date, payment_method, payment_reference, recorded_at, source, dealer_id, shipment_id, dealers!dealer_id(business_name, city), shipments!shipment_id(id)'
    )
    .is('deleted_at', null)
    .order('payment_date', { ascending: false })
    .limit(100)

  if (filters?.date_from) {
    query = query.gte('payment_date', filters.date_from)
  }
  if (filters?.date_to) {
    query = query.lte('payment_date', filters.date_to)
  }

  const { data, error } = await query
  if (error) throw error

  return ((data ?? []) as unknown as RawPaymentRow[]).map((p) => ({
    id: p.id,
    amount_naira: Number(p.amount_naira),
    payment_date: p.payment_date,
    payment_method: p.payment_method,
    payment_reference: p.payment_reference,
    recorded_at: p.recorded_at,
    source: p.source,
    dealer_id: p.dealer_id,
    business_name: p.dealers?.business_name ?? '—',
    city: p.dealers?.city ?? '',
    shipment_id: p.shipment_id,
  }))
}

export async function getPayment(paymentId: string): Promise<PaymentDetail | null> {
  const db = await createClient()

  const { data, error } = await db
    .from('payments')
    .select(
      'id, amount_naira, payment_date, payment_method, payment_reference, recorded_at, source, notes, dealer_id, shipment_id, dealers!dealer_id(id, business_name, city, state, preferred_language), shipments!shipment_id(id, status, dispatched_at, total_amount_naira, amount_paid_naira), users!recorded_by(email)'
    )
    .eq('id', paymentId)
    .is('deleted_at', null)
    .single()

  if (error) return null

  const p = data as unknown as RawPaymentDetail

  return {
    id: p.id,
    amount_naira: Number(p.amount_naira),
    payment_date: p.payment_date,
    payment_method: p.payment_method,
    payment_reference: p.payment_reference,
    recorded_at: p.recorded_at,
    source: p.source,
    notes: p.notes,
    dealer_id: p.dealer_id,
    business_name: p.dealers?.business_name ?? '—',
    city: p.dealers?.city ?? '',
    state: p.dealers?.state ?? '',
    preferred_language: p.dealers?.preferred_language ?? 'en',
    shipment_id: p.shipment_id,
    shipment_status: p.shipments?.status ?? null,
    shipment_dispatched_at: p.shipments?.dispatched_at ?? null,
    shipment_total: p.shipments?.total_amount_naira != null ? Number(p.shipments.total_amount_naira) : null,
    shipment_paid: p.shipments?.amount_paid_naira != null ? Number(p.shipments.amount_paid_naira) : null,
    recorded_by_email: p.users?.email ?? 'unknown',
  }
}

export async function getDealerOutstandingShipments(
  dealerId: string
): Promise<OutstandingShipment[]> {
  const db = await createClient()

  const { data, error } = await db
    .from('shipments')
    .select('id, dispatched_at, total_amount_naira, amount_paid_naira')
    .eq('destination_dealer_id', dealerId)
    .eq('shipment_type', 'dealer')
    .in('status', ['dispatched', 'in_transit', 'delivered'])
    .is('deleted_at', null)
    .not('total_amount_naira', 'is', null)
    .order('dispatched_at', { ascending: false })

  if (error) return []

  return ((data ?? []) as unknown as RawOutstandingShipment[])
    .filter(
      (s) =>
        s.total_amount_naira != null &&
        Number(s.total_amount_naira) > Number(s.amount_paid_naira)
    )
    .map((s) => ({
      id: s.id,
      dispatched_at: s.dispatched_at,
      total_amount_naira: Number(s.total_amount_naira),
      amount_paid_naira: Number(s.amount_paid_naira),
    }))
}

export async function getAllOutstandingShipments(): Promise<
  Record<string, OutstandingShipment[]>
> {
  const db = await createClient()

  const { data, error } = await db
    .from('shipments')
    .select('id, dispatched_at, total_amount_naira, amount_paid_naira, destination_dealer_id')
    .eq('shipment_type', 'dealer')
    .in('status', ['dispatched', 'in_transit', 'delivered'])
    .is('deleted_at', null)
    .not('total_amount_naira', 'is', null)
    .order('dispatched_at', { ascending: false })

  if (error) return {}

  type Row = RawOutstandingShipment & { destination_dealer_id: string }
  const result: Record<string, OutstandingShipment[]> = {}

  for (const s of (data ?? []) as unknown as Row[]) {
    if (Number(s.total_amount_naira) <= Number(s.amount_paid_naira)) continue
    const dealerId = s.destination_dealer_id
    if (!result[dealerId]) result[dealerId] = []
    result[dealerId].push({
      id: s.id,
      dispatched_at: s.dispatched_at,
      total_amount_naira: Number(s.total_amount_naira),
      amount_paid_naira: Number(s.amount_paid_naira),
    })
  }

  return result
}
