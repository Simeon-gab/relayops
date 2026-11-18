import { createAdminClient } from '@/lib/supabase/admin'
import { assertCronRequest } from '@/lib/cron-auth'
import { emitAlert } from '@/lib/agents/emit'
import { logAgentRun, supersedeStaleAlerts } from '@/lib/db/ai-proposals'
import { WATCHDOG } from '@/lib/policy'
import { formatNaira } from '@/lib/utils/format'
import { Client } from 'pg'
import { revalidatePath } from 'next/cache'
import { autoFulfillFromShipment } from '@/lib/shipments/auto-fulfill'

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
 * the same subject, so a nightly run refreshes rather than piles up — and each
 * sweep returns the subjects it still finds, so alerts that have stopped being
 * true (restocked, confirmed, paid down) are retired in the same pass.
 *
 * Each sweep returns the ids it raised on.
 */

interface Raised {
  stock: number
  overdue: number
  credit: number
}

async function sweepLowStock(db: ReturnType<typeof createAdminClient>): Promise<string[]> {
  const { data, error } = await db
    .from('warehouse_stock')
    .select('quantity, warehouses(code, name), products(id, sku_code, display_name, active, deleted_at)')
    .lt('quantity', WATCHDOG.LOW_STOCK_QTY)

  if (error) throw error

  type Product = { id: string; sku_code: string; display_name: string; active: boolean; deleted_at: string | null }
  type Row = {
    quantity: number
    warehouses: { code: string; name: string } | null
    products: Product | null
  }

  // Grouped by product rather than by shelf. A proposal is keyed by its subject,
  // so a bike low in both warehouses raised twice would supersede itself and
  // leave one warehouse's shortage invisible — and restocking is one decision
  // about one product anyway.
  const byProduct = new Map<string, { product: Product; places: { where: string; quantity: number }[] }>()

  for (const row of (data ?? []) as unknown as Row[]) {
    const p = row.products
    if (!p || !p.active || p.deleted_at) continue

    const where = row.warehouses?.name ?? row.warehouses?.code ?? 'a warehouse'
    const entry = byProduct.get(p.id) ?? { product: p, places: [] }
    entry.places.push({ where, quantity: row.quantity })
    byProduct.set(p.id, entry)
  }

  const raised: string[] = []
  for (const { product, places } of byProduct.values()) {
    const phrase = places
      .map((s) => (s.quantity === 0 ? `out of stock in ${s.where}` : `down to ${s.quantity} in ${s.where}`))
      .join(', and ')

    await emitAlert({
      kind: 'stock_alert',
      subjectType: 'product',
      subjectId: product.id,
      // The partner decides what goes in the next container, so running low
      // is his signal before it is anyone else's.
      audience: 'partner',
      summary: `${product.display_name} is ${phrase}.`,
      detail: { sku_code: product.sku_code, low_at: places },
    })
    raised.push(product.id)
  }
  return raised
}

/**
 * Close shipments nobody has confirmed. Until dealers use the portal there is
 * no one to press "delivered", so a load that has been out long enough is
 * taken as arrived. It is labelled as an assumption — in the history, the
 * notes and the audit log — and staff can move it back to in transit if it
 * turns out to be wrong. The delivery date is left empty: we do not know it.
 */
async function sweepAssumeDelivered(): Promise<number> {
  const days = WATCHDOG.ASSUME_DELIVERED_DAYS
  if (!days) return 0

  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString()
  const note = `Assumed delivered after ${days} days — not confirmed by the dealer.`

  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  await client.connect()

  try {
    await client.query('BEGIN')

    const { rows } = await client.query<{ id: string; status: string; created_by: string }>(
      `SELECT id, status, created_by FROM shipments
       WHERE status IN ('dispatched', 'in_transit') AND dispatched_at < $1 AND deleted_at IS NULL
       FOR UPDATE`,
      [cutoff]
    )

    for (const s of rows) {
      await client.query(
        `UPDATE shipments
         SET status = 'delivered', updated_at = now(), notes = concat_ws(' ', notes, $2::text)
         WHERE id = $1`,
        [s.id, note]
      )
      await client.query(
        `INSERT INTO status_events (shipment_id, from_status, to_status, event_at, recorded_by, source, notes)
         VALUES ($1, $2, 'delivered', now(), $3, 'ai_inferred', $4)`,
        [s.id, s.status, s.created_by, note]
      )
      await client.query(
        `INSERT INTO audit_log (user_id, action, entity_type, entity_id, changes)
         VALUES ($1, 'shipment_assumed_delivered', 'shipment', $2, $3)`,
        [s.created_by, s.id, JSON.stringify({ from: s.status, to: 'delivered', by: 'watchdog', after_days: days })]
      )
      await autoFulfillFromShipment(client, s.id, s.created_by)
    }

    await client.query('COMMIT')

    if (rows.length) {
      revalidatePath('/shipments', 'layout')
      revalidatePath('/dashboard')
      revalidatePath('/dealer-orders', 'layout')
    }
    return rows.length
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    await client.end()
  }
}

async function sweepOverdue(db: ReturnType<typeof createAdminClient>): Promise<string[]> {
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

  const raised: string[] = []
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
    raised.push(s.id)
  }
  return raised
}

async function sweepCredit(db: ReturnType<typeof createAdminClient>): Promise<string[]> {
  const { data: dealers, error } = await db
    .from('dealers')
    .select('id, business_name, credit_limit_naira')
    .eq('active', true)
    .is('deleted_at', null)
    .gt('credit_limit_naira', 0)

  if (error) throw error

  type Dealer = { id: string; business_name: string; credit_limit_naira: number }
  const raised: string[] = []

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
    raised.push(d.id)
  }
  return raised
}

export async function GET() {
  const refusal = await assertCronRequest()
  if (refusal) return refusal

  const startedAt = Date.now()
  const db = createAdminClient()
  const raised: Raised = { stock: 0, overdue: 0, credit: 0 }
  const cleared: Raised = { stock: 0, overdue: 0, credit: 0 }
  let assumedDelivered = 0

  try {
    // Sequential on purpose: three small sweeps against one small database,
    // and a failure in one should not hide the others' results.
    // First, so a load closed here is not also raised as overdue below.
    assumedDelivered = await sweepAssumeDelivered()

    const stock = await sweepLowStock(db)
    const overdue = await sweepOverdue(db)
    const credit = await sweepCredit(db)

    raised.stock = stock.length
    raised.overdue = overdue.length
    raised.credit = credit.length

    // Anything still queued that this sweep no longer found has stopped being
    // true. Retiring it here is what keeps the morning queue a list of live
    // problems rather than an archive of solved ones.
    cleared.stock = await supersedeStaleAlerts('stock_alert', stock)
    cleared.overdue = await supersedeStaleAlerts('overdue_alert', overdue)
    cleared.credit = await supersedeStaleAlerts('credit_alert', credit)

    await logAgentRun({
      agent: 'watchdog',
      trigger: 'cron',
      ok: true,
      duration_ms: Date.now() - startedAt,
    })

    return Response.json({ ok: true, raised, cleared, assumedDelivered })
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
