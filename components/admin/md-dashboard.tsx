import Link from 'next/link'
import { Search, ArrowRight, Sparkles, Wallet, Package, Truck } from 'lucide-react'
import { formatNaira } from '@/lib/utils/format'
import type { Briefing } from '@/lib/ai/briefing'
import type { DailySummaryMetrics } from '@/lib/db/daily-metrics'
import type { DashboardStats } from '@/types/dashboard'
import type { AiProposal } from '@/lib/db/ai-proposals'
import { DecisionQueue } from './decision-queue'

/**
 * The MD's screen.
 *
 * Three questions, in this order: is money coming in, is stock moving, what
 * needs me. Everything else in RelayOps is one click away behind "See the
 * full system" — same login, same audit trail, just not on this page.
 *
 * The briefing renders server-side and pre-generated; he never presses a
 * button to find out how the business is doing.
 */

interface Props {
  briefing: Briefing | null
  metrics: DailySummaryMetrics
  stats: DashboardStats
  proposals: AiProposal[]
  displayName: string | null
}

function greeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function HeadlineNumber({
  icon: Icon,
  value,
  label,
  detail,
  href,
}: {
  icon: typeof Wallet
  value: string
  label: string
  detail: string
  href?: string
}) {
  const body = (
    <div className="rounded-xl border border-border bg-card px-5 py-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-bold tracking-tight text-heading">{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p>
    </div>
  )
  return href ? (
    <Link href={href} className="block transition-colors hover:bg-subtle/40">
      {body}
    </Link>
  ) : (
    body
  )
}

export function MdDashboard({ briefing, metrics, stats, proposals, displayName }: Props) {
  const name = displayName?.split(' ')[0]

  return (
    <div className="mx-auto max-w-3xl px-5 py-8 sm:px-8">
      <h1 className="text-[28px] font-bold tracking-tight text-heading">
        {greeting()}
        {name ? `, ${name}` : ''}.
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">Here is today.</p>

      {/* Briefing — the centrepiece, not a widget */}
      <div className="mt-6 rounded-xl border border-border bg-card px-6 py-5">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5" />
          <span className="text-[11px] font-semibold uppercase tracking-widest">
            Today&apos;s briefing
          </span>
        </div>

        {briefing ? (
          <>
            <p className="mt-3 text-[15px] leading-relaxed text-foreground">
              {briefing.summary_text}
            </p>
            {briefing.items_needing_attention.length > 0 && (
              <ul className="mt-4 space-y-2 border-t border-border pt-4">
                {briefing.items_needing_attention.map((item, i) => (
                  <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                    <span
                      className={
                        item.severity === 'high'
                          ? 'text-status-danger'
                          : item.severity === 'medium'
                            ? 'text-amber-600'
                            : 'text-muted-foreground'
                      }
                    >
                      •
                    </span>
                    {item.description}
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            The briefing could not be generated just now. The numbers below are live.
          </p>
        )}
      </div>

      {/* Three numbers, no more */}
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <HeadlineNumber
          icon={Wallet}
          label="Owed to us"
          href="/payments"
          value={stats.pendingPayments?.totalFormatted ?? '—'}
          detail={
            stats.pendingPayments
              ? `across ${stats.pendingPayments.shipmentCount} shipment${stats.pendingPayments.shipmentCount !== 1 ? 's' : ''}`
              : 'data unavailable'
          }
        />
        <HeadlineNumber
          icon={Package}
          label="In stock"
          value={stats.warehouseStock ? String(stats.warehouseStock.total) : '—'}
          detail={
            stats.warehouseStock
              ? `Lagos ${stats.warehouseStock.lagos} · Kano ${stats.warehouseStock.kano}`
              : 'data unavailable'
          }
        />
        <HeadlineNumber
          icon={Truck}
          label="On the road"
          value={stats.activeShipments ? String(stats.activeShipments.total) : '—'}
          detail={
            stats.activeShipments
              ? `${stats.activeShipments.dealer} dealer · ${stats.activeShipments.transfer} transfer`
              : 'data unavailable'
          }
        />
      </div>

      <div className="mt-6">
        <DecisionQueue
          proposals={proposals}
          emptyMessage="Nothing needs your decision right now."
        />
      </div>

      {/* Yesterday, as sentences rather than cards */}
      <div className="rounded-xl border border-border bg-card px-6 py-5">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Since yesterday
        </span>
        <dl className="mt-3 space-y-1.5 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Shipments dispatched</dt>
            <dd className="font-medium text-foreground">{metrics.shipments_dispatched_yesterday}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Deliveries confirmed</dt>
            <dd className="font-medium text-foreground">{metrics.deliveries_confirmed_yesterday}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Payments received</dt>
            <dd className="font-medium text-foreground">
              {formatNaira(metrics.payments_received_yesterday_naira)}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">New orders</dt>
            <dd className="font-medium text-foreground">{metrics.new_orders_yesterday}</dd>
          </div>
        </dl>
      </div>

      {/* Ask anything */}
      <Link
        href="/queries"
        className="mt-4 flex items-center gap-3 rounded-xl border border-border bg-card px-5 py-4 transition-colors hover:bg-subtle"
      >
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="flex-1 text-sm text-muted-foreground">
          Ask anything — &ldquo;how much did Kano sell last month?&rdquo;
        </span>
        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      </Link>

      <Link
        href="/dashboard?view=full"
        className="mt-6 flex items-center justify-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        See the full system
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  )
}
