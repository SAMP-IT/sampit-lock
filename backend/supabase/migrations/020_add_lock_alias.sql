-- Add lock_alias column to locks table
-- This stores the user-friendly name like "Home" or "Front Door"
-- while the 'name' field stores the TTLock model name like "M302_48bc98"

-- Add lock_alias column if it doesn't exist
ALTER TABLE locks
  ADD COLUMN IF NOT EXISTS lock_alias VARCHAR(100);

COMMENT ON COLUMN locks.lock_alias IS 'User-friendly lock name (e.g., "Home", "Front Door")';

-- Copy existing location values to lock_alias for existing locks that don't have it set
-- This provides a sensible default since location was often used for the user-friendly name
UPDATE locks
  SET lock_alias = location
  WHERE lock_alias IS NULL AND location IS NOT NULL;
