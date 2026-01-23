-- Migration: 018_user_management_enhancements.sql
-- Description: Add notes column to user_locks table for user management feature

-- Add notes column to user_locks table
ALTER TABLE user_locks
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Add index for faster lookups by user_id (for getting all locks a user has access to)
CREATE INDEX IF NOT EXISTS idx_user_locks_user_id ON user_locks(user_id);

-- Add index for faster lookups by lock_id (for getting all users with access to a lock)
CREATE INDEX IF NOT EXISTS idx_user_locks_lock_id ON user_locks(lock_id);

-- Add index for role filtering
CREATE INDEX IF NOT EXISTS idx_user_locks_role ON user_locks(role);

-- Add composite index for common query patterns
CREATE INDEX IF NOT EXISTS idx_user_locks_lock_user ON user_locks(lock_id, user_id);

-- Comment on column
COMMENT ON COLUMN user_locks.notes IS 'Optional notes about the user access (e.g., "Cleaning service - Mondays and Thursdays")';
