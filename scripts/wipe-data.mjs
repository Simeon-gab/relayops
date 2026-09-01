#!/usr/bin/env node
/**
 * Wipe RelayOps operational data so real data can be loaded in its place.
 *
 * Everything currently in the database is seed/demo data. This removes it in
 * foreign-key-safe order, leaving the shell of the system intact.
 *
 * KEPT by default:
 *   · warehouses  — Lagos and Kano are real places, not demo rows
 *   · users       — staff logins. Deleting these locks everyone out, including you
 *
 * REMOVED:
 *   products, dealers, containers, container_items, warehouse_stock,
 *   stock_movements, messages, message_parse_results, dealer_orders,
 *   dealer_order_items, shipments, shipment_items, status_events, receipts,
 *   receipt_extractions, payments, notifications, audit_log, ai_proposals,
 *   agent_runs
 *
 * Usage:
 *   node scripts/wipe-data.mjs                     # dry run — shows what would go
 *   node scripts/wipe-data.mjs --confirm           # actually delete
 *   node scripts/wipe-data.mjs --confirm --include-storage
 *                                                  # also empty the receipts and
 *                                                  # product-images buckets
 *   node scripts/wipe-data.mjs --confirm --include-warehouses
 *                                                  # also drop the two warehouses
 *
 * Dealer logins are auth users, not staff users. Wiping the dealers table does
 * not remove the Supabase Auth accounts linked to them — pass --include-dealer-logins
 * to delete those too, otherwise they are left orphaned and must be cleaned up
 * by hand in the Supabase dashboard.
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.
 */

import { resolve } from 'path'
import { createRequire } from 'module'
import { fileURLToPath } from 'url'

const require = createRequire(import.meta.url)
const __dirname = fileURLToPath(new URL('.', import.meta.url))

const dotenv = require('dotenv')
dotenv.config({ path: resolve(__dirname, '..', '.env.local') })

const args = process.argv.slice(2)
const confirmed = args.includes('--confirm')
const includeStorage = args.includes('--include-storage')
const includeWarehouses = args.includes('--include-warehouses')
const includeDealerLogins = args.includes('--include-dealer-logins')

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error('\n✗ NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must both be set in .env.local.\n')
  process.exit(1)
}

const { createClient } = require('@supabase/supabase-js')
const db = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

/**
 * Children before parents. Getting this order wrong produces a foreign-key
 * violation rather than a partial wipe, so a mistake here is loud, not silent.
 *
 * Two orderings are load-bearing and easy to get backwards:
 *   · payments and receipt_extractions both point at shipments, so they go first
 *   · dealer_orders points at messages, so orders go before messages
 */
const TABLES = [
  'agent_runs',
  'ai_proposals',
  'notifications',
  'audit_log',
  'message_parse_results',
  'payments',
  'receipt_extractions',
  'receipts',
  'status_events',
  'shipment_items',
  'shipments',
  'dealer_order_items',
  'dealer_orders',
  'messages',
  'stock_movements',
  'warehouse_stock',
  'container_items',
  'containers',
  'dealers',
  'products',
]

if (includeWarehouses) TABLES.push('warehouses')

async function countOf(table) {
  const { count, error } = await db.from(table).select('id', { count: 'exact', head: true })
  if (error) return { count: null, error: error.message }
  return { count: count ?? 0 }
}

/** Every row in the table. PostgREST refuses an unfiltered delete, so match on
 *  the primary key being present — true for every row, by definition. */
async function deleteAll(table) {
  const { error } = await db.from(table).delete().not('id', 'is', null)
  return error?.message ?? null
}

/** Storage buckets are flat-ish but files sit under per-dealer prefixes, so walk. */
async function listAllPaths(bucket, prefix = '') {
  const { data, error } = await db.storage.from(bucket).list(prefix, { limit: 1000 })
  if (error || !data) return []

  const paths = []
  for (const entry of data) {
    const full = prefix ? `${prefix}/${entry.name}` : entry.name
    // A folder comes back with no id; a file always has one.
    if (entry.id === null || entry.id === undefined) {
      paths.push(...(await listAllPaths(bucket, full)))
    } else {
      paths.push(full)
    }
  }
  return paths
}

// ─── Survey ───────────────────────────────────────────────────────────────────

console.log(`\n${confirmed ? '→ WIPING' : '→ Dry run —'} RelayOps data on ${url}\n`)

let total = 0
const plan = []

for (const table of TABLES) {
  const { count, error } = await countOf(table)
  if (error) {
    console.log(`  ${table.padEnd(24)} — skipped (${error})`)
    continue
  }
  plan.push({ table, count })
  total += count
  console.log(`  ${table.padEnd(24)} ${String(count).padStart(5)} row${count === 1 ? '' : 's'}`)
}

let storagePlan = []
if (includeStorage) {
  console.log('')
  for (const bucket of ['receipts', 'product-images']) {
    const paths = await listAllPaths(bucket)
    storagePlan.push({ bucket, paths })
    console.log(`  ${`storage:${bucket}`.padEnd(24)} ${String(paths.length).padStart(5)} file${paths.length === 1 ? '' : 's'}`)
  }
}

let dealerLogins = []
if (includeDealerLogins) {
  const { data: dealerUsers } = await db.from('users').select('id, email').eq('role', 'dealer')
  dealerLogins = dealerUsers ?? []
  console.log(`\n  ${'dealer logins'.padEnd(24)} ${String(dealerLogins.length).padStart(5)} account${dealerLogins.length === 1 ? '' : 's'}`)
}

console.log(`\n  ${'TOTAL'.padEnd(24)} ${String(total).padStart(5)} rows`)

if (!includeWarehouses) {
  const { count } = await countOf('warehouses')
  console.log(`\n  Keeping ${count} warehouse${count === 1 ? '' : 's'} and all staff logins.`)
}

if (!confirmed) {
  console.log('\n  Nothing was deleted. Re-run with --confirm to go ahead.\n')
  process.exit(0)
}

// ─── Execute ──────────────────────────────────────────────────────────────────

console.log('\n→ Deleting\n')

for (const { table, count } of plan) {
  if (count === 0) {
    console.log(`  ${table.padEnd(24)} already empty`)
    continue
  }
  const err = await deleteAll(table)
  if (err) {
    console.error(`\n✗ ${table} failed: ${err}`)
    console.error('  Stopped here. Earlier tables are already cleared; fix this and re-run.\n')
    process.exit(1)
  }
  console.log(`  ${table.padEnd(24)} cleared (${count})`)
}

for (const { bucket, paths } of storagePlan) {
  if (!paths.length) continue
  // remove() caps at 1000 paths per call.
  for (let i = 0; i < paths.length; i += 1000) {
    const { error } = await db.storage.from(bucket).remove(paths.slice(i, i + 1000))
    if (error) console.error(`  storage:${bucket} partial failure: ${error.message}`)
  }
  console.log(`  ${`storage:${bucket}`.padEnd(24)} cleared (${paths.length})`)
}

for (const u of dealerLogins) {
  const { error } = await db.auth.admin.deleteUser(u.id)
  if (error) console.error(`  dealer login ${u.email}: ${error.message}`)
}
if (dealerLogins.length) console.log(`  ${'dealer logins'.padEnd(24)} removed (${dealerLogins.length})`)

console.log(`\n✓ Wiped ${total} rows. The system is empty and ready for real data.\n`)
