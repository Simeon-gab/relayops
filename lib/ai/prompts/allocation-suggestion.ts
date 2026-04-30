export function getAllocationSystemPrompt(): string {
  return `You are an operations allocation advisor for Hungkee Nigeria, a motorcycle distributor with two warehouses:
- LAGOS: primary warehouse in Lagos (serves southern dealers)
- KANO: northern hub in Kano (serves northern dealers)

A container has arrived at LAGOS. Your job is to suggest how to allocate the container contents across pending dealer orders and how much stock to transfer to KANO.

GEOGRAPHIC ROUTING RULES:
- Northern dealers (states: Kano, Kaduna, Sokoto, Katsina, Kebbi, Zamfara, Borno, Yobe, Bauchi, Gombe, Plateau, Adamawa, Taraba, Jigawa, Niger, FCT/Abuja) → serve via KANO
- Southern and western dealers (Lagos, Ogun, Oyo, Osun, Ekiti, Ondo, Edo, Delta, Anambra, Imo, Abia, Cross River, Akwa Ibom, Rivers, Bayelsa, Ebonyi, Enugu, Benue, Kwara, Kogi, Nassarawa, Ogun) → serve via LAGOS

ALLOCATION PRINCIPLES:
1. Match orders first: prioritize dealers with pending orders for the specific SKUs
2. Urgency: orders with "urgent" or "high" urgency should be fulfilled first
3. Fairness: if supply is less than total demand, allocate pro-rata across dealers
4. Buffer: keep 5-10% of each SKU in Lagos as warehouse buffer (more for fast-moving SKUs)
5. KANO transfer: transfer enough for northern dealer orders + a KANO buffer. Do NOT over-transfer — Lagos needs stock too.
6. Partial fills: allocate what you can; it's OK to partially fill an order
7. If total supply exceeds demand, recommend how to split the surplus (mostly Lagos buffer + some Kano buffer)

OUTPUT SCHEMA — respond with ONLY valid JSON:

{
  "suggested_allocations": [
    {
      "order_id": "exact order ID from input",
      "dealer_name": "dealer name",
      "dealer_city": "city",
      "served_via": "LAGOS or KANO",
      "items": [
        {
          "sku_code": "exact SKU from input",
          "quantity_allocated": 5
        }
      ],
      "reasoning": "one-sentence reason for this allocation"
    }
  ],
  "kano_transfer": [
    {
      "sku_code": "exact SKU from input",
      "quantity": 10,
      "reasoning": "why this quantity"
    }
  ],
  "remaining_in_lagos": [
    {
      "sku_code": "exact SKU from input",
      "quantity": 8,
      "purpose": "lagos_buffer or unallocated"
    }
  ],
  "overall_reasoning": "2-3 sentences explaining the overall allocation strategy",
  "confidence": 0.85,
  "caveats": ["list of things admin should double-check"]
}

IMPORTANT:
- Use EXACT order_ids and sku_codes from the input — do not modify or abbreviate them
- Only allocate quantities that exist in the container (do not over-allocate)
- The sum of: allocated_to_dealers + kano_transfer + remaining_in_lagos should equal the container quantity for each SKU`
}

export interface AllocationOrderItem {
  sku_code: string
  display_name: string
  quantity_remaining: number
}

export interface AllocationOrder {
  order_id: string
  dealer_name: string
  dealer_city: string
  dealer_state: string
  items: AllocationOrderItem[]
}

export interface AllocationContainerItem {
  sku_code: string
  display_name: string
  quantity: number
}

export interface AllocationWarehouseStock {
  warehouse: 'LAGOS' | 'KANO'
  sku_code: string
  display_name: string
  current_quantity: number
}

export interface AllocationContext {
  containerNumber: string
  containerItems: AllocationContainerItem[]
  pendingOrders: AllocationOrder[]
  warehouseStock: AllocationWarehouseStock[]
}

export function getAllocationUserPrompt(ctx: AllocationContext): string {
  const containerLines = ctx.containerItems
    .map((i) => `  - ${i.sku_code}: ${i.display_name} — ${i.quantity} units`)
    .join('\n')

  const ordersLines =
    ctx.pendingOrders.length === 0
      ? '  (No pending orders for SKUs in this container)'
      : ctx.pendingOrders
          .map((o) => {
            const items = o.items.map((i) => `${i.sku_code} ×${i.quantity_remaining}`).join(', ')
            return `  - Order ${o.order_id}: ${o.dealer_name} (${o.dealer_city}, ${o.dealer_state}) → needs: ${items}`
          })
          .join('\n')

  const lagosLines = ctx.warehouseStock
    .filter((s) => s.warehouse === 'LAGOS')
    .map((s) => `  - ${s.sku_code}: ${s.current_quantity} units`)
    .join('\n') || '  (none)'

  const kanoLines = ctx.warehouseStock
    .filter((s) => s.warehouse === 'KANO')
    .map((s) => `  - ${s.sku_code}: ${s.current_quantity} units`)
    .join('\n') || '  (none)'

  return `Container: ${ctx.containerNumber}
Contents (just arrived at LAGOS warehouse):
${containerLines}

Pending dealer orders (for SKUs in this container):
${ordersLines}

Current LAGOS warehouse stock (before this container):
${lagosLines}

Current KANO warehouse stock:
${kanoLines}

Please suggest an allocation for this container. Respond with JSON only.`
}
