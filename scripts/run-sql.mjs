#!/usr/bin/env node
/**
 * Run a SQL file against the Supabase Postgres database.
 *
 * Usage:
 *   node scripts/run-sql.mjs supabase/migrations/0002_rls_policies.sql
 *
 * Requires DATABASE_URL in .env.local.
 * Get it from: Supabase Dashboard → Settings → Database → Connection string → URI mode
 * Add to .env.local:
 *   DATABASE_URL=postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'
import { createRequire } from 'module'
import { fileURLToPath } from 'url'

const require = createRequire(import.meta.url)
const __dirname = fileURLToPath(new URL('.', import.meta.url))

// Load .env.local from project root
const dotenv = require('dotenv')
const envPath = resolve(__dirname, '..', '.env.local')
const envResult = dotenv.config({ path: envPath })

if (envResult.error) {
  console.error(`✗ Could not read .env.local at ${envPath}`)
  console.error(envResult.error.message)
  process.exit(1)
}

const { DATABASE_URL } = process.env

if (!DATABASE_URL) {
  console.error('✗ DATABASE_URL is not set in .env.local')
  console.error('')
  console.error('Add it from: Supabase Dashboard → Settings → Database → Connection string → URI mode')
  console.error('It looks like: postgresql://postgres:[password]@db.[ref].supabase.co:5432/postgres')
  process.exit(1)
}

const sqlFilePath = process.argv[2]

if (!sqlFilePath) {
  console.error('Usage: node scripts/run-sql.mjs <path-to-sql-file>')
  process.exit(1)
}

const absoluteSqlPath = resolve(process.cwd(), sqlFilePath)

let sql
try {
  sql = readFileSync(absoluteSqlPath, 'utf8')
} catch (err) {
  console.error(`✗ Cannot read SQL file: ${absoluteSqlPath}`)
  console.error(err.message)
  process.exit(1)
}

const { Client } = require('pg')

const client = new Client({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

console.log(`→ Connecting to database...`)
console.log(`→ Running: ${sqlFilePath}`)
console.log()

try {
  await client.connect()
  await client.query(sql)
  console.log(`✓ Success — ${sqlFilePath} executed without errors.`)
} catch (err) {
  console.error(`✗ SQL error:`)
  console.error(`  Message:  ${err.message}`)
  if (err.detail)   console.error(`  Detail:   ${err.detail}`)
  if (err.hint)     console.error(`  Hint:     ${err.hint}`)
  if (err.position) console.error(`  Position: ${err.position}`)
  if (err.where)    console.error(`  Where:    ${err.where}`)
  process.exit(1)
} finally {
  await client.end()
}
