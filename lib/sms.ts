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

export async function sendAdminSms(text: string): Promise<void> {
  try {
    const apiKey = process.env.TERMII_API_KEY
    const rawTo = process.env.SUMMARY_SMS_TO
    if (!apiKey || !rawTo) return // SMS not configured — skip quietly

    const to = normalize(rawTo.split(',')[0]) // first recipient
    if (!to) return

    const from = process.env.TERMII_SENDER_ID || 'N-Alert'
    const channel = process.env.TERMII_CHANNEL || 'dnd'

    const res = await fetch(TERMII_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        to,
        from,
        sms: text.slice(0, 300),
        type: 'plain',
        channel,
        api_key: apiKey,
      }),
    })

    if (!res.ok) {
      const body = await res.text()
      console.error(`[sms] Termii error ${res.status}: ${body.slice(0, 200)}`)
      return
    }

    const data = (await res.json().catch(() => ({}))) as { message?: string; balance?: number }
    if (data?.message && !/success/i.test(data.message)) {
      console.error('[sms] Termii responded:', data.message)
    }
  } catch (err) {
    console.error('[sms] unexpected error:', err)
  }
}
