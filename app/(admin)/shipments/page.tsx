import { Suspense } from 'react'
import { getShipments, getShipmentStatusCounts } from '@/lib/db/shipments'
import { ShipmentFilterBar } from '@/components/admin/shipment-filter-bar'
import { ShipmentsTable } from '@/components/admin/shipments-table'
import type { ShipmentFilters } from '@/types/shipments'

type Props = {
  searchParams: Promise<{ status?: string; type?: string; search?: string }>
}

export default async function ShipmentsPage({ searchParams }: Props) {
  const { status, type, search } = await searchParams

  const filters: ShipmentFilters = {
    status: status ? [status] : undefined,
    type: (type as 'dealer' | 'transfer') || undefined,
    search: search || undefined,
  }

  const [shipments, statusCounts] = await Promise.all([
    getShipments(filters),
    getShipmentStatusCounts(),
  ])

  const emptyMessage =
    status || type || search
      ? 'No shipments match these filters.'
      : 'No shipments recorded yet.'

  return (
    <div className="px-6 py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Shipments</h1>
        <p className="mt-1 text-sm text-slate-500">
          Stock movements between warehouses and to dealers
        </p>
      </div>

      <div className="mb-6">
        <Suspense>
          <ShipmentFilterBar counts={statusCounts} />
        </Suspense>
      </div>

      <div className="overflow-hidden rounded-xl border bg-white">
        <ShipmentsTable shipments={shipments} emptyMessage={emptyMessage} />
      </div>
    </div>
  )
}
