ALTER TABLE message_parse_results
  ADD COLUMN IF NOT EXISTS raw_response jsonb,
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES users(id);
