#!/usr/bin/env node
/**
 * Create dealer portal logins.
 *
 * The admin "new dealer" form records a dealer but gives them no way in — it
 * writes a `dealers` row and stops. A working login needs three linked pieces:
 *   1. a Supabase Auth account (what they type a password into)
 *   2. a `users` row with role 'dealer' (what the layout checks)
 *   3. `dealers.user_id` pointing at it (what RLS scopes their data by)
 * Create any one without the others and you get a login that authenticates but
 * sees nothing, or a dealer that exists but can never sign in.
 *
 * Sign-in is email + password (app/actions/auth.ts), so every dealer needs an
 * email-shaped identifier. Most of ours have a phone and no email, so when the
 * `dealers.email` column is empty we derive one from their phone number:
 *
 *     +234 803 111 0002  →  2348031110002@dealers.hungkee.ng
 *
 * They never receive mail at it. It is a username that happens to look like an
 * email, which is why it can point at a domain that does not accept mail.
 * Override the domain with DEALER_LOGIN_DOMAIN in .env.local.
 *
 * Usage:
 *   node scripts/create-dealer-user.mjs --all                # every dealer lacking a login
 *   node scripts/create-dealer-user.mjs --all --dry-run      # show who would get one
 *   node scripts/create-dealer-user.mjs "Adekunle Motors"    # one, by business name
 *   node scripts/create-dealer-user.mjs <dealer-uuid>        # one, by id
 *
 *   --out <file>   where to write the credentials CSV (default dealer-logins.csv)
 *
 * Re-running is safe. A dealer who already has a login is skipped, not reset —
 * use `create-staff-user.mjs --set-password` to change an existing password.
 *
 * The credentials CSV holds plaintext passwords. It is written to the project
 * root, which .gitignore does not cover, so delete it once the logins are sent.
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.
 */

import { resolve } from 'path'
import { writeFileSync } from 'fs'
import { randomBytes } from 'crypto'
import { createRequire } from 'module'
import { fileURLToPath } from 'url'
import { normalizeNigerianPhone } from './_phone.mjs'

const require = createRequire(import.meta.url)
const __dirname = fileURLToPath(new URL('.', import.meta.url))

const dotenv = require('dotenv')
dotenv.config({ path: resolve(__dirname, '..', '.env.local') })

const args = process.argv.slice(2)
const all = args.includes('--all')
const dryRun = args.includes('--dry-run')

const outIndex = args.indexOf('--out')
const outFile = outIndex !== -1 ? args[outIndex + 1] : 'dealer-logins.csv'

const target = args.find((a) => !a.startsWith('--') && a !== outFile)

const LOGIN_DOMAIN = process.env.DEALER_LOGIN_DOMAIN || 'dealers.hungkee.ng'

function die(message) {
  console.error(`\n✗ ${message}\n`)
  process.exit(1)
}

if (!all && !target) {
  die(
    'Usage:\n' +
      '  node scripts/create-dealer-user.mjs --all [--dry-run] [--out file.csv]\n' +
      '  node scripts/create-dealer-user.mjs "<business name>"\n' +
      '  node scripts/create-dealer-user.mjs <dealer-uuid>'
  )
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceKey) {
  die('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must both be set in .env.local.')
}

const { createClient } = require('@supabase/supabase-js')
const db = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

/** No 0/O/1/l — these get read aloud over the phone and typed on a cracked screen. */
function generatePassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  return Array.from(randomBytes(12), (b) => alphabet[b % alphabet.length]).join('')
}

/**
 * The login identifier, and the number we will text it to.
 *
 * A real email wins when there is one. Otherwise the login is derived from the
 * dealer's phone in international form — normalised, so that the same dealer
 * always resolves to the same username no matter how their number was typed in.
 *
 * @returns {{ ok: true, email: string, sms: string|null } | { ok: false, reason: string }}
 */
function loginFor(dealer) {
  const phone = normalizeNigerianPhone(dealer.phone)

  if (dealer.email?.trim()) {
    return { ok: true, email: dealer.email.trim().toLowerCase(), sms: phone.ok ? phone.number : null }
  }
  if (!phone.ok) {
    return { ok: false, reason: `no email, and the phone is unusable (${phone.reason})` }
  }
  return { ok: true, email: `${phone.number}@${LOGIN_DOMAIN}`, sms: phone.number }
}

function csvCell(value) {
  const s = String(value ?? '')
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

// ─── Pick the dealers ─────────────────────────────────────────────────────────

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

let query = db
  .from('dealers')
  .select('id, business_name, contact_name, phone, email, user_id, city')
  .is('deleted_at', null)

if (all) {
  query = query.is('user_id', null)
} else if (UUID.test(target)) {
  query = query.eq('id', target)
} else {
  query = query.ilike('business_name', target)
}

const { data: dealers, error: fetchError } = await query.order('business_name')
if (fetchError) die(`Could not read dealers: ${fetchError.message}`)

if (!dealers.length) {
  console.log(
    all
      ? '\n✓ Every dealer already has a login. Nothing to do.\n'
      : `\n✗ No dealer matched "${target}".\n`
  )
  process.exit(0)
}

const alreadyLinked = dealers.filter((d) => d.user_id)
const pending = dealers.filter((d) => !d.user_id)

for (const d of alreadyLinked) {
  console.log(`  · ${d.business_name} already has a login — skipping`)
}

const workable = []
for (const d of pending) {
  const login = loginFor(d)
  if (login.ok) workable.push({ dealer: d, login })
  else console.log(`  ! ${d.business_name} — ${login.reason}. Fix the record, then re-run.`)
}

// A dealer can have a login and still be unreachable by SMS. Worth saying out
// loud, because their password will need delivering some other way.
for (const { dealer, login } of workable) {
  if (!login.sms) {
    console.log(`  ! ${dealer.business_name} has a login but no textable phone — deliver it by hand`)
  }
}

if (!workable.length) {
  console.log('\n  Nothing to create.\n')
  process.exit(0)
}

console.log(`\n→ ${dryRun ? 'Would create' : 'Creating'} ${workable.length} dealer login${workable.length === 1 ? '' : 's'}\n`)

if (dryRun) {
  for (const { dealer, login } of workable) {
    console.log(`  ${dealer.business_name.padEnd(26)} ${login.email}`)
  }
  console.log('\n  Dry run — nothing was created. Drop --dry-run to go ahead.\n')
  process.exit(0)
}

// ─── Create ───────────────────────────────────────────────────────────────────

const created = []

for (const { dealer, login } of workable) {
  const email = login.email
  const password = generatePassword()

  const { data: madeUser, error: createErr } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // no inbox to confirm from, and none is needed
  })

  let userId
  if (createErr) {
    const exists = createErr.status === 422 || /already/i.test(createErr.message)
    if (!exists) {
      console.error(`  ✗ ${dealer.business_name}: ${createErr.message}`)
      continue
    }
    // An auth account exists but nothing points at it — adopt it and set a
    // fresh password, so a half-finished earlier run can be completed.
    const { data: list } = await db.auth.admin.listUsers({ perPage: 1000 })
    const found = list?.users.find((u) => u.email?.toLowerCase() === email)
    if (!found) {
      console.error(`  ✗ ${dealer.business_name}: ${email} is taken but not findable`)
      continue
    }
    userId = found.id
    await db.auth.admin.updateUserById(userId, { password })
  } else {
    userId = madeUser.user.id
  }

  const { error: profileErr } = await db
    .from('users')
    .upsert(
      { id: userId, email, role: 'dealer', display_name: dealer.business_name },
      { onConflict: 'id' }
    )
  if (profileErr) {
    console.error(`  ✗ ${dealer.business_name}: profile row failed — ${profileErr.message}`)
    continue
  }

  const { error: linkErr } = await db.from('dealers').update({ user_id: userId }).eq('id', dealer.id)
  if (linkErr) {
    console.error(`  ✗ ${dealer.business_name}: could not link dealer to login — ${linkErr.message}`)
    continue
  }

  created.push({
    business_name: dealer.business_name,
    contact_name: dealer.contact_name,
    city: dealer.city,
    // Normalised, because send-dealer-logins.mjs texts whatever is in this column.
    phone: login.sms ?? '',
    login_email: email,
    password,
  })
  console.log(`  ✓ ${dealer.business_name.padEnd(26)} ${email}`)
}

if (!created.length) {
  console.log('\n✗ No logins were created.\n')
  process.exit(1)
}

const header = 'business_name,contact_name,city,phone,login_email,password'
const rows = created.map((c) =>
  [c.business_name, c.contact_name, c.city, c.phone, c.login_email, c.password].map(csvCell).join(',')
)
writeFileSync(resolve(process.cwd(), outFile), `${header}\n${rows.join('\n')}\n`, 'utf8')

console.log(`\n✓ ${created.length} login${created.length === 1 ? '' : 's'} created.`)
console.log(`  Credentials written to ${outFile} — plaintext passwords, delete it once sent.`)
console.log(`  Send them with:  node scripts/send-dealer-logins.mjs ${outFile} --dry-run\n`)
