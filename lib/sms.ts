/**
 * SMS alerts via Termii (https://termii.com) — Nigeria-focused SMS provider.
 *
 * Best-effort: if TERMII_API_KEY or SUMMARY_SMS_TO is not set, or the send
 * fails, it silently no-ops and NEVER throws — SMS must not break the
 * underlying action.
 *
 * Env:
 *   TERMII_API_KEY    required to actually send (from your Termii dashboard)
 *   SUMMARY_SMS_TO    recipient phone in international format, e.g. 2348031110001
 *   TERMII_SENDER_ID  approved sender ID (defaults to "N-Alert", Termii's
 *                     shared alert sender that reaches DND numbers)
 *   TERMII_CHANNEL    "dnd" (default, reaches Do-Not-Disturb numbers) | "generic"
 */

const TERMII_URL = 'https://api.ng.termii.com/api/sms/send'

// Termii expects numbers without a leading "+" (e.g. 2348031110001).
function normalize(phone: string): string {
  return phone.trim().replace(/^\+/, '').replace(/[^\d]/g, '')
}

export interface SmsResult {
  ok: boolean
  /** Why it did not send. 'not_configured' means no key — not a failure. */
  reason?: 'not_configured' | 'no_recipient' | 'rejected' | 'error'
  detail?: string
}

/**
 * Send one SMS to one number.
 *
 * Unlike sendAdminSms this reports what happened, because callers that text
 * dealers need to know which messages actually left — a login nobody received
 * is worse than one that visibly failed to send.
 */
export async function sendSms(to: string, text: string): Promise<SmsResult> {
  try {
    const apiKey = process.env.TERMII_API_KEY
    if (!apiKey) return { ok: false, reason: 'not_configured' }

    const number = normalize(to)
    if (!number) return { ok: false, reason: 'no_recipient' }

    const res = await fetch(TERMII_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        to: number,
        from: process.env.TERMII_SENDER_ID || 'N-Alert',
        sms: text.slice(0, 300),
        type: 'plain',
        channel: process.env.TERMII_CHANNEL || 'dnd',
        api_key: apiKey,
      }),
    })

    if (!res.ok) {
      const body = await res.text()
      const detail = `Termii ${res.status}: ${body.slice(0, 200)}`
      console.error(`[sms] ${detail}`)
      return { ok: false, reason: 'rejected', detail }
    }

    const data = (await res.json().catch(() => ({}))) as { message?: string }
    if (data?.message && !/success|sent/i.test(data.message)) {
      console.error('[sms] Termii responded:', data.message)
      return { ok: false, reason: 'rejected', detail: data.message }
    }

    return { ok: true }
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    console.error('[sms] unexpected error:', detail)
    return { ok: false, reason: 'error', detail }
  }
}

/**
 * Alert the admin number(s) in SUMMARY_SMS_TO. Best-effort and never throws —
 * an SMS failure must not roll back the action that triggered it.
 */
export async function sendAdminSms(text: string): Promise<void> {
  const rawTo = process.env.SUMMARY_SMS_TO
  if (!rawTo) return // SMS not configured — skip quietly

  const numbers = rawTo.split(',').map((s) => s.trim()).filter(Boolean)
  for (const number of numbers) {
    await sendSms(number, text)
  }
}
