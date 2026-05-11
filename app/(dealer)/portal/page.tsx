import { ClipboardList, Truck, Receipt } from 'lucide-react'
import { StatCard } from '@/components/admin/stat-card'

export default function DealerDashboardPage() {
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
          value="—"
          subtitle="Coming soon"
        />
        <StatCard
          title="In Transit"
          icon={Truck}
          value="—"
          subtitle="Coming soon"
        />
        <StatCard
          title="Outstanding Balance"
          icon={Receipt}
          value="—"
          subtitle="Coming soon"
        />
      </div>
    </div>
  )
}
