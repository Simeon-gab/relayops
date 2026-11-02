#!/usr/bin/env node
/**
 * Start the RelayOps record again from the October 2026 notebook.
 *
 * The earlier stock figures were never kept up to date, so the owner chose to
 * retire them. Old containers and shipments are soft-deleted, which hides them
 * but keeps the rows, and Lagos is set to the notebook balance of 22/10/2026.
 *
 * Containers transloaded straight onto trucks never sit in the warehouse, so
 * each one adds stock and ships it again in the same run. Quantities only, no money.
 *
 * Usage:
 *   node scripts/import-october.mjs             # runs everything, then rolls back
 *   node scripts/import-october.mjs --confirm   # commits
 */

import { resolve } from 'path'
import { createRequire } from 'module'
import { fileURLToPath } from 'url'

const require = createRequire(import.meta.url)
const __dirname = fileURLToPath(new URL('.', import.meta.url))
require('dotenv').config({ path: resolve(__dirname, '..', '.env.local') })
const { Client } = require('pg')

const confirmed = process.argv.includes('--confirm')
const LAGOS = '00000000-0000-0000-0001-000000000001'
const KANO = '00000000-0000-0000-0001-000000000002'
const NO_NUMBER = 'Container number not in the notebook; this reference is a placeholder.'
const noon = (d) => `${d}T12:00:00+01:00`

const FLASH = 'HK-FLASH 125'
const HUNTER = 'HK-HUNTER'
const CRYSTAL = 'HK-CRYSTAL'
const F1 = 'HK-F1'
const BEAT = 'HK-BEAT'
const ENGINE = 'HK-ENGINE-HUNTER'
const SPARES = 'HK-SPARES-CTN'

// Containers 1 to 9: [date, loaded for Damaturu, sent elsewhere]. Container 1
// held 195 Flash, but 21 of them went to Kano and are recorded separately below.
const DAMATURU = [
  ['2026-10-14', [[FLASH, 174], [ENGINE, 89], [HUNTER, 3]], [[FLASH, 21]]],
  ['2026-10-14', [[HUNTER, 186], [ENGINE, 100], [SPARES, 7]], []],
  ['2026-10-15', [[FLASH, 195], [SPARES, 16]], []],
  ['2026-10-16', [[FLASH, 195], [SPARES, 18]], []],
  ['2026-10-17', [[HUNTER, 189], [ENGINE, 159], [SPARES, 3]], []],
  ['2026-10-17', [[FLASH, 195], [ENGINE, 30], [SPARES, 18]], []],
  ['2026-10-18', [[FLASH, 195], [SPARES, 33]], []],
  ['2026-10-18', [[FLASH, 174], [HUNTER, 21], [ENGINE, 21]], []],
  ['2026-10-22', [[FLASH, 195]], []],
]

const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
await client.connect()
const q = (sql, args) => client.query(sql, args)

const expect = (label, actual, wanted) => {
  if (actual !== wanted) throw new Error(`${label}: expected ${wanted}, got ${actual}`)
  console.log(`  [ok] ${label}: ${actual}`)
}

try {
  await q('BEGIN')

  const { rows: dupes } = await q(`SELECT 1 FROM containers WHERE container_number LIKE 'HK-OCT-2026-%'`)
  if (dupes.length) throw new Error('October containers already exist. Refusing to import twice.')

  const { rows: staff } = await q(`SELECT id FROM users WHERE role = 'manager' LIMIT 1`)
  const actor = staff[0]?.id
  if (!actor) throw new Error('No manager user found.')

  // ── products and dealers ──────────────────────────────────────────────────
  await q(
    `INSERT INTO products (sku_code, display_name, category, unit_label, active)
     VALUES ($1, 'Hunter engine', 'spare_part', 'piece', true)`,
    [ENGINE]
  )
  await q(`UPDATE products SET engine_size_cc = 100, updated_at = now() WHERE sku_code = $1`, [HUNTER])
  await q(`UPDATE products SET engine_size_cc = 125, updated_at = now() WHERE sku_code = $1`, [CRYSTAL])

  const { rows: products } = await q(`SELECT id, sku_code FROM products`)
  const pid = Object.fromEntries(products.map((p) => [p.sku_code, p.id]))
  for (const sku of [FLASH, HUNTER, CRYSTAL, F1, BEAT, ENGINE, SPARES]) {
    if (!pid[sku]) throw new Error(`Product ${sku} not found.`)
  }

  const newDealer = async (name, city, state, notes) => {
    const { rows } = await q(
      `INSERT INTO dealers (business_name, contact_name, phone, city, state, preferred_language, served_by_warehouse_id, active, notes)
       VALUES ($1, $1, '', $2, $3, 'en', $4, true, $5) RETURNING id`,
      [name, city, state, LAGOS, notes]
    )
    return rows[0].id
  }
  const damaturu = await newDealer('Damaturu', 'Damaturu', 'Yobe', 'Named after the town. Real trading name and phone pending.')
  const hasan = await newDealer('Hasan', 'Idiroko', 'Ogun', 'Phone pending.')

  const { rows: dealers } = await q(
    `SELECT id, business_name FROM dealers WHERE business_name = ANY($1)`,
    [['Kara', 'Mohammad', 'Sunday']]
  )
  const did = Object.fromEntries(dealers.map((d) => [d.business_name, d.id]))
  for (const n of ['Kara', 'Mohammad', 'Sunday']) {
    if (!did[n]) throw new Error(`Dealer ${n} not found.`)
  }

  // ── helpers ───────────────────────────────────────────────────────────────
  const move = async (sku, delta, type, refType, refId, reason, date) => {
    await q(
      // GREATEST keeps the proposed row valid: the quantity check runs before
      // ON CONFLICT, so a negative delta would fail even when the row exists.
      `INSERT INTO warehouse_stock (warehouse_id, product_id, quantity, updated_at) VALUES ($1, $2, GREATEST($3::int, 0), now())
       ON CONFLICT (warehouse_id, product_id)
       DO UPDATE SET quantity = warehouse_stock.quantity + $3::int, updated_at = now()`,
      [LAGOS, pid[sku], delta]
    )
    await q(
      `INSERT INTO stock_movements
         (warehouse_id, product_id, change_type, quantity_delta, reference_type, reference_id, reason, created_by, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [LAGOS, pid[sku], type, delta, refType, refId, reason, actor, noon(date)]
    )
  }

  const container = async (n, date, items, notes) => {
    const number = `HK-OCT-2026-${String(n).padStart(2, '0')}`
    const { rows } = await q(
      `INSERT INTO containers (container_number, arrived_at, recorded_by, status, notes)
       VALUES ($1, $2, $3, 'completed', $4) RETURNING id`,
      [number, date, actor, `${notes} ${NO_NUMBER}`]
    )
    for (const [sku, qty] of items) {
      await q(`INSERT INTO container_items (container_id, product_id, quantity) VALUES ($1, $2, $3)`, [rows[0].id, pid[sku], qty])
      await move(sku, qty, 'container_arrival', 'container', rows[0].id, `Container ${number} arrival`, date)
    }
  }

  const ship = async ({ date, items, dealer, warehouse, city, state, status, notes, label, stock = true }) => {
    const { rows } = await q(
      `INSERT INTO shipments
         (shipment_type, origin_warehouse_id, destination_warehouse_id, destination_dealer_id,
          destination_city, destination_state, status, dispatched_at, amount_paid_naira, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, $9, $10) RETURNING id`,
      [warehouse ? 'transfer' : 'dealer', LAGOS, warehouse ?? null, dealer ?? null, city, state, status, noon(date), notes, actor]
    )
    for (const [sku, qty] of items) {
      await q(`INSERT INTO shipment_items (shipment_id, product_id, quantity) VALUES ($1, $2, $3)`, [rows[0].id, pid[sku], qty])
      if (stock) await move(sku, -qty, 'shipment_dispatch', 'shipment', rows[0].id, `Loaded to ${label}`, date)
    }
    await q(
      `INSERT INTO status_events (shipment_id, from_status, to_status, event_at, recorded_by, source, notes)
       VALUES ($1, NULL, 'dispatched', $2, $3, 'admin', 'october_notebook_import')`,
      [rows[0].id, noon(date), actor]
    )
  }

  const stockOf = async (sku) => {
    const { rows } = await q(
      `SELECT quantity FROM warehouse_stock WHERE warehouse_id = $1 AND product_id = $2`,
      [LAGOS, pid[sku]]
    )
    return rows[0]?.quantity ?? 0
  }

  // ── retire the old record ─────────────────────────────────────────────────
  const oldShipments = await q(`UPDATE shipments SET deleted_at = now(), updated_at = now() WHERE deleted_at IS NULL`)
  const oldContainers = await q(`UPDATE containers SET deleted_at = now(), updated_at = now() WHERE deleted_at IS NULL`)
  expect('old shipments hidden', oldShipments.rowCount, 4)
  expect('old containers hidden', oldContainers.rowCount, 4)

  // ── containers 1 to 9, straight onto trucks for Damaturu ──────────────────
  let damaturuTotal = 0
  for (const [i, [date, loaded, elsewhere]] of DAMATURU.entries()) {
    const n = i + 1
    await container(n, date, [...loaded, ...elsewhere], `Container ${n}, transloaded directly.`)
    await ship({
      date,
      items: loaded,
      dealer: damaturu,
      city: 'Damaturu',
      state: 'Yobe',
      status: 'delivered',
      label: 'Damaturu',
      notes: `Container ${n}, transloaded directly to Damaturu. Delivery date not recorded.`,
    })
    damaturuTotal += loaded.reduce((sum, [, qty]) => sum + qty, 0)
  }
  expect('Damaturu total', damaturuTotal, 2216)

  await ship({
    date: '2026-10-14',
    items: [[FLASH, 20]],
    dealer: did.Kara,
    city: 'Kano',
    state: 'Kano State',
    status: 'delivered',
    label: 'Kara, onward to Kano',
    notes: 'From Container 1. To Kara, then onward to Kano. Day not written; dated to the container.',
  })
  await ship({
    date: '2026-10-14',
    items: [[FLASH, 1]],
    warehouse: KANO,
    city: 'Kano',
    state: 'Kano State',
    status: 'delivered',
    label: 'Kano',
    notes: 'From Container 1. Day not written; dated to the container.',
  })
  await ship({
    date: '2026-10-16',
    items: [[CRYSTAL, 10]],
    city: null,
    state: 'Edo',
    status: 'delivered',
    label: 'Edo',
    stock: false,
    notes: 'From warehouse stock, before the 22/10/2026 opening balance, so it does not change the stock count. Day not written; dated to Container 4.',
  })

  for (const sku of [FLASH, HUNTER, ENGINE]) expect(`${sku} left after direct loads`, await stockOf(sku), 0)

  // ── opening balance, 22/10/2026 ───────────────────────────────────────────
  const reason = 'New starting record: notebook balance of 22/10/2026 replaces earlier figures'
  const opening = { [CRYSTAL]: 56, [BEAT]: 0, [FLASH]: 148, [SPARES]: 15 }
  for (const [sku, wanted] of Object.entries(opening)) {
    const delta = wanted - (await stockOf(sku))
    if (delta) await move(sku, delta, 'manual_adjustment', null, null, reason, '2026-10-22')
  }

  await ship({
    date: '2026-10-22',
    items: [[FLASH, 35]],
    dealer: did.Kara,
    city: 'Minna',
    state: 'Niger',
    status: 'delivered',
    label: 'Kara, Minna',
    notes: 'Loaded from the warehouse. Delivery date not recorded.',
  })
  expect('Flash after Kara load', await stockOf(FLASH), 113)

  await container(10, '2026-10-22', [[CRYSTAL, 195], [SPARES, 14]], 'Offloaded to the warehouse. Exact day not written; recorded after the 22/10/2026 balance.')
  expect('Crystal after offload', await stockOf(CRYSTAL), 251)
  expect('Cartons after offload', await stockOf(SPARES), 29)

  // ── 24/10, trailer straight to truck, so the warehouse count does not move ─
  await container(11, '2026-10-24', [[CRYSTAL, 195], [SPARES, 8]], 'Transloaded directly from trailer to truck for Kabiru.')
  await ship({
    date: '2026-10-24',
    items: [[CRYSTAL, 195], [SPARES, 8]],
    warehouse: KANO,
    city: 'Kano',
    state: 'Kano State',
    status: 'delivered',
    label: 'Kabiru, Kano',
    notes: 'Transloaded directly from trailer to truck, not from the warehouse. Delivery date not recorded.',
  })
  await container(12, '2026-10-24', [[CRYSTAL, 195], [SPARES, 14]], 'Transloaded directly from trailer to truck for Mohammad.')
  await ship({
    date: '2026-10-24',
    items: [[CRYSTAL, 195], [SPARES, 14]],
    dealer: did.Mohammad,
    city: 'Kano',
    state: 'Kano State',
    status: 'delivered',
    label: 'Mohammad, Kano',
    notes: 'Transloaded directly from trailer to truck, not from the warehouse. Delivery date not recorded.',
  })
  expect('Crystal unchanged by direct loads', await stockOf(CRYSTAL), 251)
  expect('Cartons unchanged by direct loads', await stockOf(SPARES), 29)

  // ── warehouse loads ───────────────────────────────────────────────────────
  await ship({
    date: '2026-10-28',
    items: [[CRYSTAL, 70]],
    dealer: did.Kara,
    city: 'Kaduna',
    state: 'Kaduna',
    status: 'dispatched',
    label: 'Kara, onward to Kaduna',
    notes: 'To Kara, then onward to Kaduna.',
  })
  await ship({
    date: '2026-10-28',
    items: [[CRYSTAL, 20], [SPARES, 2]],
    dealer: did.Kara,
    city: 'Lafia',
    state: 'Nasarawa',
    status: 'dispatched',
    label: 'Kara, onward to Lafia',
    notes: 'To Kara, then onward to Lafia.',
  })
  await move(F1, 2, 'manual_adjustment', null, null, 'First appears in the notebook balance after the 28/10/2026 loads; arrival not recorded', '2026-10-28')
  expect('Crystal after Kara loads', await stockOf(CRYSTAL), 161)
  expect('Cartons after Kara loads', await stockOf(SPARES), 27)

  await ship({
    date: '2026-10-30',
    items: [[CRYSTAL, 10]],
    dealer: did.Sunday,
    city: 'Ibadan',
    state: 'Oyo',
    status: 'dispatched',
    label: 'Sunday, Ibadan',
    notes: 'Notebook says Ibadan only; recorded under Sunday as the likely dealer. Please confirm.',
  })
  await ship({
    date: '2026-10-30',
    items: [[CRYSTAL, 6]],
    dealer: hasan,
    city: 'Idiroko',
    state: 'Ogun',
    status: 'dispatched',
    label: 'Hasan, Idiroko',
    notes: 'Loaded from the warehouse.',
  })

  // ── must equal the notebook's closing balance ─────────────────────────────
  console.log('\n  Closing balance')
  for (const [sku, wanted] of [[CRYSTAL, 145], [SPARES, 27], [FLASH, 113], [F1, 2], [BEAT, 0], [HUNTER, 0], [ENGINE, 0]]) {
    expect(sku, await stockOf(sku), wanted)
  }

  await q(
    `INSERT INTO audit_log (user_id, action, entity_type, entity_id, changes)
     SELECT $1, 'october_notebook_import', 'container', id, $2
     FROM containers WHERE container_number = 'HK-OCT-2026-01'`,
    [actor, JSON.stringify({ source: 'scripts/import-october.mjs', retired_shipments: 4, retired_containers: 4 })]
  )

  await q(confirmed ? 'COMMIT' : 'ROLLBACK')
  console.log(confirmed ? '\n  Committed.\n' : '\n  Dry run passed and rolled back. Nothing was saved. Add --confirm to commit.\n')
} catch (err) {
  await q('ROLLBACK')
  console.error(`\n[x] ${err.message}\n  Rolled back. Nothing was saved.\n`)
  process.exitCode = 1
} finally {
  await client.end()
}
