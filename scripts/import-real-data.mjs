#!/usr/bin/env node
/**
 * Import the real Hungkee dealers and products extracted from the ledger.
 *
 * Source files (written by the cleaning pass, gitignored):
 *   data/cleaned_dealers.csv    16 dealers recovered from 34 sales receipts
 *   data/cleaned_products.csv    6 products whose unit price is stated outright
 *
 * Money is deliberately NOT imported. Payments, orders and outstanding balances
 * stay out until the August ledger is in and the ₦85.7m gap between the
 * Transactions and Customer Payments sheets is resolved.
 *
 * About the blank fields: dealers.phone, .city and .state are NOT NULL in the
 * schema, and the ledger carries none of them. They are written as empty
 * strings rather than invented values. That is the honest failure mode and a
 * safe one — normalizeNigerianPhone('') returns {ok:false,reason:'empty'}, so
 * send-dealer-logins.mjs reports the dealer as unreachable and skips them
 * instead of texting a fabricated number.
 *
 * Usage:
 *   node scripts/import-real-data.mjs             # dry run — prints every row
 *   node scripts/import-real-data.mjs --confirm   # actually insert
 *
 * Re-running is safe: rows are matched on business_name / sku_code and skipped
 * if already present, so a partial import can be finished by running it again.
 */

import { resolve } from 'path'
import { readFileSync } from 'fs'
import { createRequire } from 'module'
import { fileURLToPath } from 'url'

const require = createRequire(import.meta.url)
const __dirname = fileURLToPath(new URL('.', import.meta.url))
const dotenv = require('dotenv')
dotenv.config({ path: resolve(__dirname, '..', '.env.local') })

const confirmed = process.argv.includes('--confirm')

const { createClient } = require('@supabase/supabase-js')
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

const die = (m) => { console.error(`\n✗ ${m}\n`); process.exit(1) }

function parseCsv(text) {
  const rows = []; let row = [], cell = '', quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++ }
      else if (c === '"') quoted = false
      else cell += c
    } else if (c === '"') quoted = true
    else if (c === ',') { row.push(cell); cell = '' }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = '' }
    else if (c !== '\r') cell += c
  }
  if (cell || row.length) { row.push(cell); rows.push(row) }
  const [header, ...body] = rows.filter((r) => r.some((v) => v.trim()))
  const keys = header.map((h) => h.trim())
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? '').trim()])))
}

const read = (f) => {
  try { return parseCsv(readFileSync(resolve(__dirname, '..', f), 'utf8')) }
  catch (e) { die(`Could not read ${f}: ${e.message}`) }
}

// Only the three locations the ledger actually states. Nothing is guessed.
const STATE = { Ondo: 'Ondo', Ibadan: 'Oyo', 'Nnewi (Anambra)': 'Anambra' }

const SKU = {
  Crystal:       { sku: 'HK-CRYSTAL', cc: null },
  'City 125':    { sku: 'HK-CITY125', cc: 125 },
  Hunter:        { sku: 'HK-HUNTER',  cc: null },
  Beat:          { sku: 'HK-BEAT',    cc: null },
  'F1 (Motobi)': { sku: 'HK-F1',      cc: null },
  'UD Plus':     { sku: 'HK-UDPLUS',  cc: null },
}

const { data: warehouses, error: whErr } = await db.from('warehouses').select('id, city')
if (whErr) die(`Could not read warehouses: ${whErr.message}`)
const lagos = warehouses.find((w) => w.city === 'Lagos')
if (!lagos) die('No Lagos warehouse found — dealers.served_by_warehouse_id is NOT NULL and needs one.')

// ── products ────────────────────────────────────────────────────────────────
const productRows = read('data/cleaned_products.csv').map((p) => {
  const m = SKU[p.product_name]
  if (!m) die(`No SKU mapping for product "${p.product_name}" — add one to SKU in this script.`)
  return {
    sku_code: m.sku,
    display_name: p.product_name,
    category: 'motorcycle',
    engine_size_cc: m.cc,
    sell_price_naira: Number(p.unit_price_naira),
    active: true,
  }
})

// ── dealers ─────────────────────────────────────────────────────────────────
const dealerRows = read('data/cleaned_dealers.csv').map((d) => ({
  business_name: d.business_name,
  contact_name: d.business_name, // the ledger records a person, not a trading name
  phone: '',
  email: null,
  city: d.location ? d.location.replace(/\s*\(.*\)$/, '') : '',
  state: STATE[d.location] ?? '',
  preferred_language: 'en',
  served_by_warehouse_id: lagos.id,
  active: true,
  notes: `Imported from the Oct 2025 – Jan 2026 ledger. ${d.payments_recorded} payment(s) totalling ₦${Number(d.total_paid_naira).toLocaleString()} between ${d.first_seen} and ${d.last_seen}. Phone, city and state pending.`,
}))

// ── report ──────────────────────────────────────────────────────────────────
const { data: haveP } = await db.from('products').select('sku_code')
const { data: haveD } = await db.from('dealers').select('business_name')
const existP = new Set((haveP ?? []).map((r) => r.sku_code))
const existD = new Set((haveD ?? []).map((r) => r.business_name))

const newP = productRows.filter((p) => !existP.has(p.sku_code))
const newD = dealerRows.filter((d) => !existD.has(d.business_name))

console.log(`\n${confirmed ? '→ Importing' : '→ Dry run —'} into ${process.env.NEXT_PUBLIC_SUPABASE_URL}\n`)
console.log(`PRODUCTS  ${newP.length} new, ${productRows.length - newP.length} already present`)
for (const p of newP) {
  console.log(`  ${p.sku_code.padEnd(12)} ${p.display_name.padEnd(14)} ₦${p.sell_price_naira.toLocaleString().padStart(11)}  ${p.engine_size_cc ? p.engine_size_cc + 'cc' : ''}`)
}
console.log(`\nDEALERS   ${newD.length} new, ${dealerRows.length - newD.length} already present`)
for (const d of newD) {
  console.log(`  ${d.business_name.padEnd(14)} city=${(d.city || '—').padEnd(16)} state=${(d.state || '—').padEnd(9)} phone=${d.phone === '' ? '(blank)' : d.phone}`)
}

const blanks = newD.filter((d) => !d.city).length
console.log(`\n  ${newD.length} dealers have no phone. ${blanks} also have no city or state.`)
console.log('  No payments, orders or balances are imported.')

if (!confirmed) {
  console.log('\n  Nothing was written. Add --confirm to insert.\n')
  process.exit(0)
}

// ── write ───────────────────────────────────────────────────────────────────
if (newP.length) {
  const { error } = await db.from('products').insert(newP)
  if (error) die(`Product insert failed: ${error.message}`)
  console.log(`\n  ✓ inserted ${newP.length} products`)
}
if (newD.length) {
  const { error } = await db.from('dealers').insert(newD)
  if (error) die(`Dealer insert failed: ${error.message}`)
  console.log(`  ✓ inserted ${newD.length} dealers`)
}
console.log('\n✓ Done. Fill in phone/city/state before running create-dealer-user.mjs.\n')
