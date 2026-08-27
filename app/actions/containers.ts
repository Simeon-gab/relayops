'use server'

import { can } from '@/lib/auth/roles'
import { createClient } from '@/lib/supabase/server'
import { Client } from 'pg'
import { revalidatePath } from 'next/cache'
import { callClaudeText } from '@/lib/ai/client'
import { getAllocationSystemPrompt, getAllocationUserPrompt } from '@/lib/ai/prompts/allocation-suggestion'
import { notifyAllAdmins } from '@/lib/notifications'
import { emitAllocationProposal } from '@/lib/agents/emit'
import { logAgentRun } from '@/lib/db/ai-proposals'

const LAGOS_WAREHOUSE_ID = '00000000-0000-0000-0001-000000000001'
const KANO_WAREHOUSE_ID = '00000000-0000-0000-0001-000000000002'

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

  if (!can(adminUser?.role, 'manage_containers')) {
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

    const totalItems = input.items.reduce((s, i) => s + i.quantity, 0)
    const skuCount = input.items.length
    notifyAllAdmins({
      eventType: 'allocation_pending',
      title: `New container ${input.container_number.trim()} arrived`,
      description: `${totalItems} units across ${skuCount} SKU(s) awaiting allocation`,
      entityType: 'container',
      entityId: containerId,
    }).catch((err) => console.error('[notifications] broadcast failed:', err))

    // Plan the split now rather than waiting for someone to ask for it. The
    // proposal lands on the partner's dashboard; nothing moves until he
    // approves it. Best-effort — the container is already committed.
    await planAllocationInBackground(containerId, input.container_number.trim(), totalItems)

    return { success: true, containerId }
  } catch (err) {
    await client.query('ROLLBACK')
    const message = err instanceof Error ? err.message : 'Unknown error occurred.'
    return { success: false, error: message }
  } finally {
    await client.end()
  }
}

/**
 * Ask the allocation model for a plan as soon as a container is recorded, and
 * file the answer as a proposal. Swallows its own errors: a failed suggestion
 * must never roll back a container that has already landed.
 */
async function planAllocationInBackground(
  containerId: string,
  containerNumber: string,
  totalUnits: number
): Promise<void> {
  const startedAt = Date.now()
  try {
    const result = await suggestContainerAllocation(containerId)
    if (!result.success) {
      await logAgentRun({
        agent: 'suggest_allocation',
        trigger: 'event',
        subject_type: 'container',
        subject_id: containerId,
        ok: false,
        duration_ms: Date.now() - startedAt,
        error: result.error,
      })
      return
    }

    const { suggestion } = result
    await emitAllocationProposal({
      containerId,
      containerNumber,
      totalUnits,
      dealersServed: suggestion.dealer_allocations.length,
      kanoUnits: suggestion.kano_transfer.reduce((sum, t) => sum + t.quantity, 0),
      confidence: suggestion.confidence ?? null,
      suggestion: suggestion as unknown as Record<string, unknown>,
      startedAt,
    })
  } catch (err) {
    console.error('[agent] allocation planning failed:', err instanceof Error ? err.message : err)
    await logAgentRun({
      agent: 'suggest_allocation',
      trigger: 'event',
      subject_type: 'container',
      subject_id: containerId,
      ok: false,
      duration_ms: Date.now() - startedAt,
      error: err instanceof Error ? err.message : 'unknown',
    })
  }
}

// ─── suggestContainerAllocation ───────────────────────────────────────────────

export interface AllocSuggestedItem {
  product_id: string
  sku_code: string
  display_name: string
  quantity_allocated: number
}

export interface AllocSuggestedDealer {
  order_id: string
  dealer_id: string
  dealer_name: string
  dealer_city: string
  dealer_state: string
  preferred_language: string
  served_via: 'LAGOS' | 'KANO'
  items: AllocSuggestedItem[]
  reasoning: string
}

export interface AllocTransferItem {
  product_id: string
  sku_code: string
  display_name: string
  quantity: number
  reasoning: string
}

export interface AllocRemainingItem {
  sku_code: string
  display_name: string
  quantity: number
  purpose: 'lagos_buffer' | 'unallocated'
}

export interface AllocationSuggestion {
  dealer_allocations: AllocSuggestedDealer[]
  kano_transfer: AllocTransferItem[]
  remaining_in_lagos: AllocRemainingItem[]
  overall_reasoning: string
  confidence: number
  caveats: string[]
}

export type SuggestAllocationResult =
  | { success: true; suggestion: AllocationSuggestion }
  | { success: false; error: string }

export async function suggestContainerAllocation(
  containerId: string
): Promise<SuggestAllocationResult> {
  const db = await createClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated.' }
  const { data: adminUser } = await db.from('users').select('role').eq('id', user.id).single()
  if (!can(adminUser?.role, 'allocate_container')) return { success: false, error: 'Unauthorized.' }

  // 1. Load container + items
  const { data: container } = await db
    .from('containers')
    .select('id, container_number, status')
    .eq('id', containerId)
    .single()

  if (!container) return { success: false, error: 'Container not found.' }

  type ContainerRow = { id: string; container_number: string; status: string }
  const cont = container as unknown as ContainerRow

  if (cont.status === 'allocated') return { success: false, error: 'Container is already allocated.' }

  const { data: rawItems } = await db
    .from('container_items')
    .select('product_id, quantity, products(sku_code, display_name)')
    .eq('container_id', containerId)

  type ContItemRow = { product_id: string; quantity: number; products: { sku_code: string; display_name: string } | null }
  const containerItems = ((rawItems ?? []) as unknown as ContItemRow[])
  const containerSkuIds = containerItems.map((i) => i.product_id)

  if (containerItems.length === 0) return { success: false, error: 'Container has no items.' }

  // 2. Load pending orders for SKUs in this container
  const { data: rawOrders } = await db
    .from('dealer_orders')
    .select('id, dealer_id, dealers(business_name, city, state, preferred_language), dealer_order_items(product_id, quantity_requested, quantity_fulfilled, products(sku_code, display_name))')
    .eq('status', 'pending')
    .is('deleted_at', null)

  type OrderRow = {
    id: string
    dealer_id: string
    dealers: { business_name: string; city: string; state: string; preferred_language: string } | null
    dealer_order_items: Array<{
      product_id: string
      quantity_requested: number
      quantity_fulfilled: number
      products: { sku_code: string; display_name: string } | null
    }>
  }

  // Build the dealer_id → order metadata map for execute
  const orderMeta: Record<string, { dealer_id: string; dealer_city: string; dealer_state: string; preferred_language: string; dealer_name: string }> = {}

  type PendingOrderItem = { order_id: string; dealer_name: string; dealer_city: string; dealer_state: string; items: Array<{ sku_code: string; display_name: string; quantity_remaining: number }> }

  const pendingOrders: PendingOrderItem[] = ((rawOrders ?? []) as unknown as OrderRow[])
    .flatMap((o) => {
      const relevantItems = o.dealer_order_items.filter(
        (i) => containerSkuIds.includes(i.product_id) && i.quantity_requested > i.quantity_fulfilled
      )
      if (relevantItems.length === 0) return []
      orderMeta[o.id] = {
        dealer_id: o.dealer_id,
        dealer_name: o.dealers?.business_name ?? '—',
        dealer_city: o.dealers?.city ?? '',
        dealer_state: o.dealers?.state ?? '',
        preferred_language: o.dealers?.preferred_language ?? 'en',
      }
      return [{
        order_id: o.id,
        dealer_name: o.dealers?.business_name ?? '—',
        dealer_city: o.dealers?.city ?? '',
        dealer_state: o.dealers?.state ?? '',
        items: relevantItems.map((i) => ({
          sku_code: i.products?.sku_code ?? '',
          display_name: i.products?.display_name ?? '',
          quantity_remaining: i.quantity_requested - i.quantity_fulfilled,
        })),
      }]
    })

  // 3. Load current warehouse stock for container SKUs
  const { data: rawStock } = await db
    .from('warehouse_stock')
    .select('warehouse_id, product_id, quantity, warehouses(code), products(sku_code, display_name)')
    .in('product_id', containerSkuIds)

  type StockRow = { warehouse_id: string; product_id: string; quantity: number; warehouses: { code: string } | null; products: { sku_code: string; display_name: string } | null }

  const warehouseStock = ((rawStock ?? []) as unknown as StockRow[])
    .filter((s) => s.warehouses?.code === 'LAGOS' || s.warehouses?.code === 'KANO')
    .map((s) => ({
      warehouse: s.warehouses!.code as 'LAGOS' | 'KANO',
      sku_code: s.products?.sku_code ?? '',
      display_name: s.products?.display_name ?? '',
      current_quantity: s.quantity,
    }))

  // Build sku_code → product_id map
  const skuToProductId: Record<string, string> = {}
  const skuToDisplayName: Record<string, string> = {}
  for (const item of containerItems) {
    if (item.products) {
      skuToProductId[item.products.sku_code] = item.product_id
      skuToDisplayName[item.products.sku_code] = item.products.display_name
    }
  }

  // 4. Call Claude
  const systemPrompt = getAllocationSystemPrompt()
  const userPrompt = getAllocationUserPrompt({
    containerNumber: cont.container_number,
    containerItems: containerItems.map((i) => ({
      sku_code: i.products?.sku_code ?? '',
      display_name: i.products?.display_name ?? '',
      quantity: i.quantity,
    })),
    pendingOrders,
    warehouseStock,
  })

  let rawText: string
  try {
    rawText = await callClaudeText(systemPrompt, userPrompt)
  } catch (err) {
    return { success: false, error: `Claude API error: ${err instanceof Error ? err.message : String(err)}` }
  }

  let parsed: Record<string, unknown>
  try {
    const jsonText = rawText.trim().replace(/^```json\s*/i, '').replace(/\s*```$/, '')
    parsed = JSON.parse(jsonText)
  } catch {
    return { success: false, error: 'Claude returned invalid JSON.' }
  }

  // 5. Hydrate suggestion with product_ids and dealer metadata
  type RawAlloc = { order_id: string; dealer_name: string; dealer_city: string; served_via: string; items: Array<{ sku_code: string; quantity_allocated: number }>; reasoning: string }
  type RawTransfer = { sku_code: string; quantity: number; reasoning: string }
  type RawRemaining = { sku_code: string; quantity: number; purpose: string }

  const rawAllocations = ((parsed.suggested_allocations ?? []) as unknown as RawAlloc[])
  const rawTransfer = ((parsed.kano_transfer ?? []) as unknown as RawTransfer[])
  const rawRemaining = ((parsed.remaining_in_lagos ?? []) as unknown as RawRemaining[])

  const suggestion: AllocationSuggestion = {
    dealer_allocations: rawAllocations.map((a) => ({
      order_id: a.order_id,
      dealer_id: orderMeta[a.order_id]?.dealer_id ?? '',
      dealer_name: a.dealer_name,
      dealer_city: a.dealer_city,
      dealer_state: orderMeta[a.order_id]?.dealer_state ?? '',
      preferred_language: orderMeta[a.order_id]?.preferred_language ?? 'en',
      served_via: a.served_via === 'KANO' ? 'KANO' : 'LAGOS',
      items: a.items.map((i) => ({
        product_id: skuToProductId[i.sku_code] ?? '',
        sku_code: i.sku_code,
        display_name: skuToDisplayName[i.sku_code] ?? i.sku_code,
        quantity_allocated: i.quantity_allocated,
      })),
      reasoning: a.reasoning ?? '',
    })),
    kano_transfer: rawTransfer.map((t) => ({
      product_id: skuToProductId[t.sku_code] ?? '',
      sku_code: t.sku_code,
      display_name: skuToDisplayName[t.sku_code] ?? t.sku_code,
      quantity: t.quantity,
      reasoning: t.reasoning ?? '',
    })),
    remaining_in_lagos: rawRemaining.map((r) => ({
      sku_code: r.sku_code,
      display_name: skuToDisplayName[r.sku_code] ?? r.sku_code,
      quantity: r.quantity,
      purpose: (r.purpose === 'unallocated' ? 'unallocated' : 'lagos_buffer') as 'lagos_buffer' | 'unallocated',
    })),
    overall_reasoning: (parsed.overall_reasoning as string) ?? '',
    confidence: (parsed.confidence as number) ?? 0,
    caveats: ((parsed.caveats as string[]) ?? []),
  }

  return { success: true, suggestion }
}

// ─── executeAllocation ────────────────────────────────────────────────────────

export interface ExecuteDealerAllocation {
  order_id: string
  dealer_id: string
  served_via: 'LAGOS' | 'KANO'
  items: Array<{ product_id: string; sku_code: string; quantity: number }>
}

export interface ExecuteAllocationInput {
  container_id: string
  dealer_allocations: ExecuteDealerAllocation[]
  kano_transfer: Array<{ product_id: string; sku_code: string; quantity: number }>
}

export type ExecuteAllocationResult =
  | { success: true; shipmentCount: number }
  | { success: false; error: string }

export async function executeAllocation(input: ExecuteAllocationInput): Promise<ExecuteAllocationResult> {
  const db = await createClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated.' }
  const { data: adminUser } = await db.from('users').select('role').eq('id', user.id).single()
  if (!can(adminUser?.role, 'allocate_container')) return { success: false, error: 'Unauthorized.' }

  if (!input.dealer_allocations.length && !input.kano_transfer.length) {
    return { success: false, error: 'No allocations specified.' }
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  await client.connect()

  let shipmentCount = 0

  try {
    await client.query('BEGIN')

    // 1. Get dealer info for each allocation
    const dealerIds = [...new Set(input.dealer_allocations.map((a) => a.dealer_id))]
    const dealerRes = await client.query(
      `SELECT id, city, state FROM dealers WHERE id = ANY($1::uuid[])`,
      [dealerIds]
    )
    const dealerInfo: Record<string, { city: string; state: string }> = {}
    for (const row of dealerRes.rows) {
      dealerInfo[row.id] = { city: row.city, state: row.state }
    }

    // 2. Create dealer shipments
    for (const alloc of input.dealer_allocations) {
      if (!alloc.items.length) continue
      const originId = alloc.served_via === 'KANO' ? KANO_WAREHOUSE_ID : LAGOS_WAREHOUSE_ID
      const info = dealerInfo[alloc.dealer_id]

      const shipRes = await client.query(
        `INSERT INTO shipments (shipment_type, origin_warehouse_id, destination_dealer_id, destination_city, destination_state, status, created_by)
         VALUES ('dealer', $1, $2, $3, $4, 'pending', $5) RETURNING id`,
        [originId, alloc.dealer_id, info?.city ?? null, info?.state ?? null, user.id]
      )
      const shipmentId: string = shipRes.rows[0].id
      shipmentCount++

      for (const item of alloc.items) {
        if (item.quantity <= 0) continue
        await client.query(
          `INSERT INTO shipment_items (shipment_id, product_id, quantity) VALUES ($1, $2, $3)`,
          [shipmentId, item.product_id, item.quantity]
        )
      }

      // Update dealer_order_items.quantity_fulfilled for this order
      for (const item of alloc.items) {
        await client.query(
          `UPDATE dealer_order_items SET quantity_fulfilled = LEAST(quantity_requested, quantity_fulfilled + $1)
           WHERE dealer_order_id = $2 AND product_id = $3`,
          [item.quantity, alloc.order_id, item.product_id]
        )
      }

      await client.query(
        `INSERT INTO audit_log (user_id, action, entity_type, entity_id, changes)
         VALUES ($1, 'shipment_created_from_allocation', 'shipment', $2, $3)`,
        [user.id, shipmentId, JSON.stringify({ container_id: input.container_id, dealer_id: alloc.dealer_id })]
      )
    }

    // 3. Create Kano transfer shipment if needed
    const kanoItems = input.kano_transfer.filter((t) => t.quantity > 0)
    if (kanoItems.length > 0) {
      const transferRes = await client.query(
        `INSERT INTO shipments (shipment_type, origin_warehouse_id, destination_warehouse_id, status, created_by)
         VALUES ('transfer', $1, $2, 'pending', $3) RETURNING id`,
        [LAGOS_WAREHOUSE_ID, KANO_WAREHOUSE_ID, user.id]
      )
      const transferId: string = transferRes.rows[0].id
      shipmentCount++

      for (const item of kanoItems) {
        await client.query(
          `INSERT INTO shipment_items (shipment_id, product_id, quantity) VALUES ($1, $2, $3)`,
          [transferId, item.product_id, item.quantity]
        )
      }

      await client.query(
        `INSERT INTO audit_log (user_id, action, entity_type, entity_id, changes)
         VALUES ($1, 'transfer_created_from_allocation', 'shipment', $2, $3)`,
        [user.id, transferId, JSON.stringify({ container_id: input.container_id, destination: 'KANO' })]
      )
    }

    // 4. Update warehouse_stock
    // Decrease Lagos for dealer dispatch allocations ('shipment_dispatch')
    const lagosDispatch: Record<string, number> = {}
    for (const alloc of input.dealer_allocations) {
      for (const item of alloc.items) {
        lagosDispatch[item.product_id] = (lagosDispatch[item.product_id] ?? 0) + item.quantity
      }
    }

    for (const [productId, qty] of Object.entries(lagosDispatch)) {
      if (qty <= 0) continue
      await client.query(
        `UPDATE warehouse_stock SET quantity = GREATEST(0, quantity - $1), updated_at = NOW()
         WHERE warehouse_id = $2 AND product_id = $3`,
        [qty, LAGOS_WAREHOUSE_ID, productId]
      )
      await client.query(
        `INSERT INTO stock_movements (warehouse_id, product_id, change_type, quantity_delta, reference_type, reference_id, created_by)
         VALUES ($1, $2, 'shipment_dispatch', $3, 'container', $4, $5)`,
        [LAGOS_WAREHOUSE_ID, productId, -qty, input.container_id, user.id]
      )
    }

    // Decrease Lagos for Kano transfer ('transfer_out') + Increase Kano ('transfer_in')
    for (const item of kanoItems) {
      await client.query(
        `UPDATE warehouse_stock SET quantity = GREATEST(0, quantity - $1), updated_at = NOW()
         WHERE warehouse_id = $2 AND product_id = $3`,
        [item.quantity, LAGOS_WAREHOUSE_ID, item.product_id]
      )
      await client.query(
        `INSERT INTO stock_movements (warehouse_id, product_id, change_type, quantity_delta, reference_type, reference_id, created_by)
         VALUES ($1, $2, 'transfer_out', $3, 'container', $4, $5)`,
        [LAGOS_WAREHOUSE_ID, item.product_id, -item.quantity, input.container_id, user.id]
      )
      await client.query(
        `INSERT INTO warehouse_stock (warehouse_id, product_id, quantity, updated_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (warehouse_id, product_id)
         DO UPDATE SET quantity = warehouse_stock.quantity + $3, updated_at = NOW()`,
        [KANO_WAREHOUSE_ID, item.product_id, item.quantity]
      )
      await client.query(
        `INSERT INTO stock_movements (warehouse_id, product_id, change_type, quantity_delta, reference_type, reference_id, created_by)
         VALUES ($1, $2, 'transfer_in', $3, 'container', $4, $5)`,
        [KANO_WAREHOUSE_ID, item.product_id, item.quantity, input.container_id, user.id]
      )
    }

    // 5. Mark container as allocated
    await client.query(
      `UPDATE containers SET status = 'allocated', updated_at = NOW() WHERE id = $1`,
      [input.container_id]
    )

    await client.query(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id, changes)
       VALUES ($1, 'container_allocated', 'container', $2, $3)`,
      [user.id, input.container_id, JSON.stringify({ shipment_count: shipmentCount })]
    )

    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    return { success: false, error: err instanceof Error ? err.message : 'Database error.' }
  } finally {
    await client.end()
  }

  revalidatePath(`/containers/${input.container_id}`)
  revalidatePath('/containers')
  revalidatePath('/shipments')
  revalidatePath('/dashboard')

  return { success: true, shipmentCount }
}
