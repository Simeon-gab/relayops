# AI Design

How AI is used in RelayOps — feature by feature, with prompt structure, model selection, confidence handling, and human review gates.

## Operating principles

These principles apply to every AI feature in the system.

**One model, one provider.** All AI features use Anthropic Claude. Text features use the current Sonnet model; vision features use the same model (Claude Sonnet has vision capabilities). One SDK, one API key, one set of prompt patterns to maintain.

**Structured output via prompt engineering, not tool use.** For features that need structured data, prompts explicitly request JSON output with a defined schema. Responses are parsed with try/catch and validated against expected fields. This is simpler than tool use for the scope of v1 and easier to debug.

**Confidence is a first-class concept.** Every AI output includes a confidence signal — either explicit (the model self-reports confidence) or inferred (whether required fields were extractable). Low confidence routes to human review.

**Humans approve outbound communications.** No AI-drafted message is sent automatically. Drafts are surfaced for admin review, with edit capability, before any send.

**Originals are preserved.** The original message text and the original receipt image are kept regardless of what the AI made of them. AI interpretations are logged with timestamps and model versions, so we can revisit and reparse later.

## Feature 1: Dealer message parsing

**Purpose.** Turn free-text dealer messages into structured intent — what the dealer is asking for, what's known, what's ambiguous.

**Trigger.** Inbound message arrives in `messages` table (from dealer portal, or admin pasting a WhatsApp message).

**Model.** Claude Sonnet (current default).

**Input.** The raw message text, plus context about the dealer (their city, preferred language, recent orders) for better parsing.

**Output schema.**
```json
{
  "detected_language": "en | ha | yo | ig | mixed",
  "intent": "order_request | status_question | complaint | confirmation | payment_notification | other",
  "english_translation": "...",
  "extracted": {
    "products_mentioned": [
      {"reference": "red ones", "likely_sku_codes": ["HK-M150-RED"], "quantity": 5, "confidence": 0.9}
    ],
    "dates_mentioned": [...],
    "amounts_mentioned": [...],
    "order_references": [...]
  },
  "ambiguities": ["Dealer says 'the new red ones' — multiple red SKUs in catalog, need clarification"],
  "suggested_action": "create_order_draft | request_clarification | escalate_to_admin",
  "confidence": 0.0
}
```

**Human review gate.** All parsed messages appear in an admin queue. Confidence < 0.7 or any flagged ambiguities require explicit admin action before any data is created. Confidence ≥ 0.9 with no ambiguities can pre-fill a draft order for one-click admin approval.

**Failure mode handling.** If parsing fails entirely (model errors, malformed JSON), the message stays in the queue with a "parse_failed" flag. Admin handles manually.

## Feature 2: Container allocation suggestion

**Purpose.** When a container lands in Lagos with N units of various SKUs, suggest how to split between Lagos and Kano warehouses, and which dealer orders to fulfill from each.

**Trigger.** Admin records a container, then clicks "Suggest allocation."

**Model.** Claude Sonnet.

**Input.**
- Container contents (SKU + quantity)
- Current Lagos and Kano stock by SKU
- All pending dealer orders (dealer city, state, served-by warehouse, requested SKUs and quantities, request date)
- Configurable rules (e.g., "always keep at least 5 units of Model X in each warehouse")

**Output schema.**
```json
{
  "lagos_retention": [
    {"sku_code": "HK-M150-RED", "quantity": 30, "reasoning": "Covers 4 pending orders + buffer"}
  ],
  "kano_transfer": [
    {"sku_code": "HK-M150-RED", "quantity": 20, "reasoning": "Covers 3 northern dealer orders, plus buffer"}
  ],
  "fulfillable_dealer_orders": [
    {"dealer_order_id": "...", "from_warehouse": "LAGOS", "items": [...]}
  ],
  "unfulfillable_orders": [
    {"dealer_order_id": "...", "reason": "Requested SKU not in this container"}
  ],
  "warnings": ["Kano stock of Model B is below buffer threshold — consider larger transfer"]
}
```

**Human review gate.** Always. The allocation is a *suggestion*. Admin sees it on screen, can adjust quantities by SKU and warehouse, and only after explicit confirmation does the system create the transfer shipment and dealer shipments.

**Why AI here, not pure rules.** A pure rule engine could do most of this, but AI handles the soft reasoning well: "this dealer in Onitsha could be served from either Lagos or Kano, but Kano is closer so prefer Kano if stock allows." Encoding that as rigid rules creates many edge cases. AI makes the call and explains it; admin overrides if wrong.

## Feature 3: Multi-language dispatch message drafting

**Purpose.** When a shipment is ready to dispatch, generate a notification message in the dealer's preferred language.

**Trigger.** Admin clicks "Draft dispatch message" on a shipment.

**Model.** Claude Sonnet.

**Input.**
- Dealer info (name, language, city)
- Shipment details (items, quantities, expected dispatch date, route info)
- Tone preference (default: professional but warm, configurable)

**Output schema.**
```json
{
  "message_in_language": "...",
  "language": "ha",
  "english_translation": "Hello Mr. X, your order of 5 Hungkee 150cc red motorcycles will dispatch today from Lagos and arrive in approximately 3-5 days...",
  "notes": "Used formal address per Hausa convention"
}
```

**Human review gate.** Always. Admin sees both the localized version and the English translation side by side. Admin can edit either, regenerate, or approve. Only on approval does the message get logged as sent and the shipment status update.

**Important note on translation quality.** Frontier LLMs handle Hausa, Yoruba, and Igbo with varying quality — generally good for standard messages, less reliable for nuanced phrasing. The human review gate is essential. The English translation alongside helps admins who don't speak the target language verify the message is reasonable.

**Failure mode handling.** If the model produces obviously broken output (e.g., wrong language, untranslatable text), admin can regenerate or fall back to English. A "regenerate" button calls the API again with slightly varied phrasing instructions.

## Feature 4: Receipt extraction (vision)

**Purpose.** Extract structured payment data from receipt images and PDFs.

**Trigger.** Receipt uploaded to `receipts` table.

**Model.** Claude Sonnet with vision (multimodal input).

**Input.** The receipt image (or PDF page rendered as image).

**Output schema.**
```json
{
  "extracted": {
    "amount_naira": 450000,
    "amount_confidence": 0.95,
    "date": "2026-04-22",
    "date_confidence": 0.9,
    "payment_reference": "TRF/123456789",
    "payment_reference_confidence": 0.85,
    "payer_name": "ABC Motors Ltd",
    "payer_name_confidence": 0.7,
    "recipient": "Hungkee Motorcycle Ltd",
    "recipient_confidence": 0.95,
    "payment_method": "bank_transfer",
    "method_confidence": 0.9
  },
  "overall_confidence": 0.85,
  "issues": ["Date partially obscured but readable"],
  "is_payment_receipt": true,
  "needs_human_review": false
}
```

**Human review gate.** Receipts route to admin queue if:
- `overall_confidence` < 0.8
- `is_payment_receipt` is false (uploaded image isn't actually a receipt)
- Any required field (amount, date) has confidence < 0.7
- No matching shipment found for the dealer

High-confidence receipts with a clear shipment match auto-create a payment record in "pending confirmation" status — admin sees it on a "review and confirm" list, single-click to confirm.

**Why this works.** Modern frontier vision models read structured documents well. The confidence scoring + human review combination means errors get caught, while the bulk of clear receipts move through quickly.

## Feature 5: Payment-to-shipment matching

**Purpose.** When a payment record exists (manually entered or extracted from receipt), match it to the right shipment.

**Trigger.** New payment record created without explicit shipment_id.

**Model.** Claude Sonnet.

**Input.**
- The payment details (dealer, amount, date, reference)
- The dealer's outstanding shipments (id, total amount, dispatched date, status, amount already paid)

**Output schema.**
```json
{
  "match": {
    "shipment_id": "...",
    "match_type": "exact | partial | possible",
    "confidence": 0.92,
    "reasoning": "Amount matches outstanding balance of shipment dispatched 2 weeks ago"
  },
  "alternatives": [
    {"shipment_id": "...", "confidence": 0.4, "reasoning": "Same amount but dispatched 6 months ago"}
  ],
  "needs_clarification": false,
  "suggested_clarification": null
}
```

**Human review gate.** Same pattern. High-confidence matches surface as "confirm this match" for one-click admin action. Low-confidence or ambiguous matches show alternatives and an option to ask the dealer.

## Feature 6: AI-drafted clarification messages

**Purpose.** When something is ambiguous (parse confidence low, payment match unclear), draft a follow-up question to the dealer.

**Trigger.** Admin clicks "Ask dealer for clarification" on an ambiguous item.

**Model.** Claude Sonnet.

**Input.**
- The ambiguous context (what we're trying to clarify)
- Dealer info (language, name)
- The minimum information needed to resolve

**Output schema.**
```json
{
  "message_in_language": "...",
  "english_translation": "...",
  "expected_answer_format": "yes/no | reference number | amount confirmation"
}
```

**Human review gate.** Always — admin reviews and approves before send.

## Feature 7: Daily operations summary

**Purpose.** A morning briefing for the operations team summarizing yesterday's activity, today's expected events, and items needing attention.

**Trigger.** First admin login of the day, or manual refresh.

**Model.** Claude Sonnet.

**Input.**
- Yesterday's data: shipments dispatched, deliveries confirmed, payments received, new orders, messages handled
- Today's calendar: containers expected to land, shipments scheduled to dispatch
- Outstanding items: pending dealer messages, unmatched payments, overdue shipments
- Stock anomalies: any SKU below buffer in either warehouse

**Output schema.**
```json
{
  "summary_text": "...",
  "key_metrics": {
    "shipments_dispatched_yesterday": 8,
    "payments_received_yesterday_naira": 4200000,
    "new_orders_yesterday": 3,
    "pending_review_items": 5
  },
  "items_needing_attention": [
    {"type": "stockout_risk", "description": "Lagos: Model B at 2 units, 4 pending orders", "severity": "high"},
    {"type": "overdue_shipment", "description": "Shipment to Asaba dispatched 6 days ago, no confirmation", "severity": "medium"}
  ]
}
```

**Human review gate.** None — this is informational and read-only. The data the AI is summarizing comes from the database and is verifiable.

**Why this works.** The AI isn't generating numbers; it's summarizing numbers it was given. The metrics in `key_metrics` are computed from queries, not invented by the model. The model's job is narrative synthesis and prioritization of what to highlight.

## Feature 8: Natural-language query

**Purpose.** Let admins ask the dashboard questions in plain English instead of clicking through views.

**Trigger.** Admin types in the query box on the dashboard.

**Model.** Claude Sonnet.

**Input.**
- The user's question
- A schema description (which tables exist, what fields, how they relate)
- Permission context (admin sees everything)

**Output schema.**
```json
{
  "interpreted_question": "Count of Model A in Lagos warehouse right now",
  "query_type": "count | list | aggregation",
  "structured_query": {
    "table": "warehouse_stock",
    "filters": {"warehouse_code": "LAGOS", "product_sku_code": "HK-M150-A"},
    "aggregation": "sum",
    "field": "quantity"
  },
  "needs_clarification": false,
  "clarification_question": null
}
```

The system runs the structured query against the database and returns results to the user, with a brief AI-generated narrative ("There are 23 Hungkee 150cc Model A motorcycles currently in the Lagos warehouse.").

**Human review gate.** None for read queries — they can't damage anything. Write actions through this interface are not supported in v1.

**Why this approach.** The AI interprets the question into a structured query. Actual data comes from the database, never from the AI's training. The narrative wraps the result. This is the safe pattern for natural-language interfaces against operational data.

**Fallback.** If the AI can't interpret the question (returns `needs_clarification: true`), the UI shows the clarification question and lets the user refine.

## Feature 9: Dealer-side natural language interface

**Purpose.** Let dealers ask their portal questions like "when is my order coming" in their preferred language.

**Trigger.** Dealer types in their portal's chat box.

**Model.** Claude Sonnet.

**Input.**
- Dealer's question (any language)
- Dealer ID (for scoping)
- Schema description scoped to dealer-accessible data

**Output flow.** Same pattern as Feature 8: AI interprets, system queries dealer's own data, AI wraps response in dealer's language.

**Human review gate.** None for read queries. Dealer-initiated write actions (placing a new order through chat) require admin approval before becoming a dealer_order.

## Production integration roadmap

Features that are simulated in v1 and what real integration looks like.

**WhatsApp/SMS sending.** Currently messages are logged in the database and shown in the dealer portal. Production integration: Termii or Africa's Talking for SMS (cheap, reliable in Nigeria); WhatsApp Business API for WhatsApp (requires Facebook business verification). Both are documented integration points; the message-sending function gets swapped out.

**Inbound WhatsApp.** Currently dealers type into the portal. Production: webhook from WhatsApp Business API delivers messages to the same parse pipeline.

**Receipt forwarding.** Currently dealers upload via portal. Production: forwarding incoming WhatsApp media into the same upload pipeline.

The architecture is designed so these integrations can be added without changing the core flow — they're input adapters that feed the existing parse and route logic.

## Cost considerations

Quick math on AI costs at modest scale.

Assume 50 inbound dealer messages per day, 30 outbound dispatch messages, 20 receipt extractions, 10 daily summaries (across the team), 50 natural-language queries. Average tokens per call: 1,500 input + 500 output for text features, 2,000 input + 500 output for vision (image counts as tokens).

At current Anthropic Claude Sonnet pricing (check the docs for live rates), this is roughly low-tens of dollars per month at this scale. Negligible compared to the operational time saved.

For high-volume features (natural-language queries), caching common query patterns and reusing schema descriptions across requests reduces cost meaningfully. Build it with the simple version first; optimize if costs become noticeable.

## Model selection

We are using Claude Sonnet across all features for simplicity and consistency. The current Sonnet model handles all the use cases above with sufficient quality.

If specific features show quality issues during build:
- Translation quality issues → consider fallback to English with note to dealer
- Vision quality issues → request re-upload with quality guidance
- Reasoning issues on allocation → constrain inputs more tightly, simplify

We are explicitly not building model-routing logic in v1. One model for everything, until we have evidence one feature needs something different.
