#!/usr/bin/env node
import { resolve } from 'path'
import { readFileSync } from 'fs'
import { createRequire } from 'module'
import { fileURLToPath } from 'url'

const require = createRequire(import.meta.url)
const __dirname = fileURLToPath(new URL('.', import.meta.url))

const dotenv = require('dotenv')
dotenv.config({ path: resolve(__dirname, '..', '.env.local') })

const { DATABASE_URL } = process.env
if (!DATABASE_URL) { console.error('No DATABASE_URL'); process.exit(1) }

const sqlFile = process.argv[2]
if (!sqlFile) { console.error('Usage: node _query.mjs <sql-file>'); process.exit(1) }

const sql = readFileSync(resolve(process.cwd(), sqlFile), 'utf8')

const { Client } = require('pg')
const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } })
await client.connect()

const { rows } = await client.query(sql)
console.table(rows)

await client.end()
