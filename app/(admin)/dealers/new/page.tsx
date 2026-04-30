import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getWarehouses } from '@/lib/db/warehouses'
import { DealerForm } from '@/components/admin/dealer-form'

export default async function NewDealerPage() {
  const warehouses = await getWarehouses()

  return (
    <div className="px-6 py-10">
      <Link
        href="/dealers"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to dealers
      </Link>

      <div className="mb-8 mt-4">
        <h1 className="text-2xl font-semibold text-slate-900">New dealer</h1>
        <p className="mt-1 text-sm text-slate-500">Add a dealer to the network</p>
      </div>

      <div className="max-w-3xl">
        <DealerForm warehouses={warehouses} />
      </div>
    </div>
  )
}
