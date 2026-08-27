import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * The proposal store — what the agents want to do, waiting on a person.
 *
 * Every dashboard's "needs your decision" block is a filtered read of this
 * one table, which is why proposals carry their own audience and summary
 * rather than each screen assembling its own queue.
 *
 * Writes go through the service-role client: agents run from webhooks and
 * cron with no signed-in user, so RLS has nobody to evaluate.
 */

export type ProposalKind =
  | 'container_allocation'
  | 'order_from_message'
  | 'payment_from_receipt'
  | 'dispatch_message'
  | 'next_container_load'
  | 'stock_alert'
  | 'overdue_alert'
  | 'credit_alert'

export type ProposalAudience = 'md' | 'manager' | 'partner'

export type ProposalStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'auto_executed'
  | 'failed'
  | 'superseded'

export interface AiProposal {
  id: string
  kind: ProposalKind
  subject_type: string
  subject_id: string | null
  proposal: Record<string, unknown>
  summary: string
  confidence: number | null
  value_naira: number | null
  audience: ProposalAudience
  status: ProposalStatus
  auto_executed: boolean
  ai_model: string | null
  ai_notes: string | null
  error: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
}

export interface CreateProposalInput {
  kind: ProposalKind
  subject_type: string
  subject_id?: string | null
  proposal: Record<string, unknown>
  summary: string
  confidence?: number | null
  value_naira?: number | null
  audience: ProposalAudience
  status?: ProposalStatus
  auto_executed?: boolean
  ai_model?: string | null
  ai_notes?: string | null
}

/**
 * Record a proposal. Any earlier pending proposal of the same kind about the
 * same subject is superseded first — a container re-planned after new orders
 * arrive should leave one live suggestion, not two.
 */
export async function createProposal(input: CreateProposalInput): Promise<string | null> {
  const db = createAdminClient()

  if (input.subject_id) {
    await db
      .from('ai_proposals')
      .update({ status: 'superseded' })
      .eq('kind', input.kind)
      .eq('subject_type', input.subject_type)
      .eq('subject_id', input.subject_id)
      .eq('status', 'pending')
  }

  const { data, error } = await db
    .from('ai_proposals')
    .insert({
      kind: input.kind,
      subject_type: input.subject_type,
      subject_id: input.subject_id ?? null,
      proposal: input.proposal,
      summary: input.summary,
      confidence: input.confidence ?? null,
      value_naira: input.value_naira ?? null,
      audience: input.audience,
      status: input.status ?? 'pending',
      auto_executed: input.auto_executed ?? false,
      ai_model: input.ai_model ?? null,
      ai_notes: input.ai_notes ?? null,
    })
    .select('id')
    .single()

  if (error) {
    console.error('[ai_proposals] insert failed:', error.message)
    return null
  }
  return data?.id ?? null
}

/** Pending proposals for one dashboard, newest first. */
export async function listPendingProposals(
  audience: ProposalAudience,
  limit = 20
): Promise<AiProposal[]> {
  try {
    const db = await createClient()
    const { data, error } = await db
      .from('ai_proposals')
      .select('*')
      .eq('audience', audience)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return (data ?? []) as AiProposal[]
  } catch {
    return []
  }
}

/**
 * Everything still pending, for the manager view — managers see the MD's and
 * the partner's queues too, since they are the fallback if nobody acts.
 */
export async function listAllPendingProposals(limit = 40): Promise<AiProposal[]> {
  try {
    const db = await createClient()
    const { data, error } = await db
      .from('ai_proposals')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return (data ?? []) as AiProposal[]
  } catch {
    return []
  }
}

export async function getProposal(id: string): Promise<AiProposal | null> {
  try {
    const db = await createClient()
    const { data, error } = await db.from('ai_proposals').select('*').eq('id', id).single()
    if (error) throw error
    return data as AiProposal
  } catch {
    return null
  }
}

/** Mark a proposal decided. Called after the underlying action succeeds. */
export async function resolveProposal(
  id: string,
  status: Extract<ProposalStatus, 'approved' | 'rejected' | 'failed' | 'auto_executed'>,
  reviewedBy: string | null,
  error?: string
): Promise<boolean> {
  const db = createAdminClient()
  const { error: err } = await db
    .from('ai_proposals')
    .update({
      status,
      reviewed_by: reviewedBy,
      reviewed_at: new Date().toISOString(),
      error: error ?? null,
    })
    .eq('id', id)

  if (err) {
    console.error('[ai_proposals] resolve failed:', err.message)
    return false
  }
  return true
}

export async function countPendingProposals(audience: ProposalAudience): Promise<number> {
  try {
    const db = await createClient()
    const { count, error } = await db
      .from('ai_proposals')
      .select('*', { count: 'exact', head: true })
      .eq('audience', audience)
      .eq('status', 'pending')
    if (error) throw error
    return count ?? 0
  } catch {
    return 0
  }
}

// ─── agent_runs ───────────────────────────────────────────────────────────────

export interface AgentRunInput {
  agent: string
  trigger: 'event' | 'cron' | 'manual'
  subject_type?: string | null
  subject_id?: string | null
  ok: boolean
  duration_ms?: number | null
  proposal_id?: string | null
  error?: string | null
  ai_model?: string | null
}

/**
 * Log one unattended run. Never throws — an agent must not fail because its
 * bookkeeping failed.
 */
export async function logAgentRun(input: AgentRunInput): Promise<void> {
  try {
    const db = createAdminClient()
    await db.from('agent_runs').insert({
      agent: input.agent,
      trigger: input.trigger,
      subject_type: input.subject_type ?? null,
      subject_id: input.subject_id ?? null,
      ok: input.ok,
      duration_ms: input.duration_ms ?? null,
      proposal_id: input.proposal_id ?? null,
      error: input.error ?? null,
      ai_model: input.ai_model ?? null,
    })
  } catch (err) {
    console.error('[agent_runs] log failed:', err instanceof Error ? err.message : err)
  }
}

export interface AgentRun {
  id: string
  agent: string
  trigger: string
  ok: boolean
  duration_ms: number | null
  error: string | null
  created_at: string
}

/** Recent unattended activity — "what did the system do while I slept". */
export async function listRecentAgentRuns(limit = 15): Promise<AgentRun[]> {
  try {
    const db = await createClient()
    const { data, error } = await db
      .from('agent_runs')
      .select('id, agent, trigger, ok, duration_ms, error, created_at')
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) throw error
    return (data ?? []) as AgentRun[]
  } catch {
    return []
  }
}
