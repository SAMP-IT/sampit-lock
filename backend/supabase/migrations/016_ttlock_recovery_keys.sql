-- ============================================================================
-- Migration: 016_ttlock_recovery_keys.sql
-- Description: Add columns to store TTLock recovery keys from Bluetooth pairing
-- These keys are returned by the TTLock SDK during lock initialization
-- ============================================================================

-- Add admin_pwd column (Admin passcode)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'locks' AND column_name = 'admin_pwd'
    ) THEN
        ALTER TABLE locks ADD COLUMN admin_pwd VARCHAR(100);
        RAISE NOTICE 'Added admin_pwd column to locks table';
    ELSE
        RAISE NOTICE 'admin_pwd column already exists in locks table';
    END IF;
END $$;

-- Add delete_pwd column (Delete/Factory Reset passcode)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'locks' AND column_name = 'delete_pwd'
    ) THEN
        ALTER TABLE locks ADD COLUMN delete_pwd VARCHAR(100);
        RAISE NOTICE 'Added delete_pwd column to locks table';
    ELSE
        RAISE NOTICE 'delete_pwd column already exists in locks table';
    END IF;
END $$;

-- Add no_key_pwd column (Super passcode - unlock without any credentials)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'locks' AND column_name = 'no_key_pwd'
    ) THEN
        ALTER TABLE locks ADD COLUMN no_key_pwd VARCHAR(100);
        RAISE NOTICE 'Added no_key_pwd column to locks table';
    ELSE
        RAISE NOTICE 'no_key_pwd column already exists in locks table';
    END IF;
END $$;

-- Add recovery_key column for the app-generated recovery key
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'locks' AND column_name = 'recovery_key'
    ) THEN
        ALTER TABLE locks ADD COLUMN recovery_key VARCHAR(100);
        RAISE NOTICE 'Added recovery_key column to locks table';
    ELSE
        RAISE NOTICE 'recovery_key column already exists in locks table';
    END IF;
END $$;

-- Add comments for documentation
COMMENT ON COLUMN locks.admin_pwd IS 'TTLock Admin passcode from SDK initialization';
COMMENT ON COLUMN locks.delete_pwd IS 'TTLock Delete/Factory Reset passcode from SDK initialization';
COMMENT ON COLUMN locks.no_key_pwd IS 'TTLock Super passcode (emergency unlock) from SDK initialization';
COMMENT ON COLUMN locks.recovery_key IS 'App-generated recovery key for account recovery';

-- ============================================================================
-- LOG COMPLETION
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '============================================================================';
    RAISE NOTICE 'Migration 016_ttlock_recovery_keys.sql completed successfully!';
    RAISE NOTICE '============================================================================';
    RAISE NOTICE 'Added columns to locks table:';
    RAISE NOTICE '  - admin_pwd (TTLock Admin passcode)';
    RAISE NOTICE '  - delete_pwd (TTLock Delete/Factory Reset passcode)';
    RAISE NOTICE '  - no_key_pwd (TTLock Super passcode)';
    RAISE NOTICE '  - recovery_key (App-generated recovery key)';
    RAISE NOTICE '============================================================================';
END $$;
