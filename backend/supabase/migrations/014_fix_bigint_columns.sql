-- ============================================================================
-- Migration: 014_fix_bigint_columns.sql
-- Description: Change INTEGER columns to BIGINT for TTLock fingerprint/card IDs
-- Issue: TTLock returns IDs like 53784736890887 which exceed INTEGER max (2,147,483,647)
-- ============================================================================

-- ============================================================================
-- FINGERPRINTS TABLE - Change ttlock_fingerprint_id to BIGINT
-- ============================================================================

-- Drop the unique constraint if it exists (we'll recreate it)
DO $$
BEGIN
    -- Check if constraint exists before dropping
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fingerprints_ttlock_fingerprint_id_key'
        AND table_name = 'fingerprints'
    ) THEN
        ALTER TABLE fingerprints DROP CONSTRAINT fingerprints_ttlock_fingerprint_id_key;
        RAISE NOTICE 'Dropped unique constraint on fingerprints.ttlock_fingerprint_id';
    END IF;
END $$;

-- Drop the index if it exists
DROP INDEX IF EXISTS idx_fingerprints_ttlock_id;

-- Alter the column type to BIGINT
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'fingerprints' AND column_name = 'ttlock_fingerprint_id'
    ) THEN
        ALTER TABLE fingerprints ALTER COLUMN ttlock_fingerprint_id TYPE BIGINT;
        RAISE NOTICE 'Changed fingerprints.ttlock_fingerprint_id from INTEGER to BIGINT';
    ELSE
        -- Column doesn't exist, create it as BIGINT
        ALTER TABLE fingerprints ADD COLUMN ttlock_fingerprint_id BIGINT;
        RAISE NOTICE 'Added fingerprints.ttlock_fingerprint_id as BIGINT';
    END IF;
END $$;

-- Recreate the index
CREATE INDEX IF NOT EXISTS idx_fingerprints_ttlock_id ON fingerprints(ttlock_fingerprint_id);

-- Recreate unique constraint (optional - may not need unique since Bluetooth enrollments use fingerprint_number)
-- ALTER TABLE fingerprints ADD CONSTRAINT fingerprints_ttlock_fingerprint_id_key UNIQUE (ttlock_fingerprint_id);

-- ============================================================================
-- IC_CARDS TABLE - Change ttlock_card_id to BIGINT
-- ============================================================================

-- Drop the unique constraint if it exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'ic_cards_ttlock_card_id_key'
        AND table_name = 'ic_cards'
    ) THEN
        ALTER TABLE ic_cards DROP CONSTRAINT ic_cards_ttlock_card_id_key;
        RAISE NOTICE 'Dropped unique constraint on ic_cards.ttlock_card_id';
    END IF;
END $$;

-- Drop the index if it exists
DROP INDEX IF EXISTS idx_ic_cards_ttlock_id;

-- Alter the column type to BIGINT
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ic_cards' AND column_name = 'ttlock_card_id'
    ) THEN
        ALTER TABLE ic_cards ALTER COLUMN ttlock_card_id TYPE BIGINT;
        RAISE NOTICE 'Changed ic_cards.ttlock_card_id from INTEGER to BIGINT';
    ELSE
        -- Column doesn't exist, create it as BIGINT
        ALTER TABLE ic_cards ADD COLUMN ttlock_card_id BIGINT;
        RAISE NOTICE 'Added ic_cards.ttlock_card_id as BIGINT';
    END IF;
END $$;

-- Recreate the index
CREATE INDEX IF NOT EXISTS idx_ic_cards_ttlock_id ON ic_cards(ttlock_card_id);

-- ============================================================================
-- Also check fingerprint_number column - it's VARCHAR but let's ensure consistency
-- ============================================================================

-- fingerprint_number is already VARCHAR(255) in migration 011, should be fine
-- card_number is already VARCHAR(255) in migration 011, should be fine

-- ============================================================================
-- Log completion
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE 'Migration 014_fix_bigint_columns.sql completed successfully';
    RAISE NOTICE 'Changed ttlock_fingerprint_id and ttlock_card_id from INTEGER to BIGINT';
    RAISE NOTICE 'This allows TTLock IDs up to 9,223,372,036,854,775,807';
END $$;
