/**
 * AI Services Index
 *
 * Central export for all AI-related services
 */

export { default as eventLogger } from './eventLogger.js';
export { default as llmService } from './llmService.js';
export { default as anomalyDetector } from './anomalyDetector.js';
export { default as riskScorer } from './riskScorer.js';
export { default as smartNotifications } from './smartNotifications.js';
export { default as accessRecommendations } from './accessRecommendations.js';
export { default as batteryPredictor } from './batteryPredictor.js';
export { default as fraudDetector } from './fraudDetector.js';
export { default as autoRulesEngine } from './autoRulesEngine.js';
export { default as smartScheduling } from './smartScheduling.js';

// Re-export specific functions for convenience
export {
  logEvent,
  logUserEvent,
  logSettingChange,
  logBatteryLevel,
  logFailedAttempt,
  logAccessMethodEvent,
  logModeChange,
  EventAction,
  AccessMethod
} from './eventLogger.js';

export {
  isConfigured as isLLMConfigured,
  summarizeEvent,
  generateDailySummary,
  answerQuestion,
  batchSummarizeEvents
} from './llmService.js';

export {
  sendSmartNotification,
  sendDailyDigest,
  processBatchedNotifications,
  NotificationPriority
} from './smartNotifications.js';
