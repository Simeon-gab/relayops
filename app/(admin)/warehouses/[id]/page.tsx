import { notFound } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { getWarehouse, getWarehouseStock } from '@/lib/db/warehouses'
import { WarehouseStockTable } from '@/components/admin/warehouse-stock-table'

type Props = {
  params: Promise<{ id: string }>
}

export default async function WarehouseDetailPage({ params }: Props) {
  const { id } = await params

  const [warehouse, stock] = await Promise.all([
    getWarehouse(id),
    getWarehouseStock(id),
  ])

  if (!warehouse) notFound()

  return (
    <div className="px-6 py-10">
      <div className="mb-8">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold text-slate-900">
            {warehouse.name}
          </h1>
          {warehouse.is_import_base && (
            <Badge variant="secondary">Import base</Badge>
          )}
        </div>
        <p className="mt-1 text-sm text-slate-500">
          {warehouse.city}, {warehouse.state} ·{' '}
          <span className="tabular-nums">{warehouse.total_units}</span> units in
          stock
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border bg-white">
        <WarehouseStockTable stock={stock} />
      </div>
    </div>
  )
}
