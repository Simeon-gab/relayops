import Link from 'next/link'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getProducts } from '@/lib/db/products'
import { ProductsTable } from '@/components/admin/products-table'

export default async function ProductsPage() {
  const products = await getProducts()

  return (
    <div className="px-6 py-10">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Products</h1>
          <p className="mt-1 text-sm text-slate-500">
            {products.length} active SKU{products.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button asChild>
          <Link href="/products/new">
            <Plus className="mr-1.5 h-4 w-4" />
            New product
          </Link>
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border bg-white">
        <ProductsTable products={products} />
      </div>
    </div>
  )
}
