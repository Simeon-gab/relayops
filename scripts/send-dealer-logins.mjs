#!/usr/bin/env node
/**
 * Text dealers their portal login, via Termii.
 *
 * Reads the credentials CSV that create-dealer-user.mjs writes and sends each
 * dealer one SMS with their username and password.
 *
 * SMS rather than email is deliberate. The dealers do not have working email
 * addresses on file, and most of their logins are synthetic (phone@domain) so
 * there is no inbox to send to. Their phone is the address we actually have.
 *
 * The Termii call is inlined rather than imported from lib/sms.ts because that
 * is TypeScript compiled by Next, and these scripts run under plain node. Keep
 * the two in step if the provider changes.
 *
 * Usage:
 *   node scripts/send-dealer-logins.mjs dealer-logins.csv              # dry run
 *   node scripts/send-dealer-logins.mjs dealer-logins.csv --confirm    # actually send
 *   node scripts/send-dealer-logins.mjs dealer-logins.csv --confirm --only "Oki motors"
 *
 * Costs real money per message, and per 160-character page, so the dry run
 * prints the exact text and page count before anything is sent. Send one to
 * yourself first with --only.
 *
 * Env (.env.local):
 *   TERMII_API_KEY     required
 *   TERMII_SENDER_ID   approved sender ID, defaults to Termii's shared N-Alert
 *   TERMII_CHANNEL     "dnd" (default, reaches Do-Not-Disturb lines) | "generic"
 *   NEXT_PUBLIC_APP_URL  sign-in link shown in the message
 */

import { resolve } from 'path'
import { readFileSync } from 'fs'
import { createRequire } from 'module'
import { fileURLToPath } from 'url'
import { normalizeNigerianPhone, formatNigerianPhone } from './_phone.mjs'

const require = createRequire(import.meta.url)
const __dirname = fileURLToPath(new URL('.', import.meta.url))

const dotenv = require('dotenv')
dotenv.config({ path: resolve(__dirname, '..', '.env.local') })

const TERMII_URL = 'https://api.ng.termii.com/api/sms/send'

const args = process.argv.slice(2)
const confirmed = args.includes('--confirm')
const onlyIndex = args.indexOf('--only')
const only = onlyIndex !== -1 ? args[onlyIndex + 1] : null
const csvPath = args.find((a) => !a.startsWith('--') && a !== only)

function die(message) {
  console.error(`\n✗ ${message}\n`)
  process.exit(1)
}

if (!csvPath) {
  die('Usage: node scripts/send-dealer-logins.mjs <credentials.csv> [--confirm] [--only "Business Name"]')
}

const apiKey = process.env.TERMII_API_KEY
if (confirmed && !apiKey) {
  die('TERMII_API_KEY is not set in .env.local, so nothing can be sent.\n' +
      '  Add it from your Termii dashboard, then re-run.')
}

const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://relayops-system.vercel.app')
  .replace(/^https?:\/\//, '')
  .replace(/\/$/, '')

/** Minimal CSV reader — handles the quoted fields our own writer produces. */
function parseCsv(text) {
  const rows = []
  let row = []
  let cell = ''
  let quoted = false

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

function composeMessage({ login_email, password }) {
  return (
    `Hungkee RelayOps portal is live. Sign in at ${appUrl}/sign-in\n` +
    `User: ${login_email}\n` +
    `Pass: ${password}\n` +
    `Change your password after signing in.`
  )
}

const pages = (text) => Math.ceil(text.length / 160)

async function send(to, text) {
  const phone = normalizeNigerianPhone(to)
  if (!phone.ok) return { ok: false, detail: phone.reason }
  const number = phone.number

  const res = await fetch(TERMII_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      to: number,
      from: process.env.TERMII_SENDER_ID || 'N-Alert',
      sms: text,
      type: 'plain',
      channel: process.env.TERMII_CHANNEL || 'dnd',
      api_key: apiKey,
    }),
  })

  if (!res.ok) return { ok: false, detail: `Termii ${res.status}: ${(await res.text()).slice(0, 160)}` }

  const data = await res.json().catch(() => ({}))
  if (data?.message && !/success|sent/i.test(data.message)) {
    return { ok: false, detail: data.message }
  }
  return { ok: true, balance: data?.balance }
}

// ─── Load ─────────────────────────────────────────────────────────────────────

let records
try {
  records = parseCsv(readFileSync(resolve(process.cwd(), csvPath), 'utf8'))
} catch (err) {
  die(`Could not read ${csvPath}: ${err.message}`)
}

if (only) {
  records = records.filter((r) => r.business_name?.toLowerCase() === only.toLowerCase())
  if (!records.length) die(`No row in ${csvPath} matched "${only}".`)
}

// Check every number before sending any, so a bad one is a warning up front
// rather than a failure discovered halfway through a paid send.
const sendable = []
for (const r of records) {
  const phone = normalizeNigerianPhone(r.phone)
  if (phone.ok) sendable.push({ ...r, phone: phone.number })
  else console.log(`  ! ${r.business_name} — ${phone.reason}. Reach them another way.`)
}

console.log(`\n${confirmed ? '→ Sending' : '→ Dry run —'} ${sendable.length} login SMS from ${csvPath}\n`)

const totalPages = sendable.reduce((sum, r) => sum + pages(composeMessage(r)), 0)

if (!confirmed) {
  const sample = sendable[0]
  if (sample) {
    const text = composeMessage(sample)
    console.log(`  Example — to ${sample.business_name} (${formatNigerianPhone(sample.phone)}), ${pages(text)} page${pages(text) === 1 ? '' : 's'}:\n`)
    console.log(text.split('\n').map((l) => `    ${l}`).join('\n'))
  }
  console.log(`\n  ${sendable.length} message${sendable.length === 1 ? '' : 's'}, ${totalPages} billable page${totalPages === 1 ? '' : 's'} in total.`)
  console.log('\n  Nothing was sent. Add --confirm to send.')
  console.log('  Send one to yourself first:  --confirm --only "<a business name>"\n')
  process.exit(0)
}

// ─── Send ─────────────────────────────────────────────────────────────────────

let sent = 0
const failures = []

for (const r of sendable) {
  const result = await send(r.phone, composeMessage(r))
  if (result.ok) {
    sent++
    console.log(`  ✓ ${r.business_name.padEnd(26)} ${r.phone}`)
  } else {
    failures.push({ ...r, detail: result.detail })
    console.log(`  ✗ ${r.business_name.padEnd(26)} ${result.detail}`)
  }
}

console.log(`\n✓ Sent ${sent} of ${sendable.length}.`)

if (failures.length) {
  console.log(`\n  ${failures.length} did not go through. Reach these dealers another way:`)
  for (const f of failures) console.log(`    ${f.business_name} — ${f.phone}`)
}

console.log(`\n  Delete ${csvPath} now that the passwords are out.\n`)
