import { Client } from 'pg'

const MAX_ROWS = 500

export interface QueryResult {
  columns: string[]
  rows: Record<string, unknown>[]
  rowCount: number
}

export async function executeReadOnlyQuery(sql: string): Promise<QueryResult> {
  const client = new Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()

  try {
    await client.query('BEGIN READ ONLY')
    await client.query('SET LOCAL ROLE relayops_nl_query')
    await client.query("SET LOCAL statement_timeout = '5s'")

    const trimmed = sql.trim().replace(/;+$/, '')
    const capped = `SELECT * FROM (${trimmed}) _nl_q LIMIT ${MAX_ROWS}`
    const result = await client.query(capped)

    await client.query('ROLLBACK')

    const columns = result.fields.map(f => f.name)
    const rows = result.rows as Record<string, unknown>[]

    return { columns, rows, rowCount: rows.length }
  } catch (err) {
    try { await client.query('ROLLBACK') } catch { /* ignore */ }
    throw err
  } finally {
    await client.end()
  }
}
