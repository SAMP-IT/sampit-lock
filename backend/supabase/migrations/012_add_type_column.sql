-- Migration: Add add_type column to fingerprints and ic_cards tables
-- This column tracks how fingerprints/cards were added (1=Bluetooth, 2=Gateway/Cloud)
-- Created: 2026-01-02

-- Add add_type column to fingerprints table
ALTER TABLE fingerprints
ADD COLUMN IF NOT EXISTS add_type INTEGER DEFAULT 2;

-- Add comment to explain the column
COMMENT ON COLUMN fingerprints.add_type IS 'How the fingerprint was added: 1=Bluetooth, 2=Gateway/Cloud API';

-- Add add_type column to ic_cards table
ALTER TABLE ic_cards
ADD COLUMN IF NOT EXISTS add_type INTEGER DEFAULT 2;

-- Add comment to explain the column
COMMENT ON COLUMN ic_cards.add_type IS 'How the IC card was added: 1=Bluetooth, 2=Gateway/Cloud API';

-- Create index for filtering by add_type (optional, for performance)
CREATE INDEX IF NOT EXISTS idx_fingerprints_add_type ON fingerprints(add_type);
CREATE INDEX IF NOT EXISTS idx_ic_cards_add_type ON ic_cards(add_type);
