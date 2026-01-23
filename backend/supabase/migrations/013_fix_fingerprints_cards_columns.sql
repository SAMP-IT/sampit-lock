-- ============================================================================
-- Migration: 013_fix_fingerprints_cards_columns.sql
-- Description: Add missing columns to existing fingerprints and ic_cards tables
-- Note: Migration 011 failed because tables already exist with different schema
--       This migration adds the missing columns using ALTER TABLE
-- ============================================================================

-- ============================================================================
-- FINGERPRINTS TABLE - Add missing columns
-- ============================================================================

-- Add ttlock_fingerprint_id column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'fingerprints' AND column_name = 'ttlock_fingerprint_id'
    ) THEN
        ALTER TABLE fingerprints ADD COLUMN ttlock_fingerprint_id INTEGER;
        RAISE NOTICE 'Added ttlock_fingerprint_id column to fingerprints table';
    ELSE
        RAISE NOTICE 'ttlock_fingerprint_id column already exists in fingerprints table';
    END IF;
END $$;

-- Add fingerprint_name column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'fingerprints' AND column_name = 'fingerprint_name'
    ) THEN
        ALTER TABLE fingerprints ADD COLUMN fingerprint_name VARCHAR(255);
        RAISE NOTICE 'Added fingerprint_name column to fingerprints table';
    ELSE
        RAISE NOTICE 'fingerprint_name column already exists in fingerprints table';
    END IF;
END $$;

-- Add fingerprint_type column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'fingerprints' AND column_name = 'fingerprint_type'
    ) THEN
        ALTER TABLE fingerprints ADD COLUMN fingerprint_type INTEGER DEFAULT 1;
        RAISE NOTICE 'Added fingerprint_type column to fingerprints table';
    ELSE
        RAISE NOTICE 'fingerprint_type column already exists in fingerprints table';
    END IF;
END $$;

-- Add cyclic_config column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'fingerprints' AND column_name = 'cyclic_config'
    ) THEN
        ALTER TABLE fingerprints ADD COLUMN cyclic_config JSONB DEFAULT '[]';
        RAISE NOTICE 'Added cyclic_config column to fingerprints table';
    ELSE
        RAISE NOTICE 'cyclic_config column already exists in fingerprints table';
    END IF;
END $$;

-- Add sender_username column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'fingerprints' AND column_name = 'sender_username'
    ) THEN
        ALTER TABLE fingerprints ADD COLUMN sender_username VARCHAR(255);
        RAISE NOTICE 'Added sender_username column to fingerprints table';
    ELSE
        RAISE NOTICE 'sender_username column already exists in fingerprints table';
    END IF;
END $$;

-- ============================================================================
-- IC_CARDS TABLE - Add missing columns
-- ============================================================================

-- Add ttlock_card_id column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ic_cards' AND column_name = 'ttlock_card_id'
    ) THEN
        ALTER TABLE ic_cards ADD COLUMN ttlock_card_id INTEGER;
        RAISE NOTICE 'Added ttlock_card_id column to ic_cards table';
    ELSE
        RAISE NOTICE 'ttlock_card_id column already exists in ic_cards table';
    END IF;
END $$;

-- Add card_name column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ic_cards' AND column_name = 'card_name'
    ) THEN
        ALTER TABLE ic_cards ADD COLUMN card_name VARCHAR(255);
        RAISE NOTICE 'Added card_name column to ic_cards table';
    ELSE
        RAISE NOTICE 'card_name column already exists in ic_cards table';
    END IF;
END $$;

-- Add sender_username column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ic_cards' AND column_name = 'sender_username'
    ) THEN
        ALTER TABLE ic_cards ADD COLUMN sender_username VARCHAR(255);
        RAISE NOTICE 'Added sender_username column to ic_cards table';
    ELSE
        RAISE NOTICE 'sender_username column already exists in ic_cards table';
    END IF;
END $$;

-- ============================================================================
-- CREATE INDEXES (if they don't exist)
-- ============================================================================

-- Fingerprints indexes
CREATE INDEX IF NOT EXISTS idx_fingerprints_ttlock_id ON fingerprints(ttlock_fingerprint_id);

-- IC Cards indexes
CREATE INDEX IF NOT EXISTS idx_ic_cards_ttlock_id ON ic_cards(ttlock_card_id);

-- ============================================================================
-- ADD COMMENTS
-- ============================================================================

COMMENT ON COLUMN fingerprints.ttlock_fingerprint_id IS 'TTLock cloud fingerprint ID';
COMMENT ON COLUMN fingerprints.fingerprint_name IS 'User-defined name for the fingerprint';
COMMENT ON COLUMN fingerprints.fingerprint_type IS '1=Normal/Permanent, 4=Cyclic/Recurring schedule';
COMMENT ON COLUMN fingerprints.cyclic_config IS 'Weekly recurring schedule: [{weekDay: 1-7, startTime: minutes, endTime: minutes}]';

COMMENT ON COLUMN ic_cards.ttlock_card_id IS 'TTLock cloud card ID';
COMMENT ON COLUMN ic_cards.card_name IS 'User-defined name for the IC card';

-- Log completion
DO $$
BEGIN
    RAISE NOTICE 'Migration 013_fix_fingerprints_cards_columns.sql completed successfully';
END $$;
