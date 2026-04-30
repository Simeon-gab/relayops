import Link from 'next/link'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/admin/page-header'
import { PaymentsTable } from '@/components/admin/payments-table'
import { getPayments } from '@/lib/db/payments'
import { cn } from '@/lib/utils'

type Props = {
  searchParams: Promise<{ period?: string }>
}

const PERIOD_PILLS = [
  { label: 'All',          value: 'all' },
  { label: 'This month',   value: 'this_month' },
  { label: 'Last 30 days', value: 'last_30' },
  { label: 'This year',    value: 'this_year' },
]

function getDateRange(period: string | undefined): { date_from?: string; date_to?: string } {
  const now = new Date()
  if (period === 'this_month') {
    const from = new Date(now.getFullYear(), now.getMonth(), 1)
    return { date_from: from.toISOString().split('T')[0] }
  }
  if (period === 'last_30') {
    const from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    return { date_from: from.toISOString().split('T')[0] }
  }
  if (period === 'this_year') {
    return { date_from: `${now.getFullYear()}-01-01` }
  }
  return {}
}

export default async function PaymentsPage({ searchParams }: Props) {
  const { period } = await searchParams
  const activePeriod = period ?? 'all'
  const filters = getDateRange(activePeriod)
  const payments = await getPayments(filters)

  return (
    <div className="px-6 py-10">
      <PageHeader
        title="Payments"
        subtitle="Dealer payment records"
        actions={
          <Button asChild size="sm">
            <Link href="/payments/new">
              <Plus className="mr-1.5 h-4 w-4" />
              New payment
            </Link>
          </Button>
        }
      />

      {/* Filter pills */}
      <div className="mb-6 flex flex-wrap gap-2">
        {PERIOD_PILLS.map(({ label, value }) => {
          const isCurrent = activePeriod === value
          return (
            <Link
              key={value}
              href={value === 'all' ? '/payments' : `/payments?period=${value}`}
              className={cn(
                'rounded-full border px-3 py-1 text-sm font-medium transition-colors',
                isCurrent
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400 hover:text-slate-900'
              )}
            >
              {label}
            </Link>
          )
        })}
      </div>

      <PaymentsTable payments={payments} />
    </div>
  )
}
