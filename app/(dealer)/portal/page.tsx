import { ClipboardList, Truck, Receipt } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { StatCard } from '@/components/admin/stat-card'
import { formatNaira } from '@/lib/utils/format'

export default async function DealerDashboardPage() {
  const supabase = await createClient()

  const [ordersResult, shipmentsResult, balanceResult] = await Promise.all([
    // Open orders: pending or partially fulfilled
    supabase
      .from('dealer_orders')
      .select('*', { count: 'exact', head: true })
      .in('status', ['pending', 'partially_fulfilled'])
      .is('deleted_at', null),

    // In transit: dealer shipments currently moving
    supabase
      .from('shipments')
      .select('*', { count: 'exact', head: true })
      .eq('shipment_type', 'dealer')
      .eq('status', 'in_transit')
      .is('deleted_at', null),

    // Outstanding balance: sum of (total - paid) across active dealer shipments
    supabase
      .from('shipments')
      .select('total_amount_naira, amount_paid_naira')
      .eq('shipment_type', 'dealer')
      .in('status', ['dispatched', 'in_transit', 'delivered'])
      .is('deleted_at', null)
      .not('total_amount_naira', 'is', null),
  ])

  const openOrders = ordersResult.count ?? null
  const inTransit = shipmentsResult.count ?? null

  type BalanceRow = { total_amount_naira: number; amount_paid_naira: number }
  let outstandingBalance: number | null = null
  if (!balanceResult.error && balanceResult.data) {
    outstandingBalance = (balanceResult.data as BalanceRow[]).reduce((sum, row) => {
      const owed = Number(row.total_amount_naira) - Number(row.amount_paid_naira)
      return sum + (owed > 0 ? owed : 0)
    }, 0)
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-heading">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Overview of your orders, shipments, and payments.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          title="Open Orders"
          icon={ClipboardList}
          value={openOrders !== null ? String(openOrders) : '—'}
          subtitle="pending · partially fulfilled"
        />
        <StatCard
          title="In Transit"
          icon={Truck}
          value={inTransit !== null ? String(inTransit) : '—'}
          subtitle="shipments en route to you"
        />
        <StatCard
          title="Outstanding Balance"
          icon={Receipt}
          value={outstandingBalance !== null ? formatNaira(outstandingBalance) : '—'}
          subtitle="across active shipments"
        />
      </div>
    </div>
  )
}
