import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'

// Never prerender: this must actually hit the database on every invocation
// so the request counts as activity and resets Supabase's free-tier idle timer.
export const dynamic = 'force-dynamic'

/**
 * Keep-alive ping for the Supabase free tier.
 *
 * Free projects auto-pause after 7 consecutive days with no activity. A Vercel
 * cron (see vercel.json) calls this route on a schedule so the database receives
 * real traffic and never goes idle long enough to pause.
 *
 * This is intentionally read-only: a HEAD count against a stable reference table.
 * It writes nothing and touches no application state.
 */
export async function GET() {
  // If CRON_SECRET is configured, only allow Vercel Cron (which sends it) to run this.
  const secret = process.env.CRON_SECRET
  if (secret) {
    const authHeader = (await headers()).get('authorization')
    if (authHeader !== `Bearer ${secret}`) {
      return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 })
    }
  }

  const supabase = createAdminClient()
  const { error, count } = await supabase
    .from('warehouses')
    .select('*', { count: 'exact', head: true })

  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 })
  }

  return Response.json({ ok: true, pinged: 'warehouses', count })
}
