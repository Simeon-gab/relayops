import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { StatusBadge } from '@/components/admin/status-badge'
import { AllocationStarter } from '@/components/admin/allocation-starter'
import { getContainer } from '@/lib/db/containers'
import type { ContainerItem } from '@/types/containers'

type Props = {
  params: Promise<{ id: string }>
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-NG', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export default async function ContainerDetailPage({ params }: Props) {
  const { id } = await params
  const container = await getContainer(id)

  if (!container) notFound()

  const totalUnits = container.items.reduce((sum, i) => sum + i.quantity, 0)

  return (
    <div className="px-6 py-10">
      {/* Back link */}
      <Link
        href="/containers"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to containers
      </Link>

      {/* Header */}
      <div className="mb-8 mt-4">
        <h1 className="font-mono text-2xl font-semibold text-slate-900">
          {container.container_number}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Arrived {formatDate(container.arrived_at)}
        </p>
        <div className="mt-3">
          <StatusBadge status={container.status} />
        </div>
      </div>

      {/* Stats row */}
      <div className="mb-8 grid grid-cols-3 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border bg-white p-4">
          <p className="text-xs text-slate-500">Total units</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-slate-900">
            {totalUnits}
          </p>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <p className="text-xs text-slate-500">SKU count</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-slate-900">
            {container.items.length}
          </p>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <p className="text-xs text-slate-500">Status</p>
          <p className="mt-1 text-sm font-medium capitalize text-slate-900">
            {container.status.replace(/_/g, ' ')}
          </p>
        </div>
      </div>

      {/* Contents table */}
      <div className="mb-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Contents
        </h2>
        <div className="overflow-hidden rounded-xl border bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-slate-50 text-left">
                <th className="px-4 py-3 font-medium text-slate-600">SKU</th>
                <th className="px-4 py-3 font-medium text-slate-600">Product name</th>
                <th className="px-4 py-3 font-medium text-slate-600">Category</th>
                <th className="px-4 py-3 font-medium text-slate-600">Color</th>
                <th className="px-4 py-3 text-right font-medium text-slate-600">
                  Quantity
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {container.items.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="py-10 text-center text-sm text-muted-foreground"
                  >
                    No items recorded for this container.
                  </td>
                </tr>
              ) : (
                <>
                  {container.items.map((item: ContainerItem) => (
                    <tr key={item.product_id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs text-slate-600">
                          {item.sku_code}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {item.display_name}
                      </td>
                      <td className="px-4 py-3 capitalize text-slate-600">
                        {item.category}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {item.color ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="tabular-nums font-semibold text-slate-900">
                          {item.quantity}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {/* Total row */}
                  <tr className="border-t-2 bg-slate-50">
                    <td
                      colSpan={4}
                      className="px-4 py-3 text-sm font-semibold text-slate-700"
                    >
                      Total
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="tabular-nums font-bold text-slate-900">
                        {totalUnits}
                      </span>
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Shipping details (only if any field is populated) */}
      {(container.bill_of_lading ||
        container.shipping_line ||
        container.origin_port ||
        container.expected_arrival_date) && (
        <div className="mb-6">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Shipping details
          </h2>
          <div className="overflow-hidden rounded-xl border bg-white">
            <dl className="divide-y text-sm">
              {container.shipping_line && (
                <div className="flex gap-4 px-4 py-3">
                  <dt className="w-44 shrink-0 text-slate-500">Shipping line</dt>
                  <dd className="text-slate-900">{container.shipping_line}</dd>
                </div>
              )}
              {container.bill_of_lading && (
                <div className="flex gap-4 px-4 py-3">
                  <dt className="w-44 shrink-0 text-slate-500">Bill of lading</dt>
                  <dd className="font-mono text-slate-900">{container.bill_of_lading}</dd>
                </div>
              )}
              {container.origin_port && (
                <div className="flex gap-4 px-4 py-3">
                  <dt className="w-44 shrink-0 text-slate-500">Origin port</dt>
                  <dd className="text-slate-900">{container.origin_port}</dd>
                </div>
              )}
              {container.expected_arrival_date && (
                <div className="flex gap-4 px-4 py-3">
                  <dt className="w-44 shrink-0 text-slate-500">Expected arrival</dt>
                  <dd className="text-slate-900">
                    {formatDate(container.expected_arrival_date)}
                  </dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      )}

      {/* Notes */}
      <div className="mb-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Notes
        </h2>
        <div className="rounded-xl border bg-white px-4 py-4">
          {container.notes ? (
            <p className="text-sm text-slate-700">{container.notes}</p>
          ) : (
            <p className="text-sm text-slate-400">No notes.</p>
          )}
        </div>
      </div>

      {/* Allocation section */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Allocation
        </h2>
        {container.status === 'pending_allocation' ? (
          <AllocationStarter containerId={container.id} />
        ) : container.status === 'allocated' ? (
          <div className="rounded-xl border bg-green-50 px-4 py-3 text-sm text-green-800">
            Container has been allocated. See shipments for the resulting dealer and transfer shipments.
          </div>
        ) : (
          <div className="rounded-xl border bg-slate-50 px-4 py-3 text-sm text-slate-500">
            Allocation not applicable for containers with status <span className="font-mono">{container.status}</span>.
          </div>
        )}
      </div>
    </div>
  )
}
