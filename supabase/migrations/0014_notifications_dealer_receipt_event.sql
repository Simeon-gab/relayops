-- ============================================================
-- 0014_notifications_dealer_receipt_event.sql
-- Adds 'dealer_receipt_uploaded' to the notifications event_type
-- CHECK constraint so dealer portal uploads can fire notifications.
-- Applied directly via pg client 2026-05-23.
-- ============================================================

ALTER TABLE notifications
  DROP CONSTRAINT notifications_event_type_check,
  ADD CONSTRAINT notifications_event_type_check CHECK (
    event_type = ANY (ARRAY[
      'order_created',
      'payment_received',
      'receipt_extracted',
      'shipment_delivered',
      'shipment_dispatched',
      'message_received',
      'allocation_pending',
      'order_auto_fulfilled',
      'dealer_receipt_uploaded'
    ])
  );
