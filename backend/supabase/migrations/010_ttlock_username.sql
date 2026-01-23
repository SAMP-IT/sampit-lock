-- Migration: Add ttlock_username column
-- TTLock API requires alphanumeric usernames (no email format)
-- We store the generated TTLock username separately from the user's email

ALTER TABLE users ADD COLUMN IF NOT EXISTS ttlock_username TEXT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_ttlock_username ON users(ttlock_username);

-- Add comment explaining the column
COMMENT ON COLUMN users.ttlock_username IS 'TTLock API alphanumeric username (generated from email, no special chars)';
