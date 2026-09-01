import { createAdminClient } from '@/lib/supabase/admin'
import { assertCronRequest } from '@/lib/cron-auth'
import { sendAdminSms } from '@/lib/sms'

// Must run at request time (queries live data, sends SMS).
export const dynamic = 'force-dynamic'

/**
 * Daily SMS digest. A Vercel cron (see vercel.json) calls this once a day; it
 * summarizes the last 24 hours in one text. Protected by CRON_SECRET so only
 * the scheduler can trigger it.
 *
 * Delivery is reported, not assumed. Composing the text is the easy half; the
 * route's actual job is getting it onto a phone, so a run where every send was
 * rejected answers 502 and names the reason rather than returning a green
 * `ok: true` that looks exactly like a successful one.
 */
export async function GET() {
  const refusal = await assertCronRequest()
  if (refusal) return refusal

  const db = createAdminClient()
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const [ordersRes, paymentsRes, pendingOrdersRes, receiptsRes] = await Promise.all([
    db
      .from('dealer_orders')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', since)
      .is('deleted_at', null),
    db
      .from('payments')
      .select('amount_naira')
      .gte('recorded_at', since)
      .is('deleted_at', null),
    db
      .from('dealer_orders')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending')
      .is('deleted_at', null),
    db
      .from('receipts')
      .select('id', { count: 'exact', head: true })
      .in('status', ['pending_extraction', 'needs_review']),
  ])

  const newOrders = ordersRes.count ?? 0
  const payments = (paymentsRes.data ?? []) as Array<{ amount_naira: number | null }>
  const paymentCount = payments.length
  const paymentSum = payments.reduce((s, p) => s + Number(p.amount_naira || 0), 0)
  const pendingOrders = pendingOrdersRes.count ?? 0
  const receiptsToReview = receiptsRes.count ?? 0

  const naira = (n: number) =>
    n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${Math.round(n / 1000)}k` : String(n)

  const text =
    `RelayOps daily: ${newOrders} new order${newOrders === 1 ? '' : 's'}, ` +
    `${paymentCount} payment${paymentCount === 1 ? '' : 's'} (N${naira(paymentSum)}). ` +
    `${pendingOrders} pending, ${receiptsToReview} receipt${receiptsToReview === 1 ? '' : 's'} to review.`

  const sms = await sendAdminSms(text)

  if (sms.failures.length) {
    const reasons = sms.failures
      .map((f) => `${f.to} ${f.reason}${f.detail ? ` (${f.detail})` : ''}`)
      .join('; ')
    console.error(`[sms-digest] ${sms.failures.length}/${sms.attempted} sends failed: ${reasons}`)
  }

  // No recipients configured is a deliberate opt-out, not a broken run.
  const notConfigured = sms.attempted === 0
  const status = notConfigured
    ? ('not_configured' as const)
    : sms.failures.length === 0
      ? ('delivered' as const)
      : sms.sent > 0
        ? ('partial' as const)
        : ('failed' as const)

  return Response.json(
    {
      ok: status !== 'failed',
      sent: text,
      sms: {
        status,
        ...(notConfigured
          ? { hint: 'SUMMARY_SMS_TO is unset, so the digest was composed but never texted.' }
          : { attempted: sms.attempted, delivered: sms.sent, failures: sms.failures }),
      },
      stats: { newOrders, paymentCount, paymentSum, pendingOrders, receiptsToReview },
    },
    { status: status === 'failed' ? 502 : 200 }
  )
}
