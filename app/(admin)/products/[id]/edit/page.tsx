import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getProduct } from '@/lib/db/products'
import { ProductForm } from '@/components/admin/product-form'

type Props = {
  params: Promise<{ id: string }>
}

export default async function EditProductPage({ params }: Props) {
  const { id } = await params
  const product = await getProduct(id)
  if (!product) notFound()

  return (
    <div className="px-6 py-10">
      <Link
        href={`/products/${id}`}
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to product
      </Link>

      <div className="mb-8 mt-4">
        <h1 className="text-2xl font-semibold text-slate-900">Edit product</h1>
        <p className="mt-1 font-mono text-sm text-slate-500">{product.sku_code}</p>
      </div>

      <div className="max-w-3xl">
        <ProductForm mode="edit" product={product} />
      </div>
    </div>
  )
}
