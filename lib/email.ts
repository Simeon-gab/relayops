/**
 * Email summaries via Resend.
 *
 * Sends a structured summary to the admin(s) after key actions. Wired into
 * notifyAllAdmins so it fires on the same events as in-app notifications
 * (orders, parsed messages, receipts, etc.).
 *
 * Best-effort: if RESEND_API_KEY is not set, or the send fails, it silently
 * no-ops and NEVER throws — email must not break the underlying action.
 *
 * Env:
 *   RESEND_API_KEY    required to actually send (from resend.com)
 *   RESEND_FROM       from address; defaults to Resend's shared onboarding sender
 *   SUMMARY_EMAIL_TO  comma-separated override recipients; defaults to admin emails
 *   NEXT_PUBLIC_APP_URL  base URL used to build deep links in the email
 */

export interface SummaryEmailInput {
  subject: string
  title: string
  description?: string
  eventType?: string
  entityType?: string
  entityId?: string
}

const ENTITY_PATHS: Record<string, string> = {
  order: '/dealer-orders',
  message: '/messages',
  receipt: '/receipts',
  shipment: '/shipments',
  payment: '/payments',
}

function appBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || 'https://relayops-system.vercel.app').replace(/\/$/, '')
}

function entityLink(entityType?: string, entityId?: string): string | undefined {
  if (!entityType || !entityId) return undefined
  const path = ENTITY_PATHS[entityType]
  if (!path) return undefined
  return `${appBaseUrl()}${path}/${entityId}`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function renderHtml(input: SummaryEmailInput, link?: string): string {
  const desc = input.description ? `<p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.5">${escapeHtml(input.description)}</p>` : ''
  const button = link
    ? `<a href="${link}" style="display:inline-block;background:#1F4D3C;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:10px 18px;border-radius:6px">Open in RelayOps</a>`
    : ''
  const tag = input.eventType
    ? `<span style="display:inline-block;background:#E7F0EB;color:#1F4D3C;font-size:12px;font-weight:600;padding:3px 10px;border-radius:999px;letter-spacing:.02em">${escapeHtml(input.eventType)}</span>`
    : ''
  return `<!doctype html>
<html><body style="margin:0;background:#f3f4f6;padding:24px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb">
    <div style="background:linear-gradient(160deg,#1F4D3C,#163828);padding:20px 24px">
      <div style="color:#ffffff;font-size:16px;font-weight:700;letter-spacing:-.01em">RelayOps</div>
      <div style="color:#c9d9d1;font-size:12px;margin-top:2px">Operations summary</div>
    </div>
    <div style="padding:24px">
      <div style="margin-bottom:12px">${tag}</div>
      <h1 style="margin:0 0 12px;font-size:18px;color:#111827;line-height:1.35">${escapeHtml(input.title)}</h1>
      ${desc}
      ${button}
    </div>
    <div style="padding:14px 24px;border-top:1px solid #f0f0f0;color:#9ca3af;font-size:12px">
      Automated summary from RelayOps. You are receiving this because you are an admin.
    </div>
  </div>
</body></html>`
}

function renderText(input: SummaryEmailInput, link?: string): string {
  const parts = [input.title]
  if (input.description) parts.push('', input.description)
  if (link) parts.push('', `Open: ${link}`)
  parts.push('', '— RelayOps automated summary')
  return parts.join('\n')
}

export async function sendAdminSummaryEmail(
  input: SummaryEmailInput,
  fallbackRecipients: string[] = []
): Promise<void> {
  try {
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) return // email not configured — skip quietly

    const override = process.env.SUMMARY_EMAIL_TO
      ? process.env.SUMMARY_EMAIL_TO.split(',').map((s) => s.trim()).filter(Boolean)
      : []
    const to = override.length ? override : fallbackRecipients.filter(Boolean)
    if (!to.length) return

    const from = process.env.RESEND_FROM || 'RelayOps <onboarding@resend.dev>'
    const link = entityLink(input.entityType, input.entityId)

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to,
        subject: input.subject,
        html: renderHtml(input, link),
        text: renderText(input, link),
      }),
    })

    if (!res.ok) {
      const body = await res.text()
      console.error(`[email] Resend error ${res.status}: ${body.slice(0, 200)}`)
    }
  } catch (err) {
    console.error('[email] unexpected error:', err)
  }
}
