import Link from 'next/link'
import {
  Ship,
  MapPin,
  Package,
  Truck,
  AlertCircle,
  ArrowRight,
  Clock,
} from 'lucide-react'
import type { PartnerView } from '@/lib/db/partner-view'
import { arrivingSoon } from '@/lib/db/partner-view'
import type { AiProposal } from '@/lib/db/ai-proposals'
import { DecisionQueue } from './decision-queue'

/**
 * The business partner's screen.
 *
 * He is in China and owns the physical chain end to end: what goes in the
 * container, when it lands, how it is split, and where every unit ended up.
 * There is deliberately no naira on this page — no unit prices, no shipment
 * values, no payments. Payments and receipts are blocked at the RLS layer
 * (migration 0015) rather than merely hidden here.
 *
 * No message parsing either: dealer conversations are the managers' work.
 */

interface Props {
  view: PartnerView
  proposals: AiProposal[]
  displayName: string | null
}

const STAGE: Record<string, { label: string; className: string }> = {
  pending_allocation: {
    label: 'Awaiting allocation',
    className: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  allocated: {
    label: 'Allocated',
    className: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  completed: {
    label: 'Complete',
    className: 'bg-green-50 text-green-700 border-green-200',
  },
}

function clock(timeZone: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
  }).format(new Date())
}

function arrivalText(c: PartnerView['pipeline'][number]): string {
  if (c.arrived_at) {
    const d = c.days_from_arrival
    const landed = d === 0 ? 'landed today' : d === 1 ? 'landed yesterday' : `landed ${d}d ago`
    if (c.slip_days !== null && c.slip_days > 0) return `${landed} · ${c.slip_days}d late`
    if (c.slip_days !== null && c.slip_days < 0) return `${landed} · ${Math.abs(c.slip_days)}d early`
    return landed
  }
  if (c.days_from_arrival === null) return 'no arrival date'
  const days = Math.abs(c.days_from_arrival)
  return days === 0 ? 'due today' : `due in ${days}d`
}

function Stat({
  icon: Icon,
  value,
  label,
  detail,
}: {
  icon: typeof Ship
  value: string
  label: string
  detail: string
}) {
  return (
    <div className="rounded-xl border border-border bg-card px-5 py-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-bold tracking-tight text-heading">{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p>
    </div>
  )
}

export function PartnerDashboard({ view, proposals, displayName }: Props) {
  const name = displayName?.split(' ')[0]
  const incoming = arrivingSoon(view.pipeline)
  const inStock = view.skuFlow.reduce((sum, s) => sum + s.in_lagos + s.in_kano, 0)
  const totalDispatched = view.skuFlow.reduce((sum, s) => sum + s.dispatched, 0)

  return (
    <div className="px-5 py-8 sm:px-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-heading">
            Operations{name ? `, ${name}` : ''}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Container to dealer — the whole chain.
          </p>
        </div>
        <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          <span>
            <span className="font-medium text-foreground">{clock('Asia/Shanghai')}</span> China
          </span>
          <span className="h-3 w-px bg-border" />
          <span>
            <span className="font-medium text-foreground">{clock('Africa/Lagos')}</span> Lagos
          </span>
        </div>
      </div>

      {/* Action strip */}
      {(view.awaitingAllocation > 0 || incoming.length > 0) && (
        <div className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
          <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
          {view.awaitingAllocation > 0 && (
            <Link href="/containers" className="text-sm font-medium text-amber-900 hover:underline">
              {view.awaitingAllocation} container{view.awaitingAllocation !== 1 ? 's' : ''} to
              allocate
            </Link>
          )}
          {incoming.length > 0 && (
            <span className="text-sm text-amber-900">
              {incoming.length} arriving within two weeks
            </span>
          )}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          icon={Package}
          label="In warehouse"
          value={String(inStock)}
          detail={`across ${view.skuFlow.length} SKU${view.skuFlow.length !== 1 ? 's' : ''}`}
        />
        <Stat
          icon={Truck}
          label="On the road"
          value={String(view.unitsOnTheRoad)}
          detail={`${view.inTransitShipments} shipment${view.inTransitShipments !== 1 ? 's' : ''} moving`}
        />
        <Stat
          icon={MapPin}
          label="Delivered out"
          value={String(totalDispatched)}
          detail={`to ${view.destinations.length} destination${view.destinations.length !== 1 ? 's' : ''}`}
        />
        <Stat
          icon={Ship}
          label="Containers"
          value={String(view.pipeline.length)}
          detail={`${view.awaitingAllocation} awaiting allocation`}
        />
      </div>

      <div className="mt-6">
        <DecisionQueue
          proposals={proposals}
          title="Waiting on you"
          emptyMessage="No allocation or container decisions waiting."
        />
      </div>

      {/* Container pipeline */}
      <section className="mb-6 overflow-hidden rounded-xl border border-border bg-card">
        <div className="border-b border-border bg-subtle px-5 py-3">
          <h2 className="text-sm font-semibold text-foreground">Container pipeline</h2>
        </div>
        {view.pipeline.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted-foreground">No containers recorded yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {view.pipeline.map((c) => {
              const stage = STAGE[c.status] ?? {
                label: c.status,
                className: 'bg-slate-50 text-slate-700 border-slate-200',
              }
              return (
                <li key={c.id}>
                  <Link
                    href={`/containers/${c.id}`}
                    className="flex flex-col gap-2 px-5 py-4 transition-colors hover:bg-subtle sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-medium text-foreground">
                          {c.container_number}
                        </span>
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${stage.className}`}
                        >
                          {stage.label}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {c.total_units} units · {c.sku_count} SKU
                        {c.sku_count !== 1 ? 's' : ''}
                        {c.origin_port ? ` · from ${c.origin_port}` : ''}
                        {c.shipping_line ? ` · ${c.shipping_line}` : ''}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs font-medium text-muted-foreground">
                      {arrivalText(c)}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Where it all went */}
        <section className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border bg-subtle px-5 py-3">
            <h2 className="text-sm font-semibold text-foreground">Where units went</h2>
            <Link
              href="/shipments"
              className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              All shipments
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {view.destinations.length === 0 ? (
            <p className="px-5 py-6 text-sm text-muted-foreground">Nothing dispatched yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-5 py-2 font-medium">Destination</th>
                    <th className="px-5 py-2 text-right font-medium">Units</th>
                    <th className="px-5 py-2 text-right font-medium">Delivered</th>
                    <th className="px-5 py-2 text-right font-medium">Moving</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {view.destinations.map((d) => (
                    <tr key={`${d.city}-${d.state}`}>
                      <td className="px-5 py-2.5">
                        <span className="font-medium text-foreground">{d.city}</span>
                        {d.state && (
                          <span className="ml-1.5 text-xs text-muted-foreground">{d.state}</span>
                        )}
                      </td>
                      <td className="px-5 py-2.5 text-right font-medium text-foreground">
                        {d.units}
                      </td>
                      <td className="px-5 py-2.5 text-right text-muted-foreground">{d.delivered}</td>
                      <td className="px-5 py-2.5 text-right text-muted-foreground">
                        {d.in_transit}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Per-SKU position */}
        <section className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border bg-subtle px-5 py-3">
            <h2 className="text-sm font-semibold text-foreground">Stock position by model</h2>
            <Link
              href="/warehouses"
              className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              Warehouses
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {view.skuFlow.length === 0 ? (
            <p className="px-5 py-6 text-sm text-muted-foreground">No stock recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-5 py-2 font-medium">Model</th>
                    <th className="px-5 py-2 text-right font-medium">Lagos</th>
                    <th className="px-5 py-2 text-right font-medium">Kano</th>
                    <th className="px-5 py-2 text-right font-medium">Gone out</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {view.skuFlow.map((s) => (
                    <tr key={s.sku_code}>
                      <td className="px-5 py-2.5">
                        <span className="font-medium text-foreground">{s.display_name}</span>
                        <span className="ml-1.5 font-mono text-xs text-muted-foreground">
                          {s.sku_code}
                        </span>
                      </td>
                      <td
                        className={`px-5 py-2.5 text-right font-medium ${s.in_lagos < 5 ? 'text-status-danger' : 'text-foreground'}`}
                      >
                        {s.in_lagos}
                      </td>
                      <td
                        className={`px-5 py-2.5 text-right font-medium ${s.in_kano < 5 ? 'text-status-danger' : 'text-foreground'}`}
                      >
                        {s.in_kano}
                      </td>
                      <td className="px-5 py-2.5 text-right text-muted-foreground">
                        {s.dispatched}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
