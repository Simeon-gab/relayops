import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { StatusBadge } from '@/components/admin/status-badge'
import { formatNaira } from '@/lib/utils/format'

type ShipmentRow = {
  id: string
  status: string
  dispatched_at: string | null
  total_amount_naira: number | null
  shipment_items: Array<{ id: string }>
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-NG', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

export default async function DealerShipmentsPage() {
  const supabase = await createClient()

  const { data } = await supabase
    .from('shipments')
    .select('id, status, dispatched_at, total_amount_naira, shipment_items(id)')
    .eq('shipment_type', 'dealer')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  const shipments = (data ?? []) as unknown as ShipmentRow[]

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-heading">Shipments</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Stock movements to your location.
        </p>
      </div>

      {shipments.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-6">
          <p className="text-sm text-muted-foreground">
            No shipments yet. Shipments will appear here once dispatched from Hungkee.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-subtle text-left">
                <th className="px-4 py-3 font-medium text-muted-foreground">Shipment ID</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Dispatched</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Items</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Total</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {shipments.map((shipment) => (
                <tr key={shipment.id} className="hover:bg-subtle">
                  <td className="px-4 py-3">
                    <Link
                      href={`/portal/shipments/${shipment.id}`}
                      className="font-mono text-xs text-brand-deep hover:underline"
                    >
                      ...{shipment.id.slice(-8)}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/portal/shipments/${shipment.id}`}
                      className="block w-full text-xs text-muted-foreground"
                    >
                      {shipment.dispatched_at ? formatDate(shipment.dispatched_at) : '—'}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/portal/shipments/${shipment.id}`}
                      className="block w-full tabular-nums text-foreground"
                    >
                      {shipment.shipment_items.length}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/portal/shipments/${shipment.id}`}
                      className="block w-full tabular-nums text-foreground"
                    >
                      {shipment.total_amount_naira != null
                        ? formatNaira(Number(shipment.total_amount_naira))
                        : '—'}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/portal/shipments/${shipment.id}`} className="block w-full">
                      <StatusBadge status={shipment.status} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
