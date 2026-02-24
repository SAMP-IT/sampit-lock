-- ============================================================================
-- MIGRATION 026: Add sync_status to credential tables (P7)
--
-- Tracks whether the DB record is in sync with the physical lock hardware.
-- Values: 'synced', 'pending_add', 'pending_delete', 'pending_update',
--         'failed', 'unknown'
--
-- This enables the admin panel and backend to show which credentials
-- are actually active on the lock vs. only recorded in the database.
-- ============================================================================

-- Fingerprints
ALTER TABLE fingerprints
  ADD COLUMN IF NOT EXISTS sync_status TEXT DEFAULT 'synced',
  ADD COLUMN IF NOT EXISTS sync_error TEXT,
  ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN fingerprints.sync_status IS 'Hardware sync state: synced, pending_add, pending_delete, pending_update, failed, unknown';
COMMENT ON COLUMN fingerprints.sync_error IS 'Last sync error message (null if synced)';
COMMENT ON COLUMN fingerprints.last_synced_at IS 'When the credential was last confirmed synced with hardware';

-- IC Cards
ALTER TABLE ic_cards
  ADD COLUMN IF NOT EXISTS sync_status TEXT DEFAULT 'synced',
  ADD COLUMN IF NOT EXISTS sync_error TEXT,
  ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN ic_cards.sync_status IS 'Hardware sync state: synced, pending_add, pending_delete, pending_update, failed, unknown';
COMMENT ON COLUMN ic_cards.sync_error IS 'Last sync error message (null if synced)';
COMMENT ON COLUMN ic_cards.last_synced_at IS 'When the credential was last confirmed synced with hardware';

-- Passcodes
ALTER TABLE passcodes
  ADD COLUMN IF NOT EXISTS sync_status TEXT DEFAULT 'synced',
  ADD COLUMN IF NOT EXISTS sync_error TEXT,
  ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN passcodes.sync_status IS 'Hardware sync state: synced, pending_add, pending_delete, pending_update, failed, unknown';
COMMENT ON COLUMN passcodes.sync_error IS 'Last sync error message (null if synced)';
COMMENT ON COLUMN passcodes.last_synced_at IS 'When the credential was last confirmed synced with hardware';

-- Indexes for finding unsynced credentials
CREATE INDEX IF NOT EXISTS idx_fingerprints_sync_status
  ON fingerprints (sync_status)
  WHERE sync_status != 'synced';

CREATE INDEX IF NOT EXISTS idx_ic_cards_sync_status
  ON ic_cards (sync_status)
  WHERE sync_status != 'synced';

CREATE INDEX IF NOT EXISTS idx_passcodes_sync_status
  ON passcodes (sync_status)
  WHERE sync_status != 'synced';
