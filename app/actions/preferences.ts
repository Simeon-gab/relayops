'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getStaffUser } from '@/lib/auth/roles'
import { MD_FULL_VIEW_COOKIE } from '@/lib/auth/md-view'

const ONE_YEAR = 60 * 60 * 24 * 365

/**
 * Turn the MD's full-system view on or off.
 *
 * Only the md role has a short view to leave, so anyone else is ignored
 * rather than errored — there is nothing for them to toggle.
 */
export async function setMdFullView(enabled: boolean): Promise<void> {
  const db = await createClient()
  const staff = await getStaffUser(db)
  if (staff?.role !== 'md') return

  const store = await cookies()
  if (enabled) {
    store.set({
      name: MD_FULL_VIEW_COOKIE,
      value: '1',
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: ONE_YEAR,
    })
  } else {
    store.delete(MD_FULL_VIEW_COOKIE)
  }

  // The sidebar lives in the layout, so refresh everything under it.
  revalidatePath('/', 'layout')
}
