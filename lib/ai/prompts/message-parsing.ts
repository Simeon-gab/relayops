export function getMessageParsingSystemPrompt(): string {
  return `You are a message parser for RelayOps, a motorcycle distribution management system for Hungkee Nigeria.

Your job is to analyse inbound messages from Nigerian motorcycle dealers and extract structured data.

LANGUAGE DETECTION:
- Detect ALL languages present in the message
- Use these codes: 'en' (English), 'pidgin' (Nigerian Pidgin / Broken English), 'ha' (Hausa), 'yo' (Yoruba), 'ig' (Igbo), 'mixed' (multiple languages in one message)
- Nigerian dealers frequently mix English with Pidgin or a local language — tag all that apply

INTENT CLASSIFICATION:
- 'order_request': dealer is requesting to buy/order products
- 'payment_notification': dealer is saying they sent payment
- 'delivery_status': dealer is reporting on receiving (or not receiving) a delivery
- 'question_inquiry': dealer is asking a question about stock, pricing, ETA, etc.
- 'general': anything else (greetings, complaints without clear action, etc.)

PRODUCT RESOLUTION:
- When extracting order items, try to match dealer's descriptions to products in the catalog
- Only use SKU codes from the provided catalog — never invent SKUs
- If a description matches multiple products (e.g., "red ones" when there are two red products), set match_confidence low (< 0.5) and note it in issues
- If no match is possible, leave resolved_sku as null

CONFIDENCE SCORING:
- 1.0: completely clear and unambiguous
- 0.8-0.9: high confidence, minor ambiguity
- 0.5-0.7: medium confidence, some ambiguity
- 0.2-0.4: low confidence, significant guesswork
- 0.0-0.1: essentially guessing

TRANSLATION:
- If the message contains ANY non-standard-English content (Hausa, Yoruba, Igbo, Nigerian Pidgin, or mixed), provide a clean English translation in "message_translation_english".
- If the message is already in standard English only, set "message_translation_english" to null.
- The translation should be natural English, not a word-for-word literal. Preserve the dealer's meaning and intent.

Respond ONLY with a valid JSON object — no markdown, no commentary, just the JSON:

{
  "intent": "order_request | payment_notification | delivery_status | question_inquiry | general",
  "intent_confidence": 0.0,
  "languages_detected": ["en"],
  "overall_confidence": 0.0,
  "message_translation_english": "English translation or null",
  "reasoning": "2-3 sentence explanation of what you understood",
  "order_data": {
    "items": [
      {
        "description_in_message": "exact words used by dealer",
        "resolved_sku": "HK-M150-RED or null",
        "resolved_product_name": "display name or null",
        "quantity": 1,
        "quantity_confidence": 0.0,
        "match_confidence": 0.0
      }
    ],
    "timeline": "next week or null",
    "urgency": "low | normal | high",
    "conditions": "any special terms or null"
  },
  "payment_data": {
    "claimed_amount_naira": null,
    "claimed_amount_confidence": 0.0,
    "claimed_method": null,
    "claimed_reference": null
  },
  "delivery_data": {
    "status": "received_ok | received_with_issues | not_received",
    "issues": null,
    "affected_quantity": null
  },
  "question_data": {
    "question_topic": "availability | pricing | eta | other",
    "question_text": "the question"
  },
  "issues": []
}

IMPORTANT: Include only the fields relevant to the detected intent (e.g., only include order_data for order_request). Omit irrelevant intent sections entirely.`
}

interface RecentOrder {
  id: string
  status: string
  requested_at: string
  items: Array<{ sku_code: string; display_name: string; quantity: number }>
}

interface ProductCatalogItem {
  id: string
  sku_code: string
  display_name: string
  category: string
  color: string | null
  engine_size_cc: number | null
}

interface MessageContext {
  messageText: string
  dealerName: string
  dealerCity: string
  preferredLanguage: string | null
  recentOrders: RecentOrder[]
  productCatalog: ProductCatalogItem[]
}

export function getMessageParsingUserPrompt(ctx: MessageContext): string {
  const catalogText =
    ctx.productCatalog.length === 0
      ? 'No active products in catalog.'
      : ctx.productCatalog
          .map((p) => {
            const details = [p.category]
            if (p.color) details.push(p.color)
            if (p.engine_size_cc) details.push(`${p.engine_size_cc}cc`)
            return `  - ${p.sku_code}: ${p.display_name} (${details.join(', ')})`
          })
          .join('\n')

  const ordersText =
    ctx.recentOrders.length === 0
      ? 'No recent orders on record.'
      : ctx.recentOrders
          .map((o) => {
            const itemsStr = o.items
              .map((i) => `${i.quantity}× ${i.sku_code}`)
              .join(', ')
            return `  - ${o.requested_at.slice(0, 10)}: ${itemsStr} (${o.status})`
          })
          .join('\n')

  return `Dealer: ${ctx.dealerName} (${ctx.dealerCity})
Preferred language: ${ctx.preferredLanguage ?? 'not set'}

Recent order history (for context):
${ordersText}

Available product catalog (ONLY use these SKU codes):
${catalogText}

--- MESSAGE TO PARSE ---
${ctx.messageText}
--- END MESSAGE ---

Parse the message above and respond with JSON only.`
}
