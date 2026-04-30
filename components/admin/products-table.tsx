'use client'

import { useRouter } from 'next/navigation'
import { DataTable, type Column } from './data-table'
import { formatNairaCurrency } from '@/lib/utils/format'
import type { ProductSummary } from '@/types/products'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL

const columns: Column<ProductSummary>[] = [
  {
    header: '',
    className: 'w-12',
    cell: (r) =>
      r.image_path ? (
        <img
          src={`${SUPABASE_URL}/storage/v1/object/public/product-images/${r.image_path}`}
          alt=""
          className="h-9 w-9 rounded object-cover"
        />
      ) : (
        <div className="h-9 w-9 rounded bg-slate-100" />
      ),
  },
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
