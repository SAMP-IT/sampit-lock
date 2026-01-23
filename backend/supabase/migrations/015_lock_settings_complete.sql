-- ============================================================================
-- Migration: 015_lock_settings_complete.sql
-- Description: Ensure all lock_settings columns exist for complete feature support
-- Features covered:
--   - Auto Lock (on/off + delay timer)
--   - Passage Mode
--   - Lock Sound (on/off)
--   - Tamper Alert (on/off)
--   - Reset Button (on/off) - tracked locally, changed via Bluetooth
--   - Remote Unlock (on/off) - lock-level setting affecting all users
--   - One-Touch Locking
--   - LED Indicator
--   - Privacy Lock
--   - Wrong Code Lockout
--   - Anti-Peep Password
-- ============================================================================

-- ============================================================================
-- LOCK_SETTINGS TABLE - Add missing columns
-- ============================================================================

-- Add one_touch_locking column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'lock_settings' AND column_name = 'one_touch_locking'
    ) THEN
        ALTER TABLE lock_settings ADD COLUMN one_touch_locking BOOLEAN DEFAULT TRUE;
        RAISE NOTICE 'Added one_touch_locking column to lock_settings table';
    ELSE
        RAISE NOTICE 'one_touch_locking column already exists in lock_settings table';
    END IF;
END $$;

-- Add privacy_lock column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'lock_settings' AND column_name = 'privacy_lock'
    ) THEN
        ALTER TABLE lock_settings ADD COLUMN privacy_lock BOOLEAN DEFAULT FALSE;
        RAISE NOTICE 'Added privacy_lock column to lock_settings table';
    ELSE
        RAISE NOTICE 'privacy_lock column already exists in lock_settings table';
    END IF;
END $$;

-- Add sound_enabled column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'lock_settings' AND column_name = 'sound_enabled'
    ) THEN
        ALTER TABLE lock_settings ADD COLUMN sound_enabled BOOLEAN DEFAULT TRUE;
        RAISE NOTICE 'Added sound_enabled column to lock_settings table';
    ELSE
        RAISE NOTICE 'sound_enabled column already exists in lock_settings table';
    END IF;
END $$;

-- Add sound_volume column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'lock_settings' AND column_name = 'sound_volume'
    ) THEN
        ALTER TABLE lock_settings ADD COLUMN sound_volume INTEGER DEFAULT 50 CHECK (sound_volume >= 0 AND sound_volume <= 100);
        RAISE NOTICE 'Added sound_volume column to lock_settings table';
    ELSE
        RAISE NOTICE 'sound_volume column already exists in lock_settings table';
    END IF;
END $$;

-- Add led_enabled column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'lock_settings' AND column_name = 'led_enabled'
    ) THEN
        ALTER TABLE lock_settings ADD COLUMN led_enabled BOOLEAN DEFAULT TRUE;
        RAISE NOTICE 'Added led_enabled column to lock_settings table';
    ELSE
        RAISE NOTICE 'led_enabled column already exists in lock_settings table';
    END IF;
END $$;

-- Add tamper_alert column if it doesn't exist (note: different from tamper_alert_enabled)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'lock_settings' AND column_name = 'tamper_alert'
    ) THEN
        ALTER TABLE lock_settings ADD COLUMN tamper_alert BOOLEAN DEFAULT TRUE;
        RAISE NOTICE 'Added tamper_alert column to lock_settings table';
    ELSE
        RAISE NOTICE 'tamper_alert column already exists in lock_settings table';
    END IF;
END $$;

-- Add wrong_code_lockout column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'lock_settings' AND column_name = 'wrong_code_lockout'
    ) THEN
        ALTER TABLE lock_settings ADD COLUMN wrong_code_lockout INTEGER DEFAULT 5 CHECK (wrong_code_lockout >= 0 AND wrong_code_lockout <= 10);
        RAISE NOTICE 'Added wrong_code_lockout column to lock_settings table';
    ELSE
        RAISE NOTICE 'wrong_code_lockout column already exists in lock_settings table';
    END IF;
END $$;

-- Add anti_peep_password column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'lock_settings' AND column_name = 'anti_peep_password'
    ) THEN
        ALTER TABLE lock_settings ADD COLUMN anti_peep_password BOOLEAN DEFAULT FALSE;
        RAISE NOTICE 'Added anti_peep_password column to lock_settings table';
    ELSE
        RAISE NOTICE 'anti_peep_password column already exists in lock_settings table';
    END IF;
END $$;

-- Add reset_button_enabled column if it doesn't exist
-- Note: This is tracked locally in DB but changed via Bluetooth on the physical lock
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'lock_settings' AND column_name = 'reset_button_enabled'
    ) THEN
        ALTER TABLE lock_settings ADD COLUMN reset_button_enabled BOOLEAN DEFAULT TRUE;
        RAISE NOTICE 'Added reset_button_enabled column to lock_settings table';
    ELSE
        RAISE NOTICE 'reset_button_enabled column already exists in lock_settings table';
    END IF;
END $$;

-- Ensure remote_unlock_enabled exists (should already from 001_initial_schema.sql)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'lock_settings' AND column_name = 'remote_unlock_enabled'
    ) THEN
        ALTER TABLE lock_settings ADD COLUMN remote_unlock_enabled BOOLEAN DEFAULT TRUE;
        RAISE NOTICE 'Added remote_unlock_enabled column to lock_settings table';
    ELSE
        RAISE NOTICE 'remote_unlock_enabled column already exists in lock_settings table';
    END IF;
END $$;

-- Add passage_mode_start column if it doesn't exist (for scheduled passage mode)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'lock_settings' AND column_name = 'passage_mode_start'
    ) THEN
        ALTER TABLE lock_settings ADD COLUMN passage_mode_start INTEGER;
        COMMENT ON COLUMN lock_settings.passage_mode_start IS 'Passage mode start time in minutes from midnight (e.g., 480 = 8:00 AM)';
        RAISE NOTICE 'Added passage_mode_start column to lock_settings table';
    ELSE
        RAISE NOTICE 'passage_mode_start column already exists in lock_settings table';
    END IF;
END $$;

-- Add passage_mode_end column if it doesn't exist (for scheduled passage mode)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'lock_settings' AND column_name = 'passage_mode_end'
    ) THEN
        ALTER TABLE lock_settings ADD COLUMN passage_mode_end INTEGER;
        COMMENT ON COLUMN lock_settings.passage_mode_end IS 'Passage mode end time in minutes from midnight (e.g., 1080 = 6:00 PM)';
        RAISE NOTICE 'Added passage_mode_end column to lock_settings table';
    ELSE
        RAISE NOTICE 'passage_mode_end column already exists in lock_settings table';
    END IF;
END $$;

-- ============================================================================
-- FINGERPRINTS TABLE - Add add_type column for Bluetooth vs Cloud enrollment
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'fingerprints' AND column_name = 'add_type'
    ) THEN
        ALTER TABLE fingerprints ADD COLUMN add_type INTEGER DEFAULT 2;
        COMMENT ON COLUMN fingerprints.add_type IS '1=Bluetooth enrollment, 2=Gateway/Cloud enrollment';
        RAISE NOTICE 'Added add_type column to fingerprints table';
    ELSE
        RAISE NOTICE 'add_type column already exists in fingerprints table';
    END IF;
END $$;

-- Add is_active column for soft-delete/freeze functionality
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'fingerprints' AND column_name = 'is_active'
    ) THEN
        ALTER TABLE fingerprints ADD COLUMN is_active BOOLEAN DEFAULT TRUE;
        RAISE NOTICE 'Added is_active column to fingerprints table';
    ELSE
        RAISE NOTICE 'is_active column already exists in fingerprints table';
    END IF;
END $$;

-- Add valid_from and valid_until columns (alternative naming)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'fingerprints' AND column_name = 'valid_from'
    ) THEN
        ALTER TABLE fingerprints ADD COLUMN valid_from TIMESTAMP WITH TIME ZONE;
        RAISE NOTICE 'Added valid_from column to fingerprints table';
    ELSE
        RAISE NOTICE 'valid_from column already exists in fingerprints table';
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'fingerprints' AND column_name = 'valid_until'
    ) THEN
        ALTER TABLE fingerprints ADD COLUMN valid_until TIMESTAMP WITH TIME ZONE;
        RAISE NOTICE 'Added valid_until column to fingerprints table';
    ELSE
        RAISE NOTICE 'valid_until column already exists in fingerprints table';
    END IF;
END $$;

-- ============================================================================
-- IC_CARDS TABLE - Add add_type column for Bluetooth vs Cloud enrollment
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ic_cards' AND column_name = 'add_type'
    ) THEN
        ALTER TABLE ic_cards ADD COLUMN add_type INTEGER DEFAULT 2;
        COMMENT ON COLUMN ic_cards.add_type IS '1=Bluetooth enrollment, 2=Gateway/Cloud enrollment';
        RAISE NOTICE 'Added add_type column to ic_cards table';
    ELSE
        RAISE NOTICE 'add_type column already exists in ic_cards table';
    END IF;
END $$;

-- Add is_active column for soft-delete/freeze functionality
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ic_cards' AND column_name = 'is_active'
    ) THEN
        ALTER TABLE ic_cards ADD COLUMN is_active BOOLEAN DEFAULT TRUE;
        RAISE NOTICE 'Added is_active column to ic_cards table';
    ELSE
        RAISE NOTICE 'is_active column already exists in ic_cards table';
    END IF;
END $$;

-- Add valid_from and valid_until columns (alternative naming)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ic_cards' AND column_name = 'valid_from'
    ) THEN
        ALTER TABLE ic_cards ADD COLUMN valid_from TIMESTAMP WITH TIME ZONE;
        RAISE NOTICE 'Added valid_from column to ic_cards table';
    ELSE
        RAISE NOTICE 'valid_from column already exists in ic_cards table';
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ic_cards' AND column_name = 'valid_until'
    ) THEN
        ALTER TABLE ic_cards ADD COLUMN valid_until TIMESTAMP WITH TIME ZONE;
        RAISE NOTICE 'Added valid_until column to ic_cards table';
    ELSE
        RAISE NOTICE 'valid_until column already exists in ic_cards table';
    END IF;
END $$;

-- ============================================================================
-- EKEYS TABLE - Create if not exists for eKey sharing feature
-- ============================================================================

CREATE TABLE IF NOT EXISTS ekeys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lock_id UUID NOT NULL REFERENCES locks(id) ON DELETE CASCADE,
    sender_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipient_user_id UUID REFERENCES users(id) ON DELETE SET NULL,

    -- TTLock Cloud IDs
    ttlock_ekey_id BIGINT,
    ttlock_lock_id BIGINT,

    -- Recipient info (may not be a user in our system)
    recipient_phone VARCHAR(50),
    recipient_username VARCHAR(255),
    ekey_name VARCHAR(255),

    -- eKey type
    -- 1: Timed (with start/end date)
    -- 2: Permanent
    -- 3: One-time
    -- 4: Recurring/Cyclic
    ekey_type INTEGER DEFAULT 2,

    -- Validity period
    valid_from TIMESTAMP WITH TIME ZONE,
    valid_until TIMESTAMP WITH TIME ZONE,

    -- Remote unlock permission
    remote_unlock_enabled BOOLEAN DEFAULT TRUE,

    -- Status
    -- 1: Normal/Active
    -- 2: Frozen
    -- 3: Deleted
    status INTEGER DEFAULT 1,

    -- Metadata
    remarks TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for ekeys table
CREATE INDEX IF NOT EXISTS idx_ekeys_lock_id ON ekeys(lock_id);
CREATE INDEX IF NOT EXISTS idx_ekeys_sender_user_id ON ekeys(sender_user_id);
CREATE INDEX IF NOT EXISTS idx_ekeys_recipient_user_id ON ekeys(recipient_user_id);
CREATE INDEX IF NOT EXISTS idx_ekeys_ttlock_ekey_id ON ekeys(ttlock_ekey_id);
CREATE INDEX IF NOT EXISTS idx_ekeys_status ON ekeys(status);

-- Add comments
COMMENT ON TABLE ekeys IS 'Digital keys (eKeys) that can be shared with other users for lock access';
COMMENT ON COLUMN ekeys.ekey_type IS '1=Timed, 2=Permanent, 3=One-time, 4=Recurring/Cyclic';
COMMENT ON COLUMN ekeys.status IS '1=Normal/Active, 2=Frozen, 3=Deleted';
COMMENT ON COLUMN ekeys.remote_unlock_enabled IS 'Whether this eKey holder can unlock remotely via gateway';

-- ============================================================================
-- GUEST_CODES TABLE - Create if not exists for guest OTP/passcode feature
-- ============================================================================

CREATE TABLE IF NOT EXISTS guest_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lock_id UUID NOT NULL REFERENCES locks(id) ON DELETE CASCADE,
    created_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- TTLock Cloud IDs
    ttlock_passcode_id BIGINT,
    ttlock_lock_id BIGINT,

    -- Guest info
    guest_name VARCHAR(255),
    guest_phone VARCHAR(50),
    guest_email VARCHAR(255),

    -- Passcode details
    passcode VARCHAR(20) NOT NULL,
    passcode_type INTEGER DEFAULT 1, -- 1=Custom, 2=Permanent, 3=One-time, 4=Erase, 9=Cyclic

    -- Validity
    valid_from TIMESTAMP WITH TIME ZONE,
    valid_until TIMESTAMP WITH TIME ZONE,
    max_uses INTEGER DEFAULT 1,
    use_count INTEGER DEFAULT 0,

    -- Status
    is_active BOOLEAN DEFAULT TRUE,

    -- Metadata
    remarks TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for guest_codes table
CREATE INDEX IF NOT EXISTS idx_guest_codes_lock_id ON guest_codes(lock_id);
CREATE INDEX IF NOT EXISTS idx_guest_codes_created_by ON guest_codes(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_guest_codes_ttlock_passcode_id ON guest_codes(ttlock_passcode_id);
CREATE INDEX IF NOT EXISTS idx_guest_codes_is_active ON guest_codes(is_active);

-- Add comments
COMMENT ON TABLE guest_codes IS 'Guest access passcodes including one-time codes';
COMMENT ON COLUMN guest_codes.passcode_type IS '1=Custom, 2=Permanent, 3=One-time, 4=Erase, 9=Cyclic';

-- ============================================================================
-- ADD COMMENTS FOR LOCK_SETTINGS COLUMNS
-- ============================================================================

COMMENT ON COLUMN lock_settings.auto_lock_enabled IS 'Whether auto-lock is enabled';
COMMENT ON COLUMN lock_settings.auto_lock_delay IS 'Seconds before auto-lock engages after unlock';
COMMENT ON COLUMN lock_settings.remote_unlock_enabled IS 'Lock-level setting: whether remote unlock via gateway is allowed for ALL users';
COMMENT ON COLUMN lock_settings.passage_mode_enabled IS 'Whether lock stays unlocked (passage mode)';
COMMENT ON COLUMN lock_settings.passage_mode_start IS 'Passage mode start time in minutes from midnight (e.g., 480 = 8:00 AM)';
COMMENT ON COLUMN lock_settings.passage_mode_end IS 'Passage mode end time in minutes from midnight (e.g., 1080 = 6:00 PM)';
COMMENT ON COLUMN lock_settings.one_touch_locking IS 'Enable locking with one touch on keypad';
COMMENT ON COLUMN lock_settings.privacy_lock IS 'Privacy mode - blocks all access except admin';
COMMENT ON COLUMN lock_settings.sound_enabled IS 'Whether lock sounds are enabled';
COMMENT ON COLUMN lock_settings.sound_volume IS 'Volume level for lock sounds (0-100)';
COMMENT ON COLUMN lock_settings.led_enabled IS 'Whether LED indicator is enabled';
COMMENT ON COLUMN lock_settings.tamper_alert IS 'Whether tamper alerts are enabled';
COMMENT ON COLUMN lock_settings.wrong_code_lockout IS 'Number of wrong attempts before lockout';
COMMENT ON COLUMN lock_settings.anti_peep_password IS 'Allow random digits before/after real passcode';
COMMENT ON COLUMN lock_settings.reset_button_enabled IS 'Whether physical reset button is enabled (changed via Bluetooth)';

-- ============================================================================
-- CREATE OR REPLACE TRIGGER FOR UPDATED_AT
-- ============================================================================

-- Trigger function for updating timestamps
CREATE OR REPLACE FUNCTION update_lock_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if exists and recreate
DROP TRIGGER IF EXISTS trigger_update_lock_settings_timestamp ON lock_settings;
CREATE TRIGGER trigger_update_lock_settings_timestamp
    BEFORE UPDATE ON lock_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_lock_settings_updated_at();

-- Same for ekeys
CREATE OR REPLACE FUNCTION update_ekeys_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_ekeys_timestamp ON ekeys;
CREATE TRIGGER trigger_update_ekeys_timestamp
    BEFORE UPDATE ON ekeys
    FOR EACH ROW
    EXECUTE FUNCTION update_ekeys_updated_at();

-- Same for guest_codes
CREATE OR REPLACE FUNCTION update_guest_codes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_guest_codes_timestamp ON guest_codes;
CREATE TRIGGER trigger_update_guest_codes_timestamp
    BEFORE UPDATE ON guest_codes
    FOR EACH ROW
    EXECUTE FUNCTION update_guest_codes_updated_at();

-- ============================================================================
-- VERIFICATION QUERIES (for debugging - these show table structure)
-- ============================================================================

-- You can run these SELECT statements manually to verify the migration:
-- SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_name = 'lock_settings' ORDER BY ordinal_position;
-- SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_name = 'fingerprints' ORDER BY ordinal_position;
-- SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_name = 'ic_cards' ORDER BY ordinal_position;
-- SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_name = 'ekeys' ORDER BY ordinal_position;
-- SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_name = 'guest_codes' ORDER BY ordinal_position;

-- ============================================================================
-- LOG COMPLETION
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '============================================================================';
    RAISE NOTICE 'Migration 015_lock_settings_complete.sql completed successfully!';
    RAISE NOTICE '============================================================================';
    RAISE NOTICE 'Added/verified columns in lock_settings:';
    RAISE NOTICE '  - one_touch_locking (BOOLEAN DEFAULT TRUE)';
    RAISE NOTICE '  - privacy_lock (BOOLEAN DEFAULT FALSE)';
    RAISE NOTICE '  - sound_enabled (BOOLEAN DEFAULT TRUE)';
    RAISE NOTICE '  - sound_volume (INTEGER DEFAULT 50)';
    RAISE NOTICE '  - led_enabled (BOOLEAN DEFAULT TRUE)';
    RAISE NOTICE '  - tamper_alert (BOOLEAN DEFAULT TRUE)';
    RAISE NOTICE '  - wrong_code_lockout (INTEGER DEFAULT 5)';
    RAISE NOTICE '  - anti_peep_password (BOOLEAN DEFAULT FALSE)';
    RAISE NOTICE '  - reset_button_enabled (BOOLEAN DEFAULT TRUE)';
    RAISE NOTICE '  - remote_unlock_enabled (BOOLEAN DEFAULT TRUE)';
    RAISE NOTICE '  - passage_mode_start (INTEGER) - minutes from midnight';
    RAISE NOTICE '  - passage_mode_end (INTEGER) - minutes from midnight';
    RAISE NOTICE '';
    RAISE NOTICE 'Added/verified columns in fingerprints:';
    RAISE NOTICE '  - add_type (INTEGER DEFAULT 2) - 1=Bluetooth, 2=Gateway';
    RAISE NOTICE '  - is_active (BOOLEAN DEFAULT TRUE)';
    RAISE NOTICE '  - valid_from (TIMESTAMP)';
    RAISE NOTICE '  - valid_until (TIMESTAMP)';
    RAISE NOTICE '';
    RAISE NOTICE 'Added/verified columns in ic_cards:';
    RAISE NOTICE '  - add_type (INTEGER DEFAULT 2) - 1=Bluetooth, 2=Gateway';
    RAISE NOTICE '  - is_active (BOOLEAN DEFAULT TRUE)';
    RAISE NOTICE '  - valid_from (TIMESTAMP)';
    RAISE NOTICE '  - valid_until (TIMESTAMP)';
    RAISE NOTICE '';
    RAISE NOTICE 'Created tables (if not exist):';
    RAISE NOTICE '  - ekeys (for eKey sharing feature)';
    RAISE NOTICE '  - guest_codes (for guest OTP/passcode feature)';
    RAISE NOTICE '============================================================================';
END $$;
