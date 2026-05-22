-- ============================================================
-- 0012_storage_rls_receipts.sql
-- RelayOps: RLS policies for storage.objects — receipts bucket
-- Run AFTER 0002_rls_policies.sql (depends on auth_user_role()
-- and auth_user_dealer_id() helper functions).
-- Idempotent: safe to run multiple times.
--
-- Folder convention enforced by these policies:
--   {dealer_id}/{receipt_id}.{ext}  — both admin and dealer uploads
--
-- In storage.objects, `name` is the path within the bucket, so
-- the first segment is always a dealer UUID.
-- ============================================================


-- ─────────────────────────────────────────
-- ENABLE RLS (idempotent — no-op if already enabled)
-- ─────────────────────────────────────────
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- POLICIES
-- DROP IF EXISTS immediately before each CREATE so re-runs are safe.
-- ============================================================


-- ─────────────────────────────────────────
-- INSERT — admin
-- ─────────────────────────────────────────
DROP POLICY IF EXISTS admin_can_upload_anywhere_to_receipts ON storage.objects;

CREATE POLICY admin_can_upload_anywhere_to_receipts ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'receipts'
    AND public.auth_user_role() = 'admin'
  );


-- ─────────────────────────────────────────
-- INSERT — dealer (own folder only)
-- ─────────────────────────────────────────
DROP POLICY IF EXISTS dealer_can_upload_to_own_folder ON storage.objects;

CREATE POLICY dealer_can_upload_to_own_folder ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'receipts'
    AND public.auth_user_role() = 'dealer'
    AND (storage.foldername(name))[1] = public.auth_user_dealer_id()::text
  );


-- ─────────────────────────────────────────
-- SELECT — admin
-- ─────────────────────────────────────────
DROP POLICY IF EXISTS admin_can_read_all_receipts ON storage.objects;

CREATE POLICY admin_can_read_all_receipts ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'receipts'
    AND public.auth_user_role() = 'admin'
  );


-- ─────────────────────────────────────────
-- SELECT — dealer (own folder only)
-- ─────────────────────────────────────────
DROP POLICY IF EXISTS dealer_can_read_own_folder ON storage.objects;

CREATE POLICY dealer_can_read_own_folder ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'receipts'
    AND public.auth_user_role() = 'dealer'
    AND (storage.foldername(name))[1] = public.auth_user_dealer_id()::text
  );


-- ─────────────────────────────────────────
-- UPDATE — admin only (receipts are immutable for dealers)
-- ─────────────────────────────────────────
DROP POLICY IF EXISTS admin_can_update_receipts ON storage.objects;

CREATE POLICY admin_can_update_receipts ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'receipts'
    AND public.auth_user_role() = 'admin'
  )
  WITH CHECK (
    bucket_id = 'receipts'
    AND public.auth_user_role() = 'admin'
  );


-- ─────────────────────────────────────────
-- DELETE — admin only (receipts are immutable for dealers)
-- ─────────────────────────────────────────
DROP POLICY IF EXISTS admin_can_delete_receipts ON storage.objects;

CREATE POLICY admin_can_delete_receipts ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'receipts'
    AND public.auth_user_role() = 'admin'
  );
