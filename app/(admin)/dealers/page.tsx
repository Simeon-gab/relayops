import { getDealers } from '@/lib/db/dealers'
import { DealersTable } from '@/components/admin/dealers-table'

export default async function DealersPage() {
  const dealers = await getDealers()

  return (
    <div className="px-6 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-900">Dealers</h1>
        <p className="mt-1 text-sm text-slate-500">
          Hungkee dealer network across Nigeria
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border bg-white">
        <DealersTable dealers={dealers} />
      </div>
    </div>
  )
}
