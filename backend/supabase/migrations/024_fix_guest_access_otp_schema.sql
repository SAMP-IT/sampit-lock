-- ============================================================================
-- MIGRATION 024: Fix guest_access schema for OTP visitor flow (P3)
--
-- Issues fixed:
--   1. Missing columns: access_type, max_uses, usage_count, last_used_at
--   2. user_id is NOT NULL but OTP guests don't have user accounts
-- ============================================================================

-- Add missing columns for OTP support
ALTER TABLE guest_access
  ADD COLUMN IF NOT EXISTS access_type TEXT DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS max_uses INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS usage_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMP WITH TIME ZONE;

-- Make user_id nullable (OTP guests don't have user accounts)
ALTER TABLE guest_access
  ALTER COLUMN user_id DROP NOT NULL;

-- Index for OTP verification (lock_id + access_code + active status)
CREATE INDEX IF NOT EXISTS idx_guest_access_otp_lookup
  ON guest_access (lock_id, access_code, is_active)
  WHERE access_type = 'otp' AND is_active = TRUE;

COMMENT ON COLUMN guest_access.access_type IS 'Type of access: general, otp, scheduled';
COMMENT ON COLUMN guest_access.max_uses IS 'Maximum number of times this access can be used';
COMMENT ON COLUMN guest_access.usage_count IS 'Current usage count';
COMMENT ON COLUMN guest_access.last_used_at IS 'Timestamp of last usage';
