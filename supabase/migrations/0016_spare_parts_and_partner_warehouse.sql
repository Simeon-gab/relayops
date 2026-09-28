-- ============================================================
-- 0016_spare_parts_and_partner_warehouse.sql
-- RelayOps: spare parts, per-line colour, and Kano as Kabiru's warehouse.
--
--   1. products.category widens to include 'spare_part', and every product
--      gets a unit_label so "13 cartons" and "10 pieces" read correctly next
--      to "80 units". Spare parts are counted by carton, not itemised —
--      tyres-with-alloy-wheel and engines are separate products in pieces.
--   2. shipment_items.color — a load can say "5 red, 5 black" without a
--      product per colour. Stock stays per product; colour is detail.
--   3. warehouses.partner_dealer_id — a warehouse owned by a dealer rather
--      than by us. Kano belongs to Mr Kabiru: he buys, stores and sells
--      himself. Loads to a partner warehouse leave Lagos stock and are never
--      credited as ours. The 192 Crystal previously counted at Kano are
--      written off our books with a manual_adjustment so movements still
--      balance. Undo by clearing partner_dealer_id and reversing that row.
--   4. The Minna dealer's trading name is Kara.
-- ============================================================

-- 1. Spare parts ────────────────────────────────────────────
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_category_check;
ALTER TABLE products
  ADD CONSTRAINT products_category_check
  CHECK (category IN ('motorcycle', 'ebike', 'spare_part'));

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS unit_label text NOT NULL DEFAULT 'unit'
  CHECK (unit_label IN ('unit', 'carton', 'piece'));

INSERT INTO products (sku_code, display_name, category, unit_label, active)
VALUES
  ('HK-SPARES-CTN',     'Spare parts',            'spare_part', 'carton', true),
  ('HK-TYRE-ALLOY',     'Tyre with alloy wheel',  'spare_part', 'piece',  true),
  ('HK-ENGINE-CRYSTAL', 'Crystal engine',         'spare_part', 'piece',  true)
ON CONFLICT (sku_code) DO NOTHING;

-- 2. Colour per shipment line ───────────────────────────────
ALTER TABLE shipment_items ADD COLUMN IF NOT EXISTS color text;

-- 3. Partner warehouse ──────────────────────────────────────
ALTER TABLE warehouses
  ADD COLUMN IF NOT EXISTS partner_dealer_id uuid REFERENCES dealers(id);

UPDATE warehouses
SET partner_dealer_id = (SELECT id FROM dealers WHERE business_name = 'Kabiru' AND deleted_at IS NULL LIMIT 1)
WHERE code = 'KANO' AND partner_dealer_id IS NULL;

INSERT INTO stock_movements
  (warehouse_id, product_id, change_type, quantity_delta, reference_type, reason, created_by)
SELECT ws.warehouse_id, ws.product_id, 'manual_adjustment', -ws.quantity, 'warehouse',
       'Kano is Mr Kabiru''s warehouse — stock delivered there is his, not ours',
       (SELECT id FROM users WHERE role IN ('md', 'manager') ORDER BY created_at LIMIT 1)
FROM warehouse_stock ws
JOIN warehouses w ON w.id = ws.warehouse_id
WHERE w.partner_dealer_id IS NOT NULL AND ws.quantity > 0;

DELETE FROM warehouse_stock
WHERE warehouse_id IN (SELECT id FROM warehouses WHERE partner_dealer_id IS NOT NULL);

-- 4. Minna dealer is Kara ───────────────────────────────────
UPDATE dealers
SET business_name = 'Kara', contact_name = 'Kara', updated_at = now()
WHERE business_name = 'Minna' AND city = 'Minna' AND deleted_at IS NULL;
