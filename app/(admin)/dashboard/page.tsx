import { Package, Truck, Receipt, AlertCircle, ClipboardList } from 'lucide-react'
import { getDashboardStats } from '@/lib/db/dashboard-stats'
import { fetchDailyMetrics } from '@/lib/db/daily-metrics'
import { fetchPartnerView } from '@/lib/db/partner-view'
import { getDailyBriefing } from '@/lib/ai/briefing'
import { listPendingProposals, listAllPendingProposals } from '@/lib/db/ai-proposals'
import { getStaffUser } from '@/lib/auth/roles'
import { createClient } from '@/lib/supabase/server'
import { StatCard } from '@/components/admin/stat-card'
import { DailySummary } from '@/components/admin/daily-summary'
import { DecisionQueue } from '@/components/admin/decision-queue'
import { MdDashboard } from '@/components/admin/md-dashboard'
import { PartnerDashboard } from '@/components/admin/partner-dashboard'

interface Props {
  searchParams: Promise<{ view?: string }>
}

/**
 * One route, three screens.
 *
 * The MD lands on a deliberately small page and the partner on the physical
 * chain; managers get the full operational dashboard. `?view=full` lets the
 * MD cross into the manager view on the same login, so the audit trail stays
 * attached to one person rather than being split across two accounts.
 */
export default async function DashboardPage({ searchParams }: Props) {
  const { view } = await searchParams
  const db = await createClient()
  const staff = await getStaffUser(db)

  // The layout already rejected non-staff; this is a type narrowing.
  const role = staff?.role ?? 'manager'

  if (role === 'md' && view !== 'full') {
    const [stats, metrics, proposals] = await Promise.all([
      getDashboardStats(),
      fetchDailyMetrics(),
      listPendingProposals('md'),
    ])
    const briefing = await getDailyBriefing(metrics)

    return (
      <MdDashboard
        briefing={briefing}
        metrics={metrics}
        stats={stats}
        proposals={proposals}
        displayName={staff?.display_name ?? null}
      />
    )
  }

  if (role === 'partner') {
    const [partnerView, proposals] = await Promise.all([
      fetchPartnerView(),
      listPendingProposals('partner'),
    ])

    return (
      <PartnerDashboard
        view={partnerView}
        proposals={proposals}
        displayName={staff?.display_name ?? null}
      />
    )
  }

  // Manager (and the MD's "full system" view).
  const [stats, metrics, proposals] = await Promise.all([
    getDashboardStats(),
    fetchDailyMetrics(),
    listAllPendingProposals(),
  ])

  return (
    <div className="px-8 py-8">
      <div className="mb-6">
        <h1 className="text-[28px] font-bold tracking-tight text-heading">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">Daily operations overview.</p>
      </div>

      <DailySummary metrics={metrics} />

      <DecisionQueue
        proposals={proposals}
        title="Agent proposals"
        emptyMessage="No proposals waiting — the agents have nothing queued."
      />

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
