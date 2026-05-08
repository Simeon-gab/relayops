'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

async function getAuthUser() {
  const db = await createClient()
  const { data: { user } } = await db.auth.getUser()
  return user
}

export async function markNotificationRead(
  notificationId: string
): Promise<{ success: boolean; error?: string }> {
  const user = await getAuthUser()
  if (!user) return { success: false, error: 'Not authenticated.' }

  const db = await createClient()
  const { error } = await db
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId)
    .eq('recipient_user_id', user.id)
    .is('read_at', null)

  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function markAllNotificationsRead(): Promise<{ success: boolean; error?: string }> {
  const user = await getAuthUser()
  if (!user) return { success: false, error: 'Not authenticated.' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('recipient_user_id', user.id)
    .is('read_at', null)

  if (error) return { success: false, error: error.message }

  revalidatePath('/', 'layout')
  return { success: true }
}

export async function getUnreadCountAction(): Promise<number> {
  const user = await getAuthUser()
  if (!user) return 0

  const db = await createClient()
  const { count } = await db
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('recipient_user_id', user.id)
    .is('read_at', null)

  return count ?? 0
}

export async function getRecentNotificationsAction() {
  const user = await getAuthUser()
  if (!user) return []

  const db = await createClient()
  const { data } = await db
    .from('notifications')
    .select('id, event_type, title, description, entity_type, entity_id, read_at, created_at')
    .eq('recipient_user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20)

  return data ?? []
}
