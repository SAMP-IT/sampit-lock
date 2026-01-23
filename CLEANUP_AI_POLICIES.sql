-- ============================================
-- Cleanup Script: Remove existing AI policies before re-running migration
-- Run this FIRST, then run 008_ai_features.sql
-- ============================================

-- Drop all existing policies for AI tables
DROP POLICY IF EXISTS user_access_patterns_select_own ON user_access_patterns;
DROP POLICY IF EXISTS user_access_patterns_service ON user_access_patterns;

DROP POLICY IF EXISTS ai_insights_select_own ON ai_insights;
DROP POLICY IF EXISTS ai_insights_service ON ai_insights;

DROP POLICY IF EXISTS ai_suggestions_select_own ON ai_suggestions;
DROP POLICY IF EXISTS ai_suggestions_update_own ON ai_suggestions;
DROP POLICY IF EXISTS ai_suggestions_service ON ai_suggestions;

DROP POLICY IF EXISTS lock_risk_scores_select_own ON lock_risk_scores;
DROP POLICY IF EXISTS lock_risk_scores_service ON lock_risk_scores;

DROP POLICY IF EXISTS battery_history_select_own ON battery_history;
DROP POLICY IF EXISTS battery_history_service ON battery_history;

DROP POLICY IF EXISTS llm_cache_service ON llm_cache;

DROP POLICY IF EXISTS chat_conversations_select_own ON chat_conversations;
DROP POLICY IF EXISTS chat_conversations_insert_own ON chat_conversations;
DROP POLICY IF EXISTS chat_conversations_update_own ON chat_conversations;
DROP POLICY IF EXISTS chat_conversations_delete_own ON chat_conversations;
DROP POLICY IF EXISTS chat_conversations_service ON chat_conversations;

DROP POLICY IF EXISTS notification_rules_select_own ON notification_rules;
DROP POLICY IF EXISTS notification_rules_insert_own ON notification_rules;
DROP POLICY IF EXISTS notification_rules_update_own ON notification_rules;
DROP POLICY IF EXISTS notification_rules_delete_own ON notification_rules;
DROP POLICY IF EXISTS notification_rules_service ON notification_rules;

DROP POLICY IF EXISTS home_modes_select_own ON home_modes;
DROP POLICY IF EXISTS home_modes_insert_own ON home_modes;
DROP POLICY IF EXISTS home_modes_update_own ON home_modes;
DROP POLICY IF EXISTS home_modes_service ON home_modes;

DROP POLICY IF EXISTS ai_processing_queue_service ON ai_processing_queue;

DROP POLICY IF EXISTS daily_summaries_select_own ON daily_summaries;
DROP POLICY IF EXISTS daily_summaries_service ON daily_summaries;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'All AI policies cleaned up successfully - now run 008_ai_features.sql';
END $$;
