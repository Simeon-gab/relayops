import { createClient } from '@/lib/supabase/server'

export interface NotificationRow {
  id: string
  event_type: string
  title: string
  description: string | null
  entity_type: string | null
  entity_id: string | null
  read_at: string | null
  created_at: string
}

export async function getRecentNotifications(
  userId: string,
  limit = 20
): Promise<NotificationRow[]> {
  const db = await createClient()
  const { data, error } = await db
    .from('notifications')
    .select('id, event_type, title, description, entity_type, entity_id, read_at, created_at')
    .eq('recipient_user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) return []
  return (data ?? []) as NotificationRow[]
}

export async function getUnreadCount(userId: string): Promise<number> {
  const db = await createClient()
  const { count, error } = await db
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('recipient_user_id', userId)
    .is('read_at', null)

  if (error) return 0
  return count ?? 0
}
