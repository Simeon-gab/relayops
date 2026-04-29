'use client'

import { useRouter } from 'next/navigation'
import { DataTable, type Column } from './data-table'
import { StatusBadge } from './status-badge'
import type { ContainerSummary } from '@/types/containers'

function formatArrived(dateStr: string): string {
  const date = new Date(dateStr)
  const diffDays = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays <= 14) return `${diffDays}d ago`
  return date.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })
}

const columns: Column<ContainerSummary>[] = [
  {
    header: 'Container #',
    cell: (r) => (
      <span className="font-mono text-sm font-medium">{r.container_number}</span>
    ),
  },
  {
    header: 'Arrived',
    cell: (r) => (
      <span className="text-slate-600">{formatArrived(r.arrived_at)}</span>
    ),
  },
  {
    header: 'Status',
    cell: (r) => <StatusBadge status={r.status} />,
  },
  {
    header: 'SKUs',
    className: 'text-right',
    cell: (r) => (
      <span className="tabular-nums text-slate-600">{r.sku_count}</span>
    ),
  },
  {
    header: 'Total units',
    className: 'text-right',
    cell: (r) => (
      <span className="tabular-nums font-semibold">{r.total_units}</span>
    ),
  },
  {
    header: 'Notes',
    cell: (r) => (
      <span className="text-sm text-slate-500">
        {r.notes ? (r.notes.length > 60 ? r.notes.slice(0, 60) + '…' : r.notes) : '—'}
      </span>
    ),
  },
]

export function ContainersTable({ containers }: { containers: ContainerSummary[] }) {
  const router = useRouter()

  return (
    <DataTable
      columns={columns}
      data={containers}
      emptyMessage="No containers recorded yet."
      onRowClick={(row) => router.push(`/containers/${row.id}`)}
    />
  )
}
