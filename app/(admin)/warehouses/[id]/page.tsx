import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { getPartnerDeliveries, getWarehouse, getWarehouseStock } from '@/lib/db/warehouses'
import { WarehouseStockTable } from '@/components/admin/warehouse-stock-table'
import { StatusBadge } from '@/components/admin/status-badge'
import { formatQty } from '@/lib/utils/format'
import type { PartnerDelivery } from '@/types/warehouses'

type Props = {
  params: Promise<{ id: string }>
}

export default async function WarehouseDetailPage({ params }: Props) {
  const { id } = await params

  const warehouse = await getWarehouse(id)
  if (!warehouse) notFound()

  if (warehouse.partner_dealer_id) {
    const deliveries = await getPartnerDeliveries(id)
    return (
      <div className="px-6 py-10">
        <div className="mb-8">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold text-slate-900">{warehouse.name}</h1>
            <Badge variant="outline">{warehouse.partner_dealer_name ?? 'Partner'}&apos;s warehouse</Badge>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {warehouse.city}, {warehouse.state} · Owned by{' '}
            <Link href={`/dealers/${warehouse.partner_dealer_id}`} className="underline underline-offset-2">
              {warehouse.partner_dealer_name ?? 'the partner'}
            </Link>
            . Everything below was delivered to them and is not part of our stock.
          </p>
        </div>

        {deliveries.length === 0 ? (
          <p className="rounded-xl border bg-white p-6 text-sm text-slate-500">Nothing delivered yet.</p>
        ) : (
          <div className="space-y-4">
            {deliveries.map((d) => (
              <DeliveryCard key={d.shipment_id} delivery={d} />
            ))}
          </div>
        )}
      </div>
    )
  }

  const stock = await getWarehouseStock(id)

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
          <span className="tabular-nums">{warehouse.total_units}</span> motorcycles
          {warehouse.spare_part_lines.length > 0 && (
            <>
              {' '}· spare parts:{' '}
              {warehouse.spare_part_lines
                .map((p) => `${formatQty(p.quantity, p.unit_label)} ${p.display_name.toLowerCase()}`)
                .join(', ')}
            </>
          )}
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border bg-white">
        <WarehouseStockTable stock={stock} />
      </div>
    </div>
  )
}

function DeliveryCard({ delivery }: { delivery: PartnerDelivery }) {
  const date = new Date(delivery.dispatched_at ?? delivery.created_at).toLocaleDateString('en-NG', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
  const bikes = delivery.items.filter((i) => i.category !== 'spare_part')
  const parts = delivery.items.filter((i) => i.category === 'spare_part')

  return (
    <div className="rounded-xl border bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-3">
        <Link href={`/shipments/${delivery.shipment_id}`} className="font-medium text-slate-900 hover:underline">
          {date}
        </Link>
        <StatusBadge status={delivery.status} />
      </div>
      <div className="grid gap-4 px-5 py-4 sm:grid-cols-2">
        <ItemGroup title="Motorcycles" items={bikes} />
        <ItemGroup title="Spare parts" items={parts} />
      </div>
      {delivery.notes && <p className="border-t px-5 py-3 text-xs text-slate-500">{delivery.notes}</p>}
    </div>
  )
}

function ItemGroup({ title, items }: { title: string; items: PartnerDelivery['items'] }) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">{title}</p>
      {items.length === 0 ? (
        <p className="text-sm text-slate-400">—</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {items.map((i, idx) => (
            <li key={idx} className="flex justify-between gap-4">
              <span>
                {i.display_name}
                {i.color && <span className="text-slate-500"> · {i.color}</span>}
              </span>
              <span className="tabular-nums font-medium">{formatQty(i.quantity, i.unit_label)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
