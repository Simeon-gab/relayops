import type { createClient } from '@/lib/supabase/server'

/**
 * Roles in RelayOps.
 *
 *   md       — the MD. Approvals and overview. Lands on a deliberately small screen.
 *   manager  — full access. The people running the business day to day.
 *   partner  — the business partner in China. Owns the physical chain (containers,
 *              allocation, dispatch, tracking). Sees no pricing, payments, or receipts.
 *   dealer   — external. The dealer portal only.
 *
 * 'admin' was the previous catch-all and became 'manager' in migration 0015.
 */
export type StaffRole = 'md' | 'manager' | 'partner'
export type UserRole = StaffRole | 'dealer'

export const STAFF_ROLES: readonly StaffRole[] = ['md', 'manager', 'partner'] as const

/** Roles allowed to see naira figures — prices, payments, receipts, credit limits. */
export const FINANCE_ROLES: readonly StaffRole[] = ['md', 'manager'] as const

export function isStaff(role: string | null | undefined): role is StaffRole {
  return role === 'md' || role === 'manager' || role === 'partner'
}

export function isFinance(role: string | null | undefined): boolean {
  return role === 'md' || role === 'manager'
}

/**
 * Capabilities, so permission questions are asked in business terms rather
 * than by comparing role strings at each call site.
 *
 * The partner deliberately keeps allocation and dispatch — that is his job —
 * while everything money-shaped stays with md/manager.
 */
export const CAPABILITIES = {
  allocate_container:  ['md', 'manager', 'partner'],
  manage_containers:   ['md', 'manager', 'partner'],
  manage_shipments:    ['md', 'manager', 'partner'],
  manage_orders:       ['md', 'manager'],
  manage_dealers:      ['md', 'manager'],
  manage_products:     ['md', 'manager'],
  record_payments:     ['md', 'manager'],
  review_receipts:     ['md', 'manager'],
  handle_messages:     ['md', 'manager'],
  run_queries:         ['md', 'manager', 'partner'],
  approve_proposals:   ['md', 'manager', 'partner'],
} as const satisfies Record<string, readonly StaffRole[]>

export type Capability = keyof typeof CAPABILITIES

export function can(role: string | null | undefined, capability: Capability): boolean {
  if (!isStaff(role)) return false
  return (CAPABILITIES[capability] as readonly string[]).includes(role)
}

export interface StaffUser {
  id: string
  role: StaffRole
  display_name: string | null
}

type Supabase = Awaited<ReturnType<typeof createClient>>

/**
 * Resolve the signed-in staff user, or null if there isn't one.
 *
 * Takes the caller's existing client rather than making its own — server
 * actions already build one to read auth state.
 */
export async function getStaffUser(db: Supabase): Promise<StaffUser | null> {
  const {
    data: { user },
  } = await db.auth.getUser()
  if (!user) return null

  const { data: profile } = await db
    .from('users')
    .select('role, display_name')
    .eq('id', user.id)
    .single()

  if (!isStaff(profile?.role)) return null

  return {
    id: user.id,
    role: profile.role,
    display_name: profile.display_name ?? null,
  }
}

/**
 * Same, but also checks a capability. Server actions use this in place of the
 * old `if (adminUser?.role !== 'admin')` guard.
 */
export async function getStaffUserWith(
  db: Supabase,
  capability: Capability
): Promise<StaffUser | null> {
  const staff = await getStaffUser(db)
  if (!staff) return null
  return can(staff.role, capability) ? staff : null
}
