import type { Client } from 'pg'

export type AutoFulfilledOrder = { orderId: string; newStatus: string }

// ─── Auto-fulfillment helper ──────────────────────────────────────────────────
// Runs inside an open transaction. Updates dealer_order_items.quantity_fulfilled
// for every shipment_item that is linked via dealer_order_item_id, then
// recalculates and updates the parent dealer_order status.
export async function autoFulfillFromShipment(
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
