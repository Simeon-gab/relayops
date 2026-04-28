-- ============================================================
-- 0001_initial_schema.sql
-- RelayOps: all 19 tables, FKs, indexes
-- Run this first in the Supabase SQL editor.
-- ============================================================


-- ─────────────────────────────────────────
-- 1. WAREHOUSES
-- ─────────────────────────────────────────
CREATE TABLE warehouses (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  code           text        NOT NULL UNIQUE,
  name           text        NOT NULL,
  city           text        NOT NULL,
  state          text        NOT NULL,
  is_import_base boolean     NOT NULL DEFAULT false,
  active         boolean     NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now()
);


-- ─────────────────────────────────────────
-- 2. USERS  (public profile — mirrors auth.users)
-- id must be set to auth.users.id by the application trigger
-- ─────────────────────────────────────────
CREATE TABLE users (
  id             uuid        PRIMARY KEY,
  email          text        NOT NULL,
  role           text        NOT NULL CHECK (role IN ('admin', 'dealer')),
  dealer_id      uuid,       -- FK added below after dealers exists
  display_name   text        NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  last_active_at timestamptz
);


-- ─────────────────────────────────────────
-- 3. PRODUCTS
-- ─────────────────────────────────────────
CREATE TABLE products (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  sku_code          text        NOT NULL UNIQUE,
  display_name      text        NOT NULL,
  category          text        NOT NULL CHECK (category IN ('motorcycle', 'ebike')),
  engine_size_cc    integer,
  color             text,
  import_cost_naira numeric,
  sell_price_naira  numeric,
  active            boolean     NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  deleted_at        timestamptz
);


-- ─────────────────────────────────────────
-- 4. DEALERS
-- ─────────────────────────────────────────
CREATE TABLE dealers (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name          text        NOT NULL,
  contact_name           text        NOT NULL,
  phone                  text        NOT NULL,
  email                  text,
  city                   text        NOT NULL,
  state                  text        NOT NULL,
  preferred_language     text        NOT NULL CHECK (preferred_language IN ('en', 'ha', 'yo', 'ig')),
  served_by_warehouse_id uuid        NOT NULL REFERENCES warehouses(id),
  credit_limit_naira     numeric,
  user_id                uuid        REFERENCES users(id),
  active                 boolean     NOT NULL DEFAULT true,
  notes                  text,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  deleted_at             timestamptz
);

-- Close the circular dependency: users.dealer_id → dealers
ALTER TABLE users
  ADD CONSTRAINT users_dealer_id_fkey
  FOREIGN KEY (dealer_id) REFERENCES dealers(id);


-- ─────────────────────────────────────────
-- 5. CONTAINERS
-- ─────────────────────────────────────────
CREATE TABLE containers (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  container_number text        NOT NULL UNIQUE,
  arrived_at       date        NOT NULL,
  recorded_by      uuid        NOT NULL REFERENCES users(id),
  notes            text,
  status           text        NOT NULL DEFAULT 'pending_allocation'
                                 CHECK (status IN ('pending_allocation', 'allocated', 'completed')),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  deleted_at       timestamptz
);


-- ─────────────────────────────────────────
-- 6. CONTAINER_ITEMS
-- ─────────────────────────────────────────
CREATE TABLE container_items (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  container_id uuid        NOT NULL REFERENCES containers(id),
  product_id   uuid        NOT NULL REFERENCES products(id),
  quantity     integer     NOT NULL CHECK (quantity > 0),
  created_at   timestamptz NOT NULL DEFAULT now()
);


-- ─────────────────────────────────────────
-- 7. WAREHOUSE_STOCK
-- ─────────────────────────────────────────
CREATE TABLE warehouse_stock (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id uuid        NOT NULL REFERENCES warehouses(id),
  product_id   uuid        NOT NULL REFERENCES products(id),
  quantity     integer     NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (warehouse_id, product_id)
);


-- ─────────────────────────────────────────
-- 8. STOCK_MOVEMENTS
-- ─────────────────────────────────────────
CREATE TABLE stock_movements (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id   uuid        NOT NULL REFERENCES warehouses(id),
  product_id     uuid        NOT NULL REFERENCES products(id),
  change_type    text        NOT NULL CHECK (change_type IN (
                               'container_arrival', 'transfer_out', 'transfer_in',
                               'shipment_dispatch', 'manual_adjustment', 'return'
                             )),
  quantity_delta integer     NOT NULL,
  reference_type text,
  reference_id   uuid,
  reason         text,
  created_by     uuid        NOT NULL REFERENCES users(id),
  created_at     timestamptz NOT NULL DEFAULT now()
);


-- ─────────────────────────────────────────
-- 9. MESSAGES
-- ─────────────────────────────────────────
CREATE TABLE messages (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id       uuid        NOT NULL REFERENCES dealers(id),
  direction       text        NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  channel         text        NOT NULL CHECK (channel IN ('dealer_portal', 'whatsapp', 'sms')),
  language        text,
  original_text   text        NOT NULL,
  translated_text text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid        REFERENCES users(id)
);


-- ─────────────────────────────────────────
-- 10. DEALER_ORDERS
-- ─────────────────────────────────────────
CREATE TABLE dealer_orders (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id         uuid        NOT NULL REFERENCES dealers(id),
  status            text        NOT NULL DEFAULT 'pending'
                                  CHECK (status IN ('pending', 'partially_fulfilled', 'fulfilled', 'cancelled')),
  requested_at      timestamptz NOT NULL DEFAULT now(),
  notes             text,
  source            text        NOT NULL CHECK (source IN ('dealer_portal', 'admin_entry', 'ai_parsed_message')),
  source_message_id uuid        REFERENCES messages(id),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  deleted_at        timestamptz
);


-- ─────────────────────────────────────────
-- 11. DEALER_ORDER_ITEMS
-- ─────────────────────────────────────────
CREATE TABLE dealer_order_items (
  id                 uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_order_id    uuid    NOT NULL REFERENCES dealer_orders(id),
  product_id         uuid    NOT NULL REFERENCES products(id),
  quantity_requested integer NOT NULL CHECK (quantity_requested > 0),
  quantity_fulfilled integer NOT NULL DEFAULT 0,
  unit_price_naira   numeric,
  notes              text
);


-- ─────────────────────────────────────────
-- 12. SHIPMENTS
-- ─────────────────────────────────────────
CREATE TABLE shipments (
  id                       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_type            text        NOT NULL CHECK (shipment_type IN ('transfer', 'dealer')),
  origin_warehouse_id      uuid        NOT NULL REFERENCES warehouses(id),
  destination_warehouse_id uuid        REFERENCES warehouses(id),
  destination_dealer_id    uuid        REFERENCES dealers(id),
  destination_city         text,
  destination_state        text,
  status                   text        NOT NULL DEFAULT 'pending'
                                         CHECK (status IN ('pending', 'dispatched', 'in_transit', 'delivered', 'cancelled')),
  dispatched_at            timestamptz,
  delivered_at             timestamptz,
  total_amount_naira       numeric,
  amount_paid_naira        numeric     NOT NULL DEFAULT 0,
  notes                    text,
  created_by               uuid        NOT NULL REFERENCES users(id),
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  deleted_at               timestamptz
);


-- ─────────────────────────────────────────
-- 13. SHIPMENT_ITEMS
-- ─────────────────────────────────────────
CREATE TABLE shipment_items (
  id                   uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id          uuid    NOT NULL REFERENCES shipments(id),
  product_id           uuid    NOT NULL REFERENCES products(id),
  quantity             integer NOT NULL CHECK (quantity > 0),
  unit_price_naira     numeric,
  dealer_order_item_id uuid    REFERENCES dealer_order_items(id)
);


-- ─────────────────────────────────────────
-- 14. STATUS_EVENTS
-- ─────────────────────────────────────────
CREATE TABLE status_events (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id uuid        NOT NULL REFERENCES shipments(id),
  from_status text,
  to_status   text        NOT NULL,
  event_at    timestamptz NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  recorded_by uuid        NOT NULL REFERENCES users(id),
  source      text        NOT NULL CHECK (source IN ('admin', 'dealer_confirmation', 'ai_inferred')),
  notes       text
);


-- ─────────────────────────────────────────
-- 15. RECEIPTS
-- ─────────────────────────────────────────
CREATE TABLE receipts (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id     uuid        NOT NULL REFERENCES dealers(id),
  storage_path  text        NOT NULL,
  file_type     text        NOT NULL,
  uploaded_by   uuid        NOT NULL REFERENCES users(id),
  upload_source text        NOT NULL CHECK (upload_source IN ('dealer_portal', 'admin_upload')),
  status        text        NOT NULL DEFAULT 'pending_extraction'
                              CHECK (status IN ('pending_extraction', 'extracted', 'matched', 'needs_review', 'rejected')),
  created_at    timestamptz NOT NULL DEFAULT now()
);


-- ─────────────────────────────────────────
-- 16. RECEIPT_EXTRACTIONS
-- ─────────────────────────────────────────
CREATE TABLE receipt_extractions (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id             uuid        NOT NULL REFERENCES receipts(id),
  extracted_amount_naira numeric,
  extracted_date         date,
  extracted_reference    text,
  extracted_payer_name   text,
  extracted_recipient    text,
  extracted_method       text,
  field_confidences      jsonb       NOT NULL DEFAULT '{}',
  overall_confidence     numeric     NOT NULL,
  raw_response           jsonb       NOT NULL DEFAULT '{}',
  ai_model               text        NOT NULL,
  ai_notes               text,
  created_at             timestamptz NOT NULL DEFAULT now()
);


-- ─────────────────────────────────────────
-- 17. PAYMENTS
-- ─────────────────────────────────────────
CREATE TABLE payments (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id         uuid        NOT NULL REFERENCES dealers(id),
  shipment_id       uuid        REFERENCES shipments(id),
  amount_naira      numeric     NOT NULL,
  payment_date      date        NOT NULL,
  payment_reference text,
  payment_method    text        CHECK (payment_method IN ('bank_transfer', 'cash', 'pos')),
  recorded_at       timestamptz NOT NULL DEFAULT now(),
  recorded_by       uuid        NOT NULL REFERENCES users(id),
  source            text        NOT NULL CHECK (source IN ('admin_manual', 'receipt_extraction')),
  receipt_id        uuid        REFERENCES receipts(id),
  notes             text,
  deleted_at        timestamptz
);


-- ─────────────────────────────────────────
-- 18. MESSAGE_PARSE_RESULTS
-- ─────────────────────────────────────────
CREATE TABLE message_parse_results (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id     uuid        NOT NULL REFERENCES messages(id),
  parsed_intent  text        NOT NULL CHECK (parsed_intent IN (
                               'order_request', 'status_question', 'complaint', 'confirmation', 'other'
                             )),
  extracted_data jsonb       NOT NULL DEFAULT '{}',
  confidence     numeric     NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  ai_model       text        NOT NULL,
  ai_notes       text,
  created_at     timestamptz NOT NULL DEFAULT now()
);


-- ─────────────────────────────────────────
-- 19. AUDIT_LOG
-- ─────────────────────────────────────────
CREATE TABLE audit_log (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES users(id),
  action      text        NOT NULL,
  entity_type text        NOT NULL,
  entity_id   uuid        NOT NULL,
  changes     jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);


-- ============================================================
-- INDEXES
-- ============================================================

-- "All shipments for a dealer"
CREATE INDEX idx_shipments_destination_dealer ON shipments(destination_dealer_id);

-- "Outstanding orders by city / state"
CREATE INDEX idx_dealers_city  ON dealers(city);
CREATE INDEX idx_dealers_state ON dealers(state);
CREATE INDEX idx_dealer_orders_status ON dealer_orders(status);

-- "Recent status events for a shipment"
CREATE INDEX idx_status_events_shipment_event ON status_events(shipment_id, event_at DESC);

-- "Dealer messages by date"
CREATE INDEX idx_messages_dealer_created ON messages(dealer_id, created_at DESC);

-- "Receipts pending review"  (partial — avoids scanning 'matched' / 'rejected' rows)
CREATE INDEX idx_receipts_pending ON receipts(status)
  WHERE status IN ('pending_extraction', 'needs_review');

-- Supporting FK indexes
CREATE INDEX idx_dealer_orders_dealer       ON dealer_orders(dealer_id);
CREATE INDEX idx_dealer_order_items_order   ON dealer_order_items(dealer_order_id);
CREATE INDEX idx_shipment_items_shipment    ON shipment_items(shipment_id);
CREATE INDEX idx_shipments_origin_warehouse ON shipments(origin_warehouse_id);
CREATE INDEX idx_stock_movements_wh_prod    ON stock_movements(warehouse_id, product_id, created_at DESC);
CREATE INDEX idx_payments_dealer            ON payments(dealer_id);
CREATE INDEX idx_payments_shipment          ON payments(shipment_id);
CREATE INDEX idx_audit_log_entity           ON audit_log(entity_type, entity_id);
