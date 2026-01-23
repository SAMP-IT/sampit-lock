-- Simple version - just tables and indexes first
-- Run this FIRST, then run the views and triggers separately

-- Create fingerprints table
CREATE TABLE IF NOT EXISTS fingerprints (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lock_id UUID NOT NULL REFERENCES locks(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    ttlock_fingerprint_id INTEGER UNIQUE,
    fingerprint_number VARCHAR(255) NOT NULL,
    fingerprint_name VARCHAR(255),
    fingerprint_type INTEGER NOT NULL DEFAULT 1,
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE,
    cyclic_config JSONB DEFAULT '[]',
    status INTEGER DEFAULT 1,
    sender_username VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_fingerprint_per_lock UNIQUE(lock_id, fingerprint_number)
);

-- Create IC cards table
CREATE TABLE IF NOT EXISTS ic_cards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lock_id UUID NOT NULL REFERENCES locks(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    ttlock_card_id INTEGER UNIQUE,
    card_number VARCHAR(255) NOT NULL,
    card_name VARCHAR(255),
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE,
    status INTEGER DEFAULT 1,
    sender_username VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_card_per_lock UNIQUE(lock_id, card_number)
);

-- Create indexes
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
