-- Migration 019: Passcodes Table Enhancements
-- Adds name column and extends code length for TTLock passcodes

-- Add name column to passcodes table
ALTER TABLE passcodes ADD COLUMN IF NOT EXISTS name VARCHAR(100);

-- Extend code column to support up to 9 digits (TTLock allows 4-9)
ALTER TABLE passcodes ALTER COLUMN code TYPE VARCHAR(9);

-- Drop old constraint and add new one
ALTER TABLE passcodes DROP CONSTRAINT IF EXISTS passcodes_code_length;
ALTER TABLE passcodes ADD CONSTRAINT passcodes_code_length
  CHECK (char_length(code) >= 4 AND char_length(code) <= 9);

-- Add index for faster lookups by name
CREATE INDEX IF NOT EXISTS idx_passcodes_name ON passcodes(name) WHERE name IS NOT NULL;

-- Add index for created_by for user-specific queries
CREATE INDEX IF NOT EXISTS idx_passcodes_created_by ON passcodes(created_by);

-- Add comment
COMMENT ON COLUMN passcodes.name IS 'User-defined name for the passcode (e.g., Guest Code, Cleaner)';
