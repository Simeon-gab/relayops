import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Pencil } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { getProduct } from '@/lib/db/products'
import { formatNairaCurrency } from '@/lib/utils/format'

type Props = {
  params: Promise<{ id: string }>
}

export default async function ProductDetailPage({ params }: Props) {
  const { id } = await params
  const product = await getProduct(id)

  if (!product) notFound()

  const imageUrl = product.image_path
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/product-images/${product.image_path}`
    : null

  const specs: { label: string; value: string | number | null }[] = [
    { label: 'SKU', value: product.sku_code },
    { label: 'Category', value: product.category },
    { label: 'Color', value: product.color ?? '—' },
    { label: 'Engine', value: product.engine_size_cc ? `${product.engine_size_cc} cc` : 'N/A' },
    {
      label: 'Sell price',
      value: product.sell_price_naira != null ? formatNairaCurrency(product.sell_price_naira) : '—',
    },
    { label: 'Status', value: product.active ? 'Active' : 'Inactive' },
  ]

  return (
    <div className="px-6 py-10">
      <Link
        href="/products"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to products
      </Link>

      <div className="mb-8 mt-4 flex items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold text-slate-900">
              {product.display_name}
            </h1>
            {!product.active && <Badge variant="secondary">Inactive</Badge>}
          </div>
          <p className="mt-1 text-sm text-slate-500">
            <span className="font-mono">{product.sku_code}</span> ·{' '}
            <span className="tabular-nums">{product.total_stock}</span> units total
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href={`/products/${id}/edit`}>
            <Pencil className="mr-1.5 h-3.5 w-3.5" />
            Edit
          </Link>
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Product image */}
        <div className="flex items-center justify-center overflow-hidden rounded-xl border bg-white lg:col-span-1">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={product.display_name}
              className="h-56 w-full object-cover"
            />
          ) : (
            <div className="flex h-56 w-full items-center justify-center text-slate-200">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-16 w-16"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
          )}
        </div>

        {/* Specs + stock */}
        <div className="space-y-6 lg:col-span-2">
          {/* Specs grid */}
          <div className="rounded-xl border bg-white p-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Specifications
            </h2>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
              {specs.map(({ label, value }) => (
                <div key={label}>
                  <dt className="text-xs text-slate-500">{label}</dt>
                  <dd className="mt-0.5 text-sm font-medium text-slate-900">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Stock by warehouse */}
          <div className="rounded-xl border bg-white p-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Stock by warehouse
            </h2>
            {product.stock_by_warehouse.length === 0 ? (
              <p className="text-sm text-slate-500">No stock at any warehouse.</p>
            ) : (
              <div className="divide-y">
                {product.stock_by_warehouse.map((s) => (
                  <div
                    key={s.warehouse_id}
                    className="flex items-center justify-between py-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        {s.warehouse_name}
                      </p>
                      <p className="text-xs text-slate-500">{s.warehouse_code}</p>
                    </div>
                    <span className="tabular-nums text-lg font-semibold text-slate-900">
                      {s.quantity}
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between py-3">
                  <p className="text-sm font-medium text-slate-500">Total</p>
                  <span className="tabular-nums text-lg font-semibold text-slate-900">
                    {product.total_stock}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
