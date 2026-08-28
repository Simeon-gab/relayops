import { headers } from 'next/headers'

/**
 * The guard on every cron route.
 *
 * Vercel Cron sends `Authorization: Bearer $CRON_SECRET` on each scheduled
 * call, so checking that header is what separates the scheduler from anyone
 * who happens to know the URL — and these routes write proposals, send SMS and
 * spend model credits.
 *
 * Fails closed in production: with no secret configured the route refuses
 * outright rather than serving the world. Development stays open so a plain
 * `curl localhost:3000/api/agents/watchdog` still works while building.
 *
 * Returns a Response to send back, or null when the caller may proceed.
 */
export async function assertCronRequest(): Promise<Response | null> {
  const secret = process.env.CRON_SECRET

  if (!secret) {
    if (process.env.NODE_ENV !== 'production') return null
    console.error('[cron] refused: CRON_SECRET is not configured.')
    return Response.json(
      { ok: false, error: 'CRON_SECRET is not configured on this deployment.' },
      { status: 503 }
    )
  }

  const authHeader = (await headers()).get('authorization')
  if (authHeader !== `Bearer ${secret}`) {
    return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  return null
}
