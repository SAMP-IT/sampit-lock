-- ============================================================================
-- Migration: 011_fingerprints_and_cards.sql
-- Description: Add fingerprint and IC card management tables
-- ============================================================================

-- Create fingerprints table
CREATE TABLE IF NOT EXISTS fingerprints (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lock_id UUID NOT NULL REFERENCES locks(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,

    -- TTLock Cloud IDs
    ttlock_fingerprint_id INTEGER UNIQUE,
    fingerprint_number VARCHAR(255) NOT NULL,

    -- Fingerprint details
    fingerprint_name VARCHAR(255),
    fingerprint_type INTEGER NOT NULL DEFAULT 1,

    -- Validity period
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE,

    -- Cyclic schedule (for type=4)
    cyclic_config JSONB DEFAULT '[]',

    -- Status tracking
    status INTEGER DEFAULT 1,

    -- Metadata
    sender_username VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Indexes
    CONSTRAINT unique_fingerprint_per_lock UNIQUE(lock_id, fingerprint_number)
);

-- Create IC cards table
CREATE TABLE IF NOT EXISTS ic_cards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lock_id UUID NOT NULL REFERENCES locks(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,

    -- TTLock Cloud IDs
    ttlock_card_id INTEGER UNIQUE,
    card_number VARCHAR(255) NOT NULL,

    -- Card details
    card_name VARCHAR(255),

    -- Validity period
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE,

    -- Status tracking
    status INTEGER DEFAULT 1,

    -- Metadata
    sender_username VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Indexes
    CONSTRAINT unique_card_per_lock UNIQUE(lock_id, card_number)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_fingerprints_lock_id ON fingerprints(lock_id);
CREATE INDEX IF NOT EXISTS idx_fingerprints_user_id ON fingerprints(user_id);
CREATE INDEX IF NOT EXISTS idx_fingerprints_ttlock_id ON fingerprints(ttlock_fingerprint_id);
CREATE INDEX IF NOT EXISTS idx_fingerprints_status ON fingerprints(status);
CREATE INDEX IF NOT EXISTS idx_fingerprints_created_at ON fingerprints(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ic_cards_lock_id ON ic_cards(lock_id);
CREATE INDEX IF NOT EXISTS idx_ic_cards_user_id ON ic_cards(user_id);
CREATE INDEX IF NOT EXISTS idx_ic_cards_ttlock_id ON ic_cards(ttlock_card_id);
CREATE INDEX IF NOT EXISTS idx_ic_cards_status ON ic_cards(status);
CREATE INDEX IF NOT EXISTS idx_ic_cards_created_at ON ic_cards(created_at DESC);

-- Add comments for documentation
COMMENT ON TABLE fingerprints IS 'Stores fingerprint access credentials for locks';
COMMENT ON TABLE ic_cards IS 'Stores IC card (RFID/NFC) access credentials for locks';

COMMENT ON COLUMN fingerprints.fingerprint_type IS '1=Normal/Permanent, 4=Cyclic/Recurring schedule';
COMMENT ON COLUMN fingerprints.status IS '1=Normal, 2=Invalid/Expired, 3=Pending, 4=Adding, 5=Add Failed, 6=Modifying, 7=Modify Failed, 8=Deleting, 9=Delete Failed';
COMMENT ON COLUMN fingerprints.cyclic_config IS 'Weekly recurring schedule: [{weekDay: 1-7, startTime: minutes, endTime: minutes}]';

COMMENT ON COLUMN ic_cards.status IS '1=Normal, 2=Invalid/Expired, 3=Pending, 4=Adding, 5=Add Failed, 6=Modifying, 7=Modify Failed, 8=Deleting, 9=Delete Failed';

-- Create view for fingerprints with user info
CREATE OR REPLACE VIEW fingerprints_with_user_info AS
SELECT
    f.id,
    f.lock_id,
    f.user_id,
    f.ttlock_fingerprint_id,
    f.fingerprint_number,
    f.fingerprint_name,
    f.fingerprint_type,
    f.start_date,
    f.end_date,
    f.cyclic_config,
    f.status,
    f.sender_username,
    f.created_at,
    f.updated_at,
    l.name AS lock_name,
    u.name AS user_name,
    u.email AS user_email
FROM fingerprints f
LEFT JOIN locks l ON f.lock_id = l.id
LEFT JOIN users u ON f.user_id = u.id;

-- Create view for IC cards with user info
CREATE OR REPLACE VIEW ic_cards_with_user_info AS
SELECT
    c.id,
    c.lock_id,
    c.user_id,
    c.ttlock_card_id,
    c.card_number,
    c.card_name,
    c.start_date,
    c.end_date,
    c.status,
    c.sender_username,
    c.created_at,
    c.updated_at,
    l.name AS lock_name,
    u.name AS user_name,
    u.email AS user_email
FROM ic_cards c
LEFT JOIN locks l ON c.lock_id = l.id
LEFT JOIN users u ON c.user_id = u.id;

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_fingerprint_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_ic_card_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for auto-updating timestamps
CREATE TRIGGER trigger_update_fingerprint_timestamp
    BEFORE UPDATE ON fingerprints
    FOR EACH ROW
    EXECUTE FUNCTION update_fingerprint_updated_at();

CREATE TRIGGER trigger_update_ic_card_timestamp
    BEFORE UPDATE ON ic_cards
    FOR EACH ROW
    EXECUTE FUNCTION update_ic_card_updated_at();

-- Log migration completion
DO $$
BEGIN
    RAISE NOTICE 'Migration 011_fingerprints_and_cards.sql completed successfully';
END $$;
