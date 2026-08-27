/**
 * Autonomy policy — how much an agent may do without being asked.
 *
 * The agents run on their own (see lib/agents/*): a message arrives and is
 * parsed, a receipt is uploaded and is read, a container lands and an
 * allocation is planned. None of that needs a human any more.
 *
 * What still needs a human is the moment work becomes a fact: stock moves,
 * money is recorded, a dealer is told something. This file is the single
 * place that decides which of those a machine may do alone.
 *
 * Deliberately conservative at launch. Widen AUTO_ELIGIBLE as the confirm
 * rate on each proposal kind proves itself — that progression is the point,
 * not a limitation.
 */

import type { ProposalKind } from '@/lib/db/ai-proposals'

/** Below this confidence nothing runs unattended, whatever the value. */
export const AUTO_CONFIDENCE_FLOOR = 0.9

/** Above this naira value a human decides, however confident the agent is. */
export const AUTO_VALUE_CEILING_NAIRA = 500_000

/**
 * Kinds a machine may execute alone when the two thresholds above are met.
 *
 * order_from_message qualifies because a dealer order is a record of intent:
 * it moves no stock, moves no money, and is one click to cancel. Everything
 * else either spends money, moves inventory, or speaks to a dealer in the
 * company's name.
 */
export const AUTO_ELIGIBLE: readonly ProposalKind[] = ['order_from_message'] as const

/**
 * Never automatic, at any confidence, at any value.
 *
 * Confirming money has arrived is the one mistake that ends a pilot, and a
 * container allocation commits the whole month's stock at once.
 */
export const NEVER_AUTO: readonly ProposalKind[] = [
  'payment_from_receipt',
  'container_allocation',
  'next_container_load',
] as const

export interface PolicyInput {
  kind: ProposalKind
  confidence: number | null
  valueNaira?: number | null
}

export type PolicyDecision =
  | { action: 'auto_execute'; reason: string }
  | { action: 'propose'; reason: string }

export function decideAutonomy(input: PolicyInput): PolicyDecision {
  const { kind, confidence, valueNaira } = input

  if (NEVER_AUTO.includes(kind)) {
    return { action: 'propose', reason: 'This kind of decision always goes to a person.' }
  }

  if (!AUTO_ELIGIBLE.includes(kind)) {
    return { action: 'propose', reason: 'Not yet enabled for unattended execution.' }
  }

  if (confidence === null || confidence < AUTO_CONFIDENCE_FLOOR) {
    const shown = confidence === null ? 'unknown' : `${Math.round(confidence * 100)}%`
    return { action: 'propose', reason: `Confidence ${shown} is below the ${Math.round(AUTO_CONFIDENCE_FLOOR * 100)}% bar.` }
  }

  if (valueNaira != null && valueNaira >= AUTO_VALUE_CEILING_NAIRA) {
    return { action: 'propose', reason: 'Value is above the unattended ceiling.' }
  }

  return { action: 'auto_execute', reason: `Confidence ${Math.round(confidence * 100)}% with nothing irreversible at stake.` }
}

/**
 * Watchdog thresholds — what the nightly sweep counts as worth raising.
 * Mirrors the rules already stated in lib/ai/prompts/nl-query.ts so the
 * agent and the NL query layer agree on what "low" and "overdue" mean.
 */
export const WATCHDOG = {
  /** warehouse_stock.quantity below this raises a stock_alert. */
  LOW_STOCK_QTY: 5,
  /** A dispatched shipment unconfirmed for this long raises an overdue_alert. */
  OVERDUE_SHIPMENT_DAYS: 7,
  /** Container arriving within this many days is worth flagging to the partner. */
  ARRIVAL_HORIZON_DAYS: 14,
} as const
