import { createProposal, logAgentRun, type ProposalAudience } from '@/lib/db/ai-proposals'
import { decideAutonomy, AUTO_VALUE_CEILING_NAIRA } from '@/lib/policy'
import { formatNaira } from '@/lib/utils/format'
import { AI_MODEL } from '@/lib/ai/client'

/**
 * Turning agent output into something a person can decide on.
 *
 * Each emitter takes what an AI step produced and writes one proposal row:
 * the plain-English line for the queue, the confidence, the naira at stake,
 * and which dashboard should surface it. Routing lives here rather than in
 * the call sites so "who sees this" is answered in one place.
 *
 * Every function is best-effort. An emitter must never fail the work that
 * triggered it — a container is still recorded if its proposal cannot be
 * written.
 */

interface EmitResult {
  proposalId: string | null
  autoExecute: boolean
}

const NOTHING: EmitResult = { proposalId: null, autoExecute: false }

// ─── order from a parsed dealer message ───────────────────────────────────────

export interface OrderProposalInput {
  messageId: string
  dealerName: string
  parseResultId: string
  intent: string
  confidence: number
  itemCount: number
  itemSummary: string
  startedAt: number
}

export async function emitOrderProposal(input: OrderProposalInput): Promise<EmitResult> {
  try {
    const decision = decideAutonomy({ kind: 'order_from_message', confidence: input.confidence })

    const summary =
      input.itemCount > 0
        ? `${input.dealerName} is asking for ${input.itemSummary}.`
        : `${input.dealerName} sent a message read as ${input.intent.replace(/_/g, ' ')}.`

    const proposalId = await createProposal({
      kind: 'order_from_message',
      subject_type: 'message',
      subject_id: input.messageId,
      proposal: { parse_result_id: input.parseResultId, intent: input.intent },
      summary,
      confidence: input.confidence,
      audience: 'manager',
      ai_model: AI_MODEL,
      ai_notes: decision.reason,
    })

    await logAgentRun({
      agent: 'parse_message',
      trigger: 'event',
      subject_type: 'message',
      subject_id: input.messageId,
      ok: true,
      duration_ms: Date.now() - input.startedAt,
      proposal_id: proposalId,
      ai_model: AI_MODEL,
    })

    return { proposalId, autoExecute: decision.action === 'auto_execute' }
  } catch (err) {
    console.error('[emit] order proposal failed:', err instanceof Error ? err.message : err)
    return NOTHING
  }
}

// ─── allocation for a container that just landed ──────────────────────────────

export interface AllocationProposalInput {
  containerId: string
  containerNumber: string
  totalUnits: number
  dealersServed: number
  kanoUnits: number
  confidence: number | null
  suggestion: Record<string, unknown>
  startedAt: number
}

export async function emitAllocationProposal(
  input: AllocationProposalInput
): Promise<EmitResult> {
  try {
    const parts = [`${input.containerNumber} landed with ${input.totalUnits} units`]
    if (input.dealersServed > 0) parts.push(`a split across ${input.dealersServed} dealers is ready`)
    if (input.kanoUnits > 0) parts.push(`${input.kanoUnits} to move to Kano`)

    const proposalId = await createProposal({
      kind: 'container_allocation',
      subject_type: 'container',
      subject_id: input.containerId,
      proposal: input.suggestion,
      summary: `${parts.join(' — ')}.`,
      confidence: input.confidence,
      // The business partner owns allocation, so it lands on his screen.
      audience: 'partner',
      ai_model: AI_MODEL,
    })

    await logAgentRun({
      agent: 'suggest_allocation',
      trigger: 'event',
      subject_type: 'container',
      subject_id: input.containerId,
      ok: true,
      duration_ms: Date.now() - input.startedAt,
      proposal_id: proposalId,
      ai_model: AI_MODEL,
    })

    return { proposalId, autoExecute: false }
  } catch (err) {
    console.error('[emit] allocation proposal failed:', err instanceof Error ? err.message : err)
    return NOTHING
  }
}

// ─── payment read off an uploaded receipt ─────────────────────────────────────

export interface PaymentProposalInput {
  receiptId: string
  dealerName: string
  amountNaira: number | null
  reference: string | null
  confidence: number
  startedAt: number
}

export async function emitPaymentProposal(input: PaymentProposalInput): Promise<EmitResult> {
  try {
    const amount = input.amountNaira

    // Small receipts are routine and belong with the managers. Large ones are
    // the MD's call, which is what the unattended ceiling already encodes.
    const audience: ProposalAudience =
      amount !== null && amount >= AUTO_VALUE_CEILING_NAIRA ? 'md' : 'manager'

    const summary =
      amount !== null
        ? `${formatNaira(amount)} receipt from ${input.dealerName} needs confirming${input.reference ? ` (ref ${input.reference})` : ''}.`
        : `A receipt from ${input.dealerName} could not be read clearly and needs a look.`

    const proposalId = await createProposal({
      kind: 'payment_from_receipt',
      subject_type: 'receipt',
      subject_id: input.receiptId,
      proposal: { amount_naira: amount, reference: input.reference },
      summary,
      confidence: input.confidence,
      value_naira: amount,
      audience,
      ai_model: AI_MODEL,
    })

    await logAgentRun({
      agent: 'extract_receipt',
      trigger: 'event',
      subject_type: 'receipt',
      subject_id: input.receiptId,
      ok: true,
      duration_ms: Date.now() - input.startedAt,
      proposal_id: proposalId,
      ai_model: AI_MODEL,
    })

    return { proposalId, autoExecute: false }
  } catch (err) {
    console.error('[emit] payment proposal failed:', err instanceof Error ? err.message : err)
    return NOTHING
  }
}

// ─── watchdog alerts ──────────────────────────────────────────────────────────

export interface AlertInput {
  kind: 'stock_alert' | 'overdue_alert' | 'credit_alert'
  subjectType: string
  subjectId: string | null
  summary: string
  audience: ProposalAudience
  valueNaira?: number | null
  detail?: Record<string, unknown>
}

export async function emitAlert(input: AlertInput): Promise<string | null> {
  try {
    return await createProposal({
      kind: input.kind,
      subject_type: input.subjectType,
      subject_id: input.subjectId,
      proposal: input.detail ?? {},
      summary: input.summary,
      confidence: null,
      value_naira: input.valueNaira ?? null,
      audience: input.audience,
    })
  } catch (err) {
    console.error('[emit] alert failed:', err instanceof Error ? err.message : err)
    return null
  }
}
