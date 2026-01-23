-- TTLock Account Storage Migration
-- Adds fields to users table to store TTLock Cloud account credentials

-- Add TTLock Cloud account fields to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS ttlock_user_id BIGINT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS ttlock_email VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS ttlock_access_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS ttlock_token_expires_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS ttlock_refresh_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS ttlock_connected_at TIMESTAMP WITH TIME ZONE;

-- Add comments for documentation
COMMENT ON COLUMN users.ttlock_user_id IS 'TTLock Cloud user ID';
COMMENT ON COLUMN users.ttlock_email IS 'Email used for TTLock Cloud account';
COMMENT ON COLUMN users.ttlock_access_token IS 'Encrypted TTLock Cloud API access token';
COMMENT ON COLUMN users.ttlock_token_expires_at IS 'When the TTLock access token expires';
COMMENT ON COLUMN users.ttlock_refresh_token IS 'Encrypted TTLock Cloud API refresh token (if available)';
COMMENT ON COLUMN users.ttlock_connected_at IS 'When the TTLock account was last connected/synced';

-- Create index for TTLock user ID lookup
CREATE INDEX IF NOT EXISTS idx_users_ttlock_user_id ON users(ttlock_user_id) WHERE ttlock_user_id IS NOT NULL;

-- Create index for TTLock email lookup
CREATE INDEX IF NOT EXISTS idx_users_ttlock_email ON users(ttlock_email) WHERE ttlock_email IS NOT NULL;

-- Create function to check if TTLock token is expired
CREATE OR REPLACE FUNCTION is_ttlock_token_expired(user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  expires_at TIMESTAMP WITH TIME ZONE;
BEGIN
  SELECT ttlock_token_expires_at INTO expires_at
  FROM users
  WHERE id = user_id;

  IF expires_at IS NULL THEN
    RETURN TRUE;
  END IF;

  RETURN expires_at <= NOW();
END;
$$ LANGUAGE plpgsql STABLE;

-- Create function to get TTLock connection status
CREATE OR REPLACE FUNCTION get_ttlock_connection_status(user_id UUID)
RETURNS VARCHAR(20) AS $$
DECLARE
  ttlock_uid BIGINT;
  token_expired BOOLEAN;
BEGIN
  SELECT ttlock_user_id INTO ttlock_uid
  FROM users
  WHERE id = user_id;

  IF ttlock_uid IS NULL THEN
    RETURN 'not_connected';
  END IF;

  token_expired := is_ttlock_token_expired(user_id);

  IF token_expired THEN
    RETURN 'expired';
  ELSE
    RETURN 'connected';
  END IF;
END;
$$ LANGUAGE plpgsql STABLE;

-- Create view for user profiles with TTLock status
CREATE OR REPLACE VIEW user_profiles_with_ttlock AS
SELECT
  u.id,
  u.email,
  u.first_name,
  u.last_name,
  u.phone,
  u.role,
  u.avatar_url,
  u.ttlock_user_id,
  u.ttlock_email,
  u.ttlock_connected_at,
  u.ttlock_token_expires_at,
  get_ttlock_connection_status(u.id) as ttlock_status,
  u.created_at,
  u.updated_at
FROM users u;

-- Grant permissions on view
GRANT SELECT ON user_profiles_with_ttlock TO authenticated;

-- Add trigger to update updated_at when TTLock fields change
CREATE OR REPLACE FUNCTION update_user_updated_at_on_ttlock_change()
RETURNS TRIGGER AS $$
BEGIN
  IF (OLD.ttlock_user_id IS DISTINCT FROM NEW.ttlock_user_id) OR
     (OLD.ttlock_email IS DISTINCT FROM NEW.ttlock_email) OR
     (OLD.ttlock_access_token IS DISTINCT FROM NEW.ttlock_access_token) THEN
    NEW.updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_ttlock_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_user_updated_at_on_ttlock_change();

COMMENT ON VIEW user_profiles_with_ttlock IS 'User profiles with TTLock Cloud connection status';
