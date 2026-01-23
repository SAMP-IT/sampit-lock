-- TTLock Integration Migration
-- Adds fields to support TTLock SDK Bluetooth operations

-- Add TTLock fields to locks table
ALTER TABLE locks ADD COLUMN IF NOT EXISTS ttlock_mac VARCHAR(17);
ALTER TABLE locks ADD COLUMN IF NOT EXISTS ttlock_data JSONB;
ALTER TABLE locks ADD COLUMN IF NOT EXISTS ttlock_lock_name VARCHAR(100);
ALTER TABLE locks ADD COLUMN IF NOT EXISTS is_bluetooth_paired BOOLEAN DEFAULT FALSE;
ALTER TABLE locks ADD COLUMN IF NOT EXISTS last_bluetooth_sync TIMESTAMP;

-- Add comments
COMMENT ON COLUMN locks.ttlock_mac IS 'TTLock Bluetooth MAC address';
COMMENT ON COLUMN locks.ttlock_data IS 'Encrypted TTLock data from SDK (contains keys)';
COMMENT ON COLUMN locks.ttlock_lock_name IS 'Original TTLock device name';
COMMENT ON COLUMN locks.is_bluetooth_paired IS 'Whether lock is paired via Bluetooth';
COMMENT ON COLUMN locks.last_bluetooth_sync IS 'Last successful Bluetooth sync';

-- Add index for MAC address lookup
CREATE INDEX IF NOT EXISTS idx_locks_ttlock_mac ON locks(ttlock_mac);

-- Add TTLock operation source to activity_logs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'operation_source'
  ) THEN
    CREATE TYPE operation_source AS ENUM ('bluetooth', 'remote', 'auto', 'manual');
  END IF;
END $$;

ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS operation_source operation_source DEFAULT 'bluetooth';
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS ttlock_unique_id VARCHAR(50);

COMMENT ON COLUMN activity_logs.operation_source IS 'Source of lock operation: bluetooth, remote, auto, manual';
COMMENT ON COLUMN activity_logs.ttlock_unique_id IS 'Unique ID from TTLock operation';

-- Create passcodes table for TTLock passcode management
CREATE TABLE IF NOT EXISTS passcodes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lock_id UUID NOT NULL REFERENCES locks(id) ON DELETE CASCADE,
  code VARCHAR(8) NOT NULL,
  code_type VARCHAR(20) NOT NULL, -- 'permanent', 'timed', 'one_time'
  valid_from TIMESTAMP,
  valid_until TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT passcodes_code_length CHECK (char_length(code) >= 4 AND char_length(code) <= 8)
);

-- Add indexes for passcodes
CREATE INDEX IF NOT EXISTS idx_passcodes_lock_id ON passcodes(lock_id);
CREATE INDEX IF NOT EXISTS idx_passcodes_active ON passcodes(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_passcodes_valid ON passcodes(valid_from, valid_until);

-- Add RLS policies for passcodes
ALTER TABLE passcodes ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view passcodes for locks they have access to
CREATE POLICY passcodes_select_policy ON passcodes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_locks
      WHERE user_locks.lock_id = passcodes.lock_id
        AND user_locks.user_id = auth.uid()
        AND user_locks.is_active = TRUE
    )
  );

-- Policy: Users with manage_users permission can insert passcodes
CREATE POLICY passcodes_insert_policy ON passcodes
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_locks
      WHERE user_locks.lock_id = passcodes.lock_id
        AND user_locks.user_id = auth.uid()
        AND user_locks.can_manage_users = TRUE
        AND user_locks.is_active = TRUE
    )
  );

-- Policy: Users with manage_users permission can update passcodes
CREATE POLICY passcodes_update_policy ON passcodes
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_locks
      WHERE user_locks.lock_id = passcodes.lock_id
        AND user_locks.user_id = auth.uid()
        AND user_locks.can_manage_users = TRUE
        AND user_locks.is_active = TRUE
    )
  );

-- Policy: Users with manage_users permission can delete passcodes
CREATE POLICY passcodes_delete_policy ON passcodes
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_locks
      WHERE user_locks.lock_id = passcodes.lock_id
        AND user_locks.user_id = auth.uid()
        AND user_locks.can_manage_users = TRUE
        AND user_locks.is_active = TRUE
    )
  );

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_passcodes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER passcodes_updated_at
  BEFORE UPDATE ON passcodes
  FOR EACH ROW
  EXECUTE FUNCTION update_passcodes_updated_at();

-- Create cards table for IC/RFID card management
CREATE TABLE IF NOT EXISTS cards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lock_id UUID NOT NULL REFERENCES locks(id) ON DELETE CASCADE,
  card_number VARCHAR(50) NOT NULL,
  card_type VARCHAR(20) DEFAULT 'ic_card', -- 'ic_card', 'rfid_card'
  assigned_to UUID REFERENCES users(id),
  valid_from TIMESTAMP,
  valid_until TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(lock_id, card_number)
);

-- Add indexes for cards
CREATE INDEX IF NOT EXISTS idx_cards_lock_id ON cards(lock_id);
CREATE INDEX IF NOT EXISTS idx_cards_assigned_to ON cards(assigned_to);
CREATE INDEX IF NOT EXISTS idx_cards_active ON cards(is_active) WHERE is_active = TRUE;

-- Add RLS policies for cards (similar to passcodes)
ALTER TABLE cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY cards_select_policy ON cards
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_locks
      WHERE user_locks.lock_id = cards.lock_id
        AND user_locks.user_id = auth.uid()
        AND user_locks.is_active = TRUE
    )
  );

CREATE POLICY cards_insert_policy ON cards
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_locks
      WHERE user_locks.lock_id = cards.lock_id
        AND user_locks.user_id = auth.uid()
        AND user_locks.can_manage_users = TRUE
        AND user_locks.is_active = TRUE
    )
  );

CREATE POLICY cards_update_policy ON cards
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_locks
      WHERE user_locks.lock_id = cards.lock_id
        AND user_locks.user_id = auth.uid()
        AND user_locks.can_manage_users = TRUE
        AND user_locks.is_active = TRUE
    )
  );

CREATE POLICY cards_delete_policy ON cards
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_locks
      WHERE user_locks.lock_id = cards.lock_id
        AND user_locks.user_id = auth.uid()
        AND user_locks.can_manage_users = TRUE
        AND user_locks.is_active = TRUE
    )
  );

-- Create bluetooth_sync_log table for tracking Bluetooth operations
CREATE TABLE IF NOT EXISTS bluetooth_sync_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lock_id UUID NOT NULL REFERENCES locks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  operation_type VARCHAR(50) NOT NULL, -- 'lock', 'unlock', 'sync_time', 'add_passcode', etc.
  success BOOLEAN NOT NULL,
  battery_level INTEGER,
  error_message TEXT,
  sync_duration_ms INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Add indexes for bluetooth_sync_log
CREATE INDEX IF NOT EXISTS idx_bluetooth_sync_lock_id ON bluetooth_sync_log(lock_id);
CREATE INDEX IF NOT EXISTS idx_bluetooth_sync_created_at ON bluetooth_sync_log(created_at);
CREATE INDEX IF NOT EXISTS idx_bluetooth_sync_success ON bluetooth_sync_log(success);

-- Add RLS policies for bluetooth_sync_log
ALTER TABLE bluetooth_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY bluetooth_sync_select_policy ON bluetooth_sync_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_locks
      WHERE user_locks.lock_id = bluetooth_sync_log.lock_id
        AND user_locks.user_id = auth.uid()
        AND user_locks.can_view_logs = TRUE
        AND user_locks.is_active = TRUE
    )
  );

CREATE POLICY bluetooth_sync_insert_policy ON bluetooth_sync_log
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_locks
      WHERE user_locks.lock_id = bluetooth_sync_log.lock_id
        AND user_locks.user_id = auth.uid()
        AND user_locks.is_active = TRUE
    )
  );

-- Create function to get battery status
CREATE OR REPLACE FUNCTION get_battery_status(battery_level INTEGER)
RETURNS VARCHAR(20) AS $$
BEGIN
  IF battery_level IS NULL THEN
    RETURN 'unknown';
  ELSIF battery_level <= 10 THEN
    RETURN 'critical';
  ELSIF battery_level <= 20 THEN
    RETURN 'low';
  ELSIF battery_level <= 40 THEN
    RETURN 'medium';
  ELSE
    RETURN 'good';
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create view for lock status with TTLock data
CREATE OR REPLACE VIEW locks_with_ttlock_status AS
SELECT
  l.id,
  l.name,
  l.location,
  l.owner_id,
  l.device_id,
  l.mac_address,
  l.ttlock_mac,
  l.ttlock_lock_name,
  l.battery_level,
  get_battery_status(l.battery_level) as battery_status,
  l.is_locked,
  l.is_connected,
  l.is_online,
  l.is_bluetooth_paired,
  l.last_bluetooth_sync,
  l.created_at,
  l.updated_at,
  (
    SELECT COUNT(*) FROM passcodes
    WHERE passcodes.lock_id = l.id AND passcodes.is_active = TRUE
  ) as active_passcodes_count,
  (
    SELECT COUNT(*) FROM cards
    WHERE cards.lock_id = l.id AND cards.is_active = TRUE
  ) as active_cards_count,
  (
    SELECT COUNT(*) FROM user_locks
    WHERE user_locks.lock_id = l.id AND user_locks.is_active = TRUE
  ) as shared_users_count
FROM locks l;

-- Grant permissions on view
GRANT SELECT ON locks_with_ttlock_status TO authenticated;

COMMENT ON TABLE passcodes IS 'Stores TTLock passcodes created via Bluetooth SDK';
COMMENT ON TABLE cards IS 'Stores IC/RFID cards added via Bluetooth SDK';
COMMENT ON TABLE bluetooth_sync_log IS 'Logs all Bluetooth operations for debugging';
COMMENT ON VIEW locks_with_ttlock_status IS 'Lock status with TTLock-specific data';
