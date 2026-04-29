'use client'

import { useRouter } from 'next/navigation'
import { DataTable, type Column } from './data-table'
import type { WarehouseStockRow } from '@/types/warehouses'

const columns: Column<WarehouseStockRow>[] = [
  {
    header: 'SKU',
    cell: (r) => (
      <span className="font-mono text-xs text-slate-600">{r.sku_code}</span>
    ),
  },
  {
    header: 'Product',
    cell: (r) => <span className="font-medium">{r.display_name}</span>,
  },
  {
    header: 'Category',
    cell: (r) => (
      <span className="capitalize text-slate-600">{r.category}</span>
    ),
  },
  {
    header: 'Color',
    cell: (r) => (
      <span className="text-slate-600">{r.color ?? '—'}</span>
    ),
  },
  {
    header: 'Quantity',
    className: 'text-right',
    cell: (r) => (
      <span className="tabular-nums font-semibold">{r.quantity}</span>
    ),
  },
]

export function WarehouseStockTable({ stock }: { stock: WarehouseStockRow[] }) {
  const router = useRouter()

  return (
    <DataTable
      columns={columns}
      data={stock}
      emptyMessage="No stock currently at this warehouse."
      onRowClick={(row) => router.push(`/products/${row.product_id}`)}
    />
  )
}
