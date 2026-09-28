'use server'

import { can } from '@/lib/auth/roles'
import { createClient } from '@/lib/supabase/server'
import { Client } from 'pg'
import { revalidatePath } from 'next/cache'
import { callClaudeText, AI_MODEL } from '@/lib/ai/client'
import { getLoadingParseSystemPrompt, getLoadingParseUserPrompt } from '@/lib/ai/prompts/loading-parse'
import { getLoadingOptions } from '@/lib/db/loading'
import { ruleParseLoading } from '@/lib/loading/rule-parse'
import { notifyAllAdmins } from '@/lib/notifications'
import type { LoadingDraft, LoadingLoad } from '@/types/loading'

async function getStaffUser() {
  const db = await createClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) return null
  const { data } = await db.from('users').select('role').eq('id', user.id).single()
  if (!can(data?.role, 'manage_shipments')) return null
  return user
}

const lagosToday = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Lagos' })

// ─── Parse ────────────────────────────────────────────────────────────────────

export type ParseLoadingResult =
  | { success: true; draft: LoadingDraft }
  | { success: false; error: string }

/**
 * Turn a pasted WhatsApp loading message into draft loads. Nothing is written —
 * the draft goes back to the form for a human to check and confirm.
 */
export async function parseLoadingMessage(message: string): Promise<ParseLoadingResult> {
  if (!(await getStaffUser())) return { success: false, error: 'Not authorised.' }
  if (!message?.trim()) return { success: false, error: 'Paste the loading message first.' }
  if (message.length > 4000) return { success: false, error: 'That message is too long — paste one day at a time.' }

  const options = await getLoadingOptions()
  const today = lagosToday()

  // Short keys keep the prompt small and stop the model echoing UUIDs back wrong.
  const destKeys = options.destinations.map((d, i) => ({ short: `D${i + 1}`, dest: d }))

  try {
    const raw = await callClaudeText(
      getLoadingParseSystemPrompt(),
      getLoadingParseUserPrompt(
        message,
        today,
        options.products,
        destKeys.map(({ short, dest }) => ({ key: short, name: dest.name, city: dest.city, kind: dest.kind }))
      )
    )
    const parsed = JSON.parse(raw.trim().replace(/^```json\s*/i, '').replace(/\s*```$/, '')) as {
      load_date?: string | null
      loads?: Array<{
        destination_text?: string
        destination_key?: string | null
        items?: Array<{ source_text?: string; sku_code?: string | null; quantity?: number; color?: string | null }>
      }>
      issues?: string[]
    }

    const bySku = new Map(options.products.map((p) => [p.sku_code, p]))
    const byShort = new Map(destKeys.map(({ short, dest }) => [short, dest]))
    const issues = (parsed.issues ?? []).filter((i) => typeof i === 'string')

    const loads: LoadingLoad[] = (parsed.loads ?? []).map((l) => ({
      destination_key: (l.destination_key && byShort.get(l.destination_key)?.key) || null,
      destination_text: l.destination_text ?? '',
      lines: (l.items ?? [])
        .filter((it) => Number.isInteger(it.quantity) && (it.quantity ?? 0) > 0)
        .map((it) => ({
          // Only SKUs that really exist survive; anything else is left for the human.
          product_id: (it.sku_code && bySku.get(it.sku_code)?.id) || null,
          quantity: it.quantity!,
          color: it.color?.trim() || null,
          source_text: it.source_text ?? '',
        })),
    }))

    if (!loads.length) throw new Error('AI found no loads')

    const date = parsed.load_date && /^\d{4}-\d{2}-\d{2}$/.test(parsed.load_date) ? parsed.load_date : today
    return { success: true, draft: { load_date: date, loads, issues, parsed_by: 'ai' } }
  } catch (err) {
    console.error('[loading] AI parse failed, falling back to rules:', err)
    const { loads, issues } = ruleParseLoading(message, options.products, options.destinations)
    if (!loads.some((l) => l.lines.length)) {
      return { success: false, error: "Couldn't find any quantities in that message. Check it and try again." }
    }
    return { success: true, draft: { load_date: today, loads, issues, parsed_by: 'rules' } }
  }
}

// ─── Confirm ──────────────────────────────────────────────────────────────────

export interface ConfirmLoadingInput {
  raw_message: string
  load_date: string
  parsed_by: 'ai' | 'rules'
  loads: Array<{
    destination_key: string
    lines: Array<{ product_id: string; quantity: number; color: string | null }>
  }>
}

export type ConfirmLoadingResult =
  | { success: true; shipmentIds: string[] }
  | { success: false; error: string }

/**
 * Record confirmed loads: one dispatched shipment per destination, Lagos stock
 * deducted, all in one transaction. Loads to a partner warehouse (Kano) leave
 * our stock and are not credited anywhere — that stock is Mr Kabiru's.
 */
export async function confirmLoading(input: ConfirmLoadingInput): Promise<ConfirmLoadingResult> {
  const user = await getStaffUser()
  if (!user) return { success: false, error: 'Not authorised.' }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.load_date ?? '')) return { success: false, error: 'Pick a loading date.' }
  if (input.load_date > lagosToday()) return { success: false, error: "Loading date can't be in the future." }
  if (!input.loads?.length) return { success: false, error: 'There are no loads to record.' }
  for (const load of input.loads) {
    if (!load.destination_key) return { success: false, error: 'Every load needs a destination.' }
    if (!load.lines.length) return { success: false, error: 'Every load needs at least one item.' }
    for (const line of load.lines) {
      if (!line.product_id) return { success: false, error: 'Every line needs a product.' }
      if (!Number.isInteger(line.quantity) || line.quantity < 1) {
        return { success: false, error: 'Quantities must be whole numbers of at least 1.' }
      }
    }
  }

  const options = await getLoadingOptions()
  const destinations = new Map(options.destinations.map((d) => [d.key, d]))
  const products = new Map(options.products.map((p) => [p.id, p]))
  for (const load of input.loads) {
    if (!destinations.has(load.destination_key)) return { success: false, error: 'Unknown destination.' }
    for (const line of load.lines) {
      if (!products.has(line.product_id)) return { success: false, error: 'Unknown product.' }
    }
  }

  const needed = new Map<string, number>()
  for (const load of input.loads) {
    for (const line of load.lines) needed.set(line.product_id, (needed.get(line.product_id) ?? 0) + line.quantity)
  }

  const originId = options.origin_warehouse_id
  // Noon Lagos time — the day is what's known, not the hour.
  const dispatchedAt = input.load_date === lagosToday() ? new Date().toISOString() : `${input.load_date}T12:00:00+01:00`

  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  await client.connect()

  try {
    await client.query('BEGIN')

    // Lock the origin rows so two people confirming at once can't both spend the same stock.
    const { rows: stockRows } = await client.query<{ product_id: string; quantity: number }>(
      `SELECT product_id, quantity FROM warehouse_stock
       WHERE warehouse_id = $1 AND product_id = ANY($2::uuid[]) FOR UPDATE`,
      [originId, [...needed.keys()]]
    )
    const onHand = new Map(stockRows.map((r) => [r.product_id, r.quantity]))
    const short: string[] = []
    for (const [pid, qty] of needed) {
      const have = onHand.get(pid) ?? 0
      if (have < qty) short.push(`${products.get(pid)!.display_name}: need ${qty}, Lagos has ${have}`)
    }
    if (short.length) {
      await client.query('ROLLBACK')
      return { success: false, error: `Not enough stock in ${options.origin_warehouse_name}. ${short.join('; ')}.` }
    }

    const shipmentIds: string[] = []

    for (const load of input.loads) {
      const dest = destinations.get(load.destination_key)!
      const isWarehouse = dest.kind === 'warehouse'

      const { rows: [s] } = await client.query<{ id: string }>(
        `INSERT INTO shipments
           (shipment_type, origin_warehouse_id, destination_warehouse_id, destination_dealer_id,
            destination_city, destination_state, status, dispatched_at, amount_paid_naira, notes, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, 'dispatched', $7, 0, $8, $9)
         RETURNING id`,
        [
          isWarehouse ? 'transfer' : 'dealer',
          originId,
          isWarehouse ? dest.id : null,
          isWarehouse ? null : dest.id,
          dest.city || null,
          dest.state || null,
          dispatchedAt,
          'Recorded from a WhatsApp loading message.',
          user.id,
        ]
      )
      shipmentIds.push(s.id)

      for (const line of load.lines) {
        await client.query(
          `INSERT INTO shipment_items (shipment_id, product_id, quantity, color) VALUES ($1, $2, $3, $4)`,
          [s.id, line.product_id, line.quantity, line.color?.trim() || null]
        )
        await client.query(
          `UPDATE warehouse_stock SET quantity = quantity - $1, updated_at = now()
           WHERE warehouse_id = $2 AND product_id = $3`,
          [line.quantity, originId, line.product_id]
        )
        // To our own warehouse it's a transfer; to a dealer or a partner's warehouse it has left us.
        const internal = isWarehouse && !dest.partner
        await client.query(
          `INSERT INTO stock_movements
             (warehouse_id, product_id, change_type, quantity_delta, reference_type, reference_id, reason, created_by)
           VALUES ($1, $2, $3, $4, 'shipment', $5, $6, $7)`,
          [originId, line.product_id, internal ? 'transfer_out' : 'shipment_dispatch', -line.quantity, s.id, `Loaded to ${dest.name}`, user.id]
        )
        if (internal) {
          await client.query(
            `INSERT INTO warehouse_stock (warehouse_id, product_id, quantity, updated_at)
             VALUES ($1, $2, $3, now())
             ON CONFLICT (warehouse_id, product_id)
             DO UPDATE SET quantity = warehouse_stock.quantity + $3, updated_at = now()`,
            [dest.id, line.product_id, line.quantity]
          )
          await client.query(
            `INSERT INTO stock_movements
               (warehouse_id, product_id, change_type, quantity_delta, reference_type, reference_id, reason, created_by)
             VALUES ($1, $2, 'transfer_in', $3, 'shipment', $4, $5, $6)`,
            [dest.id, line.product_id, line.quantity, s.id, `Received from ${options.origin_warehouse_name}`, user.id]
          )
        }
      }

      await client.query(
        `INSERT INTO status_events (shipment_id, from_status, to_status, event_at, recorded_by, source, notes)
         VALUES ($1, NULL, 'dispatched', $2, $3, 'admin', 'loaded_from_whatsapp')`,
        [s.id, dispatchedAt, user.id]
      )
    }

    await client.query(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id, changes)
       VALUES ($1, 'loading_message_recorded', 'shipment', $2, $3)`,
      [
        user.id,
        shipmentIds[0],
        JSON.stringify({
          raw_message: input.raw_message,
          parsed_by: input.parsed_by,
          ai_model: input.parsed_by === 'ai' ? AI_MODEL : null,
          shipment_ids: shipmentIds,
        }),
      ]
    )

    await client.query('COMMIT')

    revalidatePath('/shipments')
    revalidatePath('/warehouses', 'layout')
    revalidatePath('/products', 'layout')
    revalidatePath('/dashboard')

    const units = [...needed.values()].reduce((a, b) => a + b, 0)
    notifyAllAdmins({
      eventType: 'shipment_dispatched',
      title: `${shipmentIds.length} load${shipmentIds.length === 1 ? '' : 's'} dispatched from Lagos`,
      description: `${units} items · from a WhatsApp loading message`,
      entityType: 'shipment',
      entityId: shipmentIds[0],
    }).catch((err) => console.error('[notifications] broadcast failed:', err))

    return { success: true, shipmentIds }
  } catch (err) {
    await client.query('ROLLBACK')
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error occurred.' }
  } finally {
    await client.end()
  }
}
