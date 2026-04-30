ALTER TABLE containers ADD COLUMN IF NOT EXISTS bill_of_lading text;
ALTER TABLE containers ADD COLUMN IF NOT EXISTS shipping_line text;
ALTER TABLE containers ADD COLUMN IF NOT EXISTS expected_arrival_date date;
ALTER TABLE containers ADD COLUMN IF NOT EXISTS origin_port text;
