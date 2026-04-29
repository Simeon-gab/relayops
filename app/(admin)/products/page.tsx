import { getProducts } from '@/lib/db/products'
import { ProductsTable } from '@/components/admin/products-table'

export default async function ProductsPage() {
  const products = await getProducts()

  return (
    <div className="px-6 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-900">Products</h1>
        <p className="mt-1 text-sm text-slate-500">
          {products.length} active SKU{products.length !== 1 ? 's' : ''}
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border bg-white">
        <ProductsTable products={products} />
      </div>
    </div>
  )
}
