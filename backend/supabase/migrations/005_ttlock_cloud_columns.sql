-- TTLock Cloud Support Columns
-- Adds TTLock Cloud lock identifier and gateway flag to locks table

-- Add TTLock Cloud lock ID (matches TTLock Cloud API lockId)
ALTER TABLE locks
  ADD COLUMN IF NOT EXISTS ttlock_lock_id BIGINT;

COMMENT ON COLUMN locks.ttlock_lock_id IS 'TTLock Cloud lockId value used for remote API requests';

-- Ensure ttlock_lock_id is unique when present
CREATE UNIQUE INDEX IF NOT EXISTS idx_locks_ttlock_lock_id
  ON locks(ttlock_lock_id)
  WHERE ttlock_lock_id IS NOT NULL;

-- Flag to indicate whether lock is connected to a TTLock Gateway
ALTER TABLE locks
  ADD COLUMN IF NOT EXISTS has_gateway BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN locks.has_gateway IS 'Indicates if the lock has an associated TTLock Gateway for cloud control';

-- Backfill existing rows with default FALSE for has_gateway
UPDATE locks
  SET has_gateway = FALSE
  WHERE has_gateway IS NULL;
