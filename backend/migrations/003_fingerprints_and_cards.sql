-- Migration: Add fingerprints and IC cards tables
-- Run this in your Supabase SQL Editor

-- =====================================================
-- FINGERPRINTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS fingerprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lock_id UUID NOT NULL REFERENCES locks(id) ON DELETE CASCADE,
  fingerprint_number VARCHAR(100) NOT NULL,
  name VARCHAR(255) DEFAULT 'Fingerprint',
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  valid_from TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure unique fingerprint per lock
  UNIQUE(lock_id, fingerprint_number)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_fingerprints_lock_id ON fingerprints(lock_id);
CREATE INDEX IF NOT EXISTS idx_fingerprints_user_id ON fingerprints(user_id);
CREATE INDEX IF NOT EXISTS idx_fingerprints_is_active ON fingerprints(is_active);

-- =====================================================
-- IC CARDS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS ic_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lock_id UUID NOT NULL REFERENCES locks(id) ON DELETE CASCADE,
  card_number VARCHAR(100) NOT NULL,
  name VARCHAR(255) DEFAULT 'IC Card',
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  valid_from TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure unique card per lock
  UNIQUE(lock_id, card_number)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_ic_cards_lock_id ON ic_cards(lock_id);
CREATE INDEX IF NOT EXISTS idx_ic_cards_user_id ON ic_cards(user_id);
CREATE INDEX IF NOT EXISTS idx_ic_cards_is_active ON ic_cards(is_active);

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS
ALTER TABLE fingerprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE ic_cards ENABLE ROW LEVEL SECURITY;

-- Fingerprints policies
CREATE POLICY "Users can view fingerprints for their locks"
  ON fingerprints FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_locks
      WHERE user_locks.lock_id = fingerprints.lock_id
      AND user_locks.user_id = auth.uid()
      AND user_locks.is_active = true
    )
  );

CREATE POLICY "Users can manage fingerprints for their locks"
  ON fingerprints FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_locks
      WHERE user_locks.lock_id = fingerprints.lock_id
      AND user_locks.user_id = auth.uid()
      AND user_locks.is_active = true
      AND user_locks.can_modify_settings = true
    )
  );

-- IC Cards policies
CREATE POLICY "Users can view cards for their locks"
  ON ic_cards FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_locks
      WHERE user_locks.lock_id = ic_cards.lock_id
      AND user_locks.user_id = auth.uid()
      AND user_locks.is_active = true
    )
  );

CREATE POLICY "Users can manage cards for their locks"
  ON ic_cards FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_locks
      WHERE user_locks.lock_id = ic_cards.lock_id
      AND user_locks.user_id = auth.uid()
      AND user_locks.is_active = true
      AND user_locks.can_modify_settings = true
    )
  );

-- Grant access to authenticated users
GRANT ALL ON fingerprints TO authenticated;
GRANT ALL ON ic_cards TO authenticated;

-- Allow service role full access (for backend)
GRANT ALL ON fingerprints TO service_role;
GRANT ALL ON ic_cards TO service_role;
