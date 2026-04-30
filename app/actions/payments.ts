'use server'

import { createClient } from '@/lib/supabase/server'
import { Client } from 'pg'
import { revalidatePath } from 'next/cache'

const VALID_METHODS = ['bank_transfer', 'cash', 'pos'] as const
type PaymentMethod = typeof VALID_METHODS[number]

export interface CreatePaymentInput {
  dealer_id: string
  amount_naira: number
  payment_date: string
  payment_method: PaymentMethod
  payment_reference?: string
  shipment_id?: string
  notes?: string
}

export type CreatePaymentResult =
  | { success: true; paymentId: string }
  | { success: false; error: string }

export async function createPayment(
  input: CreatePaymentInput
): Promise<CreatePaymentResult> {
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
  if (!input.amount_naira || input.amount_naira <= 0) {
    return { success: false, error: 'Amount must be greater than zero.' }
  }
  if (!input.payment_date) return { success: false, error: 'Payment date is required.' }
  if (!VALID_METHODS.includes(input.payment_method)) {
    return { success: false, error: 'Invalid payment method.' }
  }

  // Validate dealer exists
  const { data: dealer } = await db
    .from('dealers')
    .select('id')
    .eq('id', input.dealer_id)
    .eq('active', true)
    .is('deleted_at', null)
    .single()

  if (!dealer) return { success: false, error: 'Dealer not found or inactive.' }

  // If shipment_id provided, validate it belongs to this dealer
  if (input.shipment_id) {
    const { data: shipment } = await db
      .from('shipments')
      .select('id')
      .eq('id', input.shipment_id)
      .eq('destination_dealer_id', input.dealer_id)
      .is('deleted_at', null)
      .single()

    if (!shipment) {
      return { success: false, error: 'Shipment not found or does not belong to this dealer.' }
    }
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  })
  await client.connect()

  try {
    await client.query('BEGIN')

    const paymentRes = await client.query<{ id: string }>(
      `INSERT INTO payments
         (dealer_id, shipment_id, amount_naira, payment_date, payment_reference,
          payment_method, source, recorded_by, notes)
       VALUES ($1, $2, $3, $4, $5, $6, 'admin_manual', $7, $8)
       RETURNING id`,
      [
        input.dealer_id,
        input.shipment_id ?? null,
        input.amount_naira,
        input.payment_date,
        input.payment_reference?.trim() || null,
        input.payment_method,
        user.id,
        input.notes?.trim() || null,
      ]
    )

    const paymentId: string = paymentRes.rows[0].id

    if (input.shipment_id) {
      await client.query(
        `UPDATE shipments
         SET amount_paid_naira = amount_paid_naira + $1, updated_at = now()
         WHERE id = $2`,
        [input.amount_naira, input.shipment_id]
      )
    }

    await client.query(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id, changes)
       VALUES ($1, 'payment_created', 'payment', $2, $3)`,
      [
        user.id,
        paymentId,
        JSON.stringify({
          dealer_id: input.dealer_id,
          amount_naira: input.amount_naira,
          shipment_id: input.shipment_id ?? null,
        }),
      ]
    )

    await client.query('COMMIT')

    revalidatePath('/payments')
    revalidatePath('/dashboard')
    revalidatePath(`/dealers/${input.dealer_id}`)
    if (input.shipment_id) {
      revalidatePath(`/shipments/${input.shipment_id}`)
    }

    return { success: true, paymentId }
  } catch (err) {
    await client.query('ROLLBACK')
    const message = err instanceof Error ? err.message : 'Unknown error occurred.'
    return { success: false, error: message }
  } finally {
    await client.end()
  }
}
