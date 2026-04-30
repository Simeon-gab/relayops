import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DealerActivityTabs } from '@/components/admin/dealer-activity-tabs'
import { getDealer, getDealerActivity } from '@/lib/db/dealers'
import { formatNaira } from '@/lib/utils/format'

type Props = {
  params: Promise<{ id: string }>
}

const LANG_LABELS: Record<string, string> = { en: 'EN', ha: 'HA', yo: 'YO', ig: 'IG' }

export default async function DealerDetailPage({ params }: Props) {
  const { id } = await params

  const [dealer, activity] = await Promise.all([
    getDealer(id),
    getDealerActivity(id),
  ])

  if (!dealer) notFound()

  const stats = [
    { label: 'Total shipments', value: dealer.total_shipments },
    { label: 'Active shipments', value: dealer.active_shipments },
    { label: 'Total paid', value: formatNaira(dealer.total_paid_naira) },
    {
      label: 'Outstanding',
      value: formatNaira(dealer.outstanding_balance_naira),
      highlight: dealer.outstanding_balance_naira > 0,
    },
  ]

  return (
    <div className="px-6 py-10">
      {/* Back link */}
      <Link
        href="/dealers"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to dealers
      </Link>

      {/* Header */}
      <div className="mb-8 mt-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            {dealer.business_name}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {dealer.contact_name} · {dealer.phone}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge variant="outline" className="text-slate-600">
              {dealer.city}, {dealer.state}
            </Badge>
            <Badge variant="outline">
              {LANG_LABELS[dealer.preferred_language] ?? dealer.preferred_language.toUpperCase()}
            </Badge>
            <Badge variant="secondary" className="font-mono text-xs">
              Served by {dealer.served_by_warehouse_name}
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button asChild variant="outline">
            <Link href={`/payments/new?dealer=${dealer.id}`}>
              <Plus className="mr-1.5 h-4 w-4" />
              New payment
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/dealer-orders/new?dealer=${dealer.id}`}>
              <Plus className="mr-1.5 h-4 w-4" />
              New order
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/messages/new?dealer=${dealer.id}`}>
              <Plus className="mr-1.5 h-4 w-4" />
              New message
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats grid */}
      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map(({ label, value, highlight }) => (
          <div key={label} className="rounded-xl border bg-white p-4">
            <p className="text-xs text-slate-500">{label}</p>
            <p
              className={`mt-1 text-xl font-semibold tabular-nums ${
                highlight ? 'text-amber-600' : 'text-slate-900'
              }`}
            >
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* Activity tabs — client component, receives only serializable data */}
      <DealerActivityTabs activity={activity} />
    </div>
  )
}
