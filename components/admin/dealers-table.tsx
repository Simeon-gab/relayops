'use client'

import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { DataTable, type Column } from './data-table'
import { formatNaira } from '@/lib/utils/format'
import type { DealerSummary } from '@/types/dealers'

const LANG_LABELS: Record<string, string> = {
  en: 'EN',
  ha: 'HA',
  yo: 'YO',
  ig: 'IG',
}

const columns: Column<DealerSummary>[] = [
  {
    header: 'Business name',
    cell: (r) => <span className="font-medium">{r.business_name}</span>,
  },
  {
    header: 'Contact',
    cell: (r) => (
      <div>
        <p className="text-sm">{r.contact_name}</p>
        <p className="text-xs text-slate-500">{r.phone}</p>
      </div>
    ),
  },
  {
    header: 'City',
    cell: (r) => <span className="text-slate-600">{r.city}</span>,
  },
  {
    header: 'State',
    cell: (r) => <span className="text-slate-600">{r.state}</span>,
  },
  {
    header: 'Language',
    cell: (r) => (
      <Badge variant="outline" className="text-xs">
        {LANG_LABELS[r.preferred_language] ?? r.preferred_language.toUpperCase()}
      </Badge>
    ),
  },
  {
    header: 'Served by',
    cell: (r) => (
      <Badge variant="secondary" className="font-mono text-xs">
        {r.served_by_warehouse_code}
      </Badge>
    ),
  },
  {
    header: 'Active shipments',
    className: 'text-right',
    cell: (r) => (
      <span
        className={
          r.active_shipments_count > 0
            ? 'tabular-nums font-semibold'
            : 'tabular-nums text-slate-400'
        }
      >
        {r.active_shipments_count}
      </span>
    ),
  },
  {
    header: 'Outstanding',
    className: 'text-right',
    cell: (r) =>
      r.outstanding_balance_naira > 0 ? (
        <span className="tabular-nums font-semibold text-amber-600">
          {formatNaira(r.outstanding_balance_naira)}
        </span>
      ) : (
        <span className="tabular-nums text-slate-400">₦0</span>
      ),
  },
]

export function DealersTable({ dealers }: { dealers: DealerSummary[] }) {
  const router = useRouter()

  return (
    <DataTable
      columns={columns}
      data={dealers}
      emptyMessage="No dealers yet."
      onRowClick={(row) => router.push(`/dealers/${row.id}`)}
    />
  )
}
