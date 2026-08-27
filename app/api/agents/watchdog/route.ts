import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { emitAlert } from '@/lib/agents/emit'
import { logAgentRun } from '@/lib/db/ai-proposals'
import { WATCHDOG } from '@/lib/policy'
import { formatNaira } from '@/lib/utils/format'

export const dynamic = 'force-dynamic'

/**
 * The overnight sweep.
 *
 * Nothing here needs a model — these are rules, and rules are cheaper and more
 * predictable than a prompt. What it produces is the same as everything else:
 * proposals in the queue, so the morning starts with the problems already
 * found rather than with someone hunting for them.
 *
 * Re-raising is safe. createProposal supersedes an earlier pending alert about
 * the same subject, so a nightly run refreshes rather than piles up.
 */

interface Raised {
  stock: number
  overdue: number
  credit: number
}

async function sweepLowStock(db: ReturnType<typeof createAdminClient>): Promise<number> {
  const { data, error } = await db
    .from('warehouse_stock')
    .select('quantity, warehouses(code, name), products(id, sku_code, display_name, active, deleted_at)')
    .lt('quantity', WATCHDOG.LOW_STOCK_QTY)

  if (error) throw error

  type Row = {
    quantity: number
    warehouses: { code: string; name: string } | null
    products: { id: string; sku_code: string; display_name: string; active: boolean; deleted_at: string | null } | null
  }

  let raised = 0
  for (const row of (data ?? []) as unknown as Row[]) {
    const p = row.products
    if (!p || !p.active || p.deleted_at) continue

    const where = row.warehouses?.name ?? row.warehouses?.code ?? 'a warehouse'
    await emitAlert({
      kind: 'stock_alert',
      subjectType: 'product',
      subjectId: p.id,
      // The partner decides what goes in the next container, so running low
      // is his signal before it is anyone else's.
      audience: 'partner',
      summary:
        row.quantity === 0
          ? `${p.display_name} is out of stock in ${where}.`
          : `${p.display_name} is down to ${row.quantity} in ${where}.`,
      detail: { sku_code: p.sku_code, quantity: row.quantity, warehouse: where },
    })
    raised++
  }
  return raised
}

async function sweepOverdue(db: ReturnType<typeof createAdminClient>): Promise<number> {
  const cutoff = new Date(
    Date.now() - WATCHDOG.OVERDUE_SHIPMENT_DAYS * 86_400_000
  ).toISOString()

  const { data, error } = await db
    .from('shipments')
    .select('id, dispatched_at, destination_city, dealers:destination_dealer_id(business_name)')
    .eq('status', 'dispatched')
    .lt('dispatched_at', cutoff)
    .is('deleted_at', null)

  if (error) throw error

  type Row = {
    id: string
    dispatched_at: string
    destination_city: string | null
    dealers: { business_name: string } | null
  }

  let raised = 0
  for (const s of (data ?? []) as unknown as Row[]) {
    const days = Math.floor((Date.now() - new Date(s.dispatched_at).getTime()) / 86_400_000)
    const who = s.dealers?.business_name ?? 'A dealer'
    await emitAlert({
      kind: 'overdue_alert',
      subjectType: 'shipment',
      subjectId: s.id,
      audience: 'manager',
      summary: `${who}${s.destination_city ? ` in ${s.destination_city}` : ''} has not confirmed a shipment sent ${days} days ago.`,
      detail: { days_out: days },
    })
    raised++
  }
  return raised
}

async function sweepCredit(db: ReturnType<typeof createAdminClient>): Promise<number> {
  const { data: dealers, error } = await db
    .from('dealers')
    .select('id, business_name, credit_limit_naira')
    .eq('active', true)
    .is('deleted_at', null)
    .gt('credit_limit_naira', 0)

  if (error) throw error

  type Dealer = { id: string; business_name: string; credit_limit_naira: number }
  let raised = 0

  for (const d of (dealers ?? []) as Dealer[]) {
    const { data: shipments } = await db
      .from('shipments')
      .select('total_amount_naira, amount_paid_naira')
      .eq('destination_dealer_id', d.id)
      .in('status', ['dispatched', 'in_transit', 'delivered'])
      .is('deleted_at', null)

    const outstanding = (shipments ?? []).reduce(
      (sum, s) =>
        sum + (Number(s.total_amount_naira ?? 0) - Number(s.amount_paid_naira ?? 0)),
      0
    )

    const limit = Number(d.credit_limit_naira)
    if (outstanding <= limit) continue

    await emitAlert({
      kind: 'credit_alert',
      subjectType: 'dealer',
      subjectId: d.id,
      // Credit is the MD's call, not an operational one.
      audience: 'md',
      summary: `${d.business_name} owes ${formatNaira(outstanding)} against a ${formatNaira(limit)} limit — ${formatNaira(outstanding - limit)} over.`,
      valueNaira: outstanding,
      detail: { outstanding, limit },
    })
    raised++
  }
  return raised
}

export async function GET() {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const authHeader = (await headers()).get('authorization')
    if (authHeader !== `Bearer ${secret}`) {
      return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 })
    }
  }

  const startedAt = Date.now()
  const db = createAdminClient()
  const raised: Raised = { stock: 0, overdue: 0, credit: 0 }

  try {
    // Sequential on purpose: three small sweeps against one small database,
    // and a failure in one should not hide the others' results.
    raised.stock = await sweepLowStock(db)
    raised.overdue = await sweepOverdue(db)
    raised.credit = await sweepCredit(db)

    await logAgentRun({
      agent: 'watchdog',
      trigger: 'cron',
      ok: true,
      duration_ms: Date.now() - startedAt,
    })

    return Response.json({ ok: true, raised })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error.'
    console.error('[watchdog] failed:', message)

    await logAgentRun({
      agent: 'watchdog',
      trigger: 'cron',
      ok: false,
      duration_ms: Date.now() - startedAt,
      error: message,
    })

    return Response.json({ ok: false, error: message, raised }, { status: 500 })
  }
}
