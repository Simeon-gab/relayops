'use server'

import { createClient } from '@/lib/supabase/server'
import { callClaudeText } from '@/lib/ai/client'
import { getNLQuerySystemPrompt, getNLQueryUserPrompt } from '@/lib/ai/prompts/nl-query'
import {
  getDailySummarySystemPrompt,
  getDailySummaryUserPrompt,
  type DailySummaryMetrics,
} from '@/lib/ai/prompts/daily-summary'
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
  if (adminUser?.role !== 'admin') return { success: false, error: 'Admin access required.' }

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

export async function generateDailySummary(): Promise<DailySummaryResult> {
  const db = await createClient()
  const {
    data: { user },
  } = await db.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated.' }

  const { data: adminUser } = await db.from('users').select('role').eq('id', user.id).single()
  if (adminUser?.role !== 'admin') return { success: false, error: 'Admin access required.' }

  try {
    const now = new Date()
    const todayStart = new Date(now)
    todayStart.setHours(0, 0, 0, 0)

    const yesterdayStart = new Date(todayStart)
    yesterdayStart.setDate(yesterdayStart.getDate() - 1)

    const sevenDaysAgo = new Date(todayStart)
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const [
      dispatchedRes,
      deliveredRes,
      paymentsRes,
      ordersRes,
      pendingOrdersRes,
      overdueRes,
      lowStockRes,
    ] = await Promise.all([
      db
        .from('shipments')
        .select('id', { count: 'exact', head: true })
        .gte('dispatched_at', yesterdayStart.toISOString())
        .lt('dispatched_at', todayStart.toISOString())
        .is('deleted_at', null),

      db
        .from('shipments')
        .select('id', { count: 'exact', head: true })
        .gte('delivered_at', yesterdayStart.toISOString())
        .lt('delivered_at', todayStart.toISOString())
        .is('deleted_at', null),

      db
        .from('payments')
        .select('amount_naira')
        .gte('recorded_at', yesterdayStart.toISOString())
        .lt('recorded_at', todayStart.toISOString())
        .is('deleted_at', null),

      db
        .from('dealer_orders')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', yesterdayStart.toISOString())
        .lt('created_at', todayStart.toISOString())
        .is('deleted_at', null),

      db
        .from('dealer_orders')
        .select('id', { count: 'exact', head: true })
        .in('status', ['pending', 'partially_fulfilled'])
        .is('deleted_at', null),

      db
        .from('shipments')
        .select('destination_city, destination_state, dispatched_at')
        .eq('status', 'dispatched')
        .lt('dispatched_at', sevenDaysAgo.toISOString())
        .is('deleted_at', null)
        .limit(10),

      db
        .from('warehouse_stock')
        .select('quantity, warehouses(code), products(display_name, sku_code)')
        .lt('quantity', 5)
        .gt('quantity', 0),
    ])

    const shipmentsDispatched = dispatchedRes.count ?? 0
    const deliveriesConfirmed = deliveredRes.count ?? 0
    const newOrders = ordersRes.count ?? 0
    const pendingOrdersTotal = pendingOrdersRes.count ?? 0

    type PayRow = { amount_naira: number }
    const paymentsNaira = ((paymentsRes.data ?? []) as PayRow[]).reduce(
      (sum, r) => sum + Number(r.amount_naira),
      0
    )

    type OverdueRow = { destination_city: string | null; destination_state: string | null; dispatched_at: string | null }
    const overdueShipments = ((overdueRes.data ?? []) as OverdueRow[]).map(s => ({
      destination:
        [s.destination_city, s.destination_state].filter(Boolean).join(', ') || 'unknown location',
      dispatched_at: s.dispatched_at,
    }))

    type StockRow = {
      quantity: number
      warehouses: { code: string } | null
      products: { display_name: string; sku_code: string } | null
    }
    const lowStockItems = ((lowStockRes.data ?? []) as unknown as StockRow[]).map(r => ({
      product: r.products?.display_name ?? 'Unknown',
      sku: r.products?.sku_code ?? '',
      warehouse: r.warehouses?.code ?? 'Unknown',
      quantity: r.quantity,
    }))

    const metrics: DailySummaryMetrics = {
      shipments_dispatched_yesterday: shipmentsDispatched,
      deliveries_confirmed_yesterday: deliveriesConfirmed,
      payments_received_yesterday_naira: paymentsNaira,
      new_orders_yesterday: newOrders,
      pending_orders_total: pendingOrdersTotal,
      overdue_shipments: overdueShipments,
      low_stock_items: lowStockItems,
    }

    const dateLabel = now.toLocaleDateString('en-NG', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })

    const raw = await callClaudeText(
      getDailySummarySystemPrompt(),
      getDailySummaryUserPrompt(metrics, dateLabel)
    )

    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON in model response.')

    const parsed = JSON.parse(jsonMatch[0]) as {
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

    return {
      success: true,
      summary_text: parsed.summary_text,
      key_metrics: parsed.key_metrics,
      items_needing_attention: parsed.items_needing_attention ?? [],
    }
  } catch (err) {
    console.error('[generateDailySummary]', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'An unexpected error occurred.',
    }
  }
}
