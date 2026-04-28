# Data Model

The database schema for RelayOps. Designed around the operational entities of a motorcycle distribution business: products, warehouses, dealers, containers, shipments, payments, and the events that connect them.

## Design principles

Three principles drive every schema decision in this document.

**Append-only audit for state changes.** Anything that has a meaningful history — shipment status, payment status, message delivery — is tracked via event tables, not by overwriting fields. This gives a complete timeline for any entity and supports both debugging and dispute resolution.

**Soft deletes for primary entities.** Records are marked deleted via a `deleted_at` timestamp rather than being removed. This preserves referential integrity, keeps historical reports accurate, and allows for recovery from mistakes.

**Explicit confidence on AI-derived data.** When AI extracts or parses something, the confidence level is stored alongside the result, and the raw input is preserved. We never lose the original message or receipt — we always know what the AI was working from.

## Entity overview

```
products  ──┐
            ├──>  container_items  ──>  containers
warehouses ─┤
            ├──>  warehouse_stock
            │
dealers  ───┼──>  dealer_orders  ──>  shipments  ──>  status_events
            │                              │
            │                              └────>  payments  ──>  payment_extractions
            │
            └──>  messages  ──>  message_logs
```

## Tables

### `products`

The motorcycle and e-bike SKUs Hungkee imports and distributes.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (pk) | |
| sku_code | text (unique) | Internal SKU code, e.g. "HK-M150-RED" |
| display_name | text | "Hungkee 150cc Standard - Red" |
| category | text | "motorcycle" or "ebike" |
| engine_size_cc | integer (nullable) | Null for e-bikes |
| color | text (nullable) | |
| import_cost_naira | numeric (nullable) | For internal margin tracking |
| sell_price_naira | numeric (nullable) | Reference price; actual prices set per dealer order |
| active | boolean | Default true |
| created_at | timestamptz | |
| updated_at | timestamptz | |
| deleted_at | timestamptz (nullable) | Soft delete |

### `warehouses`

The two physical warehouses. Modeled as a table rather than an enum so we can extend later.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (pk) | |
| code | text (unique) | "LAGOS" or "KANO" |
| name | text | "Lagos Primary Warehouse" |
| city | text | |
| state | text | |
| is_import_base | boolean | True only for Lagos |
| active | boolean | |
| created_at | timestamptz | |

The `is_import_base` flag matters for the AI allocation logic — only Lagos can receive containers; Kano can only receive transfers from Lagos.

### `containers`

A shipping container that lands at the Lagos warehouse.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (pk) | |
| container_number | text (unique) | The shipping container ID |
| arrived_at | date | When it landed at Lagos |
| recorded_by | uuid (fk → users) | Admin who entered it |
| notes | text (nullable) | |
| status | text | "pending_allocation", "allocated", "completed" |
| created_at | timestamptz | |
| updated_at | timestamptz | |
| deleted_at | timestamptz (nullable) | |

### `container_items`

What's inside a container — SKU and quantity, one row per SKU.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (pk) | |
| container_id | uuid (fk → containers) | |
| product_id | uuid (fk → products) | |
| quantity | integer | |
| created_at | timestamptz | |

### `warehouse_stock`

Current stock level by warehouse and product. One row per (warehouse, product) combination.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (pk) | |
| warehouse_id | uuid (fk → warehouses) | |
| product_id | uuid (fk → products) | |
| quantity | integer | Current count, can go to zero |
| updated_at | timestamptz | |

Unique constraint on `(warehouse_id, product_id)`.

This table represents *current* stock. Historical stock movements are derived from `stock_movements`.

### `stock_movements`

Append-only log of every stock change. The source of truth for any "what happened to this stock" question.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (pk) | |
| warehouse_id | uuid (fk → warehouses) | |
| product_id | uuid (fk → products) | |
| change_type | text | "container_arrival", "transfer_out", "transfer_in", "shipment_dispatch", "manual_adjustment", "return" |
| quantity_delta | integer | Positive for inflow, negative for outflow |
| reference_type | text (nullable) | "container", "shipment", etc. |
| reference_id | uuid (nullable) | The ID of the referenced entity |
| reason | text (nullable) | Free text, especially for manual adjustments |
| created_by | uuid (fk → users) | |
| created_at | timestamptz | |

Every stock change writes a row here and updates `warehouse_stock`. Both happen in a transaction.

### `dealers`

The dealer network.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (pk) | |
| business_name | text | |
| contact_name | text | |
| phone | text | |
| email | text (nullable) | |
| city | text | |
| state | text | |
| preferred_language | text | "en", "ha" (Hausa), "yo" (Yoruba), "ig" (Igbo) |
| served_by_warehouse_id | uuid (fk → warehouses) | Default routing — Lagos or Kano |
| credit_limit_naira | numeric (nullable) | |
| user_id | uuid (fk → users, nullable) | If dealer has a portal login |
| active | boolean | |
| notes | text (nullable) | |
| created_at | timestamptz | |
| updated_at | timestamptz | |
| deleted_at | timestamptz (nullable) | |

### `dealer_orders`

A dealer's request for products. Created either manually by admin from a WhatsApp message, or directly by the dealer through the portal.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (pk) | |
| dealer_id | uuid (fk → dealers) | |
| status | text | "pending", "partially_fulfilled", "fulfilled", "cancelled" |
| requested_at | timestamptz | |
| notes | text (nullable) | |
| source | text | "dealer_portal", "admin_entry", "ai_parsed_message" |
| source_message_id | uuid (fk → messages, nullable) | If parsed from a message |
| created_at | timestamptz | |
| updated_at | timestamptz | |
| deleted_at | timestamptz (nullable) | |

### `dealer_order_items`

Line items on a dealer order.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (pk) | |
| dealer_order_id | uuid (fk → dealer_orders) | |
| product_id | uuid (fk → products) | |
| quantity_requested | integer | |
| quantity_fulfilled | integer | Default 0, updated as shipments dispatch |
| unit_price_naira | numeric (nullable) | |
| notes | text (nullable) | |

### `shipments`

A movement of stock from a warehouse to a destination. Two types:

- **Transfer:** Lagos → Kano. Internal stock movement.
- **Dealer:** Warehouse → Dealer city.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (pk) | |
| shipment_type | text | "transfer" or "dealer" |
| origin_warehouse_id | uuid (fk → warehouses) | |
| destination_warehouse_id | uuid (fk → warehouses, nullable) | For transfers |
| destination_dealer_id | uuid (fk → dealers, nullable) | For dealer shipments |
| destination_city | text (nullable) | Free text for dealer destinations |
| destination_state | text (nullable) | |
| status | text | "pending", "dispatched", "in_transit", "delivered", "cancelled" |
| dispatched_at | timestamptz (nullable) | |
| delivered_at | timestamptz (nullable) | |
| total_amount_naira | numeric (nullable) | For dealer shipments |
| amount_paid_naira | numeric | Default 0, updated as payments come in |
| notes | text (nullable) | |
| created_by | uuid (fk → users) | |
| created_at | timestamptz | |
| updated_at | timestamptz | |
| deleted_at | timestamptz (nullable) | |

### `shipment_items`

Line items on a shipment.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (pk) | |
| shipment_id | uuid (fk → shipments) | |
| product_id | uuid (fk → products) | |
| quantity | integer | |
| unit_price_naira | numeric (nullable) | For dealer shipments |
| dealer_order_item_id | uuid (fk → dealer_order_items, nullable) | Links back to original order line |

### `status_events`

Append-only log of status changes for shipments. The audit trail for "what happened to this shipment."

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (pk) | |
| shipment_id | uuid (fk → shipments) | |
| from_status | text (nullable) | Null for initial event |
| to_status | text | |
| event_at | timestamptz | When the status changed |
| recorded_at | timestamptz | When it was logged in the system |
| recorded_by | uuid (fk → users) | |
| source | text | "admin", "dealer_confirmation", "ai_inferred" |
| notes | text (nullable) | |

### `messages`

All inbound and outbound messages between operations team and dealers. The unstructured layer.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (pk) | |
| dealer_id | uuid (fk → dealers) | |
| direction | text | "inbound" or "outbound" |
| channel | text | "dealer_portal", "whatsapp" (future), "sms" (future) |
| language | text (nullable) | Detected for inbound, set for outbound |
| original_text | text | The raw message |
| translated_text | text (nullable) | English translation if original was non-English |
| created_at | timestamptz | |
| created_by | uuid (fk → users, nullable) | Admin who sent (outbound), null for inbound |

### `message_parse_results`

What AI made of an inbound message. One row per parse attempt.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (pk) | |
| message_id | uuid (fk → messages) | |
| parsed_intent | text | "order_request", "status_question", "complaint", "confirmation", "other" |
| extracted_data | jsonb | Structured fields the AI pulled out |
| confidence | numeric | 0.0 to 1.0 |
| ai_model | text | Which model version processed this |
| ai_notes | text (nullable) | What the AI flagged as ambiguous |
| created_at | timestamptz | |

### `payments`

Records of dealer payments. Created when an admin confirms a payment, either from a manually entered record or from a receipt extraction.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (pk) | |
| dealer_id | uuid (fk → dealers) | |
| shipment_id | uuid (fk → shipments, nullable) | The shipment this payment is for |
| amount_naira | numeric | |
| payment_date | date | When the payment was made (per receipt) |
| payment_reference | text (nullable) | Bank reference, transaction ID |
| payment_method | text (nullable) | "bank_transfer", "cash", "pos" |
| recorded_at | timestamptz | When entered into system |
| recorded_by | uuid (fk → users) | |
| source | text | "admin_manual", "receipt_extraction" |
| receipt_id | uuid (fk → receipts, nullable) | If from a receipt |
| notes | text (nullable) | |
| deleted_at | timestamptz (nullable) | |

### `receipts`

Uploaded receipt images and PDFs.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (pk) | |
| dealer_id | uuid (fk → dealers) | |
| storage_path | text | Path in Supabase Storage |
| file_type | text | "image/jpeg", "image/png", "application/pdf" |
| uploaded_by | uuid (fk → users) | Could be dealer or admin |
| upload_source | text | "dealer_portal", "admin_upload" |
| status | text | "pending_extraction", "extracted", "matched", "needs_review", "rejected" |
| created_at | timestamptz | |

### `receipt_extractions`

What AI vision extracted from a receipt. One row per extraction attempt.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (pk) | |
| receipt_id | uuid (fk → receipts) | |
| extracted_amount_naira | numeric (nullable) | |
| extracted_date | date (nullable) | |
| extracted_reference | text (nullable) | |
| extracted_payer_name | text (nullable) | |
| extracted_recipient | text (nullable) | |
| extracted_method | text (nullable) | |
| field_confidences | jsonb | Per-field confidence scores |
| overall_confidence | numeric | |
| raw_response | jsonb | Full AI response for debugging |
| ai_model | text | |
| ai_notes | text (nullable) | |
| created_at | timestamptz | |

### `users`

Authenticated users. Maps to Supabase Auth.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (pk) | Matches Supabase Auth user.id |
| email | text | |
| role | text | "admin" or "dealer" |
| dealer_id | uuid (fk → dealers, nullable) | Set if role = "dealer" |
| display_name | text | |
| created_at | timestamptz | |
| last_active_at | timestamptz | |

### `audit_log`

Cross-cutting audit log for sensitive actions.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (pk) | |
| user_id | uuid (fk → users) | |
| action | text | "container_recorded", "shipment_dispatched", "payment_confirmed", etc. |
| entity_type | text | |
| entity_id | uuid | |
| changes | jsonb (nullable) | What changed |
| created_at | timestamptz | |

## Row-level security

Supabase RLS policies enforce data access:

- **Admins** can read and write all rows in all tables.
- **Dealers** can read only their own dealer record, their own orders, their own shipments, their own messages, their own payments, and their own receipts.
- **Dealers** can write to: their own messages (creating new outbound), their own receipts (uploading), their own dealer_orders (creating new), and limited shipment fields (confirming receipt).
- All write operations from dealer accounts go through validation that checks the dealer_id on the affected row matches the dealer_id linked to the user.

## Why this schema

A few decisions worth explaining.

**Why two tables for stock (`warehouse_stock` and `stock_movements`)?** Because the question "how much is in Lagos right now?" is asked constantly and needs to be fast, while "how did this number change over the last month?" is asked occasionally and benefits from a complete log. Separating current state from history is a standard pattern for inventory systems.

**Why store AI confidence and raw responses?** Two reasons. First, debugging — when something extracts wrong, we want to know what the AI saw and why it was confident. Second, model evaluation — we can later analyze where AI is reliable and where it isn't, which guides where to add human review gates.

**Why `messages` separate from `message_parse_results`?** Because the message itself is the truth. Parsing is interpretation. We want to be able to re-parse messages with better prompts or newer models without losing the original. The message also serves as the audit trail for dealer communication independent of how AI interpreted it.

**Why no transactions table for payments?** Because Hungkee doesn't process payments — dealers pay directly to bank accounts. The `payments` table is documentary, not transactional. It records what payments occurred, not effects them.

**Why soft deletes?** Because deleting a dealer who has historical orders breaks reporting. Marking them deleted preserves the data and lets the UI hide them.

## Indexes (for performance)

The query patterns this schema needs to support fast:

- "All shipments for a dealer" → index on `shipments.destination_dealer_id`
- "Outstanding orders by city/state" → indexes on `dealers.city`, `dealers.state`, `dealer_orders.status`
- "Recent status events for a shipment" → index on `(shipment_id, event_at desc)`
- "Stock for a warehouse" → already covered by unique constraint
- "Dealer messages by date" → index on `(dealer_id, created_at desc)`
- "Receipts pending review" → partial index on `receipts.status` where status in pending states

Specific index DDL will be in the migration file.
