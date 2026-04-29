import { getContainers } from '@/lib/db/containers'
import { ContainersTable } from '@/components/admin/containers-table'

export default async function ContainersPage() {
  const containers = await getContainers()

  return (
    <div className="px-6 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-900">Containers</h1>
        <p className="mt-1 text-sm text-slate-500">
          Container arrivals at Lagos warehouse
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border bg-white">
        <ContainersTable containers={containers} />
      </div>
    </div>
  )
}
