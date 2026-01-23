-- Fix activity_logs enum types for TTLock Bluetooth operations
-- This migration adds missing values to the lock_action and access_method_type enums

-- Add 'paired' and 'reset' to lock_action enum
ALTER TYPE lock_action ADD VALUE IF NOT EXISTS 'paired';
ALTER TYPE lock_action ADD VALUE IF NOT EXISTS 'reset';

-- Add 'bluetooth' to access_method_type enum
ALTER TYPE access_method_type ADD VALUE IF NOT EXISTS 'bluetooth';

-- Add timestamp column to activity_logs for consistency
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Backfill timestamp from created_at for existing records
UPDATE activity_logs SET timestamp = created_at WHERE timestamp IS NULL;

-- Add index for timestamp column
CREATE INDEX IF NOT EXISTS idx_activity_logs_timestamp ON activity_logs(timestamp DESC);

COMMENT ON COLUMN activity_logs.timestamp IS 'Timestamp when the action occurred';
