import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/admin/page-header'
import { PaymentForm } from '@/components/admin/payment-form'
import { getAllOutstandingShipments } from '@/lib/db/payments'
import type { DealerOption } from '@/components/admin/payment-form'

type Props = {
  searchParams: Promise<{ dealer?: string }>
}

type RawDealer = {
  id: string
  business_name: string
  city: string
  state: string
}

export default async function NewPaymentPage({ searchParams }: Props) {
  const { dealer: defaultDealerId } = await searchParams

  const db = await createClient()

  const [dealersResult, outstandingShipments] = await Promise.all([
    db
      .from('dealers')
      .select('id, business_name, city, state')
      .eq('active', true)
      .is('deleted_at', null)
      .order('business_name'),
    getAllOutstandingShipments(),
  ])

  if (dealersResult.error) throw dealersResult.error

  const dealers: DealerOption[] = ((dealersResult.data ?? []) as unknown as RawDealer[]).map(
    (d) => ({
      id: d.id,
      business_name: d.business_name,
      city: d.city,
      state: d.state,
    })
  )

  return (
    <div className="px-6 py-10">
      <PageHeader
        title="New payment"
        subtitle="Record a dealer payment received by bank transfer, cash, or POS."
      />
      <PaymentForm
        dealers={dealers}
        defaultDealerId={defaultDealerId}
        outstandingShipmentsByDealer={outstandingShipments}
      />
    </div>
  )
}
