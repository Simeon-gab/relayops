#!/usr/bin/env node
import { resolve } from 'path'
import { createRequire } from 'module'
import { fileURLToPath } from 'url'

const require = createRequire(import.meta.url)
const __dirname = fileURLToPath(new URL('.', import.meta.url))

const dotenv = require('dotenv')
dotenv.config({ path: resolve(__dirname, '..', '.env.local') })

const { DATABASE_URL } = process.env
if (!DATABASE_URL) { console.error('No DATABASE_URL'); process.exit(1) }

const tables = process.argv.slice(2)
if (!tables.length) { console.error('Usage: node _inspect-schema.mjs table1 table2 ...'); process.exit(1) }

const { Client } = require('pg')
const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } })

await client.connect()

for (const table of tables) {
  const { rows } = await client.query(
    `SELECT column_name, data_type, is_nullable
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1
     ORDER BY ordinal_position`,
    [table]
  )
  console.log(`\n=== ${table} (${rows.length} columns) ===`)
  for (const r of rows) {
    console.log(`  ${r.column_name.padEnd(35)} ${r.data_type.padEnd(20)} ${r.is_nullable === 'YES' ? 'nullable' : ''}`)
  }
}

await client.end()
