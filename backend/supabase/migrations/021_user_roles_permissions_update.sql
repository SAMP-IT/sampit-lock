-- Migration: 021_user_roles_permissions_update.sql
-- Description: Add new user roles and permission columns for comprehensive RBAC
-- Roles: owner, admin, family, restricted, long_term_guest, guest

-- ============================================================
-- 0. BACKUP EXISTING DATA (Safety measure)
-- ============================================================
CREATE TABLE IF NOT EXISTS user_locks_backup_021 AS SELECT * FROM user_locks;

-- ============================================================
-- 1. UPDATE ROLE CONSTRAINT TO INCLUDE NEW ROLES
-- ============================================================
-- Drop the existing constraint and add new one with expanded roles
ALTER TABLE user_locks DROP CONSTRAINT IF EXISTS user_locks_role_check;
ALTER TABLE user_locks ADD CONSTRAINT user_locks_role_check
  CHECK (role IN ('owner', 'admin', 'family', 'guest', 'restricted', 'long_term_guest'));

-- ============================================================
-- 2. ADD NEW PERMISSION COLUMNS
-- ============================================================
-- Can manage own credentials (fingerprint, PIN for self)
ALTER TABLE user_locks ADD COLUMN IF NOT EXISTS can_manage_own_credentials BOOLEAN DEFAULT TRUE;

-- Restricted log visibility (only own activity)
ALTER TABLE user_locks ADD COLUMN IF NOT EXISTS can_view_own_logs_only BOOLEAN DEFAULT FALSE;

-- ============================================================
-- 3. ADD TTLOCK EKEY LINKAGE COLUMNS
-- ============================================================
-- Link user_locks to TTLock eKey for sync
ALTER TABLE user_locks ADD COLUMN IF NOT EXISTS ttlock_ekey_id BIGINT;
ALTER TABLE user_locks ADD COLUMN IF NOT EXISTS ttlock_key_status VARCHAR(20);

-- Add comment for ttlock_key_status
COMMENT ON COLUMN user_locks.ttlock_key_status IS 'TTLock eKey status: active, frozen, expired, deleted';

-- ============================================================
-- 4. ADD INDEXES FOR PERFORMANCE
-- ============================================================
-- Index for auto-expiry queries (find expired restricted/long_term_guest users)
CREATE INDEX IF NOT EXISTS idx_user_locks_expiry
  ON user_locks (role, access_valid_until, is_active)
  WHERE role IN ('restricted', 'long_term_guest');

-- Index for TTLock eKey lookups
CREATE INDEX IF NOT EXISTS idx_user_locks_ttlock_ekey
  ON user_locks (ttlock_ekey_id)
  WHERE ttlock_ekey_id IS NOT NULL;

-- ============================================================
-- 5. UPDATE EKEYS TABLE FOR ROLE TRACKING (if table exists)
-- ============================================================
DO $$
BEGIN
  -- Add app_role column to ekeys table if it exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ekeys') THEN
    ALTER TABLE ekeys ADD COLUMN IF NOT EXISTS app_role VARCHAR(50);
    ALTER TABLE ekeys ADD COLUMN IF NOT EXISTS user_lock_id UUID;

    -- Add foreign key if not exists
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = 'ekeys_user_lock_id_fkey'
      AND table_name = 'ekeys'
    ) THEN
      ALTER TABLE ekeys ADD CONSTRAINT ekeys_user_lock_id_fkey
        FOREIGN KEY (user_lock_id) REFERENCES user_locks(id) ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

-- ============================================================
-- 6. ADD 'access_expired' TO lock_action ENUM (if not exists)
-- ============================================================
DO $$
BEGIN
  -- Check if lock_action type exists and add value if needed
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'lock_action') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'access_expired' AND enumtypid = 'lock_action'::regtype) THEN
      ALTER TYPE lock_action ADD VALUE IF NOT EXISTS 'access_expired';
    END IF;
  END IF;
EXCEPTION
  WHEN others THEN
    -- Ignore error if enum value already exists
    RAISE NOTICE 'Could not add access_expired to lock_action enum: %', SQLERRM;
END $$;

-- ============================================================
-- 7. ADD 'user_removed' TO lock_action ENUM (if not exists)
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'lock_action') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'user_removed' AND enumtypid = 'lock_action'::regtype) THEN
      ALTER TYPE lock_action ADD VALUE IF NOT EXISTS 'user_removed';
    END IF;
  END IF;
EXCEPTION
  WHEN others THEN
    RAISE NOTICE 'Could not add user_removed to lock_action enum: %', SQLERRM;
END $$;

-- ============================================================
-- 8. SET DEFAULT VALUES FOR EXISTING ROWS
-- ============================================================
-- Set can_manage_own_credentials based on role
UPDATE user_locks
SET can_manage_own_credentials = CASE
  WHEN role IN ('owner', 'admin', 'family', 'restricted', 'long_term_guest') THEN TRUE
  WHEN role = 'guest' THEN FALSE
  ELSE TRUE
END
WHERE can_manage_own_credentials IS NULL;

-- Set can_view_own_logs_only based on role
UPDATE user_locks
SET can_view_own_logs_only = CASE
  WHEN role IN ('restricted', 'long_term_guest', 'guest') THEN TRUE
  ELSE FALSE
END
WHERE can_view_own_logs_only IS NULL;

-- ============================================================
-- 9. ADD PASSCODES TABLE COLUMN FOR USER ASSIGNMENT (if not exists)
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'passcodes') THEN
    ALTER TABLE passcodes ADD COLUMN IF NOT EXISTS assigned_to_user_id UUID REFERENCES users(id) ON DELETE SET NULL;

    -- Add index for user lookup
    CREATE INDEX IF NOT EXISTS idx_passcodes_assigned_user ON passcodes(assigned_to_user_id) WHERE assigned_to_user_id IS NOT NULL;
  END IF;
END $$;

-- ============================================================
-- 10. DOCUMENTATION
-- ============================================================
COMMENT ON TABLE user_locks IS 'User-Lock relationship with granular RBAC permissions. Roles: owner (full control), admin (manage except owner), family (household member), restricted (scheduled access), long_term_guest (auto-expiring), guest (basic)';

COMMENT ON COLUMN user_locks.can_manage_own_credentials IS 'Whether user can manage their own fingerprints/PINs (not others)';
COMMENT ON COLUMN user_locks.can_view_own_logs_only IS 'If TRUE, user can only see their own activity logs (not others)';
COMMENT ON COLUMN user_locks.ttlock_ekey_id IS 'TTLock eKey ID for syncing with TTLock cloud';
COMMENT ON COLUMN user_locks.time_restricted IS 'If TRUE, access is limited to time_restriction_start/end and days_of_week';
COMMENT ON COLUMN user_locks.access_valid_from IS 'Start date for time-limited access (long_term_guest, restricted)';
COMMENT ON COLUMN user_locks.access_valid_until IS 'End date for time-limited access - credentials auto-expire after this';
