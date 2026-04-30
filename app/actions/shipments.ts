'use server'

import { createClient } from '@/lib/supabase/server'
import { Client } from 'pg'
import { revalidatePath } from 'next/cache'

const VALID_STATUSES = ['pending', 'dispatched', 'in_transit', 'delivered', 'cancelled'] as const
type ShipmentStatus = typeof VALID_STATUSES[number]

const LEGAL_TRANSITIONS: Record<ShipmentStatus, ShipmentStatus[]> = {
  pending:    ['dispatched', 'cancelled'],
  dispatched: ['in_transit', 'cancelled'],
  in_transit: ['delivered', 'cancelled'],
  delivered:  ['in_transit'],
  cancelled:  ['pending'],
}

export type UpdateShipmentStatusResult =
  | { success: true }
  | { success: false; error: string }

export async function updateShipmentStatus(
  shipmentId: string,
  newStatus: string,
  notes?: string
): Promise<UpdateShipmentStatusResult> {
  const db = await createClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated.' }

  const { data: adminUser } = await db
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (adminUser?.role !== 'admin') {
    return { success: false, error: 'Unauthorized — admin access required.' }
  }

  if (!VALID_STATUSES.includes(newStatus as ShipmentStatus)) {
    return { success: false, error: `Invalid status: ${newStatus}` }
  }

  if (newStatus === 'cancelled' && !notes?.trim()) {
    return { success: false, error: 'A reason is required when cancelling a shipment.' }
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  })
  await client.connect()

  try {
    await client.query('BEGIN')

    const { rows } = await client.query<{ status: string }>(
      `SELECT status FROM shipments WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
      [shipmentId]
    )

    if (!rows.length) {
      await client.query('ROLLBACK')
      return { success: false, error: 'Shipment not found.' }
    }

    const currentStatus = rows[0].status as ShipmentStatus

    if (currentStatus === newStatus) {
      await client.query('ROLLBACK')
      return { success: false, error: `Shipment is already ${newStatus.replace(/_/g, ' ')}.` }
    }

    const allowed = LEGAL_TRANSITIONS[currentStatus] ?? []
    if (!allowed.includes(newStatus as ShipmentStatus)) {
      await client.query('ROLLBACK')
      return {
        success: false,
        error: `Cannot move from "${currentStatus.replace(/_/g, ' ')}" to "${newStatus.replace(/_/g, ' ')}".`,
      }
    }

    // Build timestamp updates for dispatched_at / delivered_at
    let timestampClause = ''
    if (newStatus === 'dispatched') timestampClause = ', dispatched_at = now()'
    if (newStatus === 'delivered') timestampClause = ', delivered_at = now()'

    await client.query(
      `UPDATE shipments SET status = $1, updated_at = now()${timestampClause} WHERE id = $2`,
      [newStatus, shipmentId]
    )

    await client.query(
      `INSERT INTO status_events
         (shipment_id, from_status, to_status, event_at, recorded_by, source, notes)
       VALUES ($1, $2, $3, now(), $4, 'admin', $5)`,
      [shipmentId, currentStatus, newStatus, user.id, notes?.trim() || null]
    )

    const changes: Record<string, string> = { from: currentStatus, to: newStatus }
    if (notes?.trim()) changes.reason = notes.trim()

    await client.query(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id, changes)
       VALUES ($1, 'shipment_status_changed', 'shipment', $2, $3)`,
      [user.id, shipmentId, JSON.stringify(changes)]
    )

    await client.query('COMMIT')

    revalidatePath(`/shipments/${shipmentId}`)
    revalidatePath('/shipments')
    revalidatePath('/dashboard')

    return { success: true }
  } catch (err) {
    await client.query('ROLLBACK')
    const message = err instanceof Error ? err.message : 'Unknown error occurred.'
    return { success: false, error: message }
  } finally {
    await client.end()
  }
}
