'use server'

import { can } from '@/lib/auth/roles'
import { generateBriefing } from '@/lib/ai/briefing'
import { createClient } from '@/lib/supabase/server'
import { callClaudeText } from '@/lib/ai/client'
import { getNLQuerySystemPrompt, getNLQueryUserPrompt } from '@/lib/ai/prompts/nl-query'
import { fetchDailyMetrics, type DailySummaryMetrics } from '@/lib/db/daily-metrics'
import { validateGeneratedSQL } from '@/lib/ai/sql-safety'
import { executeReadOnlyQuery, type QueryResult } from '@/lib/db/nl-query-client'

// ─── NL Query ────────────────────────────────────────────────────────────────

export type NLQuerySuccess = {
  success: true
  sql: string
  explanation: string
  caveats: string | null
  expected_columns: string[]
  results: QueryResult
}

export type NLQueryFailure = {
  success: false
  error: string
  clarification?: string
}

export type NLQueryResult = NLQuerySuccess | NLQueryFailure

export async function executeNLQuery(question: string): Promise<NLQueryResult> {
  const db = await createClient()
  const {
    data: { user },
  } = await db.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated.' }

  const { data: adminUser } = await db.from('users').select('role').eq('id', user.id).single()
  if (!can(adminUser?.role, 'run_queries')) return { success: false, error: 'You do not have access to queries.' }

  const q = question.trim()
  if (!q) return { success: false, error: 'Question is required.' }

  try {
    const today = new Date().toISOString().split('T')[0]
    const raw = await callClaudeText(getNLQuerySystemPrompt(), getNLQueryUserPrompt(q, today))

    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON in model response.')

    const parsed = JSON.parse(jsonMatch[0]) as {
      sql?: string | null
      explanation?: string | null
      expected_columns?: string[] | null
      caveats?: string | null
      needs_clarification?: boolean
      clarification_question?: string | null
    }

    if (parsed.needs_clarification) {
      return {
        success: false,
        error: 'Question needs clarification.',
        clarification: parsed.clarification_question ?? undefined,
      }
    }

    if (!parsed.sql) throw new Error('Model returned no SQL.')

    const validation = validateGeneratedSQL(parsed.sql)
    if (!validation.valid) {
      return { success: false, error: `SQL validation failed: ${validation.reason}` }
    }

    const results = await executeReadOnlyQuery(parsed.sql)

    // Fire-and-forget audit log
    void db.from('audit_log').insert({
      user_id: user.id,
      action: 'nl_query',
      entity_type: 'query',
      entity_id: crypto.randomUUID(),
      changes: { question: q, sql: parsed.sql, row_count: results.rowCount },
    })

    return {
      success: true,
      sql: parsed.sql,
      explanation: parsed.explanation ?? '',
      caveats: parsed.caveats ?? null,
      expected_columns: parsed.expected_columns ?? results.columns,
      results,
    }
  } catch (err) {
    console.error('[executeNLQuery]', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'An unexpected error occurred.',
    }
  }
}

// ─── Daily Summary ────────────────────────────────────────────────────────────

export type DailySummarySuccess = {
  success: true
  summary_text: string
  key_metrics: {
    shipments_dispatched_yesterday: number
    payments_received_yesterday_naira: number
    new_orders_yesterday: number
    pending_review_items: number
  }
  items_needing_attention: {
    type: string
    description: string
    severity: 'high' | 'medium' | 'low'
  }[]
}

export type DailySummaryFailure = { success: false; error: string }
export type DailySummaryResult = DailySummarySuccess | DailySummaryFailure

// Shared Claude call — the briefing itself lives in lib/ai/briefing.ts so the
// MD dashboard can render a cached copy without going through a server action.
async function callDailySummaryAI(metrics: DailySummaryMetrics): Promise<DailySummarySuccess> {
  const briefing = await generateBriefing(metrics)
  return {
    success: true,
    summary_text: briefing.summary_text,
    key_metrics: briefing.key_metrics,
    items_needing_attention: briefing.items_needing_attention,
  }
}

async function authAdmin() {
  const db = await createClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) return null
  const { data: adminUser } = await db.from('users').select('role').eq('id', user.id).single()
  if (!can(adminUser?.role, 'run_queries')) return null
  return user
}

// Fetches metrics then calls AI — kept for backward compatibility
export async function generateDailySummary(): Promise<DailySummaryResult> {
  if (!(await authAdmin())) return { success: false, error: 'Not authenticated or not admin.' }
  try {
    const metrics = await fetchDailyMetrics()
    return await callDailySummaryAI(metrics)
  } catch (err) {
    console.error('[generateDailySummary]', err)
    return { success: false, error: err instanceof Error ? err.message : 'An unexpected error occurred.' }
  }
}

// Accepts pre-computed metrics (from server-rendered page) — avoids re-fetching DB data
export async function generateDailySummaryFromMetrics(
  metrics: DailySummaryMetrics
): Promise<DailySummaryResult> {
  if (!(await authAdmin())) return { success: false, error: 'Not authenticated or not admin.' }
  try {
    return await callDailySummaryAI(metrics)
  } catch (err) {
    console.error('[generateDailySummaryFromMetrics]', err)
    return { success: false, error: err instanceof Error ? err.message : 'An unexpected error occurred.' }
  }
}
