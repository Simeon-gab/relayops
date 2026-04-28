-- ============================================================
-- seed.sql
-- RelayOps: realistic development / demo data
-- Run AFTER both migration files.
--
-- IMPORTANT: The admin user record below uses a placeholder UUID.
-- After you sign in for the first time, run:
--   UPDATE users
--   SET id = '<your-actual-auth-user-id>'
--   WHERE id = '00000000-0000-0000-0002-000000000001';
-- Or replace the UUID here before running.
-- ============================================================


-- ─────────────────────────────────────────
-- WAREHOUSES
-- ─────────────────────────────────────────
INSERT INTO warehouses (id, code, name, city, state, is_import_base, active) VALUES
  ('00000000-0000-0000-0001-000000000001', 'LAGOS', 'Lagos Primary Warehouse',  'Lagos', 'Lagos State', true,  true),
  ('00000000-0000-0000-0001-000000000002', 'KANO',  'Kano Northern Hub',         'Kano',  'Kano State',  false, true);


-- ─────────────────────────────────────────
-- ADMIN USER  (placeholder — see note above)
-- ─────────────────────────────────────────
INSERT INTO users (id, email, role, display_name) VALUES
  ('00000000-0000-0000-0002-000000000001', 'simeonayano209@gmail.com', 'admin', 'Simeon Gabriel');


-- ─────────────────────────────────────────
-- PRODUCTS
-- ─────────────────────────────────────────
INSERT INTO products (id, sku_code, display_name, category, engine_size_cc, color, import_cost_naira, sell_price_naira) VALUES
  ('00000000-0000-0000-0003-000000000001', 'HK-M150-RED', 'Hungkee 150cc Standard - Red',    'motorcycle', 150, 'Red',   280000, 420000),
  ('00000000-0000-0000-0003-000000000002', 'HK-M150-BLU', 'Hungkee 150cc Standard - Blue',   'motorcycle', 150, 'Blue',  280000, 420000),
  ('00000000-0000-0000-0003-000000000003', 'HK-M200-BLK', 'Hungkee 200cc Sport - Black',     'motorcycle', 200, 'Black', 380000, 560000),
  ('00000000-0000-0000-0003-000000000004', 'HK-M200-RED', 'Hungkee 200cc Sport - Red',       'motorcycle', 200, 'Red',   380000, 560000),
  ('00000000-0000-0000-0003-000000000005', 'HK-M125-WHT', 'Hungkee 125cc Economy - White',   'motorcycle', 125, 'White', 210000, 320000),
  ('00000000-0000-0000-0003-000000000006', 'HK-M125-BLK', 'Hungkee 125cc Economy - Black',   'motorcycle', 125, 'Black', 210000, 320000),
  ('00000000-0000-0000-0003-000000000007', 'HK-EB500-BLU','Hungkee 500W E-Bike - Blue',      'ebike',      null,'Blue',  320000, 480000),
  ('00000000-0000-0000-0003-000000000008', 'HK-EB750-BLK','Hungkee 750W E-Bike - Black',     'ebike',      null,'Black', 420000, 620000);


-- ─────────────────────────────────────────
-- DEALERS
-- Lagos zone (south / southwest / southeast): en, yo, ig
-- Kano zone  (north / middle belt):           ha, en
-- ─────────────────────────────────────────
INSERT INTO dealers (id, business_name, contact_name, phone, city, state, preferred_language, served_by_warehouse_id, credit_limit_naira, active) VALUES
  -- Lagos zone
  ('00000000-0000-0000-0004-000000000001', 'Adekunle Motors',        'Adekunle Balogun',   '+2348031110001', 'Lagos',         'Lagos State',   'en', '00000000-0000-0000-0001-000000000001', 5000000,  true),
  ('00000000-0000-0000-0004-000000000002', 'Ibadan Bikes Ltd',       'Taiwo Adeyemi',      '+2348031110002', 'Ibadan',        'Oyo State',     'yo', '00000000-0000-0000-0001-000000000001', 3000000,  true),
  ('00000000-0000-0000-0004-000000000003', 'Sunny Riders',           'Chukwuemeka Obi',    '+2348031110003', 'Onitsha',       'Anambra State', 'ig', '00000000-0000-0000-0001-000000000001', 4000000,  true),
  ('00000000-0000-0000-0004-000000000004', 'Delta Moto Hub',         'Emmanuel Ogheneruona','+2348031110004','Benin City',    'Edo State',     'en', '00000000-0000-0000-0001-000000000001', 3500000,  true),
  ('00000000-0000-0000-0004-000000000005', 'Owerri Auto Centre',     'Ifeanyi Okonkwo',    '+2348031110005', 'Owerri',        'Imo State',     'ig', '00000000-0000-0000-0001-000000000001', 3000000,  true),
  ('00000000-0000-0000-0004-000000000006', 'Port Harcourt Motors',   'Soberekon Amadi',    '+2348031110006', 'Port Harcourt', 'Rivers State',  'en', '00000000-0000-0000-0001-000000000001', 4500000,  true),
  ('00000000-0000-0000-0004-000000000007', 'Aba Two-Wheels',         'Chidi Nwosu',        '+2348031110007', 'Aba',           'Abia State',    'ig', '00000000-0000-0000-0001-000000000001', 2500000,  true),
  ('00000000-0000-0000-0004-000000000008', 'Akure Cycles',           'Adewale Fasanya',    '+2348031110008', 'Akure',         'Ondo State',    'yo', '00000000-0000-0000-0001-000000000001', 2000000,  true),
  -- Kano zone
  ('00000000-0000-0000-0004-000000000009', 'Kano Premier Motors',    'Musa Abdullahi',     '+2348031110009', 'Kano',          'Kano State',    'ha', '00000000-0000-0000-0001-000000000002', 5000000,  true),
  ('00000000-0000-0000-0004-000000000010', 'Kaduna Bikes Express',   'Usman Garba',        '+2348031110010', 'Kaduna',        'Kaduna State',  'ha', '00000000-0000-0000-0001-000000000002', 4000000,  true),
  ('00000000-0000-0000-0004-000000000011', 'Abuja Moto Hub',         'Daniel Okafor',      '+2348031110011', 'Abuja',         'FCT',           'en', '00000000-0000-0000-0001-000000000002', 6000000,  true),
  ('00000000-0000-0000-0004-000000000012', 'Jos Riders Ltd',         'Gyang Pam',          '+2348031110012', 'Jos',           'Plateau State', 'en', '00000000-0000-0000-0001-000000000002', 2500000,  true);


-- ─────────────────────────────────────────
-- CONTAINERS
-- ─────────────────────────────────────────
INSERT INTO containers (id, container_number, arrived_at, recorded_by, status, notes) VALUES
  ('00000000-0000-0000-0005-000000000001', 'CNTU-1234567', (NOW() - INTERVAL '62 days')::date, '00000000-0000-0000-0002-000000000001', 'completed',           'First Q2 shipment — all units allocated and dispatched'),
  ('00000000-0000-0000-0005-000000000002', 'MSCU-9876543', (NOW() - INTERVAL '30 days')::date, '00000000-0000-0000-0002-000000000001', 'allocated',           'Second container — partial dispatch in progress'),
  ('00000000-0000-0000-0005-000000000003', 'HLCU-2468135', (NOW() - INTERVAL '7 days')::date,  '00000000-0000-0000-0002-000000000001', 'pending_allocation',  'Awaiting review of pending dealer orders before allocating');


-- ─────────────────────────────────────────
-- CONTAINER ITEMS
-- ─────────────────────────────────────────
-- Container 1: CNTU-1234567 (62 days ago)
INSERT INTO container_items (container_id, product_id, quantity) VALUES
  ('00000000-0000-0000-0005-000000000001', '00000000-0000-0000-0003-000000000001', 20),  -- M150-RED
  ('00000000-0000-0000-0005-000000000001', '00000000-0000-0000-0003-000000000002', 15),  -- M150-BLU
  ('00000000-0000-0000-0005-000000000001', '00000000-0000-0000-0003-000000000003', 10),  -- M200-BLK
  ('00000000-0000-0000-0005-000000000001', '00000000-0000-0000-0003-000000000007',  8);  -- EB500-BLU

-- Container 2: MSCU-9876543 (30 days ago)
INSERT INTO container_items (container_id, product_id, quantity) VALUES
  ('00000000-0000-0000-0005-000000000002', '00000000-0000-0000-0003-000000000005', 25),  -- M125-WHT
  ('00000000-0000-0000-0005-000000000002', '00000000-0000-0000-0003-000000000006', 20),  -- M125-BLK
  ('00000000-0000-0000-0005-000000000002', '00000000-0000-0000-0003-000000000004', 12),  -- M200-RED
  ('00000000-0000-0000-0005-000000000002', '00000000-0000-0000-0003-000000000007',  5);  -- EB500-BLU

-- Container 3: HLCU-2468135 (7 days ago, not yet allocated)
INSERT INTO container_items (container_id, product_id, quantity) VALUES
  ('00000000-0000-0000-0005-000000000003', '00000000-0000-0000-0003-000000000001', 30),  -- M150-RED
  ('00000000-0000-0000-0005-000000000003', '00000000-0000-0000-0003-000000000002', 18),  -- M150-BLU
  ('00000000-0000-0000-0005-000000000003', '00000000-0000-0000-0003-000000000008',  6);  -- EB750-BLK


-- ─────────────────────────────────────────
-- WAREHOUSE STOCK  (current levels)
-- Lagos: after containers 1+2 arrived, minus units shipped out
-- Kano:  after receiving the Lagos→Kano transfer
-- ─────────────────────────────────────────
-- Lagos
INSERT INTO warehouse_stock (warehouse_id, product_id, quantity) VALUES
  ('00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0003-000000000001', 12),  -- M150-RED
  ('00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0003-000000000002',  9),  -- M150-BLU
  ('00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0003-000000000003',  4),  -- M200-BLK
  ('00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0003-000000000004',  8),  -- M200-RED
  ('00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0003-000000000005', 14),  -- M125-WHT
  ('00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0003-000000000006', 10),  -- M125-BLK
  ('00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0003-000000000007',  7),  -- EB500-BLU
  ('00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0003-000000000008',  0);  -- EB750-BLK (container 3 not yet allocated)

-- Kano (received from Lagos transfer)
INSERT INTO warehouse_stock (warehouse_id, product_id, quantity) VALUES
  ('00000000-0000-0000-0001-000000000002', '00000000-0000-0000-0003-000000000001',  8),  -- M150-RED
  ('00000000-0000-0000-0001-000000000002', '00000000-0000-0000-0003-000000000002',  6),  -- M150-BLU
  ('00000000-0000-0000-0001-000000000002', '00000000-0000-0000-0003-000000000004',  4),  -- M200-RED
  ('00000000-0000-0000-0001-000000000002', '00000000-0000-0000-0003-000000000005', 11),  -- M125-WHT
  ('00000000-0000-0000-0001-000000000002', '00000000-0000-0000-0003-000000000006', 10);  -- M125-BLK


-- ─────────────────────────────────────────
-- DEALER ORDERS
-- ─────────────────────────────────────────
INSERT INTO dealer_orders (id, dealer_id, status, requested_at, source, notes) VALUES
  -- Fulfilled orders
  ('00000000-0000-0000-0006-000000000001', '00000000-0000-0000-0004-000000000001', 'fulfilled',          NOW() - INTERVAL '55 days', 'admin_entry',        'Urgent — market day stock'),
  ('00000000-0000-0000-0006-000000000002', '00000000-0000-0000-0004-000000000002', 'fulfilled',          NOW() - INTERVAL '50 days', 'admin_entry',        null),
  ('00000000-0000-0000-0006-000000000003', '00000000-0000-0000-0004-000000000009', 'fulfilled',          NOW() - INTERVAL '48 days', 'admin_entry',        'Pre-festive stock-up'),
  ('00000000-0000-0000-0006-000000000004', '00000000-0000-0000-0004-000000000006', 'fulfilled',          NOW() - INTERVAL '25 days', 'admin_entry',        null),
  ('00000000-0000-0000-0006-000000000005', '00000000-0000-0000-0004-000000000010', 'fulfilled',          NOW() - INTERVAL '22 days', 'admin_entry',        null),
  -- Partially fulfilled
  ('00000000-0000-0000-0006-000000000006', '00000000-0000-0000-0004-000000000003', 'partially_fulfilled', NOW() - INTERVAL '18 days', 'ai_parsed_message', 'Order parsed from WhatsApp message'),
  -- Pending
  ('00000000-0000-0000-0006-000000000007', '00000000-0000-0000-0004-000000000005', 'pending',            NOW() - INTERVAL '5 days',  'admin_entry',        null),
  ('00000000-0000-0000-0006-000000000008', '00000000-0000-0000-0004-000000000011', 'pending',            NOW() - INTERVAL '3 days',  'dealer_portal',      null);


-- ─────────────────────────────────────────
-- DEALER ORDER ITEMS
-- ─────────────────────────────────────────
-- Order 1: Adekunle Motors → 5×M150-RED, 3×M150-BLU (fulfilled)
INSERT INTO dealer_order_items (id, dealer_order_id, product_id, quantity_requested, quantity_fulfilled, unit_price_naira) VALUES
  ('00000000-0000-0000-0007-000000000001', '00000000-0000-0000-0006-000000000001', '00000000-0000-0000-0003-000000000001', 5, 5, 420000),
  ('00000000-0000-0000-0007-000000000002', '00000000-0000-0000-0006-000000000001', '00000000-0000-0000-0003-000000000002', 3, 3, 420000);

-- Order 2: Ibadan Bikes → 4×M125-WHT, 2×M200-BLK (fulfilled)
INSERT INTO dealer_order_items (id, dealer_order_id, product_id, quantity_requested, quantity_fulfilled, unit_price_naira) VALUES
  ('00000000-0000-0000-0007-000000000003', '00000000-0000-0000-0006-000000000002', '00000000-0000-0000-0003-000000000005', 4, 4, 320000),
  ('00000000-0000-0000-0007-000000000004', '00000000-0000-0000-0006-000000000002', '00000000-0000-0000-0003-000000000003', 2, 2, 560000);

-- Order 3: Kano Premier → 5×M150-RED, 4×M125-WHT (fulfilled)
INSERT INTO dealer_order_items (id, dealer_order_id, product_id, quantity_requested, quantity_fulfilled, unit_price_naira) VALUES
  ('00000000-0000-0000-0007-000000000005', '00000000-0000-0000-0006-000000000003', '00000000-0000-0000-0003-000000000001', 5, 5, 425000),
  ('00000000-0000-0000-0007-000000000006', '00000000-0000-0000-0006-000000000003', '00000000-0000-0000-0003-000000000005', 4, 4, 325000);

-- Order 4: Port Harcourt Motors → 4×M150-RED, 2×M150-BLU (fulfilled)
INSERT INTO dealer_order_items (id, dealer_order_id, product_id, quantity_requested, quantity_fulfilled, unit_price_naira) VALUES
  ('00000000-0000-0000-0007-000000000007', '00000000-0000-0000-0006-000000000004', '00000000-0000-0000-0003-000000000001', 4, 4, 420000),
  ('00000000-0000-0000-0007-000000000008', '00000000-0000-0000-0006-000000000004', '00000000-0000-0000-0003-000000000002', 2, 2, 420000);

-- Order 5: Kaduna Bikes → 3×M150-RED, 2×M200-RED (fulfilled)
INSERT INTO dealer_order_items (id, dealer_order_id, product_id, quantity_requested, quantity_fulfilled, unit_price_naira) VALUES
  ('00000000-0000-0000-0007-000000000009', '00000000-0000-0000-0006-000000000005', '00000000-0000-0000-0003-000000000001', 3, 3, 425000),
  ('00000000-0000-0000-0007-000000000010', '00000000-0000-0000-0006-000000000005', '00000000-0000-0000-0003-000000000004', 2, 2, 565000);

-- Order 6: Sunny Riders → 3×M200-RED, 2×EB500-BLU (partially fulfilled: only 2 M200-RED shipped)
INSERT INTO dealer_order_items (id, dealer_order_id, product_id, quantity_requested, quantity_fulfilled, unit_price_naira) VALUES
  ('00000000-0000-0000-0007-000000000011', '00000000-0000-0000-0006-000000000006', '00000000-0000-0000-0003-000000000004', 3, 2, 560000),
  ('00000000-0000-0000-0007-000000000012', '00000000-0000-0000-0006-000000000006', '00000000-0000-0000-0003-000000000007', 2, 0, 480000);

-- Order 7: Owerri Auto Centre → 3×M125-BLK, 1×EB500-BLU (pending)
INSERT INTO dealer_order_items (id, dealer_order_id, product_id, quantity_requested, quantity_fulfilled, unit_price_naira) VALUES
  ('00000000-0000-0000-0007-000000000013', '00000000-0000-0000-0006-000000000007', '00000000-0000-0000-0003-000000000006', 3, 0, 320000),
  ('00000000-0000-0000-0007-000000000014', '00000000-0000-0000-0006-000000000007', '00000000-0000-0000-0003-000000000007', 1, 0, 480000);

-- Order 8: Abuja Moto Hub → 4×M125-WHT, 3×M125-BLK (pending)
INSERT INTO dealer_order_items (id, dealer_order_id, product_id, quantity_requested, quantity_fulfilled, unit_price_naira) VALUES
  ('00000000-0000-0000-0007-000000000015', '00000000-0000-0000-0006-000000000008', '00000000-0000-0000-0003-000000000005', 4, 0, 322000),
  ('00000000-0000-0000-0007-000000000016', '00000000-0000-0000-0006-000000000008', '00000000-0000-0000-0003-000000000006', 3, 0, 322000);


-- ─────────────────────────────────────────
-- SHIPMENTS
-- ─────────────────────────────────────────
INSERT INTO shipments (id, shipment_type, origin_warehouse_id, destination_warehouse_id, destination_dealer_id, destination_city, destination_state, status, dispatched_at, delivered_at, total_amount_naira, amount_paid_naira, created_by) VALUES
  -- SHP-001: Lagos → Adekunle Motors (delivered)
  ('00000000-0000-0000-0008-000000000001', 'dealer', '00000000-0000-0000-0001-000000000001', null, '00000000-0000-0000-0004-000000000001', 'Lagos',  'Lagos State',
   'delivered', NOW() - INTERVAL '50 days', NOW() - INTERVAL '48 days',
   3360000,  -- (5×420k + 3×420k)
   3360000, '00000000-0000-0000-0002-000000000001'),

  -- SHP-002: Lagos → Ibadan Bikes (delivered)
  ('00000000-0000-0000-0008-000000000002', 'dealer', '00000000-0000-0000-0001-000000000001', null, '00000000-0000-0000-0004-000000000002', 'Ibadan', 'Oyo State',
   'delivered', NOW() - INTERVAL '45 days', NOW() - INTERVAL '43 days',
   2400000,  -- (4×320k + 2×560k)
   2400000, '00000000-0000-0000-0002-000000000001'),

  -- SHP-003: Lagos → Kano (warehouse transfer, delivered)
  ('00000000-0000-0000-0008-000000000003', 'transfer', '00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0001-000000000002', null, null, null,
   'delivered', NOW() - INTERVAL '42 days', NOW() - INTERVAL '40 days',
   null, 0, '00000000-0000-0000-0002-000000000001'),

  -- SHP-004: Kano → Kano Premier Motors (delivered)
  ('00000000-0000-0000-0008-000000000004', 'dealer', '00000000-0000-0000-0001-000000000002', null, '00000000-0000-0000-0004-000000000009', 'Kano', 'Kano State',
   'delivered', NOW() - INTERVAL '38 days', NOW() - INTERVAL '36 days',
   3425000,  -- (5×425k + 4×325k... wait let me recalc: 5×425k=2125k + 4×325k=1300k = 3425k)
   3425000, '00000000-0000-0000-0002-000000000001'),

  -- SHP-005: Lagos → Port Harcourt Motors (in_transit)
  ('00000000-0000-0000-0008-000000000005', 'dealer', '00000000-0000-0000-0001-000000000001', null, '00000000-0000-0000-0004-000000000006', 'Port Harcourt', 'Rivers State',
   'in_transit', NOW() - INTERVAL '5 days', null,
   2520000,  -- (4×420k + 2×420k = 2520k)
   1000000, '00000000-0000-0000-0002-000000000001'),

  -- SHP-006: Kano → Kaduna Bikes Express (delivered)
  ('00000000-0000-0000-0008-000000000006', 'dealer', '00000000-0000-0000-0001-000000000002', null, '00000000-0000-0000-0004-000000000010', 'Kaduna', 'Kaduna State',
   'delivered', NOW() - INTERVAL '20 days', NOW() - INTERVAL '18 days',
   2405000,  -- (3×425k + 2×565k = 1275k + 1130k = 2405k)
   2405000, '00000000-0000-0000-0002-000000000001'),

  -- SHP-007: Lagos → Sunny Riders / partial (in_transit)
  ('00000000-0000-0000-0008-000000000007', 'dealer', '00000000-0000-0000-0001-000000000001', null, '00000000-0000-0000-0004-000000000003', 'Onitsha', 'Anambra State',
   'in_transit', NOW() - INTERVAL '8 days', null,
   1120000,  -- only 2×M200-RED shipped (2×560k)
   0, '00000000-0000-0000-0002-000000000001');


-- ─────────────────────────────────────────
-- SHIPMENT ITEMS
-- ─────────────────────────────────────────
-- SHP-001: Adekunle Motors
INSERT INTO shipment_items (shipment_id, product_id, quantity, unit_price_naira, dealer_order_item_id) VALUES
  ('00000000-0000-0000-0008-000000000001', '00000000-0000-0000-0003-000000000001', 5, 420000, '00000000-0000-0000-0007-000000000001'),
  ('00000000-0000-0000-0008-000000000001', '00000000-0000-0000-0003-000000000002', 3, 420000, '00000000-0000-0000-0007-000000000002');

-- SHP-002: Ibadan Bikes
INSERT INTO shipment_items (shipment_id, product_id, quantity, unit_price_naira, dealer_order_item_id) VALUES
  ('00000000-0000-0000-0008-000000000002', '00000000-0000-0000-0003-000000000005', 4, 320000, '00000000-0000-0000-0007-000000000003'),
  ('00000000-0000-0000-0008-000000000002', '00000000-0000-0000-0003-000000000003', 2, 560000, '00000000-0000-0000-0007-000000000004');

-- SHP-003: Lagos → Kano transfer
INSERT INTO shipment_items (shipment_id, product_id, quantity, unit_price_naira) VALUES
  ('00000000-0000-0000-0008-000000000003', '00000000-0000-0000-0003-000000000001', 13, null),
  ('00000000-0000-0000-0008-000000000003', '00000000-0000-0000-0003-000000000002',  9, null),
  ('00000000-0000-0000-0008-000000000003', '00000000-0000-0000-0003-000000000004',  6, null),
  ('00000000-0000-0000-0008-000000000003', '00000000-0000-0000-0003-000000000005', 15, null),
  ('00000000-0000-0000-0008-000000000003', '00000000-0000-0000-0003-000000000006', 15, null);

-- SHP-004: Kano Premier Motors
INSERT INTO shipment_items (shipment_id, product_id, quantity, unit_price_naira, dealer_order_item_id) VALUES
  ('00000000-0000-0000-0008-000000000004', '00000000-0000-0000-0003-000000000001', 5, 425000, '00000000-0000-0000-0007-000000000005'),
  ('00000000-0000-0000-0008-000000000004', '00000000-0000-0000-0003-000000000005', 4, 325000, '00000000-0000-0000-0007-000000000006');

-- SHP-005: Port Harcourt Motors
INSERT INTO shipment_items (shipment_id, product_id, quantity, unit_price_naira, dealer_order_item_id) VALUES
  ('00000000-0000-0000-0008-000000000005', '00000000-0000-0000-0003-000000000001', 4, 420000, '00000000-0000-0000-0007-000000000007'),
  ('00000000-0000-0000-0008-000000000005', '00000000-0000-0000-0003-000000000002', 2, 420000, '00000000-0000-0000-0007-000000000008');

-- SHP-006: Kaduna Bikes Express
INSERT INTO shipment_items (shipment_id, product_id, quantity, unit_price_naira, dealer_order_item_id) VALUES
  ('00000000-0000-0000-0008-000000000006', '00000000-0000-0000-0003-000000000001', 3, 425000, '00000000-0000-0000-0007-000000000009'),
  ('00000000-0000-0000-0008-000000000006', '00000000-0000-0000-0003-000000000004', 2, 565000, '00000000-0000-0000-0007-000000000010');

-- SHP-007: Sunny Riders (partial — only M200-RED shipped)
INSERT INTO shipment_items (shipment_id, product_id, quantity, unit_price_naira, dealer_order_item_id) VALUES
  ('00000000-0000-0000-0008-000000000007', '00000000-0000-0000-0003-000000000004', 2, 560000, '00000000-0000-0000-0007-000000000011');


-- ─────────────────────────────────────────
-- STATUS EVENTS  (full timeline per shipment)
-- ─────────────────────────────────────────
-- SHP-001: Adekunle Motors
INSERT INTO status_events (shipment_id, from_status, to_status, event_at, recorded_by, source) VALUES
  ('00000000-0000-0000-0008-000000000001', null,          'pending',    NOW() - INTERVAL '54 days', '00000000-0000-0000-0002-000000000001', 'admin'),
  ('00000000-0000-0000-0008-000000000001', 'pending',     'dispatched', NOW() - INTERVAL '50 days', '00000000-0000-0000-0002-000000000001', 'admin'),
  ('00000000-0000-0000-0008-000000000001', 'dispatched',  'in_transit', NOW() - INTERVAL '49 days', '00000000-0000-0000-0002-000000000001', 'admin'),
  ('00000000-0000-0000-0008-000000000001', 'in_transit',  'delivered',  NOW() - INTERVAL '48 days', '00000000-0000-0000-0002-000000000001', 'dealer_confirmation');

-- SHP-002: Ibadan Bikes
INSERT INTO status_events (shipment_id, from_status, to_status, event_at, recorded_by, source) VALUES
  ('00000000-0000-0000-0008-000000000002', null,          'pending',    NOW() - INTERVAL '48 days', '00000000-0000-0000-0002-000000000001', 'admin'),
  ('00000000-0000-0000-0008-000000000002', 'pending',     'dispatched', NOW() - INTERVAL '45 days', '00000000-0000-0000-0002-000000000001', 'admin'),
  ('00000000-0000-0000-0008-000000000002', 'dispatched',  'in_transit', NOW() - INTERVAL '44 days', '00000000-0000-0000-0002-000000000001', 'admin'),
  ('00000000-0000-0000-0008-000000000002', 'in_transit',  'delivered',  NOW() - INTERVAL '43 days', '00000000-0000-0000-0002-000000000001', 'dealer_confirmation');

-- SHP-003: Lagos → Kano transfer
INSERT INTO status_events (shipment_id, from_status, to_status, event_at, recorded_by, source) VALUES
  ('00000000-0000-0000-0008-000000000003', null,          'pending',    NOW() - INTERVAL '44 days', '00000000-0000-0000-0002-000000000001', 'admin'),
  ('00000000-0000-0000-0008-000000000003', 'pending',     'dispatched', NOW() - INTERVAL '42 days', '00000000-0000-0000-0002-000000000001', 'admin'),
  ('00000000-0000-0000-0008-000000000003', 'dispatched',  'in_transit', NOW() - INTERVAL '41 days', '00000000-0000-0000-0002-000000000001', 'admin'),
  ('00000000-0000-0000-0008-000000000003', 'in_transit',  'delivered',  NOW() - INTERVAL '40 days', '00000000-0000-0000-0002-000000000001', 'admin');

-- SHP-004: Kano Premier Motors
INSERT INTO status_events (shipment_id, from_status, to_status, event_at, recorded_by, source) VALUES
  ('00000000-0000-0000-0008-000000000004', null,          'pending',    NOW() - INTERVAL '40 days', '00000000-0000-0000-0002-000000000001', 'admin'),
  ('00000000-0000-0000-0008-000000000004', 'pending',     'dispatched', NOW() - INTERVAL '38 days', '00000000-0000-0000-0002-000000000001', 'admin'),
  ('00000000-0000-0000-0008-000000000004', 'dispatched',  'in_transit', NOW() - INTERVAL '37 days', '00000000-0000-0000-0002-000000000001', 'admin'),
  ('00000000-0000-0000-0008-000000000004', 'in_transit',  'delivered',  NOW() - INTERVAL '36 days', '00000000-0000-0000-0002-000000000001', 'dealer_confirmation');

-- SHP-005: Port Harcourt Motors (in_transit)
INSERT INTO status_events (shipment_id, from_status, to_status, event_at, recorded_by, source) VALUES
  ('00000000-0000-0000-0008-000000000005', null,          'pending',    NOW() - INTERVAL '7 days',  '00000000-0000-0000-0002-000000000001', 'admin'),
  ('00000000-0000-0000-0008-000000000005', 'pending',     'dispatched', NOW() - INTERVAL '5 days',  '00000000-0000-0000-0002-000000000001', 'admin'),
  ('00000000-0000-0000-0008-000000000005', 'dispatched',  'in_transit', NOW() - INTERVAL '4 days',  '00000000-0000-0000-0002-000000000001', 'admin');

-- SHP-006: Kaduna Bikes Express
INSERT INTO status_events (shipment_id, from_status, to_status, event_at, recorded_by, source) VALUES
  ('00000000-0000-0000-0008-000000000006', null,          'pending',    NOW() - INTERVAL '22 days', '00000000-0000-0000-0002-000000000001', 'admin'),
  ('00000000-0000-0000-0008-000000000006', 'pending',     'dispatched', NOW() - INTERVAL '20 days', '00000000-0000-0000-0002-000000000001', 'admin'),
  ('00000000-0000-0000-0008-000000000006', 'dispatched',  'in_transit', NOW() - INTERVAL '19 days', '00000000-0000-0000-0002-000000000001', 'admin'),
  ('00000000-0000-0000-0008-000000000006', 'in_transit',  'delivered',  NOW() - INTERVAL '18 days', '00000000-0000-0000-0002-000000000001', 'dealer_confirmation');

-- SHP-007: Sunny Riders (in_transit)
INSERT INTO status_events (shipment_id, from_status, to_status, event_at, recorded_by, source) VALUES
  ('00000000-0000-0000-0008-000000000007', null,          'pending',    NOW() - INTERVAL '10 days', '00000000-0000-0000-0002-000000000001', 'admin'),
  ('00000000-0000-0000-0008-000000000007', 'pending',     'dispatched', NOW() - INTERVAL '8 days',  '00000000-0000-0000-0002-000000000001', 'admin'),
  ('00000000-0000-0000-0008-000000000007', 'dispatched',  'in_transit', NOW() - INTERVAL '7 days',  '00000000-0000-0000-0002-000000000001', 'admin');


-- ─────────────────────────────────────────
-- STOCK MOVEMENTS  (key events driving current stock levels)
-- ─────────────────────────────────────────
-- Container 1 arrives at Lagos
INSERT INTO stock_movements (warehouse_id, product_id, change_type, quantity_delta, reference_type, reference_id, created_by, created_at) VALUES
  ('00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0003-000000000001', 'container_arrival',  20, 'container', '00000000-0000-0000-0005-000000000001', '00000000-0000-0000-0002-000000000001', NOW() - INTERVAL '62 days'),
  ('00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0003-000000000002', 'container_arrival',  15, 'container', '00000000-0000-0000-0005-000000000001', '00000000-0000-0000-0002-000000000001', NOW() - INTERVAL '62 days'),
  ('00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0003-000000000003', 'container_arrival',  10, 'container', '00000000-0000-0000-0005-000000000001', '00000000-0000-0000-0002-000000000001', NOW() - INTERVAL '62 days'),
  ('00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0003-000000000007', 'container_arrival',   8, 'container', '00000000-0000-0000-0005-000000000001', '00000000-0000-0000-0002-000000000001', NOW() - INTERVAL '62 days');

-- Container 2 arrives at Lagos
INSERT INTO stock_movements (warehouse_id, product_id, change_type, quantity_delta, reference_type, reference_id, created_by, created_at) VALUES
  ('00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0003-000000000005', 'container_arrival',  25, 'container', '00000000-0000-0000-0005-000000000002', '00000000-0000-0000-0002-000000000001', NOW() - INTERVAL '30 days'),
  ('00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0003-000000000006', 'container_arrival',  20, 'container', '00000000-0000-0000-0005-000000000002', '00000000-0000-0000-0002-000000000001', NOW() - INTERVAL '30 days'),
  ('00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0003-000000000004', 'container_arrival',  12, 'container', '00000000-0000-0000-0005-000000000002', '00000000-0000-0000-0002-000000000001', NOW() - INTERVAL '30 days'),
  ('00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0003-000000000007', 'container_arrival',   5, 'container', '00000000-0000-0000-0005-000000000002', '00000000-0000-0000-0002-000000000001', NOW() - INTERVAL '30 days');

-- Transfer out from Lagos
INSERT INTO stock_movements (warehouse_id, product_id, change_type, quantity_delta, reference_type, reference_id, created_by, created_at) VALUES
  ('00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0003-000000000001', 'transfer_out', -13, 'shipment', '00000000-0000-0000-0008-000000000003', '00000000-0000-0000-0002-000000000001', NOW() - INTERVAL '42 days'),
  ('00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0003-000000000002', 'transfer_out',  -9, 'shipment', '00000000-0000-0000-0008-000000000003', '00000000-0000-0000-0002-000000000001', NOW() - INTERVAL '42 days'),
  ('00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0003-000000000004', 'transfer_out',  -6, 'shipment', '00000000-0000-0000-0008-000000000003', '00000000-0000-0000-0002-000000000001', NOW() - INTERVAL '42 days'),
  ('00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0003-000000000005', 'transfer_out', -15, 'shipment', '00000000-0000-0000-0008-000000000003', '00000000-0000-0000-0002-000000000001', NOW() - INTERVAL '42 days'),
  ('00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0003-000000000006', 'transfer_out', -15, 'shipment', '00000000-0000-0000-0008-000000000003', '00000000-0000-0000-0002-000000000001', NOW() - INTERVAL '42 days');

-- Transfer in to Kano
INSERT INTO stock_movements (warehouse_id, product_id, change_type, quantity_delta, reference_type, reference_id, created_by, created_at) VALUES
  ('00000000-0000-0000-0001-000000000002', '00000000-0000-0000-0003-000000000001', 'transfer_in',  13, 'shipment', '00000000-0000-0000-0008-000000000003', '00000000-0000-0000-0002-000000000001', NOW() - INTERVAL '40 days'),
  ('00000000-0000-0000-0001-000000000002', '00000000-0000-0000-0003-000000000002', 'transfer_in',   9, 'shipment', '00000000-0000-0000-0008-000000000003', '00000000-0000-0000-0002-000000000001', NOW() - INTERVAL '40 days'),
  ('00000000-0000-0000-0001-000000000002', '00000000-0000-0000-0003-000000000004', 'transfer_in',   6, 'shipment', '00000000-0000-0000-0008-000000000003', '00000000-0000-0000-0002-000000000001', NOW() - INTERVAL '40 days'),
  ('00000000-0000-0000-0001-000000000002', '00000000-0000-0000-0003-000000000005', 'transfer_in',  15, 'shipment', '00000000-0000-0000-0008-000000000003', '00000000-0000-0000-0002-000000000001', NOW() - INTERVAL '40 days'),
  ('00000000-0000-0000-0001-000000000002', '00000000-0000-0000-0003-000000000006', 'transfer_in',  15, 'shipment', '00000000-0000-0000-0008-000000000003', '00000000-0000-0000-0002-000000000001', NOW() - INTERVAL '40 days');

-- Dealer shipment dispatches from Lagos
INSERT INTO stock_movements (warehouse_id, product_id, change_type, quantity_delta, reference_type, reference_id, created_by, created_at) VALUES
  -- SHP-001 Adekunle
  ('00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0003-000000000001', 'shipment_dispatch', -5, 'shipment', '00000000-0000-0000-0008-000000000001', '00000000-0000-0000-0002-000000000001', NOW() - INTERVAL '50 days'),
  ('00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0003-000000000002', 'shipment_dispatch', -3, 'shipment', '00000000-0000-0000-0008-000000000001', '00000000-0000-0000-0002-000000000001', NOW() - INTERVAL '50 days'),
  -- SHP-002 Ibadan
  ('00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0003-000000000005', 'shipment_dispatch', -4, 'shipment', '00000000-0000-0000-0008-000000000002', '00000000-0000-0000-0002-000000000001', NOW() - INTERVAL '45 days'),
  ('00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0003-000000000003', 'shipment_dispatch', -2, 'shipment', '00000000-0000-0000-0008-000000000002', '00000000-0000-0000-0002-000000000001', NOW() - INTERVAL '45 days'),
  -- SHP-005 Port Harcourt
  ('00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0003-000000000001', 'shipment_dispatch', -4, 'shipment', '00000000-0000-0000-0008-000000000005', '00000000-0000-0000-0002-000000000001', NOW() - INTERVAL '5 days'),
  ('00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0003-000000000002', 'shipment_dispatch', -2, 'shipment', '00000000-0000-0000-0008-000000000005', '00000000-0000-0000-0002-000000000001', NOW() - INTERVAL '5 days'),
  -- SHP-007 Sunny Riders (partial)
  ('00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0003-000000000004', 'shipment_dispatch', -2, 'shipment', '00000000-0000-0000-0008-000000000007', '00000000-0000-0000-0002-000000000001', NOW() - INTERVAL '8 days');

-- Dealer shipment dispatches from Kano
INSERT INTO stock_movements (warehouse_id, product_id, change_type, quantity_delta, reference_type, reference_id, created_by, created_at) VALUES
  -- SHP-004 Kano Premier
  ('00000000-0000-0000-0001-000000000002', '00000000-0000-0000-0003-000000000001', 'shipment_dispatch', -5, 'shipment', '00000000-0000-0000-0008-000000000004', '00000000-0000-0000-0002-000000000001', NOW() - INTERVAL '38 days'),
  ('00000000-0000-0000-0001-000000000002', '00000000-0000-0000-0003-000000000005', 'shipment_dispatch', -4, 'shipment', '00000000-0000-0000-0008-000000000004', '00000000-0000-0000-0002-000000000001', NOW() - INTERVAL '38 days'),
  -- SHP-006 Kaduna
  ('00000000-0000-0000-0001-000000000002', '00000000-0000-0000-0003-000000000001', 'shipment_dispatch', -3, 'shipment', '00000000-0000-0000-0008-000000000006', '00000000-0000-0000-0002-000000000001', NOW() - INTERVAL '20 days'),
  ('00000000-0000-0000-0001-000000000002', '00000000-0000-0000-0003-000000000004', 'shipment_dispatch', -2, 'shipment', '00000000-0000-0000-0008-000000000006', '00000000-0000-0000-0002-000000000001', NOW() - INTERVAL '20 days');


-- ─────────────────────────────────────────
-- MESSAGES
-- ─────────────────────────────────────────
INSERT INTO messages (id, dealer_id, direction, channel, language, original_text, translated_text, created_by) VALUES
  -- Inbound from Sunny Riders (Igbo, WhatsApp)
  ('00000000-0000-0000-0009-000000000001',
   '00000000-0000-0000-0004-000000000003',
   'inbound', 'whatsapp', 'ig',
   'Nna men, a biko zipu m 3 nke M200 RED na 2 nke ebike. Anyị chekwara ọtụtụ ndị ahịa',
   'Please send us 3 M200 RED and 2 e-bikes. We have many customers waiting.',
   null),

  -- Outbound to Sunny Riders (English, portal)
  ('00000000-0000-0000-0009-000000000002',
   '00000000-0000-0000-0004-000000000003',
   'outbound', 'dealer_portal', 'en',
   'Dear Sunny Riders, we have received your order (3×HK-M200-RED, 2×HK-EB500-BLU). We currently have 2 units of M200-RED available and will dispatch shortly. The e-bikes are on back-order from the next container.',
   null,
   '00000000-0000-0000-0002-000000000001'),

  -- Inbound from Kano Premier (Hausa, WhatsApp)
  ('00000000-0000-0000-0009-000000000003',
   '00000000-0000-0000-0004-000000000009',
   'inbound', 'whatsapp', 'ha',
   'Ina son sanin yanayin jirgin wanda kuka aika. Har yanzu bamu karba ba.',
   'I want to know the status of the shipment you sent. We have not received it yet.',
   null),

  -- Inbound from Abuja Moto Hub (English, portal)
  ('00000000-0000-0000-0009-000000000004',
   '00000000-0000-0000-0004-000000000011',
   'inbound', 'dealer_portal', 'en',
   'Hi, we would like to order 4 units of the 125cc White and 3 units of 125cc Black. Please confirm availability and pricing.',
   null,
   null);

-- Link order 6 (Sunny Riders) to the message that triggered it
UPDATE dealer_orders
   SET source_message_id = '00000000-0000-0000-0009-000000000001'
 WHERE id = '00000000-0000-0000-0006-000000000006';


-- ─────────────────────────────────────────
-- MESSAGE PARSE RESULTS
-- ─────────────────────────────────────────
INSERT INTO message_parse_results (message_id, parsed_intent, extracted_data, confidence, ai_model, ai_notes) VALUES
  -- Parse of Sunny Riders' Igbo message
  ('00000000-0000-0000-0009-000000000001',
   'order_request',
   '{"products": [{"sku": "HK-M200-RED", "quantity": 3}, {"sku": "HK-EB500-BLU", "quantity": 2}], "urgency": "high"}',
   0.91,
   'claude-sonnet-4-6',
   'SKUs inferred from product catalog match. Quantity explicit in original text. High urgency flagged from "ọtụtụ ndị ahịa" (many customers waiting).'),

  -- Parse of Kano Premier's Hausa message
  ('00000000-0000-0000-0009-000000000003',
   'status_question',
   '{"shipment_reference": null, "inquiry_type": "delivery_status"}',
   0.87,
   'claude-sonnet-4-6',
   'No explicit shipment reference given — matched to most recent in_transit shipment for this dealer. Flagged for admin review.'),

  -- Parse of Abuja Moto Hub's English message
  ('00000000-0000-0000-0009-000000000004',
   'order_request',
   '{"products": [{"sku": "HK-M125-WHT", "quantity": 4}, {"sku": "HK-M125-BLK", "quantity": 3}], "urgency": "normal"}',
   0.97,
   'claude-sonnet-4-6',
   null);


-- ─────────────────────────────────────────
-- RECEIPTS  (two uploaded receipts)
-- ─────────────────────────────────────────
INSERT INTO receipts (id, dealer_id, storage_path, file_type, uploaded_by, upload_source, status) VALUES
  ('00000000-0000-0000-0010-000000000001',
   '00000000-0000-0000-0004-000000000001',
   'receipts/adekunle-motors/receipt-shp001-20260318.jpg', 'image/jpeg',
   '00000000-0000-0000-0002-000000000001', 'admin_upload', 'matched'),

  ('00000000-0000-0000-0010-000000000002',
   '00000000-0000-0000-0004-000000000006',
   'receipts/ph-motors/receipt-shp005-partial.jpg', 'image/jpeg',
   '00000000-0000-0000-0002-000000000001', 'admin_upload', 'extracted');


-- ─────────────────────────────────────────
-- RECEIPT EXTRACTIONS
-- ─────────────────────────────────────────
INSERT INTO receipt_extractions (receipt_id, extracted_amount_naira, extracted_date, extracted_reference, extracted_payer_name, extracted_recipient, extracted_method, field_confidences, overall_confidence, raw_response, ai_model) VALUES
  -- Extraction for Adekunle receipt
  ('00000000-0000-0000-0010-000000000001',
   3360000,
   (NOW() - INTERVAL '46 days')::date,
   'GTB-TXN-20260319-004477',
   'Adekunle Motors Ltd',
   'Hungkee Motorcycle Nigeria',
   'bank_transfer',
   '{"amount": 0.99, "date": 0.97, "reference": 0.95, "payer_name": 0.92, "recipient": 0.88, "method": 0.98}',
   0.95,
   '{}',
   'claude-sonnet-4-6'),

  -- Extraction for Port Harcourt partial payment
  ('00000000-0000-0000-0010-000000000002',
   1000000,
   (NOW() - INTERVAL '2 days')::date,
   'UBA-TXN-20260426-009821',
   'Port Harcourt Motors',
   'Hungkee Motorcycle Nigeria',
   'bank_transfer',
   '{"amount": 0.98, "date": 0.96, "reference": 0.94, "payer_name": 0.85, "recipient": 0.89, "method": 0.97}',
   0.93,
   '{}',
   'claude-sonnet-4-6');


-- ─────────────────────────────────────────
-- PAYMENTS
-- ─────────────────────────────────────────
INSERT INTO payments (dealer_id, shipment_id, amount_naira, payment_date, payment_reference, payment_method, recorded_by, source, receipt_id, notes) VALUES
  -- Adekunle Motors — full payment
  ('00000000-0000-0000-0004-000000000001', '00000000-0000-0000-0008-000000000001',
   3360000, (NOW() - INTERVAL '46 days')::date,
   'GTB-TXN-20260319-004477', 'bank_transfer',
   '00000000-0000-0000-0002-000000000001', 'receipt_extraction',
   '00000000-0000-0000-0010-000000000001', null),

  -- Ibadan Bikes — full payment
  ('00000000-0000-0000-0004-000000000002', '00000000-0000-0000-0008-000000000002',
   2400000, (NOW() - INTERVAL '40 days')::date,
   null, 'cash',
   '00000000-0000-0000-0002-000000000001', 'admin_manual',
   null, 'Cash payment collected at handover in Ibadan'),

  -- Kano Premier — full payment
  ('00000000-0000-0000-0004-000000000009', '00000000-0000-0000-0008-000000000004',
   3425000, (NOW() - INTERVAL '33 days')::date,
   'FBN-TXN-20260325-007733', 'bank_transfer',
   '00000000-0000-0000-0002-000000000001', 'admin_manual',
   null, null),

  -- Kaduna Bikes — full payment
  ('00000000-0000-0000-0004-000000000010', '00000000-0000-0000-0008-000000000006',
   2405000, (NOW() - INTERVAL '15 days')::date,
   'ZNB-TXN-20260413-002214', 'bank_transfer',
   '00000000-0000-0000-0002-000000000001', 'admin_manual',
   null, null),

  -- Port Harcourt Motors — partial payment (shipment still in transit)
  ('00000000-0000-0000-0004-000000000006', '00000000-0000-0000-0008-000000000005',
   1000000, (NOW() - INTERVAL '2 days')::date,
   'UBA-TXN-20260426-009821', 'bank_transfer',
   '00000000-0000-0000-0002-000000000001', 'receipt_extraction',
   '00000000-0000-0000-0010-000000000002', 'Partial payment — balance due on delivery');
