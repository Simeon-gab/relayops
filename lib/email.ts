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

// Human-friendly label, icon, and accent colour for each internal event type.
const EVENT_META: Record<string, { label: string; emoji: string; accent: string }> = {
  order_created: { label: 'New order', emoji: '🛒', accent: '#1F4D3C' },
  order_auto_fulfilled: { label: 'Order fulfilled', emoji: '✅', accent: '#0f766e' },
  message_received: { label: 'New message', emoji: '💬', accent: '#2563eb' },
  payment_received: { label: 'Payment received', emoji: '💰', accent: '#0f766e' },
  receipt_extracted: { label: 'Receipt read', emoji: '🧾', accent: '#7c3aed' },
  shipment_dispatched: { label: 'Shipment dispatched', emoji: '🚚', accent: '#ea580c' },
  shipment_delivered: { label: 'Delivered', emoji: '📦', accent: '#0f766e' },
  allocation_pending: { label: 'Allocation needed', emoji: '⚖️', accent: '#d97706' },
}

function prettify(slug: string): string {
  return slug.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function eventMeta(eventType?: string): { label: string; emoji: string; accent: string } {
  if (eventType && EVENT_META[eventType]) return EVENT_META[eventType]
  return { label: eventType ? prettify(eventType) : 'Update', emoji: '🔔', accent: '#1F4D3C' }
}

function formatNaijaTime(): string {
  try {
    return new Intl.DateTimeFormat('en-NG', {
      timeZone: 'Africa/Lagos',
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(new Date())
  } catch {
    return ''
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function renderHtml(input: SummaryEmailInput, link?: string): string {
  const meta = eventMeta(input.eventType)
  const when = formatNaijaTime()
  const preview = escapeHtml(input.description || input.title)
  const desc = input.description
    ? `<p style="margin:0 0 22px;color:#4b5563;font-size:15px;line-height:1.55">${escapeHtml(input.description)}</p>`
    : ''
  const button = link
    ? `<a href="${link}" style="display:inline-block;background:${meta.accent};color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 22px;border-radius:9px">Open in RelayOps &nbsp;&rarr;</a>`
    : ''
  return `<!doctype html>
<html>
<head>
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
</head>
<body style="margin:0;background:#eef1f0;padding:24px 16px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#eef1f0">${preview}</div>
  <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8e5;box-shadow:0 2px 6px rgba(16,40,30,.07)">
    <div style="background:linear-gradient(135deg,#1F4D3C 0%,#163828 100%);padding:22px 26px">
      <div style="color:#ffffff;font-size:17px;font-weight:700;letter-spacing:-.01em">RelayOps</div>
      <div style="color:#a9c4b8;font-size:11px;margin-top:3px;letter-spacing:.08em;text-transform:uppercase">Operations summary</div>
    </div>
    <div style="padding:26px">
      <div style="margin-bottom:16px">
        <span style="display:inline-block;background:#f1f5f3;color:${meta.accent};font-size:13px;font-weight:600;padding:5px 13px;border-radius:999px;border:1px solid #e2e8e5">${meta.emoji}&nbsp; ${escapeHtml(meta.label)}</span>
      </div>
      <h1 style="margin:0 0 12px;font-size:21px;color:#0f172a;line-height:1.3;font-weight:700">${escapeHtml(input.title)}</h1>
      ${desc}
      ${button}
    </div>
    <div style="padding:16px 26px;border-top:1px solid #eef1f0;color:#94a3a0;font-size:12px;line-height:1.5">
      Automated summary from RelayOps${when ? ` &middot; ${when}` : ''}<br>You&rsquo;re receiving this as an admin.
    </div>
  </div>
</body>
</html>`
}

function renderText(input: SummaryEmailInput, link?: string): string {
  const meta = eventMeta(input.eventType)
  const parts = [`[${meta.label}] ${input.title}`]
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
