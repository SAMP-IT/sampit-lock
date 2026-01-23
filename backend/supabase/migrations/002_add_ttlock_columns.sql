-- Migration: Add TTLock integration columns to locks table
-- Created: 2025-11-13

-- Add ttlock_id column to store TTLock Cloud lock ID
ALTER TABLE locks
ADD COLUMN IF NOT EXISTS ttlock_id BIGINT UNIQUE;

-- Add lock_state column (replaces is_locked boolean with more states)
ALTER TABLE locks
ADD COLUMN IF NOT EXISTS lock_state VARCHAR(20) DEFAULT 'locked' CHECK (lock_state IN ('locked', 'unlocked', 'jammed', 'unknown'));

-- Add metadata column to store additional TTLock data
ALTER TABLE locks
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Create index on ttlock_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_locks_ttlock_id ON locks(ttlock_id);

-- Add comment
COMMENT ON COLUMN locks.ttlock_id IS 'TTLock Cloud lock ID for imported locks';
COMMENT ON COLUMN locks.lock_state IS 'Current lock state: locked, unlocked, jammed, unknown';
COMMENT ON COLUMN locks.metadata IS 'Additional lock metadata and TTLock data';
