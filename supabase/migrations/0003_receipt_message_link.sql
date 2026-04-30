-- Add optional FK from receipts to messages so receipt uploads from the
-- inbound-message form can be traced back to the message they arrived with.
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS message_id uuid REFERENCES messages(id);
CREATE INDEX IF NOT EXISTS idx_receipts_message_id ON receipts(message_id) WHERE message_id IS NOT NULL;
