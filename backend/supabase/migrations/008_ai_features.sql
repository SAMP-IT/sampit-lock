-- ============================================
-- AI FEATURES DATABASE SCHEMA
-- Migration: 008_ai_features.sql
-- Description: Creates tables and columns for AI features
-- Date: 2025-12-15
-- ============================================

-- 0. Enhanced User Locks Table (for vacation mode and time restrictions)
ALTER TABLE user_locks ADD COLUMN IF NOT EXISTS
  vacation_disabled BOOLEAN DEFAULT FALSE;
ALTER TABLE user_locks ADD COLUMN IF NOT EXISTS
  time_restrictions JSONB DEFAULT NULL;

-- 1. Enhanced Events Table (extends activity_logs)
-- Adds AI-relevant fields to existing logging
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS
  ai_processed BOOLEAN DEFAULT FALSE;
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS
  anomaly_score DECIMAL(5, 2);
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS
  anomaly_flags JSONB DEFAULT '[]';
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS
  natural_language_summary TEXT;

-- Create index for AI processing
CREATE INDEX IF NOT EXISTS idx_activity_logs_ai_processed ON activity_logs(ai_processed) WHERE ai_processed = FALSE;

-- 2. User Access Patterns
CREATE TABLE IF NOT EXISTS user_access_patterns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lock_id UUID NOT NULL REFERENCES locks(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0=Sunday, 6=Saturday
  typical_start_hour INTEGER CHECK (typical_start_hour >= 0 AND typical_start_hour <= 23), -- 0-23
  typical_end_hour INTEGER CHECK (typical_end_hour >= 0 AND typical_end_hour <= 23), -- 0-23
  average_daily_accesses DECIMAL(5, 2),
  confidence_score DECIMAL(3, 2) CHECK (confidence_score >= 0 AND confidence_score <= 1), -- 0.00 to 1.00
  sample_count INTEGER DEFAULT 0,
  last_calculated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, lock_id, day_of_week)
);

CREATE INDEX IF NOT EXISTS idx_user_access_patterns_user ON user_access_patterns(user_id);
CREATE INDEX IF NOT EXISTS idx_user_access_patterns_lock ON user_access_patterns(lock_id);
CREATE INDEX IF NOT EXISTS idx_user_access_patterns_user_lock ON user_access_patterns(user_id, lock_id);

-- 3. AI Insights
CREATE TABLE IF NOT EXISTS ai_insights (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lock_id UUID NOT NULL REFERENCES locks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  insight_type VARCHAR(50) NOT NULL, -- 'anomaly', 'pattern', 'suggestion', 'risk', 'summary'
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  title VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  related_event_id UUID REFERENCES activity_logs(id) ON DELETE SET NULL,
  is_read BOOLEAN DEFAULT FALSE,
  is_dismissed BOOLEAN DEFAULT FALSE,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_insights_lock ON ai_insights(lock_id);
CREATE INDEX IF NOT EXISTS idx_ai_insights_user ON ai_insights(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_insights_type ON ai_insights(insight_type);
CREATE INDEX IF NOT EXISTS idx_ai_insights_severity ON ai_insights(severity);
CREATE INDEX IF NOT EXISTS idx_ai_insights_created ON ai_insights(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_insights_unread ON ai_insights(is_read, is_dismissed) WHERE is_read = FALSE AND is_dismissed = FALSE;

-- 4. AI Suggestions (user-actionable)
CREATE TABLE IF NOT EXISTS ai_suggestions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lock_id UUID NOT NULL REFERENCES locks(id) ON DELETE CASCADE,
  owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- Lock owner who sees the suggestion
  target_user_id UUID REFERENCES users(id) ON DELETE CASCADE, -- User the suggestion is about (if applicable)
  suggestion_type VARCHAR(50) NOT NULL, -- 'restrict_time', 'revoke_access', 'add_restriction', 'extend_access', 'battery_replace'
  title VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  suggested_action JSONB NOT NULL, -- {action: 'restrict_time', params: {start: 10, end: 12}}
  confidence_score DECIMAL(3, 2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'dismissed', 'expired', 'auto_applied')),
  accepted_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_suggestions_lock ON ai_suggestions(lock_id);
CREATE INDEX IF NOT EXISTS idx_ai_suggestions_owner ON ai_suggestions(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_ai_suggestions_status ON ai_suggestions(status);
CREATE INDEX IF NOT EXISTS idx_ai_suggestions_pending ON ai_suggestions(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_ai_suggestions_created ON ai_suggestions(created_at DESC);

-- 5. Risk Scores
CREATE TABLE IF NOT EXISTS lock_risk_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lock_id UUID NOT NULL REFERENCES locks(id) ON DELETE CASCADE,
  overall_score INTEGER NOT NULL CHECK (overall_score >= 0 AND overall_score <= 100), -- 0-100
  risk_level VARCHAR(20) NOT NULL CHECK (risk_level IN ('low', 'medium', 'high')),
  factor_breakdown JSONB NOT NULL, -- {failed_attempts: 15, unusual_access: 20, battery: 10, ...}
  recommendations JSONB DEFAULT '[]', -- Array of improvement suggestions
  calculated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_risk_scores_lock ON lock_risk_scores(lock_id);
CREATE INDEX IF NOT EXISTS idx_risk_scores_calculated ON lock_risk_scores(calculated_at DESC);
CREATE INDEX IF NOT EXISTS idx_risk_scores_lock_latest ON lock_risk_scores(lock_id, calculated_at DESC);

-- 6. Battery History (for prediction)
CREATE TABLE IF NOT EXISTS battery_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lock_id UUID NOT NULL REFERENCES locks(id) ON DELETE CASCADE,
  battery_level INTEGER NOT NULL CHECK (battery_level >= 0 AND battery_level <= 100), -- 0-100
  voltage DECIMAL(4, 2), -- If available from device
  temperature DECIMAL(4, 1), -- If available
  daily_operations INTEGER, -- Operations count for that day
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_battery_history_lock ON battery_history(lock_id);
CREATE INDEX IF NOT EXISTS idx_battery_history_recorded ON battery_history(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_battery_history_lock_recorded ON battery_history(lock_id, recorded_at DESC);

-- 7. LLM Response Cache
CREATE TABLE IF NOT EXISTS llm_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cache_key VARCHAR(255) NOT NULL UNIQUE,
  prompt_hash VARCHAR(64) NOT NULL,
  prompt_preview TEXT, -- First 500 chars of prompt for debugging
  response TEXT NOT NULL,
  model VARCHAR(50) NOT NULL,
  tokens_used INTEGER,
  cost_cents DECIMAL(10, 4), -- Estimated cost
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  hit_count INTEGER DEFAULT 0,
  last_hit_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_llm_cache_key ON llm_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_llm_cache_expires ON llm_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_llm_cache_created ON llm_cache(created_at DESC);

-- 8. Chat Conversations
CREATE TABLE IF NOT EXISTS chat_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lock_id UUID NOT NULL REFERENCES locks(id) ON DELETE CASCADE, -- User must select a lock
  title VARCHAR(200), -- Auto-generated title from first message
  messages JSONB DEFAULT '[]', -- [{role: 'user', content: '...', timestamp: '...'}, {role: 'assistant', content: '...', timestamp: '...'}]
  message_count INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0, -- Track token usage
  is_archived BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_conversations_user ON chat_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_lock ON chat_conversations(lock_id);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_user_lock ON chat_conversations(user_id, lock_id);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_updated ON chat_conversations(updated_at DESC);

-- 9. Notification Suppression Rules (Smart Notifications)
CREATE TABLE IF NOT EXISTS notification_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  lock_id UUID REFERENCES locks(id) ON DELETE CASCADE, -- null = all locks
  rule_type VARCHAR(50) NOT NULL, -- 'auto_lock', 'time_restriction', 'auto_disable', 'vacation_alert', etc.
  name VARCHAR(100),
  conditions JSONB DEFAULT '{}', -- Rule conditions
  actions JSONB DEFAULT '[]', -- Actions to take when triggered
  priority INTEGER DEFAULT 0, -- Higher = processed first
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_rules_user ON notification_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_rules_lock ON notification_rules(lock_id);
CREATE INDEX IF NOT EXISTS idx_notification_rules_active ON notification_rules(is_active) WHERE is_active = TRUE;

-- 10. Home/Property Modes (Vacation Mode, etc.)
CREATE TABLE IF NOT EXISTS home_modes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mode VARCHAR(20) NOT NULL DEFAULT 'home' CHECK (mode IN ('home', 'away', 'vacation', 'night')),
  is_active BOOLEAN DEFAULT TRUE,
  activated_at TIMESTAMPTZ DEFAULT NOW(),
  ends_at TIMESTAMPTZ, -- When the mode should auto-expire
  settings JSONB DEFAULT '{}', -- Mode-specific settings
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_home_modes_user ON home_modes(user_id);
CREATE INDEX IF NOT EXISTS idx_home_modes_mode ON home_modes(mode);
CREATE INDEX IF NOT EXISTS idx_home_modes_active ON home_modes(user_id, is_active) WHERE is_active = TRUE;

-- 11. AI Processing Queue (for batch processing)
CREATE TABLE IF NOT EXISTS ai_processing_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_type VARCHAR(50) NOT NULL, -- 'analyze_event', 'generate_summary', 'calculate_risk', 'generate_suggestions', 'presence_simulation', 'batch_notification'
  payload JSONB NOT NULL,
  priority INTEGER DEFAULT 0, -- Higher = process first
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  error_message TEXT,
  scheduled_for TIMESTAMPTZ, -- Optional: When this task should be executed
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_queue_status ON ai_processing_queue(status);
CREATE INDEX IF NOT EXISTS idx_ai_queue_pending ON ai_processing_queue(status, priority DESC) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_ai_queue_created ON ai_processing_queue(created_at);

-- 12. Daily Summaries (pre-generated)
CREATE TABLE IF NOT EXISTS daily_summaries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lock_id UUID NOT NULL REFERENCES locks(id) ON DELETE CASCADE,
  summary_date DATE NOT NULL,
  total_accesses INTEGER DEFAULT 0,
  unique_users INTEGER DEFAULT 0,
  failed_attempts INTEGER DEFAULT 0,
  anomalies_detected INTEGER DEFAULT 0,
  natural_language_summary TEXT,
  highlights JSONB DEFAULT '[]', -- Key events of the day
  statistics JSONB DEFAULT '{}', -- Access by hour, by user, etc.
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, lock_id, summary_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_summaries_user_lock ON daily_summaries(user_id, lock_id);
CREATE INDEX IF NOT EXISTS idx_daily_summaries_date ON daily_summaries(summary_date DESC);

-- ============================================
-- Row Level Security Policies
-- ============================================

ALTER TABLE user_access_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE lock_risk_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE battery_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE llm_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE home_modes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_processing_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_summaries ENABLE ROW LEVEL SECURITY;

-- User Access Patterns: Users can view their own patterns
CREATE POLICY user_access_patterns_select_own ON user_access_patterns
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY user_access_patterns_service ON user_access_patterns
  FOR ALL USING (auth.role() = 'service_role');

-- AI Insights: Users can view insights for their locks
CREATE POLICY ai_insights_select_own ON ai_insights
  FOR SELECT USING (
    lock_id IN (SELECT id FROM locks WHERE owner_id = auth.uid())
    OR user_id = auth.uid()
  );

CREATE POLICY ai_insights_service ON ai_insights
  FOR ALL USING (auth.role() = 'service_role');

-- AI Suggestions: Lock owners can view and act on suggestions
CREATE POLICY ai_suggestions_select_own ON ai_suggestions
  FOR SELECT USING (owner_user_id = auth.uid());

CREATE POLICY ai_suggestions_update_own ON ai_suggestions
  FOR UPDATE USING (owner_user_id = auth.uid());

CREATE POLICY ai_suggestions_service ON ai_suggestions
  FOR ALL USING (auth.role() = 'service_role');

-- Risk Scores: Lock owners can view
CREATE POLICY lock_risk_scores_select_own ON lock_risk_scores
  FOR SELECT USING (
    lock_id IN (SELECT id FROM locks WHERE owner_id = auth.uid())
  );

CREATE POLICY lock_risk_scores_service ON lock_risk_scores
  FOR ALL USING (auth.role() = 'service_role');

-- Battery History: Lock owners can view
CREATE POLICY battery_history_select_own ON battery_history
  FOR SELECT USING (
    lock_id IN (SELECT id FROM locks WHERE owner_id = auth.uid())
  );

CREATE POLICY battery_history_service ON battery_history
  FOR ALL USING (auth.role() = 'service_role');

-- LLM Cache: Service role only
CREATE POLICY llm_cache_service ON llm_cache
  FOR ALL USING (auth.role() = 'service_role');

-- Chat Conversations: Users own their conversations
CREATE POLICY chat_conversations_select_own ON chat_conversations
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY chat_conversations_insert_own ON chat_conversations
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY chat_conversations_update_own ON chat_conversations
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY chat_conversations_delete_own ON chat_conversations
  FOR DELETE USING (user_id = auth.uid());

CREATE POLICY chat_conversations_service ON chat_conversations
  FOR ALL USING (auth.role() = 'service_role');

-- Notification Rules: Users manage their own rules
CREATE POLICY notification_rules_select_own ON notification_rules
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY notification_rules_insert_own ON notification_rules
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY notification_rules_update_own ON notification_rules
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY notification_rules_delete_own ON notification_rules
  FOR DELETE USING (user_id = auth.uid());

CREATE POLICY notification_rules_service ON notification_rules
  FOR ALL USING (auth.role() = 'service_role');

-- Home Modes: Users manage their own modes
CREATE POLICY home_modes_select_own ON home_modes
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY home_modes_insert_own ON home_modes
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY home_modes_update_own ON home_modes
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY home_modes_service ON home_modes
  FOR ALL USING (auth.role() = 'service_role');

-- AI Processing Queue: Service role only
CREATE POLICY ai_processing_queue_service ON ai_processing_queue
  FOR ALL USING (auth.role() = 'service_role');

-- Daily Summaries: Users can view their own
CREATE POLICY daily_summaries_select_own ON daily_summaries
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY daily_summaries_service ON daily_summaries
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- Add new event types to lock_action enum
-- ============================================

-- Note: PostgreSQL doesn't support IF NOT EXISTS for ADD VALUE
-- These will error if already exist, which is safe
DO $$
BEGIN
  ALTER TYPE lock_action ADD VALUE 'setting_changed';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TYPE lock_action ADD VALUE 'user_added';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TYPE lock_action ADD VALUE 'user_removed';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TYPE lock_action ADD VALUE 'permission_changed';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TYPE lock_action ADD VALUE 'fingerprint_enrolled';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TYPE lock_action ADD VALUE 'fingerprint_deleted';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TYPE lock_action ADD VALUE 'card_assigned';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TYPE lock_action ADD VALUE 'card_removed';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TYPE lock_action ADD VALUE 'passcode_created';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TYPE lock_action ADD VALUE 'passcode_deleted';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TYPE lock_action ADD VALUE 'passcode_used';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TYPE lock_action ADD VALUE 'mode_changed';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TYPE lock_action ADD VALUE 'battery_low';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TYPE lock_action ADD VALUE 'battery_critical';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- Triggers for updated_at columns
-- ============================================

-- user_access_patterns
DROP TRIGGER IF EXISTS update_user_access_patterns_updated_at ON user_access_patterns;
CREATE TRIGGER update_user_access_patterns_updated_at
  BEFORE UPDATE ON user_access_patterns
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- chat_conversations
DROP TRIGGER IF EXISTS update_chat_conversations_updated_at ON chat_conversations;
CREATE TRIGGER update_chat_conversations_updated_at
  BEFORE UPDATE ON chat_conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- notification_rules
DROP TRIGGER IF EXISTS update_notification_rules_updated_at ON notification_rules;
CREATE TRIGGER update_notification_rules_updated_at
  BEFORE UPDATE ON notification_rules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Helper Functions
-- ============================================

-- Function to increment cache hit count atomically
CREATE OR REPLACE FUNCTION increment_cache_hit_count(p_cache_key VARCHAR(255))
RETURNS VOID AS $$
BEGIN
  UPDATE llm_cache
  SET hit_count = COALESCE(hit_count, 0) + 1,
      last_hit_at = NOW()
  WHERE cache_key = p_cache_key;
END;
$$ LANGUAGE plpgsql;

-- Function to get latest risk score for a lock
CREATE OR REPLACE FUNCTION get_latest_risk_score(p_lock_id UUID)
RETURNS TABLE (
  overall_score INTEGER,
  risk_level VARCHAR(20),
  factor_breakdown JSONB,
  calculated_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT rs.overall_score, rs.risk_level, rs.factor_breakdown, rs.calculated_at
  FROM lock_risk_scores rs
  WHERE rs.lock_id = p_lock_id
  ORDER BY rs.calculated_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Function to get user's current home mode
CREATE OR REPLACE FUNCTION get_user_home_mode(p_user_id UUID)
RETURNS VARCHAR(20) AS $$
DECLARE
  current_mode VARCHAR(20);
BEGIN
  SELECT mode INTO current_mode
  FROM home_modes
  WHERE user_id = p_user_id;

  RETURN COALESCE(current_mode, 'normal');
END;
$$ LANGUAGE plpgsql;

-- Function to check if notification should be suppressed
CREATE OR REPLACE FUNCTION should_suppress_notification(
  p_user_id UUID,
  p_lock_id UUID,
  p_event_type VARCHAR(50),
  p_event_user_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  suppress BOOLEAN := FALSE;
  rule RECORD;
BEGIN
  FOR rule IN
    SELECT * FROM notification_rules
    WHERE user_id = p_user_id
      AND (lock_id IS NULL OR lock_id = p_lock_id)
      AND is_active = TRUE
    ORDER BY priority DESC
  LOOP
    -- Check rule type and apply logic
    IF rule.rule_type = 'suppress_owner' AND p_event_user_id = p_user_id THEN
      suppress := TRUE;
      EXIT;
    END IF;

    -- Add more rule type checks as needed
  END LOOP;

  RETURN suppress;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Comments
-- ============================================

COMMENT ON TABLE user_access_patterns IS 'Stores learned access patterns per user-lock-day combination for anomaly detection';
COMMENT ON TABLE ai_insights IS 'AI-generated insights about lock activity and security';
COMMENT ON TABLE ai_suggestions IS 'Actionable AI suggestions for lock owners to accept or dismiss';
COMMENT ON TABLE lock_risk_scores IS 'Historical risk scores for each lock, calculated periodically';
COMMENT ON TABLE battery_history IS 'Battery level history for prediction algorithms';
COMMENT ON TABLE llm_cache IS 'Cached LLM responses to reduce API costs';
COMMENT ON TABLE chat_conversations IS 'Chat assistant conversation history per user-lock';
COMMENT ON TABLE notification_rules IS 'User-defined rules for smart notification filtering';
COMMENT ON TABLE home_modes IS 'Current home/property mode (normal, vacation, away, etc.)';
COMMENT ON TABLE ai_processing_queue IS 'Queue for batch AI processing tasks';
COMMENT ON TABLE daily_summaries IS 'Pre-generated daily activity summaries per lock';

-- ============================================
-- Completion
-- ============================================

DO $$
BEGIN
  RAISE NOTICE 'Migration 008_ai_features completed successfully';
END $$;
