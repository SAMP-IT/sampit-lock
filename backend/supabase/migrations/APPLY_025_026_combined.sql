-- ============================================================================
-- COMBINED MIGRATIONS 025 + 026 — Apply in Supabase Dashboard SQL Editor
-- Run this entire block at once. All statements are idempotent (safe to re-run).
-- ============================================================================

-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION 025: Sync users.role enum with user_locks.role values
-- ═══════════════════════════════════════════════════════════════════════════

-- Add 'admin' to user_role enum
DO $$
BEGIN
  ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'admin';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add 'scheduled' to user_role enum
DO $$
BEGIN
  ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'scheduled';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add 'guest_otp' to user_role enum
DO $$
BEGIN
  ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'guest_otp';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add 'guest_longterm' to user_role enum
DO $$
BEGIN
  ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'guest_longterm';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add 'otp_verified' to lock_action enum
DO $$
BEGIN
  ALTER TYPE lock_action ADD VALUE IF NOT EXISTS 'otp_verified';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add 'otp' to access_method_type enum
DO $$
BEGIN
  ALTER TYPE access_method_type ADD VALUE IF NOT EXISTS 'otp';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION 026: Add sync_status to credential tables
-- ═══════════════════════════════════════════════════════════════════════════

-- Fingerprints
ALTER TABLE fingerprints
  ADD COLUMN IF NOT EXISTS sync_status TEXT DEFAULT 'synced',
  ADD COLUMN IF NOT EXISTS sync_error TEXT,
  ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN fingerprints.sync_status IS 'Hardware sync state: synced, pending_add, pending_delete, pending_update, failed, unknown';
COMMENT ON COLUMN fingerprints.sync_error IS 'Last sync error message (null if synced)';
COMMENT ON COLUMN fingerprints.last_synced_at IS 'When the credential was last confirmed synced with hardware';

-- IC Cards
ALTER TABLE ic_cards
  ADD COLUMN IF NOT EXISTS sync_status TEXT DEFAULT 'synced',
  ADD COLUMN IF NOT EXISTS sync_error TEXT,
  ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN ic_cards.sync_status IS 'Hardware sync state: synced, pending_add, pending_delete, pending_update, failed, unknown';
COMMENT ON COLUMN ic_cards.sync_error IS 'Last sync error message (null if synced)';
COMMENT ON COLUMN ic_cards.last_synced_at IS 'When the credential was last confirmed synced with hardware';

-- Passcodes
ALTER TABLE passcodes
  ADD COLUMN IF NOT EXISTS sync_status TEXT DEFAULT 'synced',
  ADD COLUMN IF NOT EXISTS sync_error TEXT,
  ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN passcodes.sync_status IS 'Hardware sync state: synced, pending_add, pending_delete, pending_update, failed, unknown';
COMMENT ON COLUMN passcodes.sync_error IS 'Last sync error message (null if synced)';
COMMENT ON COLUMN passcodes.last_synced_at IS 'When the credential was last confirmed synced with hardware';

-- Indexes for finding unsynced credentials
CREATE INDEX IF NOT EXISTS idx_fingerprints_sync_status
  ON fingerprints (sync_status)
  WHERE sync_status != 'synced';

CREATE INDEX IF NOT EXISTS idx_ic_cards_sync_status
  ON ic_cards (sync_status)
  WHERE sync_status != 'synced';

CREATE INDEX IF NOT EXISTS idx_passcodes_sync_status
  ON passcodes (sync_status)
  WHERE sync_status != 'synced';

-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFICATION
-- ═══════════════════════════════════════════════════════════════════════════
-- Uncomment these to verify after running:
-- SELECT unnest(enum_range(NULL::user_role));
-- SELECT unnest(enum_range(NULL::lock_action));
-- SELECT unnest(enum_range(NULL::access_method_type));
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'fingerprints' AND column_name IN ('sync_status','sync_error','last_synced_at');
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'passcodes' AND column_name IN ('sync_status','sync_error','last_synced_at');
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'ic_cards' AND column_name IN ('sync_status','sync_error','last_synced_at');
