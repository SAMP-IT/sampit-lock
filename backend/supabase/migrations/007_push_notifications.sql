-- Migration: 007_push_notifications.sql
-- Description: Add tables for push notifications and TTLock webhooks
-- Date: 2025-12-15

-- Device tokens for push notifications
CREATE TABLE IF NOT EXISTS device_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  device_token TEXT NOT NULL,
  expo_push_token TEXT NOT NULL,
  platform VARCHAR(10) NOT NULL CHECK (platform IN ('ios', 'android')),
  device_name TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, device_token)
);

-- TTLock webhook events log
CREATE TABLE IF NOT EXISTS webhook_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type VARCHAR(50) NOT NULL,
  lock_id UUID REFERENCES locks(id) ON DELETE SET NULL,
  ttlock_lock_id BIGINT,
  payload JSONB NOT NULL,
  processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notification preferences table (replace hardcoded defaults)
CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  push_enabled BOOLEAN DEFAULT TRUE,
  email_enabled BOOLEAN DEFAULT TRUE,
  unlock_notifications BOOLEAN DEFAULT TRUE,
  lock_notifications BOOLEAN DEFAULT TRUE,
  battery_warnings BOOLEAN DEFAULT TRUE,
  tamper_alerts BOOLEAN DEFAULT TRUE,
  failed_attempts BOOLEAN DEFAULT TRUE,
  guest_access BOOLEAN DEFAULT TRUE,
  offline_alerts BOOLEAN DEFAULT TRUE,
  quiet_hours_enabled BOOLEAN DEFAULT FALSE,
  quiet_hours_start TIME DEFAULT '22:00:00',
  quiet_hours_end TIME DEFAULT '07:00:00',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_device_tokens_user_id ON device_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_device_tokens_active ON device_tokens(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_webhook_events_processed ON webhook_events(processed) WHERE processed = FALSE;
CREATE INDEX IF NOT EXISTS idx_webhook_events_created ON webhook_events(created_at);
CREATE INDEX IF NOT EXISTS idx_notification_preferences_user ON notification_preferences(user_id);

-- Row Level Security (RLS) Policies
ALTER TABLE device_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

-- Device tokens: Users can only access their own tokens
CREATE POLICY device_tokens_select_own ON device_tokens
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY device_tokens_insert_own ON device_tokens
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY device_tokens_update_own ON device_tokens
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY device_tokens_delete_own ON device_tokens
  FOR DELETE USING (auth.uid() = user_id);

-- Webhook events: Service role only (backend access)
CREATE POLICY webhook_events_service_role ON webhook_events
  FOR ALL USING (auth.role() = 'service_role');

-- Notification preferences: Users can only access their own preferences
CREATE POLICY notification_preferences_select_own ON notification_preferences
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY notification_preferences_insert_own ON notification_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY notification_preferences_update_own ON notification_preferences
  FOR UPDATE USING (auth.uid() = user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_device_tokens_updated_at ON device_tokens;
CREATE TRIGGER update_device_tokens_updated_at
  BEFORE UPDATE ON device_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_notification_preferences_updated_at ON notification_preferences;
CREATE TRIGGER update_notification_preferences_updated_at
  BEFORE UPDATE ON notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comment on tables
COMMENT ON TABLE device_tokens IS 'Stores device tokens for push notifications (Expo Push)';
COMMENT ON TABLE webhook_events IS 'Logs all TTLock webhook events for processing and debugging';
COMMENT ON TABLE notification_preferences IS 'User notification preferences for push, email, and alert types';
