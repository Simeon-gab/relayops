'use server'

import { createClient } from '@/lib/supabase/server'
import { Client } from 'pg'
import { revalidatePath } from 'next/cache'
import { notifyAllAdmins } from '@/lib/notifications'

// ─── Status transition helpers ────────────────────────────────────────────────

const VALID_STATUSES = ['pending', 'partially_fulfilled', 'fulfilled', 'cancelled'] as const
type OrderStatus = typeof VALID_STATUSES[number]

const LEGAL_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending:              ['partially_fulfilled', 'fulfilled', 'cancelled'],
  partially_fulfilled:  ['pending', 'fulfilled', 'cancelled'],
  fulfilled:            ['pending'],
  cancelled:            ['pending'],
}

export interface DealerOrderItemInput {
  product_id: string
  quantity: number
  unit_price_naira?: number
}

export interface CreateDealerOrderInput {
  dealer_id: string
  requested_at: string
  notes?: string
  items: DealerOrderItemInput[]
}

export type CreateDealerOrderResult =
  | { success: true; orderId: string; dealerId: string }
  | { success: false; error: string }

export async function createDealerOrder(
  input: CreateDealerOrderInput
): Promise<CreateDealerOrderResult> {
  const db = await createClient()

  const {
    data: { user },
  } = await db.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated.' }

  const { data: adminUser } = await db
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (adminUser?.role !== 'admin') {
    return { success: false, error: 'Unauthorized — admin access required.' }
  }

  if (!input.dealer_id?.trim()) return { success: false, error: 'Dealer is required.' }
  if (!input.requested_at) return { success: false, error: 'Request date is required.' }
  if (!input.items?.length) return { success: false, error: 'At least one item is required.' }

  for (const item of input.items) {
    if (!item.product_id) {
      return { success: false, error: 'Each item must have a product selected.' }
    }
    if (!item.quantity || item.quantity < 1) {
      return { success: false, error: 'Each item must have a quantity of at least 1.' }
    }
  }

  const { data: dealer } = await db
    .from('dealers')
    .select('id')
    .eq('id', input.dealer_id)
    .eq('active', true)
    .is('deleted_at', null)
    .single()

  if (!dealer) {
    return { success: false, error: 'Selected dealer does not exist or is inactive.' }
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  })

  await client.connect()

  try {
    await client.query('BEGIN')

    const orderRes = await client.query(
      `INSERT INTO dealer_orders
         (dealer_id, status, requested_at, notes, source, source_message_id)
       VALUES ($1, 'pending', $2, $3, 'admin_entry', NULL)
       RETURNING id`,
      [
        input.dealer_id,
        input.requested_at,
        input.notes?.trim() || null,
      ]
    )

    const orderId: string = orderRes.rows[0].id

    for (const item of input.items) {
      await client.query(
        `INSERT INTO dealer_order_items
           (dealer_order_id, product_id, quantity_requested, quantity_fulfilled, unit_price_naira)
         VALUES ($1, $2, $3, 0, $4)`,
        [
          orderId,
          item.product_id,
          item.quantity,
          item.unit_price_naira ?? null,
        ]
      )
    }

    await client.query(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id, changes)
       VALUES ($1, 'dealer_order_created', 'dealer_order', $2, $3)`,
      [
        user.id,
        orderId,
        JSON.stringify({
          dealer_id: input.dealer_id,
          item_count: input.items.length,
        }),
      ]
    )

    await client.query('COMMIT')

    revalidatePath(`/dealers/${input.dealer_id}`)

    const { data: dealerInfo } = await db
      .from('dealers')
      .select('business_name')
      .eq('id', input.dealer_id)
      .single()

    notifyAllAdmins({
      eventType: 'order_created',
      title: `New order from ${dealerInfo?.business_name ?? 'dealer'}`,
      description: `${input.items.length} item(s) requested`,
      entityType: 'order',
      entityId: orderId,
    }).catch(() => {})

    return { success: true, orderId, dealerId: input.dealer_id }
  } catch (err) {
    await client.query('ROLLBACK')
    const message = err instanceof Error ? err.message : 'Unknown error occurred.'
    return { success: false, error: message }
  } finally {
    await client.end()
  }
}

// ─── Update order status ──────────────────────────────────────────────────────

export type UpdateOrderStatusResult =
  | { success: true }
  | { success: false; error: string }

export async function updateOrderStatus(
  orderId: string,
  newStatus: string,
  reason?: string
): Promise<UpdateOrderStatusResult> {
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

  if (!VALID_STATUSES.includes(newStatus as OrderStatus)) {
    return { success: false, error: `Invalid status: ${newStatus}` }
  }

  if (newStatus === 'cancelled' && !reason?.trim()) {
    return { success: false, error: 'A reason is required when cancelling an order.' }
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  })
  await client.connect()

  try {
    await client.query('BEGIN')

    const { rows } = await client.query<{ status: string }>(
      `SELECT status FROM dealer_orders WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
      [orderId]
    )

    if (!rows.length) {
      await client.query('ROLLBACK')
      return { success: false, error: 'Order not found.' }
    }

    const currentStatus = rows[0].status as OrderStatus

    if (currentStatus === newStatus) {
      await client.query('ROLLBACK')
      return {
        success: false,
        error: `Order is already ${newStatus.replace(/_/g, ' ')}.`,
      }
    }

    const allowed = LEGAL_TRANSITIONS[currentStatus] ?? []
    if (!allowed.includes(newStatus as OrderStatus)) {
      await client.query('ROLLBACK')
      return {
        success: false,
        error: `Cannot move from "${currentStatus.replace(/_/g, ' ')}" to "${newStatus.replace(/_/g, ' ')}".`,
      }
    }

    await client.query(
      `UPDATE dealer_orders SET status = $1, updated_at = now() WHERE id = $2`,
      [newStatus, orderId]
    )

    const changes: Record<string, string> = { from: currentStatus, to: newStatus }
    if (reason?.trim()) changes.reason = reason.trim()

    await client.query(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id, changes)
       VALUES ($1, 'order_status_changed', 'dealer_order', $2, $3)`,
      [user.id, orderId, JSON.stringify(changes)]
    )

    await client.query('COMMIT')

    revalidatePath(`/dealer-orders/${orderId}`)
    revalidatePath('/dealer-orders')
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
