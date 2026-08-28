import { createAdminClient } from '@/lib/supabase/admin'
import { assertCronRequest } from '@/lib/cron-auth'
import { sendAdminSms } from '@/lib/sms'

// Must run at request time (queries live data, sends SMS).
export const dynamic = 'force-dynamic'

/**
 * Daily SMS digest. A Vercel cron (see vercel.json) calls this once a day; it
 * summarizes the last 24 hours in one text. Protected by CRON_SECRET so only
 * the scheduler can trigger it.
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

  await sendAdminSms(text)

  return Response.json({
    ok: true,
    sent: text,
    stats: { newOrders, paymentCount, paymentSum, pendingOrders, receiptsToReview },
  })
}
