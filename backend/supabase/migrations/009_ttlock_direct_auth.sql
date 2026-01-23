-- Migration: TTLock Direct Authentication
-- Description: Add profile_completed column and update users table for TTLock-only auth
-- Date: 2025-01-XX

-- Add profile_completed column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_completed BOOLEAN DEFAULT FALSE;

-- Update existing users who have first_name set to mark profile as completed
UPDATE users SET profile_completed = TRUE WHERE first_name IS NOT NULL AND first_name != '';

-- Make first_name and last_name nullable for TTLock auth flow
-- (profile is completed after TTLock login)
ALTER TABLE users ALTER COLUMN first_name DROP NOT NULL;
ALTER TABLE users ALTER COLUMN last_name DROP NOT NULL;

-- Make password_hash nullable since TTLock handles auth
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

-- Add index for profile_completed for efficient queries
CREATE INDEX IF NOT EXISTS idx_users_profile_completed ON users(profile_completed);

-- Comment for documentation
COMMENT ON COLUMN users.profile_completed IS 'Indicates if user has completed profile setup after TTLock authentication';
