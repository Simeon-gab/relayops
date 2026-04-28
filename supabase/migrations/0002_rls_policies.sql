-- ============================================================
-- 0002_rls_policies.sql
-- RelayOps: Row-Level Security policies
-- Run this AFTER 0001_initial_schema.sql.
-- Idempotent: safe to run multiple times.
-- ============================================================


-- ─────────────────────────────────────────
-- HELPER FUNCTIONS  (CREATE OR REPLACE = already idempotent)
-- ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.auth_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM users WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.auth_user_dealer_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT dealer_id FROM users WHERE id = auth.uid();
$$;


-- ─────────────────────────────────────────
-- ENABLE RLS ON ALL TABLES  (idempotent by default)
-- ─────────────────────────────────────────
ALTER TABLE warehouses            ENABLE ROW LEVEL SECURITY;
ALTER TABLE users                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE products              ENABLE ROW LEVEL SECURITY;
ALTER TABLE dealers               ENABLE ROW LEVEL SECURITY;
ALTER TABLE containers            ENABLE ROW LEVEL SECURITY;
ALTER TABLE container_items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouse_stock       ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements       ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages              ENABLE ROW LEVEL SECURITY;
ALTER TABLE dealer_orders         ENABLE ROW LEVEL SECURITY;
ALTER TABLE dealer_order_items    ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipments             ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipment_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE status_events         ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipts              ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipt_extractions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments              ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_parse_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log             ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- POLICIES
-- DROP IF EXISTS immediately before each CREATE so re-runs are safe.
-- ============================================================


-- ─────────────────────────────────────────
-- warehouses
-- ─────────────────────────────────────────
DROP POLICY IF EXISTS admin_all   ON warehouses;
DROP POLICY IF EXISTS dealer_read ON warehouses;

CREATE POLICY admin_all ON warehouses
  FOR ALL TO authenticated
  USING (auth_user_role() = 'admin')
  WITH CHECK (auth_user_role() = 'admin');

CREATE POLICY dealer_read ON warehouses
  FOR SELECT TO authenticated
  USING (auth_user_role() = 'dealer');


-- ─────────────────────────────────────────
-- users
-- ─────────────────────────────────────────
DROP POLICY IF EXISTS admin_all      ON users;
DROP POLICY IF EXISTS dealer_read_own ON users;

CREATE POLICY admin_all ON users
  FOR ALL TO authenticated
  USING (auth_user_role() = 'admin')
  WITH CHECK (auth_user_role() = 'admin');

CREATE POLICY dealer_read_own ON users
  FOR SELECT TO authenticated
  USING (id = auth.uid());


-- ─────────────────────────────────────────
-- products
-- ─────────────────────────────────────────
DROP POLICY IF EXISTS admin_all         ON products;
DROP POLICY IF EXISTS dealer_read_active ON products;

CREATE POLICY admin_all ON products
  FOR ALL TO authenticated
  USING (auth_user_role() = 'admin')
  WITH CHECK (auth_user_role() = 'admin');

CREATE POLICY dealer_read_active ON products
  FOR SELECT TO authenticated
  USING (auth_user_role() = 'dealer' AND active = true AND deleted_at IS NULL);


-- ─────────────────────────────────────────
-- dealers
-- ─────────────────────────────────────────
DROP POLICY IF EXISTS admin_all      ON dealers;
DROP POLICY IF EXISTS dealer_read_own ON dealers;

CREATE POLICY admin_all ON dealers
  FOR ALL TO authenticated
  USING (auth_user_role() = 'admin')
  WITH CHECK (auth_user_role() = 'admin');

CREATE POLICY dealer_read_own ON dealers
  FOR SELECT TO authenticated
  USING (id = auth_user_dealer_id());


-- ─────────────────────────────────────────
-- containers  (admin only)
-- ─────────────────────────────────────────
DROP POLICY IF EXISTS admin_all ON containers;

CREATE POLICY admin_all ON containers
  FOR ALL TO authenticated
  USING (auth_user_role() = 'admin')
  WITH CHECK (auth_user_role() = 'admin');


-- ─────────────────────────────────────────
-- container_items  (admin only)
-- ─────────────────────────────────────────
DROP POLICY IF EXISTS admin_all ON container_items;

CREATE POLICY admin_all ON container_items
  FOR ALL TO authenticated
  USING (auth_user_role() = 'admin')
  WITH CHECK (auth_user_role() = 'admin');


-- ─────────────────────────────────────────
-- warehouse_stock  (admin only)
-- ─────────────────────────────────────────
DROP POLICY IF EXISTS admin_all ON warehouse_stock;

CREATE POLICY admin_all ON warehouse_stock
  FOR ALL TO authenticated
  USING (auth_user_role() = 'admin')
  WITH CHECK (auth_user_role() = 'admin');


-- ─────────────────────────────────────────
-- stock_movements  (admin only)
-- ─────────────────────────────────────────
DROP POLICY IF EXISTS admin_all ON stock_movements;

CREATE POLICY admin_all ON stock_movements
  FOR ALL TO authenticated
  USING (auth_user_role() = 'admin')
  WITH CHECK (auth_user_role() = 'admin');


-- ─────────────────────────────────────────
-- messages
-- ─────────────────────────────────────────
DROP POLICY IF EXISTS admin_all        ON messages;
DROP POLICY IF EXISTS dealer_read_own  ON messages;
DROP POLICY IF EXISTS dealer_insert_own ON messages;

CREATE POLICY admin_all ON messages
  FOR ALL TO authenticated
  USING (auth_user_role() = 'admin')
  WITH CHECK (auth_user_role() = 'admin');

CREATE POLICY dealer_read_own ON messages
  FOR SELECT TO authenticated
  USING (dealer_id = auth_user_dealer_id());

CREATE POLICY dealer_insert_own ON messages
  FOR INSERT TO authenticated
  WITH CHECK (
    auth_user_role() = 'dealer'
    AND dealer_id = auth_user_dealer_id()
    AND direction = 'inbound'
    AND channel = 'dealer_portal'
  );


-- ─────────────────────────────────────────
-- dealer_orders
-- ─────────────────────────────────────────
DROP POLICY IF EXISTS admin_all         ON dealer_orders;
DROP POLICY IF EXISTS dealer_read_own   ON dealer_orders;
DROP POLICY IF EXISTS dealer_insert_own ON dealer_orders;

CREATE POLICY admin_all ON dealer_orders
  FOR ALL TO authenticated
  USING (auth_user_role() = 'admin')
  WITH CHECK (auth_user_role() = 'admin');

CREATE POLICY dealer_read_own ON dealer_orders
  FOR SELECT TO authenticated
  USING (dealer_id = auth_user_dealer_id());

CREATE POLICY dealer_insert_own ON dealer_orders
  FOR INSERT TO authenticated
  WITH CHECK (
    auth_user_role() = 'dealer'
    AND dealer_id = auth_user_dealer_id()
    AND source = 'dealer_portal'
  );


-- ─────────────────────────────────────────
-- dealer_order_items
-- ─────────────────────────────────────────
DROP POLICY IF EXISTS admin_all         ON dealer_order_items;
DROP POLICY IF EXISTS dealer_read_own   ON dealer_order_items;
DROP POLICY IF EXISTS dealer_insert_own ON dealer_order_items;

CREATE POLICY admin_all ON dealer_order_items
  FOR ALL TO authenticated
  USING (auth_user_role() = 'admin')
  WITH CHECK (auth_user_role() = 'admin');

CREATE POLICY dealer_read_own ON dealer_order_items
  FOR SELECT TO authenticated
  USING (
    dealer_order_id IN (
      SELECT id FROM dealer_orders WHERE dealer_id = auth_user_dealer_id()
    )
  );

CREATE POLICY dealer_insert_own ON dealer_order_items
  FOR INSERT TO authenticated
  WITH CHECK (
    auth_user_role() = 'dealer'
    AND dealer_order_id IN (
      SELECT id FROM dealer_orders
      WHERE dealer_id = auth_user_dealer_id()
        AND source = 'dealer_portal'
    )
  );


-- ─────────────────────────────────────────
-- shipments
-- ─────────────────────────────────────────
DROP POLICY IF EXISTS admin_all              ON shipments;
DROP POLICY IF EXISTS dealer_read_own        ON shipments;
DROP POLICY IF EXISTS dealer_confirm_delivery ON shipments;

CREATE POLICY admin_all ON shipments
  FOR ALL TO authenticated
  USING (auth_user_role() = 'admin')
  WITH CHECK (auth_user_role() = 'admin');

CREATE POLICY dealer_read_own ON shipments
  FOR SELECT TO authenticated
  USING (destination_dealer_id = auth_user_dealer_id());

CREATE POLICY dealer_confirm_delivery ON shipments
  FOR UPDATE TO authenticated
  USING (
    destination_dealer_id = auth_user_dealer_id()
    AND status = 'in_transit'
  )
  WITH CHECK (
    destination_dealer_id = auth_user_dealer_id()
    AND status = 'delivered'
  );


-- ─────────────────────────────────────────
-- shipment_items
-- ─────────────────────────────────────────
DROP POLICY IF EXISTS admin_all      ON shipment_items;
DROP POLICY IF EXISTS dealer_read_own ON shipment_items;

CREATE POLICY admin_all ON shipment_items
  FOR ALL TO authenticated
  USING (auth_user_role() = 'admin')
  WITH CHECK (auth_user_role() = 'admin');

CREATE POLICY dealer_read_own ON shipment_items
  FOR SELECT TO authenticated
  USING (
    shipment_id IN (
      SELECT id FROM shipments WHERE destination_dealer_id = auth_user_dealer_id()
    )
  );


-- ─────────────────────────────────────────
-- status_events
-- ─────────────────────────────────────────
DROP POLICY IF EXISTS admin_all                ON status_events;
DROP POLICY IF EXISTS dealer_read_own          ON status_events;
DROP POLICY IF EXISTS dealer_insert_confirmation ON status_events;

CREATE POLICY admin_all ON status_events
  FOR ALL TO authenticated
  USING (auth_user_role() = 'admin')
  WITH CHECK (auth_user_role() = 'admin');

CREATE POLICY dealer_read_own ON status_events
  FOR SELECT TO authenticated
  USING (
    shipment_id IN (
      SELECT id FROM shipments WHERE destination_dealer_id = auth_user_dealer_id()
    )
  );

CREATE POLICY dealer_insert_confirmation ON status_events
  FOR INSERT TO authenticated
  WITH CHECK (
    auth_user_role() = 'dealer'
    AND source = 'dealer_confirmation'
    AND to_status = 'delivered'
    AND shipment_id IN (
      SELECT id FROM shipments WHERE destination_dealer_id = auth_user_dealer_id()
    )
  );


-- ─────────────────────────────────────────
-- receipts
-- ─────────────────────────────────────────
DROP POLICY IF EXISTS admin_all         ON receipts;
DROP POLICY IF EXISTS dealer_read_own   ON receipts;
DROP POLICY IF EXISTS dealer_insert_own ON receipts;

CREATE POLICY admin_all ON receipts
  FOR ALL TO authenticated
  USING (auth_user_role() = 'admin')
  WITH CHECK (auth_user_role() = 'admin');

CREATE POLICY dealer_read_own ON receipts
  FOR SELECT TO authenticated
  USING (dealer_id = auth_user_dealer_id());

CREATE POLICY dealer_insert_own ON receipts
  FOR INSERT TO authenticated
  WITH CHECK (
    auth_user_role() = 'dealer'
    AND dealer_id = auth_user_dealer_id()
    AND upload_source = 'dealer_portal'
  );


-- ─────────────────────────────────────────
-- receipt_extractions
-- ─────────────────────────────────────────
DROP POLICY IF EXISTS admin_all      ON receipt_extractions;
DROP POLICY IF EXISTS dealer_read_own ON receipt_extractions;

CREATE POLICY admin_all ON receipt_extractions
  FOR ALL TO authenticated
  USING (auth_user_role() = 'admin')
  WITH CHECK (auth_user_role() = 'admin');

CREATE POLICY dealer_read_own ON receipt_extractions
  FOR SELECT TO authenticated
  USING (
    receipt_id IN (
      SELECT id FROM receipts WHERE dealer_id = auth_user_dealer_id()
    )
  );


-- ─────────────────────────────────────────
-- payments
-- ─────────────────────────────────────────
DROP POLICY IF EXISTS admin_all      ON payments;
DROP POLICY IF EXISTS dealer_read_own ON payments;

CREATE POLICY admin_all ON payments
  FOR ALL TO authenticated
  USING (auth_user_role() = 'admin')
  WITH CHECK (auth_user_role() = 'admin');

CREATE POLICY dealer_read_own ON payments
  FOR SELECT TO authenticated
  USING (dealer_id = auth_user_dealer_id());


-- ─────────────────────────────────────────
-- message_parse_results  (admin only)
-- ─────────────────────────────────────────
DROP POLICY IF EXISTS admin_all ON message_parse_results;

CREATE POLICY admin_all ON message_parse_results
  FOR ALL TO authenticated
  USING (auth_user_role() = 'admin')
  WITH CHECK (auth_user_role() = 'admin');


-- ─────────────────────────────────────────
-- audit_log  (admin only)
-- ─────────────────────────────────────────
DROP POLICY IF EXISTS admin_all ON audit_log;

CREATE POLICY admin_all ON audit_log
  FOR ALL TO authenticated
  USING (auth_user_role() = 'admin')
  WITH CHECK (auth_user_role() = 'admin');
