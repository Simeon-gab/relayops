'use client'

import { useRouter } from 'next/navigation'
import { DataTable, type Column } from './data-table'
import { formatNairaCurrency } from '@/lib/utils/format'
import type { ProductSummary } from '@/types/products'

const columns: Column<ProductSummary>[] = [
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
    cell: (r) => <span className="text-slate-600">{r.color ?? '—'}</span>,
  },
  {
    header: 'Sell price',
    className: 'text-right',
    cell: (r) => (
      <span className="tabular-nums">
        {r.sell_price_naira != null ? formatNairaCurrency(r.sell_price_naira) : '—'}
      </span>
    ),
  },
  {
    header: 'Stock',
    className: 'text-right',
    cell: (r) => (
      <span className="tabular-nums font-semibold">{r.total_stock}</span>
    ),
  },
]

export function ProductsTable({ products }: { products: ProductSummary[] }) {
  const router = useRouter()

  return (
    <DataTable
      columns={columns}
      data={products}
      emptyMessage="No active products found."
      onRowClick={(row) => router.push(`/products/${row.id}`)}
    />
  )
}
