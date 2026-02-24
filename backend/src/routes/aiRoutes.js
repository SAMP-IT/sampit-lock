/**
 * AI Feature Routes
 *
 * Routes for all AI-powered features:
 * - Natural Language Logs
 * - AI Insights
 * - Risk Scores
 * - Chat Assistant
 */

import express from 'express';
import { authenticate } from '../middleware/auth.js';
import logger from '../utils/logger.js';

// Import controllers
import {
  getNaturalLanguageActivity,
  getDailySummary,
  getInsights,
  markInsightRead,
  dismissInsight,
  getRiskScore,
  getAllRiskScores
} from '../controllers/ai/insightsController.js';

import {
  sendMessage,
  getConversations,
  getConversation,
  archiveConversation,
  getSuggestions
} from '../controllers/ai/chatController.js';

import {
  getAccessRecommendations,
  getAIAccessSuggestion,
  recordRecommendationAction
} from '../services/ai/accessRecommendations.js';

import {
  predictBatteryDepletion,
  getBatteryHistory
} from '../services/ai/batteryPredictor.js';

import {
  getFraudAlerts,
  getFraudSummary
} from '../services/ai/fraudDetector.js';

import {
  generateRuleSuggestions,
  createRuleFromSuggestion,
  getActiveRules,
  toggleRule,
  deleteRule,
  dismissSuggestion
} from '../services/ai/autoRulesEngine.js';

import {
  getCurrentMode,
  setHomeMode,
  enableVacationMode,
  disableVacationMode,
  getSuggestedSchedule,
  activateSchedule,
  setAutoPilot,
  getUserAISettings
} from '../services/ai/smartScheduling.js';

import { supabase } from '../services/supabase.js';

import {
  triggerBatteryPredictions,
  triggerFraudDetection,
  triggerDailyAnalysis
} from '../workers/aiProcessor.js';

const router = express.Router();

console.log('🟠 [AI-ROUTES] Router initialized, about to add authenticate middleware');

// All routes require authentication
router.use((req, res, next) => {
  console.log('🟠 [AI-ROUTES] Middleware running for path:', req.path);
  console.log('🟠 [AI-ROUTES] Calling authenticate...');
  return authenticate(req, res, next);
});

// ==========================================
// Natural Language Activity Logs
// ==========================================

/**
 * @route   GET /api/ai/locks/:lockId/activity/natural
 * @desc    Get activity logs with natural language summaries
 * @access  Private
 */
router.get('/locks/:lockId/activity/natural', getNaturalLanguageActivity);

/**
 * @route   GET /api/ai/locks/:lockId/summary/daily
 * @desc    Get daily activity summary for a lock
 * @access  Private
 * @query   date - YYYY-MM-DD format (optional, defaults to today)
 */
router.get('/locks/:lockId/summary/daily', getDailySummary);

// ==========================================
// AI Insights
// ==========================================

/**
 * @route   GET /api/ai/locks/:lockId/insights
 * @desc    Get AI-generated insights for a lock
 * @access  Private
 * @query   type - Filter by insight type (anomaly, pattern, suggestion, risk)
 * @query   severity - Filter by severity (info, warning, critical)
 * @query   limit - Max results (default 20)
 * @query   include_dismissed - Include dismissed insights (default false)
 */
router.get('/locks/:lockId/insights', getInsights);

/**
 * @route   POST /api/ai/insights/:insightId/read
 * @desc    Mark an insight as read
 * @access  Private
 */
router.post('/insights/:insightId/read', markInsightRead);

/**
 * @route   POST /api/ai/insights/:insightId/dismiss
 * @desc    Dismiss an insight
 * @access  Private
 */
router.post('/insights/:insightId/dismiss', dismissInsight);

// ==========================================
// Risk Scores
// ==========================================

/**
 * @route   GET /api/ai/locks/:lockId/risk-score
 * @desc    Get risk score for a specific lock
 * @access  Private
 */
router.get('/locks/:lockId/risk-score', getRiskScore);

/**
 * @route   GET /api/ai/risk-scores
 * @desc    Get risk scores for all user's locks
 * @access  Private
 */
router.get('/risk-scores', getAllRiskScores);

// ==========================================
// Chat Assistant
// ==========================================

/**
 * @route   POST /api/ai/chat
 * @desc    Send a message to the AI assistant
 * @access  Private
 * @body    { message: string, lockId: string, conversationId?: string }
 */
router.post('/chat', sendMessage);

/**
 * @route   GET /api/ai/chat/conversations
 * @desc    Get user's chat conversations
 * @access  Private
 * @query   lockId - Filter by lock (optional)
 * @query   limit - Max results (default 20)
 */
router.get('/chat/conversations', getConversations);

/**
 * @route   GET /api/ai/chat/conversations/:conversationId
 * @desc    Get a specific conversation with messages
 * @access  Private
 */
router.get('/chat/conversations/:conversationId', getConversation);

/**
 * @route   DELETE /api/ai/chat/conversations/:conversationId
 * @desc    Archive a conversation
 * @access  Private
 */
router.delete('/chat/conversations/:conversationId', archiveConversation);

/**
 * @route   GET /api/ai/chat/suggestions/:lockId
 * @desc    Get suggested questions for a lock
 * @access  Private
 */
router.get('/chat/suggestions/:lockId', getSuggestions);

// ==========================================
// Access Recommendations
// ==========================================

/**
 * @route   GET /api/ai/locks/:lockId/recommendations
 * @desc    Get AI access recommendations for a lock
 * @access  Private
 */
router.get('/locks/:lockId/recommendations', async (req, res) => {
  try {
    const { lockId } = req.params;
    const userId = req.user?.id;
    logger.info('[AI] Request: ' + 'getAccessRecommendations', userId, { lockId });

    const result = await getAccessRecommendations(lockId);

    logger.info(`[AI] ✅ Generated ${result?.recommendations?.length || 0} recommendations for lock ${lockId}`);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('[AI] ❌ Get recommendations error:', { error: error.message, lockId: req.params.lockId });
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to get recommendations' }
    });
  }
});

/**
 * @route   GET /api/ai/locks/:lockId/users/:userId/suggestion
 * @desc    Get AI suggestion for a specific user's access
 * @access  Private
 */
router.get('/locks/:lockId/users/:userId/suggestion', async (req, res) => {
  try {
    const { lockId, userId } = req.params;
    const requesterId = req.user?.id;
    logger.info('[AI] Request: ' + 'getAIAccessSuggestion', requesterId, { lockId, targetUserId: userId });

    const result = await getAIAccessSuggestion(lockId, userId);

    logger.info(`[AI] ✅ Access suggestion generated for user ${userId} on lock ${lockId}`);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('[AI] ❌ Get AI suggestion error:', { error: error.message, lockId: req.params.lockId, userId: req.params.userId });
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to get suggestion' }
    });
  }
});

/**
 * @route   POST /api/ai/recommendations/:recommendationId/action
 * @desc    Record action taken on a recommendation
 * @access  Private
 * @body    { lockId, userId, recommendationType, action, metadata }
 */
router.post('/recommendations/action', async (req, res) => {
  try {
    const { lockId, userId, recommendationType, action, metadata } = req.body;
    const requesterId = req.user?.id;
    logger.info('[AI] Request: ' + 'recordRecommendationAction', requesterId, { lockId, userId, recommendationType, action });

    const result = await recordRecommendationAction({
      lockId,
      userId,
      recommendationType,
      action,
      metadata
    });

    logger.info(`[AI] ✅ Recommendation action recorded: ${action} for ${recommendationType} on lock ${lockId}`);
    res.json({
      success: result.success,
      data: result
    });
  } catch (error) {
    logger.error('[AI] ❌ Record recommendation action error:', { error: error.message, ...req.body });
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to record action' }
    });
  }
});

// ==========================================
// Predictive Battery Alerts
// ==========================================

/**
 * @route   GET /api/ai/locks/:lockId/battery/prediction
 * @desc    Get battery prediction for a lock
 * @access  Private
 */
router.get('/locks/:lockId/battery/prediction', async (req, res) => {
  try {
    const { lockId } = req.params;
    const userId = req.user?.id;
    logger.info('[AI] Request: ' + 'predictBatteryDepletion', userId, { lockId });

    const result = await predictBatteryDepletion(lockId);

    logger.ai.batteryPrediction(lockId, result);
    res.json({
      success: !result.error,
      data: result
    });
  } catch (error) {
    logger.error('[AI] ❌ Battery prediction error:', { error: error.message, lockId: req.params.lockId });
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to predict battery' }
    });
  }
});

/**
 * @route   GET /api/ai/locks/:lockId/battery/history
 * @desc    Get battery history for a lock
 * @access  Private
 * @query   days - Number of days of history (default 30)
 */
router.get('/locks/:lockId/battery/history', async (req, res) => {
  try {
    const { lockId } = req.params;
    const { days = 30 } = req.query;
    const userId = req.user?.id;
    logger.info('[AI] Request: ' + 'getBatteryHistory', userId, { lockId, days });

    const result = await getBatteryHistory(lockId, parseInt(days));

    logger.info(`[AI] ✅ Battery history retrieved for lock ${lockId} (${days} days, ${result?.length || 0} records)`);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('[AI] ❌ Battery history error:', { error: error.message, lockId: req.params.lockId });
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to get battery history' }
    });
  }
});

// ==========================================
// Fraud Detection
// ==========================================

/**
 * @route   GET /api/ai/locks/:lockId/security/alerts
 * @desc    Get fraud/security alerts for a lock
 * @access  Private
 * @query   days - Number of days to look back (default 7)
 */
router.get('/locks/:lockId/security/alerts', async (req, res) => {
  try {
    const { lockId } = req.params;
    const { days = 7 } = req.query;
    const userId = req.user?.id;
    logger.info('[AI] Request: ' + 'getFraudAlerts', userId, { lockId, days });

    const result = await getFraudAlerts(lockId, parseInt(days));

    logger.ai.fraudAlert(lockId, 'summary', result?.severity || 'info', { alertCount: result?.alerts?.length || 0 });
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('[AI] ❌ Get security alerts error:', { error: error.message, lockId: req.params.lockId });
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to get security alerts' }
    });
  }
});

/**
 * @route   GET /api/ai/locks/:lockId/security/summary
 * @desc    Get security summary for a lock
 * @access  Private
 */
router.get('/locks/:lockId/security/summary', async (req, res) => {
  try {
    const { lockId } = req.params;
    const userId = req.user?.id;
    logger.info('[AI] Request: ' + 'getFraudSummary', userId, { lockId });

    const result = await getFraudSummary(lockId);

    logger.info(`[AI] ✅ Security summary retrieved for lock ${lockId} - Risk level: ${result?.riskLevel || 'unknown'}`);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('[AI] ❌ Get security summary error:', { error: error.message, lockId: req.params.lockId });
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to get security summary' }
    });
  }
});

// ==========================================
// Auto Rules Engine
// ==========================================

/**
 * @route   GET /api/ai/locks/:lockId/rules/suggestions
 * @desc    Get AI-generated rule suggestions
 * @access  Private
 */
router.get('/locks/:lockId/rules/suggestions', async (req, res) => {
  try {
    const { lockId } = req.params;
    const userId = req.user?.id;
    logger.info('[AI] Request: ' + 'generateRuleSuggestions', userId, { lockId });

    const result = await generateRuleSuggestions(lockId);

    logger.ai.ruleSuggestion(lockId, result?.suggestions?.length || 0);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('[AI] ❌ Get rule suggestions error:', { error: error.message, lockId: req.params.lockId });
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to get rule suggestions' }
    });
  }
});

/**
 * @route   GET /api/ai/locks/:lockId/rules
 * @desc    Get active rules for a lock
 * @access  Private
 */
router.get('/locks/:lockId/rules', async (req, res) => {
  try {
    const { lockId } = req.params;
    const userId = req.user?.id;
    logger.info('[AI] Request: ' + 'getActiveRules', userId, { lockId });

    const result = await getActiveRules(lockId);

    logger.ai.rulesList(lockId, result?.rules?.length || 0);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('[AI] ❌ Get rules error:', { error: error.message, lockId: req.params.lockId });
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to get rules' }
    });
  }
});

/**
 * @route   POST /api/ai/locks/:lockId/rules
 * @desc    Create a rule from a suggestion
 * @access  Private
 * @body    { suggestion: Object }
 */
router.post('/locks/:lockId/rules', async (req, res) => {
  try {
    const { lockId } = req.params;
    const { suggestion } = req.body;
    const userId = req.user.id;
    logger.info('[AI] Request: ' + 'createRuleFromSuggestion', userId, { lockId, ruleType: suggestion?.type });

    const result = await createRuleFromSuggestion(lockId, suggestion, userId);

    logger.ai.ruleCreated(lockId, result?.ruleId || null, suggestion?.type || 'unknown', userId);
    logger.info(`[AI] ✅ Rule created on lock ${lockId} by user ${userId} - Type: ${suggestion?.type || 'unknown'}`);
    res.json({
      success: result.success,
      data: result
    });
  } catch (error) {
    logger.error('[AI] ❌ Create rule error:', { error: error.message, lockId: req.params.lockId, userId: req.user?.id });
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to create rule' }
    });
  }
});

/**
 * @route   PATCH /api/ai/rules/:ruleId
 * @desc    Toggle rule status
 * @access  Private
 * @body    { is_active: boolean }
 */
router.patch('/rules/:ruleId', async (req, res) => {
  try {
    const { ruleId } = req.params;
    const { is_active } = req.body;
    const userId = req.user?.id;
    logger.info('[AI] Request: ' + 'toggleRule', userId, { ruleId, is_active });

    const result = await toggleRule(ruleId, is_active);

    logger.info(`[AI] ✅ Rule ${ruleId} toggled to ${is_active ? 'ACTIVE' : 'INACTIVE'} by user ${userId}`);
    res.json({
      success: result.success,
      data: result
    });
  } catch (error) {
    logger.error('[AI] ❌ Toggle rule error:', { error: error.message, ruleId: req.params.ruleId });
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to toggle rule' }
    });
  }
});

/**
 * @route   DELETE /api/ai/rules/:ruleId
 * @desc    Delete a rule
 * @access  Private
 */
router.delete('/rules/:ruleId', async (req, res) => {
  try {
    const { ruleId } = req.params;
    const userId = req.user?.id;
    logger.info('[AI] Request: ' + 'deleteRule', userId, { ruleId });

    const result = await deleteRule(ruleId);

    logger.info(`[AI] ✅ Rule ${ruleId} deleted by user ${userId}`);
    res.json({
      success: result.success,
      data: result
    });
  } catch (error) {
    logger.error('[AI] ❌ Delete rule error:', { error: error.message, ruleId: req.params.ruleId });
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to delete rule' }
    });
  }
});

/**
 * @route   POST /api/ai/locks/:lockId/rules/dismiss
 * @desc    Dismiss a rule suggestion so it won't reappear
 * @access  Private
 */
router.post('/locks/:lockId/rules/dismiss', async (req, res) => {
  try {
    const { lockId } = req.params;
    const { suggestion } = req.body;
    const userId = req.user.id;
    logger.info('[AI] Request: dismissSuggestion', userId, { lockId, ruleType: suggestion?.type });

    const result = await dismissSuggestion(lockId, suggestion, userId);

    logger.info(`[AI] ✅ Rule suggestion dismissed on lock ${lockId} by user ${userId}`);
    res.json({ success: result.success, data: result });
  } catch (error) {
    logger.error('[AI] ❌ Dismiss suggestion error:', { error: error.message, lockId: req.params.lockId });
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to dismiss suggestion' }
    });
  }
});

// ==========================================
// Smart Scheduling / Vacation Mode
// ==========================================

/**
 * @route   GET /api/ai/mode
 * @desc    Get current home mode
 * @access  Private
 */
router.get('/mode', async (req, res) => {
  try {
    const userId = req.user.id;
    logger.info('[AI] Request: ' + 'getCurrentMode', userId, {});

    const result = await getCurrentMode(userId);

    logger.ai.homeMode(userId, result?.mode || 'unknown');
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('[AI] ❌ Get mode error:', { error: error.message, userId: req.user?.id });
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to get mode' }
    });
  }
});

/**
 * @route   POST /api/ai/mode
 * @desc    Set home mode
 * @access  Private
 * @body    { mode: string, options?: Object }
 */
router.post('/mode', async (req, res) => {
  try {
    const userId = req.user.id;
    const { mode, options } = req.body;
    logger.info('[AI] Request: ' + 'setHomeMode', userId, { mode, options });

    const result = await setHomeMode(userId, mode, options || {});

    logger.ai.homeMode(userId, mode);
    logger.info(`[AI] ✅ Home mode set to '${mode}' for user ${userId}`);
    res.json({
      success: result.success,
      data: result
    });
  } catch (error) {
    logger.error('[AI] ❌ Set mode error:', { error: error.message, userId: req.user?.id, mode: req.body?.mode });
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to set mode' }
    });
  }
});

/**
 * @route   POST /api/ai/vacation
 * @desc    Enable vacation mode
 * @access  Private
 * @body    { startDate?, endDate?, trustedUsers?, disableGuests?, presenceSimulation?, alertOnAccess?, lockIds? }
 */
router.post('/vacation', async (req, res) => {
  try {
    const userId = req.user.id;
    const options = req.body;
    logger.info('[AI] Request: ' + 'enableVacationMode', userId, { startDate: options?.startDate, endDate: options?.endDate });

    const result = await enableVacationMode(userId, options);

    logger.ai.vacationMode(userId, true, options?.startDate, options?.endDate);
    logger.info(`[AI] ✅ Vacation mode ENABLED for user ${userId}`);
    res.json({
      success: result.success,
      data: result
    });
  } catch (error) {
    logger.error('[AI] ❌ Enable vacation mode error:', { error: error.message, userId: req.user?.id });
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to enable vacation mode' }
    });
  }
});

/**
 * @route   DELETE /api/ai/vacation
 * @desc    Disable vacation mode
 * @access  Private
 */
router.delete('/vacation', async (req, res) => {
  try {
    const userId = req.user.id;
    logger.info('[AI] Request: ' + 'disableVacationMode', userId, {});

    const result = await disableVacationMode(userId);

    logger.ai.vacationMode(userId, false);
    logger.info(`[AI] ✅ Vacation mode DISABLED for user ${userId}`);
    res.json({
      success: result.success,
      data: result
    });
  } catch (error) {
    logger.error('[AI] ❌ Disable vacation mode error:', { error: error.message, userId: req.user?.id });
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to disable vacation mode' }
    });
  }
});

/**
 * @route   GET /api/ai/schedule/suggestions
 * @desc    Get suggested schedules based on patterns
 * @access  Private
 */
router.get('/schedule/suggestions', async (req, res) => {
  try {
    const userId = req.user.id;
    logger.info('[AI] Request: ' + 'getSuggestedSchedule', userId, {});

    const result = await getSuggestedSchedule(userId);

    logger.info(`[AI] ✅ Schedule suggestions generated for user ${userId} (${result?.suggestions?.length || 0} suggestions)`);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('[AI] ❌ Get schedule suggestions error:', { error: error.message, userId: req.user?.id });
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to get schedule suggestions' }
    });
  }
});

/**
 * @route   POST /api/ai/schedule/activate
 * @desc    Activate a suggested schedule
 * @access  Private
 */
router.post('/schedule/activate', async (req, res) => {
  try {
    const userId = req.user.id;
    const { schedule } = req.body;
    logger.info('[AI] Request: activateSchedule', userId, { scheduleType: schedule?.type });

    const result = await activateSchedule(userId, schedule);

    logger.info(`[AI] ✅ Schedule activated for user ${userId} - Type: ${schedule?.type}`);
    res.json({ success: result.success, data: result });
  } catch (error) {
    logger.error('[AI] ❌ Activate schedule error:', { error: error.message, userId: req.user?.id });
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to activate schedule' }
    });
  }
});

/**
 * @route   PATCH /api/ai/settings/auto-pilot
 * @desc    Toggle AI auto-pilot mode
 * @access  Private
 */
router.patch('/settings/auto-pilot', async (req, res) => {
  try {
    const userId = req.user.id;
    const { enabled } = req.body;
    logger.info('[AI] Request: setAutoPilot', userId, { enabled });

    const result = await setAutoPilot(userId, enabled);

    logger.info(`[AI] ✅ Auto-pilot ${enabled ? 'enabled' : 'disabled'} for user ${userId}`);
    res.json({ success: result.success, data: result });
  } catch (error) {
    logger.error('[AI] ❌ Set auto-pilot error:', { error: error.message, userId: req.user?.id });
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to update auto-pilot' }
    });
  }
});

/**
 * @route   POST /api/ai/settings/location
 * @desc    Save home location for geofencing
 * @access  Private
 */
router.post('/settings/location', async (req, res) => {
  try {
    const userId = req.user.id;
    const { latitude, longitude, radius = 100, address } = req.body;
    logger.info('[AI] Request: saveLocation', userId, { latitude, longitude, radius });

    const { data, error } = await supabase
      .from('user_ai_settings')
      .upsert({
        user_id: userId,
        home_location: { latitude, longitude, radius, address },
        location_detection_enabled: true,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' })
      .select()
      .single();

    if (error) throw error;

    logger.info(`[AI] ✅ Home location saved for user ${userId}`);
    res.json({ success: true, data: { location: data.home_location } });
  } catch (error) {
    logger.error('[AI] ❌ Save location error:', { error: error.message, userId: req.user?.id });
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to save location' }
    });
  }
});

/**
 * @route   GET /api/ai/settings/location
 * @desc    Get saved home location
 * @access  Private
 */
router.get('/settings/location', async (req, res) => {
  try {
    const userId = req.user.id;

    const { data } = await supabase
      .from('user_ai_settings')
      .select('home_location, location_detection_enabled')
      .eq('user_id', userId)
      .single();

    res.json({
      success: true,
      data: {
        location: data?.home_location || null,
        enabled: data?.location_detection_enabled || false
      }
    });
  } catch (error) {
    logger.error('[AI] ❌ Get location error:', { error: error.message, userId: req.user?.id });
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to get location' }
    });
  }
});

/**
 * @route   GET /api/ai/settings
 * @desc    Get all user AI settings
 * @access  Private
 */
router.get('/settings', async (req, res) => {
  try {
    const userId = req.user.id;
    const settings = await getUserAISettings(userId);
    res.json({ success: true, data: settings });
  } catch (error) {
    logger.error('[AI] ❌ Get AI settings error:', { error: error.message, userId: req.user?.id });
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to get AI settings' }
    });
  }
});

// ==========================================
// AI Status
// ==========================================

/**
 * @route   GET /api/ai/status
 * @desc    Check AI features status and configuration
 * @access  Private
 */
router.get('/status', (req, res) => {
  const openaiConfigured = !!process.env.OPENAI_API_KEY;
  const userId = req.user?.id;

  logger.info(`[AI] ℹ️ Status check by user ${userId} - OpenAI configured: ${openaiConfigured}`);

  res.json({
    success: true,
    data: {
      ai_enabled: openaiConfigured,
      features: {
        natural_language_logs: openaiConfigured,
        chat_assistant: openaiConfigured,
        smart_insights: true, // Rule-based, doesn't require LLM
        risk_scores: true,
        daily_summaries: openaiConfigured,
        access_recommendations: true, // Rule-based with optional LLM
        smart_notifications: true,
        predictive_battery: true,
        fraud_detection: true,
        auto_rules: true,
        smart_scheduling: true,
        vacation_mode: true
      },
      model: openaiConfigured ? (process.env.OPENAI_MODEL || 'gpt-4o') : null,
      background_jobs: {
        battery_predictions: 'Every 6 hours',
        fraud_detection: 'Every hour',
        daily_analysis: '2 AM daily',
        notification_queue: 'Every 15 minutes',
        cleanup: '3 AM daily'
      }
    }
  });
});

// ==========================================
// Manual AI Job Triggers (Testing Only)
// ==========================================

/**
 * @route   POST /api/ai/jobs/battery-predictions
 * @desc    Manually trigger battery predictions
 * @access  Private
 * @query   lockId - Optional lock ID to run for specific lock
 */
router.post('/jobs/battery-predictions', async (req, res) => {
  try {
    const { lockId } = req.query;
    const userId = req.user?.id;

    logger.info(`[AI Jobs] Manual battery prediction triggered by user ${userId}${lockId ? ` for lock ${lockId}` : ' (all locks)'}`);

    const results = await triggerBatteryPredictions(lockId || null);

    res.json({
      success: true,
      message: 'Battery predictions completed',
      data: results
    });
  } catch (error) {
    logger.error('[AI Jobs] Battery prediction trigger failed:', error.message);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: error.message }
    });
  }
});

/**
 * @route   POST /api/ai/jobs/fraud-detection
 * @desc    Manually trigger fraud detection
 * @access  Private
 * @query   lockId - Optional lock ID to run for specific lock
 */
router.post('/jobs/fraud-detection', async (req, res) => {
  try {
    const { lockId } = req.query;
    const userId = req.user?.id;

    logger.info(`[AI Jobs] Manual fraud detection triggered by user ${userId}${lockId ? ` for lock ${lockId}` : ' (all locks)'}`);

    const results = await triggerFraudDetection(lockId || null);

    res.json({
      success: true,
      message: 'Fraud detection completed',
      data: results
    });
  } catch (error) {
    logger.error('[AI Jobs] Fraud detection trigger failed:', error.message);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: error.message }
    });
  }
});

/**
 * @route   POST /api/ai/jobs/daily-analysis
 * @desc    Manually trigger daily analysis (risk scores + recommendations + rules)
 * @access  Private
 */
router.post('/jobs/daily-analysis', async (req, res) => {
  try {
    const userId = req.user?.id;

    logger.info(`[AI Jobs] Manual daily analysis triggered by user ${userId}`);

    const results = await triggerDailyAnalysis(userId);

    res.json({
      success: true,
      message: 'Daily analysis completed',
      data: results
    });
  } catch (error) {
    logger.error('[AI Jobs] Daily analysis trigger failed:', error.message);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: error.message }
    });
  }
});

export default router;
