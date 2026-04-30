import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

type AuditAction = 'order_status_changed' | 'order_auto_fulfilled'

interface AuditEntry {
  id: string
  action: AuditAction
  created_at: string
  changes: {
    from?: string
    to?: string
    reason?: string
    triggered_by_shipment_id?: string
  } | null
  users: { email: string } | null
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  partially_fulfilled: 'Partially fulfilled',
  fulfilled: 'Fulfilled',
  cancelled: 'Cancelled',
}

function statusLabel(s: string): string {
  return STATUS_LABELS[s] ?? s.replace(/_/g, ' ')
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

export async function OrderStatusHistory({ orderId }: { orderId: string }) {
  const db = await createClient()

  const { data, error } = await db
    .from('audit_log')
    .select('id, action, created_at, changes, users!user_id(email)')
    .eq('entity_type', 'dealer_order')
    .eq('entity_id', orderId)
    .in('action', ['order_status_changed', 'order_auto_fulfilled'])
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[OrderStatusHistory] query failed:', error.message)
  }

  const entries = (data ?? []) as unknown as AuditEntry[]

  return (
    <section className="mb-8">
      <h2 className="mb-3 text-base font-semibold text-slate-800">Status history</h2>

      {entries.length === 0 ? (
        <div className="rounded-xl border bg-white px-4 py-8 text-center text-sm text-slate-400">
          No status changes yet.
        </div>
      ) : (
        <div className="divide-y rounded-xl border bg-white">
          {entries.map((entry) => {
            const from = entry.changes?.from
            const to = entry.changes?.to
            const reason = entry.changes?.reason
            const shipmentId = entry.changes?.triggered_by_shipment_id
            const isAuto = entry.action === 'order_auto_fulfilled'

            return (
              <div key={entry.id} className="px-4 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <span className="text-sm font-medium text-slate-900">
                    {from
                      ? `${statusLabel(from)} → ${statusLabel(to ?? '')}`
                      : statusLabel(to ?? '')}
                  </span>
                  <span className="text-xs text-slate-400">
                    {formatDateTime(entry.created_at)}
                  </span>
                </div>

                {isAuto ? (
                  <p className="mt-0.5 text-xs text-slate-500">
                    Auto-updated — shipment{' '}
                    {shipmentId ? (
                      <Link
                        href={`/shipments/${shipmentId}`}
                        className="font-mono text-blue-600 hover:underline"
                      >
                        #{shipmentId.slice(-8)}
                      </Link>
                    ) : (
                      'unknown'
                    )}{' '}
                    marked delivered
                  </p>
                ) : (
                  <p className="mt-0.5 text-xs text-slate-500">
                    by {entry.users?.email ?? 'unknown'}
                  </p>
                )}

                {reason && (
                  <p className="mt-1 text-sm italic text-slate-600">{reason}</p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
