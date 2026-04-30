import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { ProductForm } from '@/components/admin/product-form'

export default function NewProductPage() {
  return (
    <div className="px-6 py-10">
      <Link
        href="/products"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to products
      </Link>

      <div className="mb-8 mt-4">
        <h1 className="text-2xl font-semibold text-slate-900">New product</h1>
        <p className="mt-1 text-sm text-slate-500">Add a new SKU to the catalogue</p>
      </div>
      <div className="max-w-3xl">
        <ProductForm mode="create" />
      </div>
    </div>
  )
}
