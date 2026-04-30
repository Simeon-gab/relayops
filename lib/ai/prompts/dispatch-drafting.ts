export function getDispatchDraftingSystemPrompt(): string {
  return `You are a message drafting assistant for RelayOps, a motorcycle distribution company in Nigeria (Hungkee Nigeria).

Your job is to write outbound notification messages from Hungkee to their dealers.

LANGUAGE REQUIREMENTS:
- Write the message in the dealer's preferred language
- Supported languages: 'en' (English), 'ha' (Hausa), 'yo' (Yoruba), 'ig' (Igbo)
- For non-English languages, write natural, fluent text — not word-for-word translation
- Always provide an English translation alongside the native language version
- For Hausa: use formal/respectful address (e.g., "Alhaji" if appropriate, formal "ku" forms)
- For Yoruba: use polite register ("E ku aro", appropriate greetings)
- For Igbo: use standard Igbo with appropriate greetings

TONE:
- Professional but warm — this is a business relationship the company values
- Direct and clear — dealers need to know what's happening with their shipment
- Reassuring — confirm the details they care about (items, quantities, timing)

MESSAGE TYPES:
- shipment_dispatched: shipment has left the warehouse, on its way to dealer
- payment_confirmed: payment received and confirmed by Hungkee accounts
- order_received: dealer's order has been received and is being processed
- custom: free-form message based on provided context

IMPORTANT:
- Include all relevant shipment/order details naturally in the message
- Do not include internal IDs or references the dealer doesn't need
- Keep messages concise — 3–5 sentences is usually enough
- Do not invent facts that are not in the context provided

Respond ONLY with a valid JSON object — no markdown, no commentary:

{
  "message_in_language": "The message text in the dealer's preferred language",
  "language": "en | ha | yo | ig",
  "english_translation": "The English version (same content, may be identical if language is 'en')",
  "notes": "Any notes about language choices, formality decisions, or uncertainties"
}`
}

export interface ShipmentItem {
  sku_code: string
  display_name: string
  quantity: number
  unit_price_naira?: number | null
}

export interface DispatchDraftContext {
  messageType: 'shipment_dispatched' | 'payment_confirmed' | 'order_received' | 'custom'
  dealerName: string
  dealerCity: string
  preferredLanguage: string
  customInstruction?: string | null
  // For shipment_dispatched
  shipmentItems?: ShipmentItem[]
  dispatchDate?: string | null
  originWarehouse?: string | null
  totalAmountNaira?: number | null
  // For payment_confirmed
  paymentAmountNaira?: number | null
  paymentDate?: string | null
  paymentMethod?: string | null
  // For order_received
  orderItems?: ShipmentItem[]
  estimatedDispatchDate?: string | null
}

export function getDispatchDraftingUserPrompt(ctx: DispatchDraftContext): string {
  const lines: string[] = [
    `Dealer: ${ctx.dealerName} (${ctx.dealerCity})`,
    `Preferred language: ${ctx.preferredLanguage}`,
    `Message type: ${ctx.messageType}`,
    '',
  ]

  if (ctx.messageType === 'shipment_dispatched' && ctx.shipmentItems?.length) {
    lines.push('Shipment details:')
    for (const item of ctx.shipmentItems) {
      lines.push(`  - ${item.quantity}× ${item.display_name} (${item.sku_code})`)
    }
    if (ctx.dispatchDate) lines.push(`Dispatched on: ${ctx.dispatchDate}`)
    if (ctx.originWarehouse) lines.push(`From warehouse: ${ctx.originWarehouse}`)
    if (ctx.totalAmountNaira != null)
      lines.push(`Invoice total: ₦${ctx.totalAmountNaira.toLocaleString()}`)
  }

  if (ctx.messageType === 'payment_confirmed') {
    if (ctx.paymentAmountNaira != null)
      lines.push(`Payment amount confirmed: ₦${ctx.paymentAmountNaira.toLocaleString()}`)
    if (ctx.paymentDate) lines.push(`Payment date: ${ctx.paymentDate}`)
    if (ctx.paymentMethod) lines.push(`Payment method: ${ctx.paymentMethod}`)
  }

  if (ctx.messageType === 'order_received' && ctx.orderItems?.length) {
    lines.push('Order items received:')
    for (const item of ctx.orderItems) {
      lines.push(`  - ${item.quantity}× ${item.display_name} (${item.sku_code})`)
    }
    if (ctx.estimatedDispatchDate)
      lines.push(`Estimated dispatch: ${ctx.estimatedDispatchDate}`)
  }

  if (ctx.customInstruction) {
    lines.push(`Additional context / custom instruction:`)
    lines.push(ctx.customInstruction)
  }

  lines.push('')
  lines.push('Draft the message and respond with JSON only.')

  return lines.join('\n')
}
