'use client'

import { useRouter } from 'next/navigation'
import { Truck, ArrowRight } from 'lucide-react'
import { DataTable, type Column } from './data-table'
import { StatusBadge } from './status-badge'
import { formatNaira } from '@/lib/utils/format'
import type { ShipmentSummary } from '@/types/shipments'

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function shortId(id: string): string {
  return id.slice(-8)
}

const columns: Column<ShipmentSummary>[] = [
  {
    header: 'ID',
    className: 'hidden md:table-cell',
    cell: (r) => (
      <span className="font-mono text-xs text-slate-500">…{shortId(r.id)}</span>
    ),
  },
  {
    header: 'Type',
    className: 'hidden sm:table-cell',
    cell: (r) =>
      r.shipment_type === 'dealer' ? (
        <span className="flex items-center gap-1.5 text-slate-600">
          <Truck className="h-3.5 w-3.5 shrink-0" />
          <span className="text-sm">Dealer</span>
        </span>
      ) : (
        <span className="flex items-center gap-1.5 text-slate-600">
          <ArrowRight className="h-3.5 w-3.5 shrink-0" />
          <span className="text-sm">Transfer</span>
        </span>
      ),
  },
  {
    header: 'Destination',
    cell: (r) =>
      r.shipment_type === 'dealer' ? (
        <div>
          <p className="text-sm font-medium">{r.destination_dealer_name ?? '—'}</p>
          <p className="text-xs text-slate-500">{r.destination_city ?? ''}</p>
        </div>
      ) : (
        <div>
          <p className="text-sm font-medium">
            {r.origin_warehouse_code} → {r.destination_warehouse_code ?? '—'}
          </p>
          <p className="text-xs text-slate-500">Warehouse transfer</p>
        </div>
      ),
  },
  {
    header: 'Status',
    cell: (r) => <StatusBadge status={r.status} />,
  },
  {
    header: 'Dispatched',
    className: 'hidden lg:table-cell',
    cell: (r) => (
      <span className="text-sm text-slate-600">{formatDate(r.dispatched_at)}</span>
    ),
  },
  {
    header: 'Total',
    className: 'text-right',
    cell: (r) => (
      <span className="tabular-nums text-sm">
        {r.total_amount_naira != null ? formatNaira(r.total_amount_naira) : '—'}
      </span>
    ),
  },
  {
    header: 'Paid',
    className: 'hidden text-right sm:table-cell',
    cell: (r) => {
      const total = r.total_amount_naira ?? 0
      const paid = r.amount_paid_naira
      const partial = paid > 0 && paid < total
      return (
        <span
          className={`tabular-nums text-sm ${
            partial ? 'font-semibold text-amber-600' : 'text-slate-600'
          }`}
        >
          {r.total_amount_naira != null ? formatNaira(paid) : '—'}
        </span>
      )
    },
  },
]

interface Props {
  shipments: ShipmentSummary[]
  emptyMessage?: string
}

export function ShipmentsTable({ shipments, emptyMessage = 'No shipments found.' }: Props) {
  const router = useRouter()

  return (
    <DataTable
      columns={columns}
      data={shipments}
      emptyMessage={emptyMessage}
      onRowClick={(row) => router.push(`/shipments/${row.id}`)}
    />
  )
}
