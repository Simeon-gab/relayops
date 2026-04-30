'use server'

import { createClient } from '@/lib/supabase/server'
import { Client } from 'pg'
import { revalidatePath } from 'next/cache'

const LAGOS_WAREHOUSE_ID = '00000000-0000-0000-0001-000000000001'

export interface ContainerItemInput {
  product_id: string
  quantity: number
}

export interface CreateContainerInput {
  container_number: string
  arrived_at: string
  notes: string
  bill_of_lading: string
  shipping_line: string
  expected_arrival_date: string
  origin_port: string
  items: ContainerItemInput[]
}

export type CreateContainerResult =
  | { success: true; containerId: string }
  | { success: false; error: string }

export async function createContainer(
  input: CreateContainerInput
): Promise<CreateContainerResult> {
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

  if (!input.container_number?.trim()) {
    return { success: false, error: 'Container number is required.' }
  }
  if (!input.arrived_at) {
    return { success: false, error: 'Arrival date is required.' }
  }
  if (!input.items?.length) {
    return { success: false, error: 'At least one item is required.' }
  }
  for (const item of input.items) {
    if (!item.product_id) {
      return { success: false, error: 'Each item must have a product selected.' }
    }
    if (!item.quantity || item.quantity < 1) {
      return { success: false, error: 'Each item must have a quantity of at least 1.' }
    }
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  })

  await client.connect()

  try {
    await client.query('BEGIN')

    const containerRes = await client.query(
      `INSERT INTO containers
         (container_number, arrived_at, recorded_by, status, notes, bill_of_lading, shipping_line, expected_arrival_date, origin_port)
       VALUES ($1, $2, $3, 'pending_allocation', $4, $5, $6, $7, $8)
       RETURNING id`,
      [
        input.container_number.trim(),
        input.arrived_at,
        user.id,
        input.notes?.trim() || null,
        input.bill_of_lading?.trim() || null,
        input.shipping_line?.trim() || null,
        input.expected_arrival_date?.trim() || null,
        input.origin_port?.trim() || null,
      ]
    )

    const containerId: string = containerRes.rows[0].id

    for (const item of input.items) {
      await client.query(
        `INSERT INTO container_items (container_id, product_id, quantity)
         VALUES ($1, $2, $3)`,
        [containerId, item.product_id, item.quantity]
      )

      await client.query(
        `INSERT INTO stock_movements
           (warehouse_id, product_id, change_type, quantity_delta, reference_type, reference_id, created_by)
         VALUES ($1, $2, 'container_arrival', $3, 'container', $4, $5)`,
        [LAGOS_WAREHOUSE_ID, item.product_id, item.quantity, containerId, user.id]
      )

      await client.query(
        `INSERT INTO warehouse_stock (warehouse_id, product_id, quantity, updated_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (warehouse_id, product_id)
         DO UPDATE SET quantity = warehouse_stock.quantity + $3, updated_at = NOW()`,
        [LAGOS_WAREHOUSE_ID, item.product_id, item.quantity]
      )
    }

    await client.query(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id, changes)
       VALUES ($1, 'container_recorded', 'container', $2, $3)`,
      [
        user.id,
        containerId,
        JSON.stringify({
          container_number: input.container_number.trim(),
          item_count: input.items.length,
        }),
      ]
    )

    await client.query('COMMIT')

    revalidatePath('/containers')

    return { success: true, containerId }
  } catch (err) {
    await client.query('ROLLBACK')
    const message = err instanceof Error ? err.message : 'Unknown error occurred.'
    return { success: false, error: message }
  } finally {
    await client.end()
  }
}
