import { createAdminClient } from '@/lib/supabase/admin'

export interface NotificationInput {
  recipientUserId: string
  eventType: string
  title: string
  description?: string
  entityType?: string
  entityId?: string
}

export interface BroadcastNotificationInput {
  eventType: string
  title: string
  description?: string
  entityType?: string
  entityId?: string
}

export async function createNotification(input: NotificationInput): Promise<void> {
  try {
    const admin = createAdminClient()
    const { error } = await admin.from('notifications').insert({
      recipient_user_id: input.recipientUserId,
      event_type: input.eventType,
      title: input.title,
      description: input.description ?? null,
      entity_type: input.entityType ?? null,
      entity_id: input.entityId ?? null,
    })
    if (error) console.error('[notifications] insert failed:', error.message)
  } catch (err) {
    console.error('[notifications] unexpected error:', err)
  }
}

export async function notifyAllAdmins(input: BroadcastNotificationInput): Promise<void> {
  try {
    const admin = createAdminClient()
    const { data: admins, error } = await admin
      .from('users')
      .select('id')
      .eq('role', 'admin')

    if (error || !admins?.length) return

    const rows = admins.map((u) => ({
      recipient_user_id: u.id,
      event_type: input.eventType,
      title: input.title,
      description: input.description ?? null,
      entity_type: input.entityType ?? null,
      entity_id: input.entityId ?? null,
    }))

    const { error: insertErr } = await admin.from('notifications').insert(rows)
    if (insertErr) console.error('[notifications] bulk insert failed:', insertErr.message)
  } catch (err) {
    console.error('[notifications] unexpected error:', err)
  }
}
