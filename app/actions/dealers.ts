'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

const VALID_LANGUAGES = ['en', 'ha', 'yo', 'ig'] as const

export interface CreateDealerInput {
  business_name: string
  contact_name: string
  phone: string
  phone_secondary: string
  email: string
  city: string
  state: string
  preferred_language: string
  served_by_warehouse_id: string
  credit_limit_naira: number | null
  notes: string
}

export type CreateDealerResult =
  | { success: true; dealerId: string }
  | { success: false; error: string }

export async function createDealer(input: CreateDealerInput): Promise<CreateDealerResult> {
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

  // Server-side validation (client already validates, this is a safety net)
  const { business_name, contact_name, phone, city, state, preferred_language, served_by_warehouse_id } = input

  if (!business_name?.trim()) return { success: false, error: 'Business name is required.' }
  if (!contact_name?.trim()) return { success: false, error: 'Contact name is required.' }
  if (!phone?.trim()) return { success: false, error: 'Phone number is required.' }
  if (!city?.trim()) return { success: false, error: 'City is required.' }
  if (!state?.trim()) return { success: false, error: 'State is required.' }
  if (!VALID_LANGUAGES.includes(preferred_language as typeof VALID_LANGUAGES[number])) {
    return { success: false, error: 'Invalid language selection.' }
  }
  if (!served_by_warehouse_id?.trim()) {
    return { success: false, error: 'Serving warehouse is required.' }
  }

  // Validate warehouse exists
  const { data: warehouse } = await db
    .from('warehouses')
    .select('id')
    .eq('id', served_by_warehouse_id)
    .eq('active', true)
    .single()

  if (!warehouse) return { success: false, error: 'Selected warehouse does not exist.' }

  // Insert dealer
  const { data: newDealer, error: insertError } = await db
    .from('dealers')
    .insert({
      business_name: business_name.trim(),
      contact_name: contact_name.trim(),
      phone: phone.trim(),
      phone_secondary: input.phone_secondary?.trim() || null,
      email: input.email?.trim() || null,
      city: city.trim(),
      state: state.trim(),
      preferred_language,
      served_by_warehouse_id,
      credit_limit_naira: input.credit_limit_naira,
      notes: input.notes?.trim() || null,
      active: true,
    })
    .select('id')
    .single()

  if (insertError) {
    return { success: false, error: insertError.message }
  }

  // Audit log
  await db.from('audit_log').insert({
    user_id: user.id,
    action: 'dealer_created',
    entity_type: 'dealer',
    entity_id: newDealer.id,
    changes: { business_name: business_name.trim(), city: city.trim(), state: state.trim() },
  })

  revalidatePath('/dealers')
  return { success: true, dealerId: newDealer.id }
}
