-- Drop old constraint first (old enum: order_request, status_question, complaint, confirmation, other)
-- then migrate existing rows to new enum, then add new constraint.

ALTER TABLE message_parse_results
  DROP CONSTRAINT IF EXISTS message_parse_results_parsed_intent_check;

-- Map old intent values to new ones
UPDATE message_parse_results SET parsed_intent = 'question_inquiry' WHERE parsed_intent = 'status_question';
UPDATE message_parse_results SET parsed_intent = 'general'          WHERE parsed_intent IN ('complaint', 'confirmation', 'other');

ALTER TABLE message_parse_results
  ADD CONSTRAINT message_parse_results_parsed_intent_check
  CHECK (parsed_intent = ANY (ARRAY[
    'order_request',
    'payment_notification',
    'delivery_status',
    'question_inquiry',
    'general'
  ]));
