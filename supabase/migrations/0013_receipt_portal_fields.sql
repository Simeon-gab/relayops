-- ============================================================
-- 0013_receipt_portal_fields.sql
-- Adds dealer-portal-specific columns to the receipts table:
--   linked_order_id  — optional FK to the order this receipt pays toward
--   notes            — optional free-text from the dealer at upload time
-- Both are nullable; existing rows are unaffected.
-- ============================================================

ALTER TABLE receipts
  ADD COLUMN IF NOT EXISTS linked_order_id uuid REFERENCES dealer_orders(id),
  ADD COLUMN IF NOT EXISTS notes text;

CREATE INDEX IF NOT EXISTS idx_receipts_linked_order
  ON receipts(linked_order_id)
  WHERE linked_order_id IS NOT NULL;
