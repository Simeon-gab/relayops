#!/usr/bin/env node
/**
 * Import the August 2026 Crystal shipment and its distribution.
 *
 * This is the point RelayOps starts from. The source is not a spreadsheet —
 * it is what the MD reported directly:
 *
 *   2 Crystal containers arrived, 195 units each          390 units in
 *   192 units to Kano                                     (warehouse transfer)
 *    30 units to Awwal, Abuja                             (dealer)
 *    30 units to Minna                                    (dealer, name pending)
 *    15 units to Lafia                                    (dealer, name pending)
 *                                                         ---
 *                                                         267 distributed
 *                                                         123 remain at Lagos
 *
 * Lagos is the import base, so both containers land there and everything moves
 * outward from it. The 123 unshipped units are Lagos stock on hand.
 *
 * No money is recorded anywhere. unit_price_naira and total_amount_naira are
 * left NULL and amount_paid_naira is 0 — deliberately, because the value of
 * this stock is not confirmed and the ledger it would come from is out of
 * scope. This file records movement of units, nothing else.
 *
 * Minna and Lafia are dealers whose trading names are not yet known. They are
 * created under their town name, matching how the business already refers to
 * them, and should be renamed once the real names arrive.
 *
 * Requires import-real-data.mjs to have run first — it needs the Crystal product.
 *
 * Usage:
 *   node scripts/import-august.mjs             # dry run
 *   node scripts/import-august.mjs --confirm   # actually insert
 */

import { resolve } from 'path'
import { createRequire } from 'module'
import { fileURLToPath } from 'url'

const require = createRequire(import.meta.url)
const __dirname = fileURLToPath(new URL('.', import.meta.url))
require('dotenv').config({ path: resolve(__dirname, '..', '.env.local') })

const confirmed = process.argv.includes('--confirm')
const { createClient } = require('@supabase/supabase-js')
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)
const die = (m) => { console.error(`\n[x] ${m}\n`); process.exit(1) }

// Only the month is known, not the day. Everything is dated to the 1st and
// says so, rather than inventing a delivery date that was never recorded.
const ARRIVED = '2026-08-01'
const UNITS_PER_CONTAINER = 195
const CONTAINERS = ['HK-AUG-2026-01', 'HK-AUG-2026-02']

const DEALER_DROPS = [
  { name: 'Awwal', city: 'Abuja', state: 'FCT', units: 30 },
  { name: 'Minna', city: 'Minna', state: 'Niger', units: 30 },
  { name: 'Lafia', city: 'Lafia', state: 'Nasarawa', units: 15 },
]
const KANO_UNITS = 192

// ── look up what must already exist ─────────────────────────────────────────
const { data: whs } = await db.from('warehouses').select('id, code, city')
const lagos = whs?.find((w) => w.code === 'LAGOS')
const kano = whs?.find((w) => w.code === 'KANO')
if (!lagos || !kano) die('Lagos and Kano warehouses must both exist.')

const { data: crystal } = await db
  .from('products').select('id, display_name').eq('sku_code', 'HK-CRYSTAL').maybeSingle()
if (!crystal) die('Product HK-CRYSTAL not found — run import-real-data.mjs first.')

const { data: staff } = await db.from('users').select('id, role').in('role', ['md', 'manager']).limit(1)
if (!staff?.length) die('No md/manager user found — containers.recorded_by is NOT NULL and needs one.')
const actor = staff[0].id

// ── arithmetic, verified before anything is written ─────────────────────────
const arrived = CONTAINERS.length * UNITS_PER_CONTAINER
const shipped = KANO_UNITS + DEALER_DROPS.reduce((s, d) => s + d.units, 0)
const remaining = arrived - shipped
if (remaining < 0) die(`Distribution (${shipped}) exceeds what arrived (${arrived}).`)

console.log(`\n${confirmed ? '-> Importing' : '-> Dry run —'} August 2026 Crystal shipment\n`)
console.log(`  arrived at Lagos      ${String(arrived).padStart(4)}  (${CONTAINERS.length} containers x ${UNITS_PER_CONTAINER})`)
console.log(`  to Kano warehouse     ${String(KANO_UNITS).padStart(4)}  transfer`)
for (const d of DEALER_DROPS) {
  console.log(`  to ${d.name.padEnd(18)} ${String(d.units).padStart(4)}  dealer shipment (${d.city}, ${d.state})`)
}
console.log(`  ${'-'.repeat(24)}`)
console.log(`  distributed           ${String(shipped).padStart(4)}`)
console.log(`  remaining at Lagos    ${String(remaining).padStart(4)}  stock on hand`)
console.log(`\n  No prices, no payments, no orders are recorded.`)

if (!confirmed) {
  console.log('\n  Nothing was written. Add --confirm to insert.\n')
  process.exit(0)
}

// ── dealers for the three drop points ───────────────────────────────────────
const dealerIds = {}
for (const d of DEALER_DROPS) {
  const { data: found } = await db.from('dealers').select('id').eq('business_name', d.name).maybeSingle()
  if (found) { dealerIds[d.name] = found.id; console.log(`  - dealer ${d.name} already present`); continue }
  const { data, error } = await db.from('dealers').insert({
    business_name: d.name,
    contact_name: d.name,
    phone: '',
    city: d.city,
    state: d.state,
    preferred_language: 'en',
    served_by_warehouse_id: lagos.id,
    active: true,
    notes: 'Created from the August 2026 Crystal distribution. Trading name and phone pending.',
  }).select('id').single()
  if (error) die(`Dealer ${d.name} insert failed: ${error.message}`)
  dealerIds[d.name] = data.id
  console.log(`  [ok] dealer ${d.name} created`)
}

// ── containers ──────────────────────────────────────────────────────────────
for (const num of CONTAINERS) {
  const { data: exists } = await db.from('containers').select('id').eq('container_number', num).maybeSingle()
  if (exists) { console.log(`  - container ${num} already present`); continue }
  const { data: c, error } = await db.from('containers').insert({
    container_number: num,
    arrived_at: ARRIVED,
    recorded_by: actor,
    status: 'completed',
    notes: `${UNITS_PER_CONTAINER} Crystal units. Arrival date recorded to the month; exact day not known.`,
  }).select('id').single()
  if (error) die(`Container ${num} insert failed: ${error.message}`)

  const { error: ie } = await db.from('container_items').insert({
    container_id: c.id, product_id: crystal.id, quantity: UNITS_PER_CONTAINER,
  })
  if (ie) die(`Container item for ${num} failed: ${ie.message}`)

  const { error: me } = await db.from('stock_movements').insert({
    warehouse_id: lagos.id, product_id: crystal.id, change_type: 'container_arrival',
    quantity_delta: UNITS_PER_CONTAINER, reference_type: 'container', reference_id: c.id,
    reason: `Container ${num} arrival`, created_by: actor,
  })
  if (me) die(`Arrival movement for ${num} failed: ${me.message}`)
  console.log(`  [ok] container ${num}: ${UNITS_PER_CONTAINER} Crystal into Lagos`)
}

// ── shipment helper ─────────────────────────────────────────────────────────
async function ship({ type, units, destWarehouse, destDealer, city, state, label }) {
  const { data: s, error } = await db.from('shipments').insert({
    shipment_type: type,
    origin_warehouse_id: lagos.id,
    destination_warehouse_id: destWarehouse ?? null,
    destination_dealer_id: destDealer ?? null,
    destination_city: city ?? null,
    destination_state: state ?? null,
    status: 'delivered',
    dispatched_at: `${ARRIVED}T00:00:00Z`,
    delivered_at: `${ARRIVED}T00:00:00Z`,
    amount_paid_naira: 0,
    notes: 'August 2026 Crystal distribution. Value not recorded. Dated to the month; exact day not known.',
    created_by: actor,
  }).select('id').single()
  if (error) die(`Shipment to ${label} failed: ${error.message}`)

  const { error: ie } = await db.from('shipment_items').insert({
    shipment_id: s.id, product_id: crystal.id, quantity: units,
  })
  if (ie) die(`Shipment items for ${label} failed: ${ie.message}`)

  const moves = [{
    warehouse_id: lagos.id, product_id: crystal.id, change_type: 'shipment_dispatch',
    quantity_delta: -units, reference_type: 'shipment', reference_id: s.id,
    reason: `Dispatched to ${label}`, created_by: actor,
  }]
  if (destWarehouse) moves.push({
    warehouse_id: destWarehouse, product_id: crystal.id, change_type: 'transfer_in',
    quantity_delta: units, reference_type: 'shipment', reference_id: s.id,
    reason: 'Received from Lagos', created_by: actor,
  })
  const { error: me } = await db.from('stock_movements').insert(moves)
  if (me) die(`Movements for ${label} failed: ${me.message}`)
  console.log(`  [ok] ${units} units to ${label}`)
}

const { count: shipCount } = await db.from('shipments').select('id', { count: 'exact', head: true })
if (shipCount) {
  console.log(`\n  [!] ${shipCount} shipment(s) already exist — skipping distribution to avoid duplicates.`)
} else {
  await ship({ type: 'transfer', units: KANO_UNITS, destWarehouse: kano.id, city: 'Kano', state: 'Kano State', label: 'Kano warehouse' })
  for (const d of DEALER_DROPS) {
    await ship({ type: 'dealer', units: d.units, destDealer: dealerIds[d.name], city: d.city, state: d.state, label: `${d.name} (${d.city})` })
  }
}

// ── resulting stock on hand ─────────────────────────────────────────────────
for (const [wh, qty] of [[lagos.id, remaining], [kano.id, KANO_UNITS]]) {
  const { data: row } = await db.from('warehouse_stock').select('id')
    .eq('warehouse_id', wh).eq('product_id', crystal.id).maybeSingle()
  const payload = { warehouse_id: wh, product_id: crystal.id, quantity: qty, updated_at: new Date().toISOString() }
  const { error } = row
    ? await db.from('warehouse_stock').update(payload).eq('id', row.id)
    : await db.from('warehouse_stock').insert(payload)
  if (error) die(`Stock update failed: ${error.message}`)
}
console.log(`  [ok] stock on hand — Lagos ${remaining}, Kano ${KANO_UNITS}`)
console.log('\n[done]\n')
