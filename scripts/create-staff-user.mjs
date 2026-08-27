#!/usr/bin/env node
/**
 * Create a staff login for RelayOps.
 *
 * There is no database trigger mirroring auth.users into public.users, so an
 * account needs both halves: the Supabase Auth user, and the profile row that
 * carries the role. Creating one without the other leaves a login that can
 * authenticate but has no role, which the app rejects at the layout.
 *
 * Usage:
 *   node scripts/create-staff-user.mjs <email> <role> "<Display Name>" [password]
 *
 *   node scripts/create-staff-user.mjs chief@hungkee.ng md "Chief Adewale"
 *   node scripts/create-staff-user.mjs wei@hungkee.cn partner "Wei Zhang"
 *   node scripts/create-staff-user.mjs ops@hungkee.ng manager "Ngozi Eze"
 *
 * Omit the password and one is generated and printed once. It is never stored
 * anywhere else — copy it before closing the terminal.
 *
 * Re-running for an existing email updates that person's role and name rather
 * than failing, so it is safe to use to correct a mistake.
 *
 * Changing someone's password:
 *   node scripts/create-staff-user.mjs --set-password <email> [new-password]
 *
 * Moving an account to a different address, keeping its history:
 *   node scripts/create-staff-user.mjs --change-email <old-email> <new-email>
 *
 * This is how a throwaway test address becomes a real company one later. The
 * account keeps its id, so every container, shipment and audit entry recorded
 * under it stays attached — which deleting and recreating would orphan.
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.
 */

import { resolve } from 'path'
import { randomBytes } from 'crypto'
import { createRequire } from 'module'
import { fileURLToPath } from 'url'

const require = createRequire(import.meta.url)
const __dirname = fileURLToPath(new URL('.', import.meta.url))

const dotenv = require('dotenv')
dotenv.config({ path: resolve(__dirname, '..', '.env.local') })

const VALID_ROLES = ['md', 'manager', 'partner']

const args = process.argv.slice(2)

function die(message) {
  console.error(`\n✗ ${message}\n`)
  process.exit(1)
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  die('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must both be set in .env.local.')
}

const { createClient } = require('@supabase/supabase-js')
const adminClient = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

/** Find a user by email. Returns null rather than throwing when absent. */
async function findAuthUser(target) {
  const { data, error } = await adminClient.auth.admin.listUsers({ perPage: 1000 })
  if (error) die(`Could not list users: ${error.message}`)
  return data.users.find((u) => u.email?.toLowerCase() === target.toLowerCase()) ?? null
}

// ─── --change-email ───────────────────────────────────────────────────────────

if (args[0] === '--change-email') {
  const [, oldEmail, newEmail] = args

  if (!oldEmail || !newEmail) {
    die('Usage: node scripts/create-staff-user.mjs --change-email <old-email> <new-email>')
  }

  const existing = await findAuthUser(oldEmail)
  if (!existing) die(`No account found for ${oldEmail}.`)

  const clash = await findAuthUser(newEmail)
  if (clash && clash.id !== existing.id) {
    die(`${newEmail} already belongs to another account. Pick a different address.`)
  }

  console.log(`\n→ Moving ${oldEmail} → ${newEmail}`)
  console.log(`  · account id ${existing.id} is kept, so all history stays attached`)

  const { error: authErr } = await adminClient.auth.admin.updateUserById(existing.id, {
    email: newEmail,
    email_confirm: true,
  })
  if (authErr) die(`Could not update the auth user: ${authErr.message}`)
  console.log('  · sign-in address updated')

  const { error: profileErr } = await adminClient
    .from('users')
    .update({ email: newEmail })
    .eq('id', existing.id)
  if (profileErr) {
    die(
      `Sign-in address changed but the profile row still shows the old one: ${profileErr.message}\n` +
        `  Fix it with:  UPDATE users SET email = '${newEmail}' WHERE id = '${existing.id}';`
    )
  }
  console.log('  · profile row updated')

  console.log(`\n✓ Done. They now sign in with ${newEmail}. The password is unchanged.\n`)
  process.exit(0)
}

// ─── --set-password ───────────────────────────────────────────────────────────

if (args[0] === '--set-password') {
  const [, targetEmail, newPassword] = args

  if (!targetEmail) {
    die('Usage: node scripts/create-staff-user.mjs --set-password <email> [new-password]')
  }

  const existing = await findAuthUser(targetEmail)
  if (!existing) die(`No account found for ${targetEmail}.`)

  const chosen = newPassword || generatePassword()
  if (chosen.length < 8) die('Password must be at least 8 characters.')

  const { error } = await adminClient.auth.admin.updateUserById(existing.id, {
    password: chosen,
  })
  if (error) die(`Could not set the password: ${error.message}`)

  console.log(`\n✓ Password changed for ${targetEmail}.`)
  if (!newPassword) {
    console.log(`    password: ${chosen}`)
    console.log('\n  Shown once and not stored anywhere. Copy it now.\n')
  } else {
    console.log('    password: (the one you supplied)\n')
  }
  process.exit(0)
}

// ─── create / update ──────────────────────────────────────────────────────────

const [email, role, displayName, providedPassword] = args

if (!email || !role || !displayName) {
  die(
    'Usage: node scripts/create-staff-user.mjs <email> <role> "<Display Name>" [password]\n' +
      `  role must be one of: ${VALID_ROLES.join(', ')}\n` +
      '  or:  node scripts/create-staff-user.mjs --set-password <email> [new-password]\n' +
      '  or:  node scripts/create-staff-user.mjs --change-email <old-email> <new-email>'
  )
}

if (!VALID_ROLES.includes(role)) {
  die(`"${role}" is not a staff role. Use one of: ${VALID_ROLES.join(', ')}.\n` +
      '  Dealer accounts are created through the dealer flow, not this script.')
}

// A readable password: no ambiguous characters, long enough to be safe to
// send over WhatsApp once and change later.
function generatePassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  const bytes = randomBytes(16)
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('')
}

const password = providedPassword || generatePassword()

console.log(`\n→ Creating ${role} account for ${email}`)

// 1. The auth user. If one already exists, find it and reuse its id.
let userId
const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
})

if (createErr) {
  const alreadyExists =
    createErr.status === 422 || /already been registered|already exists/i.test(createErr.message)

  if (!alreadyExists) die(`Could not create the auth user: ${createErr.message}`)

  console.log('  · auth user already exists — reusing it and updating the profile')

  const found = await findAuthUser(email)
  if (!found) die('The email is registered but could not be found in the first 1000 users.')
  userId = found.id
} else {
  userId = created.user.id
  console.log('  · auth user created')
}

// 2. The profile row that carries the role.
const { error: profileErr } = await adminClient
  .from('users')
  .upsert({ id: userId, email, role, display_name: displayName }, { onConflict: 'id' })

if (profileErr) {
  die(
    `Auth user exists but the profile row failed: ${profileErr.message}\n` +
      `  Fix it with:\n` +
      `    INSERT INTO users (id, email, role, display_name)\n` +
      `    VALUES ('${userId}', '${email}', '${role}', '${displayName.replace(/'/g, "''")}')\n` +
      `    ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, display_name = EXCLUDED.display_name;`
  )
}

console.log('  · profile row written')
console.log(`\n✓ ${displayName} can now sign in as ${role}.`)
console.log(`    email:    ${email}`)
if (!providedPassword) {
  console.log(`    password: ${password}`)
  console.log('\n  This password is shown once and is not stored. Send it to them and')
  console.log('  ask them to change it after their first sign-in.\n')
} else {
  console.log('    password: (the one you supplied)\n')
}
