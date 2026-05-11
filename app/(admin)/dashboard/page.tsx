import { Package, Truck, Receipt, AlertCircle, ClipboardList } from 'lucide-react'
import { getDashboardStats } from '@/lib/db/dashboard-stats'
import { fetchDailyMetrics } from '@/lib/db/daily-metrics'
import { StatCard } from '@/components/admin/stat-card'
import { DailySummary } from '@/components/admin/daily-summary'

export default async function DashboardPage() {
  const [stats, metrics] = await Promise.all([getDashboardStats(), fetchDailyMetrics()])

  return (
    <div className="px-8 py-8">
      <div className="mb-6">
        <h1 className="text-[28px] font-bold tracking-tight text-heading">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">Daily operations overview.</p>
      </div>

      <DailySummary metrics={metrics} />

      {/* Top row: 3 cards */}
      <div className="grid gap-4 sm:grid-cols-3">
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

      {/* Bottom row: 2 cards (1/3 + 2/3) */}
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
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
          className="sm:col-span-2"
        />
      </div>
    </div>
  )
}
