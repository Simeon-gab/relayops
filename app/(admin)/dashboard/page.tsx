import { Package, Truck, Receipt, AlertCircle, ClipboardList } from 'lucide-react'
import { getDashboardStats } from '@/lib/db/dashboard-stats'
import { fetchDailyMetrics } from '@/lib/db/daily-metrics'
import { StatCard } from '@/components/admin/stat-card'
import { DailySummary } from '@/components/admin/daily-summary'

export default async function DashboardPage() {
  const [stats, metrics] = await Promise.all([getDashboardStats(), fetchDailyMetrics()])

  return (
    <div className="px-6 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">Daily operations overview.</p>
      </div>

      <DailySummary metrics={metrics} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard
          title="Warehouse Stock"
          icon={Package}
          value={stats.warehouseStock !== null ? String(stats.warehouseStock.total) : '—'}
          subtitle={
            stats.warehouseStock !== null
              ? `Lagos: ${stats.warehouseStock.lagos} · Kano: ${stats.warehouseStock.kano}`
              : 'data unavailable'
          }
        />
        <StatCard
          title="Active Shipments"
          icon={Truck}
          value={stats.activeShipments !== null ? String(stats.activeShipments.total) : '—'}
          subtitle={
            stats.activeShipments !== null
              ? `${stats.activeShipments.dealer} dealer · ${stats.activeShipments.transfer} transfer`
              : 'data unavailable'
          }
        />
        <StatCard
          title="Pending Payments"
          icon={Receipt}
          value={stats.pendingPayments !== null ? stats.pendingPayments.totalFormatted : '—'}
          subtitle={
            stats.pendingPayments !== null
              ? `${stats.pendingPayments.shipmentCount} shipment${stats.pendingPayments.shipmentCount !== 1 ? 's' : ''} outstanding`
              : 'data unavailable'
          }
        />
        <StatCard
          title="Items Needing Attention"
          icon={AlertCircle}
          value={stats.attention !== null ? String(stats.attention.total) : '—'}
          subtitle={
            stats.attention !== null
              ? [
                  `${stats.attention.receipts} receipts`,
                  `${stats.attention.messages} messages`,
                  `${stats.attention.overdue} overdue`,
                  stats.attention.pending_containers > 0
                    ? `${stats.attention.pending_containers} container${stats.attention.pending_containers !== 1 ? 's' : ''} to allocate`
                    : null,
                ].filter(Boolean).join(' · ')
              : 'data unavailable'
          }
        />
        <StatCard
          title="Pending Orders"
          icon={ClipboardList}
          href="/dealer-orders"
          value={stats.pendingOrders !== null ? String(stats.pendingOrders.total) : '—'}
          subtitle={
            stats.pendingOrders !== null
              ? `${stats.pendingOrders.pending} pending · ${stats.pendingOrders.partially_fulfilled} partial`
              : 'data unavailable'
          }
        />
      </div>
    </div>
  )
}
