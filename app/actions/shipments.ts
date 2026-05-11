'use server'

import { createClient } from '@/lib/supabase/server'
import { Client } from 'pg'
import { revalidatePath } from 'next/cache'
import { notifyAllAdmins } from '@/lib/notifications'

const VALID_STATUSES = ['pending', 'dispatched', 'in_transit', 'delivered', 'cancelled'] as const
type ShipmentStatus = typeof VALID_STATUSES[number]

const LEGAL_TRANSITIONS: Record<ShipmentStatus, ShipmentStatus[]> = {
  pending:    ['dispatched', 'cancelled'],
  dispatched: ['in_transit', 'cancelled'],
  in_transit: ['delivered', 'cancelled'],
  delivered:  ['in_transit'],
  cancelled:  ['pending'],
}

export type AutoFulfilledOrder = { orderId: string; newStatus: string }

export type UpdateShipmentStatusResult =
  | { success: true; ordersAutoUpdated: AutoFulfilledOrder[] }
  | { success: false; error: string }

// ─── Create shipment from dealer order ───────────────────────────────────────

export interface CreateShipmentFromOrderItemInput {
  dealer_order_item_id: string
  product_id: string
  quantity: number
  unit_price_naira?: number
}

export interface CreateShipmentFromOrderInput {
  dealer_order_id: string
  origin_warehouse_id: string
  items: CreateShipmentFromOrderItemInput[]
  expected_delivery_date?: string
  notes?: string
}

export type CreateShipmentFromOrderResult =
  | { success: true; shipmentId: string }
  | { success: false; error: string }

export async function createShipmentFromOrder(
  input: CreateShipmentFromOrderInput
): Promise<CreateShipmentFromOrderResult> {
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

  if (!input.dealer_order_id?.trim()) return { success: false, error: 'Order ID is required.' }
  if (!input.origin_warehouse_id?.trim()) return { success: false, error: 'Origin warehouse is required.' }
  if (!input.items?.length) return { success: false, error: 'At least one item is required.' }

  for (const item of input.items) {
    if (item.quantity < 1) return { success: false, error: 'All item quantities must be at least 1.' }
  }

  const { data: order } = await db
    .from('dealer_orders')
    .select('id, status, dealer_id')
    .eq('id', input.dealer_order_id)
    .is('deleted_at', null)
    .single()

  if (!order) return { success: false, error: 'Order not found.' }
  if (order.status === 'cancelled' || order.status === 'fulfilled') {
    return { success: false, error: `Cannot create shipment for an order with status "${order.status}".` }
  }

  const { data: orderItems } = await db
    .from('dealer_order_items')
    .select('id, product_id, quantity_requested, quantity_fulfilled')
    .eq('dealer_order_id', input.dealer_order_id)

  const orderItemMap = new Map<string, { product_id: string; quantity_requested: number; quantity_fulfilled: number }>(
    (orderItems ?? []).map((i: { id: string; product_id: string; quantity_requested: number; quantity_fulfilled: number }) => [i.id, i])
  )

  for (const item of input.items) {
    const doi = orderItemMap.get(item.dealer_order_item_id)
    if (!doi) {
      return { success: false, error: `Order item ${item.dealer_order_item_id} not found in this order.` }
    }
    const remaining = doi.quantity_requested - doi.quantity_fulfilled
    if (item.quantity > remaining) {
      return {
        success: false,
        error: `Requested quantity ${item.quantity} exceeds remaining ${remaining} for this item.`,
      }
    }
  }

  const { data: stockRows } = await db
    .from('warehouse_stock')
    .select('product_id, quantity')
    .eq('warehouse_id', input.origin_warehouse_id)
    .in('product_id', input.items.map((i) => i.product_id))

  const stockMap = new Map<string, number>(
    (stockRows ?? []).map((r: { product_id: string; quantity: number }) => [r.product_id, r.quantity])
  )

  for (const item of input.items) {
    const available = stockMap.get(item.product_id) ?? 0
    if (available < item.quantity) {
      return {
        success: false,
        error: `Insufficient stock: product ${item.product_id} has ${available} available but ${item.quantity} requested.`,
      }
    }
  }

  const { data: products } = await db
    .from('products')
    .select('id, sell_price_naira')
    .in('id', input.items.map((i) => i.product_id))

  const priceMap = new Map<string, number>(
    (products ?? []).map((p: { id: string; sell_price_naira: number | null }) => [
      p.id,
      p.sell_price_naira != null ? Number(p.sell_price_naira) : 0,
    ])
  )

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  })
  await client.connect()

  try {
    await client.query('BEGIN')

    const { rows: [shipmentRow] } = await client.query<{ id: string }>(
      `INSERT INTO shipments
         (shipment_type, origin_warehouse_id, destination_dealer_id,
          status, total_amount_naira, notes, created_by)
       VALUES ('dealer', $1, $2, 'pending', 0, $3, $4)
       RETURNING id`,
      [input.origin_warehouse_id, order.dealer_id, input.notes?.trim() || null, user.id]
    )
    const shipmentId = shipmentRow.id

    let totalAmount = 0
    for (const item of input.items) {
      const unitPrice = item.unit_price_naira ?? priceMap.get(item.product_id) ?? 0
      totalAmount += unitPrice * item.quantity

      await client.query(
        `INSERT INTO shipment_items
           (shipment_id, product_id, quantity, unit_price_naira, dealer_order_item_id)
         VALUES ($1, $2, $3, $4, $5)`,
        [shipmentId, item.product_id, item.quantity, unitPrice || null, item.dealer_order_item_id]
      )
    }

    await client.query(
      `UPDATE shipments SET total_amount_naira = $1 WHERE id = $2`,
      [totalAmount || null, shipmentId]
    )

    await client.query(
      `INSERT INTO status_events
         (shipment_id, from_status, to_status, event_at, recorded_by, source, notes)
       VALUES ($1, NULL, 'pending', now(), $2, 'admin', 'created_from_order')`,
      [shipmentId, user.id]
    )

    await client.query(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id, changes)
       VALUES ($1, 'shipment_created_from_order', 'shipment', $2, $3)`,
      [
        user.id,
        shipmentId,
        JSON.stringify({ dealer_order_id: input.dealer_order_id, item_count: input.items.length }),
      ]
    )

    await client.query('COMMIT')

    revalidatePath(`/dealer-orders/${input.dealer_order_id}`)
    revalidatePath('/dealer-orders')
    revalidatePath('/shipments')
    revalidatePath(`/dealers/${order.dealer_id}`)
    revalidatePath('/dashboard')

    notifyAllAdmins({
      eventType: 'shipment_dispatched',
      title: `Shipment created for order`,
      description: `${input.items.length} items · pending dispatch`,
      entityType: 'shipment',
      entityId: shipmentId,
    }).catch((err) => console.error('[notifications] broadcast failed:', err))

    return { success: true, shipmentId }
  } catch (err) {
    await client.query('ROLLBACK')
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error occurred.' }
  } finally {
    await client.end()
  }
}

// ─── Auto-fulfillment helper ──────────────────────────────────────────────────
// Runs inside an open transaction. Updates dealer_order_items.quantity_fulfilled
// for every shipment_item that is linked via dealer_order_item_id, then
// recalculates and updates the parent dealer_order status.
async function autoFulfillFromShipment(
  client: Client,
  shipmentId: string,
  userId: string
): Promise<AutoFulfilledOrder[]> {
  const { rows: linkedItems } = await client.query<{
    quantity: number
    dealer_order_item_id: string
  }>(
    `SELECT quantity, dealer_order_item_id
     FROM shipment_items
     WHERE shipment_id = $1 AND dealer_order_item_id IS NOT NULL`,
    [shipmentId]
  )

  if (!linkedItems.length) return []

  const affectedOrderIds = new Set<string>()

  for (const item of linkedItems) {
    const { rows } = await client.query<{
      dealer_order_id: string
      quantity_requested: number
      quantity_fulfilled: number
    }>(
      `SELECT dealer_order_id, quantity_requested, quantity_fulfilled
       FROM dealer_order_items WHERE id = $1 FOR UPDATE`,
      [item.dealer_order_item_id]
    )
    if (!rows.length) continue

    const doi = rows[0]
    const capped = Math.min(doi.quantity_fulfilled + item.quantity, doi.quantity_requested)

    await client.query(
      `UPDATE dealer_order_items SET quantity_fulfilled = $1 WHERE id = $2`,
      [capped, item.dealer_order_item_id]
    )
    affectedOrderIds.add(doi.dealer_order_id)
  }

  const autoUpdated: AutoFulfilledOrder[] = []

  for (const orderId of affectedOrderIds) {
    const { rows: [orderRow] } = await client.query<{ status: string }>(
      `SELECT status FROM dealer_orders WHERE id = $1 FOR UPDATE`,
      [orderId]
    )
    if (!orderRow) continue

    const currentStatus = orderRow.status

    const { rows: [totals] } = await client.query<{
      total_requested: string
      total_fulfilled: string
    }>(
      `SELECT SUM(quantity_requested) AS total_requested,
              SUM(quantity_fulfilled)  AS total_fulfilled
       FROM dealer_order_items WHERE dealer_order_id = $1`,
      [orderId]
    )

    const totalRequested = Number(totals?.total_requested ?? 0)
    const totalFulfilled = Number(totals?.total_fulfilled ?? 0)

    const newStatus =
      totalFulfilled >= totalRequested && totalRequested > 0
        ? 'fulfilled'
        : totalFulfilled > 0
        ? 'partially_fulfilled'
        : 'pending'

    if (newStatus === currentStatus) continue

    await client.query(
      `UPDATE dealer_orders SET status = $1, updated_at = now() WHERE id = $2`,
      [newStatus, orderId]
    )

    await client.query(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id, changes)
       VALUES ($1, 'order_auto_fulfilled', 'dealer_order', $2, $3)`,
      [
        userId,
        orderId,
        JSON.stringify({ from: currentStatus, to: newStatus, triggered_by_shipment_id: shipmentId }),
      ]
    )

    autoUpdated.push({ orderId, newStatus })
  }

  return autoUpdated
}

// ─── Public action ────────────────────────────────────────────────────────────

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

    // Auto-fulfill linked dealer orders when shipment is delivered
    const ordersAutoUpdated =
      newStatus === 'delivered'
        ? await autoFulfillFromShipment(client, shipmentId, user.id)
        : []

    const { rows: [shipmentInfo] } = await client.query<{ destination_dealer_id: string | null }>(
      `SELECT destination_dealer_id FROM shipments WHERE id = $1`,
      [shipmentId]
    )

    await client.query('COMMIT')

    revalidatePath(`/shipments/${shipmentId}`)
    revalidatePath('/shipments')
    revalidatePath('/dashboard')
    revalidatePath('/dealer-orders')
    for (const o of ordersAutoUpdated) {
      revalidatePath(`/dealer-orders/${o.orderId}`)
    }

    if (newStatus === 'delivered') {
      notifyAllAdmins({
        eventType: 'shipment_delivered',
        title: 'Shipment delivered',
        description: ordersAutoUpdated.length > 0
          ? `${ordersAutoUpdated.length} order(s) auto-fulfilled`
          : undefined,
        entityType: 'shipment',
        entityId: shipmentId,
      }).catch((err) => console.error('[notifications] broadcast failed:', err))
    } else if (newStatus === 'dispatched') {
      notifyAllAdmins({
        eventType: 'shipment_dispatched',
        title: 'Shipment dispatched',
        entityType: 'shipment',
        entityId: shipmentId,
      }).catch((err) => console.error('[notifications] broadcast failed:', err))
    }

    return { success: true, ordersAutoUpdated }
  } catch (err) {
    await client.query('ROLLBACK')
    const message = err instanceof Error ? err.message : 'Unknown error occurred.'
    return { success: false, error: message }
  } finally {
    await client.end()
  }
}
