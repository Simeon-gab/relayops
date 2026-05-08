-- ============================================================
-- 0011_notifications.sql
-- In-app notification table for RelayOps
-- ============================================================

CREATE TABLE IF NOT EXISTS notifications (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type        text        NOT NULL CHECK (event_type IN (
                                  'order_created',
                                  'payment_received',
                                  'receipt_extracted',
                                  'shipment_delivered',
                                  'shipment_dispatched',
                                  'message_received',
                                  'allocation_pending',
                                  'order_auto_fulfilled'
                                )),
  title             text        NOT NULL,
  description       text,
  entity_type       text,
  entity_id         uuid,
  read_at           timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_recipient_unread
  ON notifications(recipient_user_id, read_at, created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_see_own_notifications" ON notifications
  FOR SELECT USING (auth.uid() = recipient_user_id);

CREATE POLICY "users_update_own_notifications" ON notifications
  FOR UPDATE USING (auth.uid() = recipient_user_id);

-- Server-side actions insert via service role (bypasses RLS).
-- This policy allows authenticated server code to insert for any recipient.
CREATE POLICY "service_insert_notifications" ON notifications
  FOR INSERT WITH CHECK (true);
