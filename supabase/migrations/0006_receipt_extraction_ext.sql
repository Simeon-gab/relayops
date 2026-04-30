ALTER TABLE receipt_extractions
  ADD COLUMN IF NOT EXISTS shipment_match_id uuid REFERENCES shipments(id),
  ADD COLUMN IF NOT EXISTS is_payment_receipt boolean NOT NULL DEFAULT true;
