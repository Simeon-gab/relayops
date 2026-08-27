-- ============================================================
-- 0015_roles_and_ai_proposals.sql
-- RelayOps: staff roles + the agentic proposal store.
--
-- Two changes that belong in one migration because the RLS
-- policies depend on the new role values:
--
--   1. users.role widens from ('admin','dealer') to
--      ('md','manager','partner','dealer'). Existing 'admin'
--      rows become 'manager'.
--   2. ai_proposals — where background agents write what they
--      want to do, so a human can approve it later. Nothing in
--      the app generated proposals off-request before this.
--
-- Idempotent: safe to re-run.
-- ============================================================


-- ─────────────────────────────────────────
-- 1. ROLES
-- ─────────────────────────────────────────

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

UPDATE users SET role = 'manager' WHERE role = 'admin';

ALTER TABLE users
  ADD CONSTRAINT users_role_check
  CHECK (role IN ('md', 'manager', 'partner', 'dealer'));


-- Staff = anyone who is not a dealer. Replaces the scattered
-- `auth_user_role() = 'admin'` tests below.
CREATE OR REPLACE FUNCTION public.auth_is_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT role FROM users WHERE id = auth.uid()) IN ('md', 'manager', 'partner'),
    false
  );
$$;

-- Money-side staff. The business partner is deliberately excluded:
-- he sees the physical chain, not pricing or payments.
CREATE OR REPLACE FUNCTION public.auth_is_finance()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT role FROM users WHERE id = auth.uid()) IN ('md', 'manager'),
    false
  );
$$;


-- ─────────────────────────────────────────
-- 2. RE-POINT EXISTING POLICIES AT auth_is_staff()
--    Same shape as 0002, new predicate.
-- ─────────────────────────────────────────

DO $$
DECLARE
  t text;
  staff_tables text[] := ARRAY[
    'warehouses', 'users', 'products', 'dealers', 'containers',
    'container_items', 'warehouse_stock', 'stock_movements', 'messages',
    'dealer_orders', 'dealer_order_items', 'shipments', 'shipment_items',
    'status_events', 'receipts', 'message_parse_results', 'audit_log'
  ];
BEGIN
  FOREACH t IN ARRAY staff_tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS admin_all ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS staff_all ON %I', t);
    EXECUTE format(
      'CREATE POLICY staff_all ON %I FOR ALL TO authenticated
         USING (auth_is_staff()) WITH CHECK (auth_is_staff())', t
    );
  END LOOP;
END $$;


-- payments / receipt_extractions carry naira figures the partner
-- must not see, so they get the finance predicate instead.
DROP POLICY IF EXISTS admin_all   ON payments;
DROP POLICY IF EXISTS staff_all   ON payments;
DROP POLICY IF EXISTS finance_all ON payments;

CREATE POLICY finance_all ON payments
  FOR ALL TO authenticated
  USING (auth_is_finance())
  WITH CHECK (auth_is_finance());

DROP POLICY IF EXISTS admin_all   ON receipt_extractions;
DROP POLICY IF EXISTS staff_all   ON receipt_extractions;
DROP POLICY IF EXISTS finance_all ON receipt_extractions;

CREATE POLICY finance_all ON receipt_extractions
  FOR ALL TO authenticated
  USING (auth_is_finance())
  WITH CHECK (auth_is_finance());


-- ─────────────────────────────────────────
-- 3. AUDIT LOG: allow agent-authored rows
--    Background agents act with no signed-in user, so user_id
--    has to be nullable and the actor has to be recorded.
-- ─────────────────────────────────────────

ALTER TABLE audit_log ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE audit_log
  ADD COLUMN IF NOT EXISTS actor text NOT NULL DEFAULT 'user';

ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS audit_log_actor_check;
ALTER TABLE audit_log
  ADD CONSTRAINT audit_log_actor_check CHECK (actor IN ('user', 'agent'));


-- ─────────────────────────────────────────
-- 4. AI_PROPOSALS
--    One row per thing an agent wants to do. The decision queues
--    on every dashboard are a filtered read of this table.
-- ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ai_proposals (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  kind          text        NOT NULL,
  subject_type  text        NOT NULL,   -- 'container' | 'message' | 'receipt' | 'shipment' | 'system'
  subject_id    uuid,                   -- null for standing proposals (e.g. next container load)

  -- What the agent decided, in the shape the executing action expects.
  proposal      jsonb       NOT NULL,
  -- One plain-English line for the decision queue. Written by the agent.
  summary       text        NOT NULL,
  confidence    numeric(3,2),
  -- Naira value at stake, used by the autonomy policy. Null = not money-bearing.
  value_naira   numeric(14,2),

  -- Which dashboard surfaces this.
  audience      text        NOT NULL DEFAULT 'manager',

  status        text        NOT NULL DEFAULT 'pending',
  auto_executed boolean     NOT NULL DEFAULT false,

  ai_model      text,
  ai_notes      text,
  error         text,

  reviewed_by   uuid        REFERENCES users(id),
  reviewed_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT NOW()
);

ALTER TABLE ai_proposals DROP CONSTRAINT IF EXISTS ai_proposals_kind_check;
ALTER TABLE ai_proposals
  ADD CONSTRAINT ai_proposals_kind_check CHECK (kind IN (
    'container_allocation',   -- container landed → how to split it
    'order_from_message',     -- dealer message parsed → draft order
    'payment_from_receipt',   -- receipt extracted → draft payment
    'dispatch_message',       -- shipment created → draft dealer notice
    'next_container_load',    -- weekly: what to load in China
    'stock_alert',            -- watchdog: running out
    'overdue_alert',          -- watchdog: shipment not confirmed
    'credit_alert'            -- watchdog: order over credit limit
  ));

ALTER TABLE ai_proposals DROP CONSTRAINT IF EXISTS ai_proposals_status_check;
ALTER TABLE ai_proposals
  ADD CONSTRAINT ai_proposals_status_check CHECK (status IN (
    'pending', 'approved', 'rejected', 'auto_executed', 'failed', 'superseded'
  ));

ALTER TABLE ai_proposals DROP CONSTRAINT IF EXISTS ai_proposals_audience_check;
ALTER TABLE ai_proposals
  ADD CONSTRAINT ai_proposals_audience_check CHECK (audience IN (
    'md', 'manager', 'partner'
  ));

-- The decision-queue read: pending items for one audience, newest first.
CREATE INDEX IF NOT EXISTS ai_proposals_queue_idx
  ON ai_proposals (audience, status, created_at DESC);

-- Used to supersede an earlier proposal about the same thing.
CREATE INDEX IF NOT EXISTS ai_proposals_subject_idx
  ON ai_proposals (subject_type, subject_id, status);

ALTER TABLE ai_proposals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS staff_all ON ai_proposals;
CREATE POLICY staff_all ON ai_proposals
  FOR ALL TO authenticated
  USING (auth_is_staff())
  WITH CHECK (auth_is_staff());


-- ─────────────────────────────────────────
-- 5. AGENT_RUNS
--    Observability for work that happens with nobody watching.
--    "What did the system do overnight" has to be answerable.
-- ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agent_runs (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  agent        text        NOT NULL,   -- 'parse_message' | 'extract_receipt' | ...
  trigger      text        NOT NULL,   -- 'event' | 'cron' | 'manual'
  subject_type text,
  subject_id   uuid,
  ok           boolean     NOT NULL,
  duration_ms  integer,
  proposal_id  uuid        REFERENCES ai_proposals(id) ON DELETE SET NULL,
  error        text,
  ai_model     text,
  created_at   timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS agent_runs_recent_idx
  ON agent_runs (created_at DESC);

ALTER TABLE agent_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS staff_read ON agent_runs;
CREATE POLICY staff_read ON agent_runs
  FOR SELECT TO authenticated
  USING (auth_is_staff());
