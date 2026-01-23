import winston from 'winston';

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Define console format for development with colors
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0 && Object.keys(meta).some(k => meta[k] !== undefined)) {
      msg += ` ${JSON.stringify(meta)}`;
    }
    return msg;
  })
);

// Create logger instance
const baseLogger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  transports: [
    // Console transport for development
    new winston.transports.Console({
      format: consoleFormat
    })
  ],
  exitOnError: false
});

// Add file transport in production
if (process.env.NODE_ENV === 'production') {
  baseLogger.add(
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  );

  baseLogger.add(
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  );
}

// Create a stream object for Morgan HTTP logger
baseLogger.stream = {
  write: (message) => {
    baseLogger.info(message.trim());
  }
};

/**
 * Extended Logger with detailed feature-specific logging
 * All logs are color-coded and structured for easy debugging
 */
const logger = {
  // Base winston methods
  info: (message, meta) => baseLogger.info(message, meta),
  warn: (message, meta) => baseLogger.warn(message, meta),
  error: (message, meta) => baseLogger.error(message, meta),
  debug: (message, meta) => baseLogger.debug(message, meta),
  stream: baseLogger.stream,

  // ==========================================
  // Authentication Logging
  // ==========================================
  auth: {
    login: (email, success, details = null) => {
      if (success) {
        baseLogger.info(`[AUTH] ✅ LOGIN SUCCESS - User: ${email}`, { category: 'auth', action: 'login', email, success: true, ...details });
      } else {
        baseLogger.warn(`[AUTH] ❌ LOGIN FAILED - User: ${email}`, { category: 'auth', action: 'login', email, success: false, ...details });
      }
    },
    register: (email, success, details = null) => {
      if (success) {
        baseLogger.info(`[AUTH] ✅ REGISTER SUCCESS - User: ${email}`, { category: 'auth', action: 'register', email, success: true, ...details });
      } else {
        baseLogger.warn(`[AUTH] ❌ REGISTER FAILED - User: ${email}`, { category: 'auth', action: 'register', email, success: false, ...details });
      }
    },
    profileComplete: (userId, success, details = null) => {
      if (success) {
        baseLogger.info(`[AUTH] ✅ PROFILE COMPLETED - UserID: ${userId}`, { category: 'auth', action: 'profile_complete', userId, success: true, ...details });
      } else {
        baseLogger.warn(`[AUTH] ❌ PROFILE COMPLETION FAILED - UserID: ${userId}`, { category: 'auth', action: 'profile_complete', userId, success: false, ...details });
      }
    },
    tokenRefresh: (userId, success, details = null) => {
      if (success) {
        baseLogger.info(`[AUTH] 🔄 TOKEN REFRESHED - UserID: ${userId}`, { category: 'auth', action: 'token_refresh', userId, success: true, ...details });
      } else {
        baseLogger.warn(`[AUTH] ❌ TOKEN REFRESH FAILED - UserID: ${userId}`, { category: 'auth', action: 'token_refresh', userId, success: false, ...details });
      }
    },
    logout: (userId) => {
      baseLogger.info(`[AUTH] 🚪 LOGOUT - UserID: ${userId}`, { category: 'auth', action: 'logout', userId });
    },
    middleware: (userId, endpoint, authorized) => {
      if (authorized) {
        baseLogger.debug(`[AUTH-MW] ✓ Authorized: User ${userId} -> ${endpoint}`, { category: 'auth_middleware', userId, endpoint, authorized: true });
      } else {
        baseLogger.warn(`[AUTH-MW] ✗ Unauthorized request -> ${endpoint}`, { category: 'auth_middleware', endpoint, authorized: false });
      }
    }
  },

  // ==========================================
  // Lock Operations Logging
  // ==========================================
  lock: {
    control: (lockId, action, method, success, details = null) => {
      const actionEmoji = action === 'unlock' ? '🔓' : '🔒';
      if (success) {
        baseLogger.info(`[LOCK] ${actionEmoji} ${action.toUpperCase()} SUCCESS - LockID: ${lockId}, Method: ${method}`, { category: 'lock', action, lockId, method, success: true, ...details });
      } else {
        baseLogger.warn(`[LOCK] ${actionEmoji} ${action.toUpperCase()} FAILED - LockID: ${lockId}, Method: ${method}`, { category: 'lock', action, lockId, method, success: false, ...details });
      }
    },
    add: (lockId, lockName, userId, success, details = null) => {
      if (success) {
        baseLogger.info(`[LOCK] ➕ LOCK ADDED - ID: ${lockId}, Name: "${lockName}", Owner: ${userId}`, { category: 'lock', action: 'add', lockId, lockName, userId, success: true, ...details });
      } else {
        baseLogger.warn(`[LOCK] ➕ LOCK ADD FAILED - Name: "${lockName}", Owner: ${userId}`, { category: 'lock', action: 'add', lockName, userId, success: false, ...details });
      }
    },
    delete: (lockId, userId, success, details = null) => {
      if (success) {
        baseLogger.info(`[LOCK] 🗑️ LOCK DELETED - ID: ${lockId}, By: ${userId}`, { category: 'lock', action: 'delete', lockId, userId, success: true, ...details });
      } else {
        baseLogger.warn(`[LOCK] 🗑️ LOCK DELETE FAILED - ID: ${lockId}, By: ${userId}`, { category: 'lock', action: 'delete', lockId, userId, success: false, ...details });
      }
    },
    get: (lockId, userId, success) => {
      if (success) {
        baseLogger.debug(`[LOCK] 📖 LOCK FETCHED - ID: ${lockId}, By: ${userId}`, { category: 'lock', action: 'get', lockId, userId, success: true });
      } else {
        baseLogger.warn(`[LOCK] 📖 LOCK FETCH FAILED - ID: ${lockId}, By: ${userId}`, { category: 'lock', action: 'get', lockId, userId, success: false });
      }
    },
    list: (userId, count) => {
      baseLogger.info(`[LOCK] 📋 LOCKS LISTED - User: ${userId}, Count: ${count}`, { category: 'lock', action: 'list', userId, count });
    },
    sync: (userId, imported, skipped) => {
      baseLogger.info(`[LOCK] 🔄 SYNC COMPLETE - User: ${userId}, Imported: ${imported}, Skipped: ${skipped}`, { category: 'lock', action: 'sync', userId, imported, skipped });
    },
    settings: (lockId, setting, value, success) => {
      if (success) {
        baseLogger.info(`[LOCK] ⚙️ SETTING UPDATED - LockID: ${lockId}, ${setting}: ${JSON.stringify(value)}`, { category: 'lock', action: 'settings', lockId, setting, value, success: true });
      } else {
        baseLogger.warn(`[LOCK] ⚙️ SETTING UPDATE FAILED - LockID: ${lockId}, ${setting}`, { category: 'lock', action: 'settings', lockId, setting, success: false });
      }
    }
  },

  // ==========================================
  // AI Features Logging
  // ==========================================
  ai: {
    chat: (userId, lockId, messagePreview, success, details = null) => {
      const preview = messagePreview?.length > 50 ? messagePreview.substring(0, 50) + '...' : messagePreview;
      if (success) {
        baseLogger.info(`[AI-CHAT] 💬 MESSAGE PROCESSED - User: ${userId}, Lock: ${lockId}, Msg: "${preview}"`, { category: 'ai_chat', userId, lockId, success: true, ...details });
      } else {
        baseLogger.warn(`[AI-CHAT] 💬 MESSAGE FAILED - User: ${userId}, Lock: ${lockId}`, { category: 'ai_chat', userId, lockId, success: false, ...details });
      }
    },
    chatConversation: (userId, conversationId, action) => {
      baseLogger.info(`[AI-CHAT] 💬 CONVERSATION ${action.toUpperCase()} - User: ${userId}, ConvID: ${conversationId}`, { category: 'ai_chat', userId, conversationId, action });
    },
    insights: (lockId, insightCount, types = null) => {
      baseLogger.info(`[AI-INSIGHTS] 💡 INSIGHTS GENERATED - LockID: ${lockId}, Count: ${insightCount}`, { category: 'ai_insights', lockId, count: insightCount, types });
    },
    insightAction: (insightId, action, userId) => {
      baseLogger.info(`[AI-INSIGHTS] 💡 INSIGHT ${action.toUpperCase()} - InsightID: ${insightId}, By: ${userId}`, { category: 'ai_insights', insightId, action, userId });
    },
    riskScore: (lockId, score, factors = null) => {
      const level = score >= 80 ? 'GOOD' : score >= 50 ? 'MODERATE' : 'HIGH_RISK';
      baseLogger.info(`[AI-RISK] 🛡️ RISK SCORE: ${score} (${level}) - LockID: ${lockId}`, { category: 'ai_risk', lockId, score, level, factors });
    },
    naturalLanguage: (lockId, activityCount, success) => {
      if (success) {
        baseLogger.info(`[AI-NLP] 📝 NL ACTIVITY GENERATED - LockID: ${lockId}, Activities: ${activityCount}`, { category: 'ai_nlp', lockId, activityCount, success: true });
      } else {
        baseLogger.warn(`[AI-NLP] 📝 NL ACTIVITY FAILED - LockID: ${lockId}`, { category: 'ai_nlp', lockId, success: false });
      }
    },
    dailySummary: (lockId, date, success) => {
      if (success) {
        baseLogger.info(`[AI-SUMMARY] 📊 DAILY SUMMARY GENERATED - LockID: ${lockId}, Date: ${date}`, { category: 'ai_summary', lockId, date, success: true });
      } else {
        baseLogger.warn(`[AI-SUMMARY] 📊 DAILY SUMMARY FAILED - LockID: ${lockId}, Date: ${date}`, { category: 'ai_summary', lockId, date, success: false });
      }
    },
    batteryPrediction: (lockId, prediction) => {
      baseLogger.info(`[AI-BATTERY] 🔋 BATTERY PREDICTION - LockID: ${lockId}, Current: ${prediction.currentLevel}%, Days: ${prediction.daysRemaining}, Health: ${prediction.health}`, { category: 'ai_battery', lockId, ...prediction });
    },
    batteryHistory: (lockId, days, recordCount) => {
      baseLogger.info(`[AI-BATTERY] 🔋 BATTERY HISTORY - LockID: ${lockId}, Days: ${days}, Records: ${recordCount}`, { category: 'ai_battery', lockId, days, recordCount });
    },
    fraudAlert: (lockId, alertType, severity, details = null) => {
      const logLevel = severity === 'critical' || severity === 'high' ? 'warn' : 'info';
      baseLogger[logLevel](`[AI-FRAUD] 🚨 FRAUD ALERT: ${alertType} - LockID: ${lockId}, Severity: ${severity}`, { category: 'ai_fraud', lockId, alertType, severity, ...details });
    },
    fraudSummary: (lockId, alertCount) => {
      baseLogger.info(`[AI-FRAUD] 🚨 FRAUD SUMMARY - LockID: ${lockId}, Alerts: ${alertCount}`, { category: 'ai_fraud', lockId, alertCount });
    },
    ruleSuggestion: (lockId, suggestionCount, types = null) => {
      baseLogger.info(`[AI-RULES] 📋 RULES SUGGESTED - LockID: ${lockId}, Count: ${suggestionCount}`, { category: 'ai_rules', lockId, suggestionCount, types });
    },
    ruleCreated: (lockId, ruleId, ruleType, userId) => {
      baseLogger.info(`[AI-RULES] ✅ RULE CREATED - LockID: ${lockId}, RuleID: ${ruleId}, Type: ${ruleType}, By: ${userId}`, { category: 'ai_rules', lockId, ruleId, ruleType, userId, action: 'create' });
    },
    ruleToggled: (ruleId, isActive, userId) => {
      baseLogger.info(`[AI-RULES] 🔄 RULE ${isActive ? 'ENABLED' : 'DISABLED'} - RuleID: ${ruleId}, By: ${userId}`, { category: 'ai_rules', ruleId, isActive, userId, action: 'toggle' });
    },
    ruleDeleted: (ruleId, userId) => {
      baseLogger.info(`[AI-RULES] 🗑️ RULE DELETED - RuleID: ${ruleId}, By: ${userId}`, { category: 'ai_rules', ruleId, userId, action: 'delete' });
    },
    rulesList: (lockId, ruleCount) => {
      baseLogger.info(`[AI-RULES] 📋 RULES LISTED - LockID: ${lockId}, Count: ${ruleCount}`, { category: 'ai_rules', lockId, ruleCount, action: 'list' });
    },
    homeMode: (userId, mode, success, details = null) => {
      if (success) {
        baseLogger.info(`[AI-MODE] 🏠 MODE CHANGED - User: ${userId}, Mode: ${mode}`, { category: 'ai_mode', userId, mode, success: true, ...details });
      } else {
        baseLogger.warn(`[AI-MODE] 🏠 MODE CHANGE FAILED - User: ${userId}, Mode: ${mode}`, { category: 'ai_mode', userId, mode, success: false, ...details });
      }
    },
    homeModeGet: (userId, mode) => {
      baseLogger.info(`[AI-MODE] 🏠 MODE RETRIEVED - User: ${userId}, Current: ${mode}`, { category: 'ai_mode', userId, mode, action: 'get' });
    },
    vacationMode: (userId, enabled, options = null) => {
      if (enabled) {
        baseLogger.info(`[AI-VACATION] ✈️ VACATION MODE ENABLED - User: ${userId}`, { category: 'ai_vacation', userId, enabled: true, ...options });
      } else {
        baseLogger.info(`[AI-VACATION] ✈️ VACATION MODE DISABLED - User: ${userId}`, { category: 'ai_vacation', userId, enabled: false });
      }
    },
    accessRecommendation: (lockId, recommendationCount) => {
      baseLogger.info(`[AI-ACCESS] 👤 ACCESS RECOMMENDATIONS - LockID: ${lockId}, Count: ${recommendationCount}`, { category: 'ai_access', lockId, recommendationCount });
    },
    accessSuggestion: (lockId, userId, suggestion) => {
      baseLogger.info(`[AI-ACCESS] 👤 ACCESS SUGGESTION - LockID: ${lockId}, UserID: ${userId}, Suggestion: ${suggestion}`, { category: 'ai_access', lockId, userId, suggestion });
    },
    recommendationAction: (lockId, userId, action, recommendation) => {
      baseLogger.info(`[AI-ACCESS] 👤 RECOMMENDATION ${action.toUpperCase()} - LockID: ${lockId}, UserID: ${userId}`, { category: 'ai_access', lockId, userId, action, recommendation });
    },
    scheduleSuggestions: (userId, suggestionCount) => {
      baseLogger.info(`[AI-SCHEDULE] 📅 SCHEDULE SUGGESTIONS - User: ${userId}, Count: ${suggestionCount}`, { category: 'ai_schedule', userId, suggestionCount });
    },
    status: (aiEnabled, features) => {
      baseLogger.info(`[AI-STATUS] 🤖 AI STATUS CHECK - Enabled: ${aiEnabled}`, { category: 'ai_status', aiEnabled, features });
    }
  },

  // ==========================================
  // Security Logging
  // ==========================================
  security: {
    dashboard: (userId, success) => {
      if (success) {
        baseLogger.info(`[SECURITY] 📊 DASHBOARD ACCESSED - User: ${userId}`, { category: 'security', userId, action: 'dashboard', success: true });
      } else {
        baseLogger.warn(`[SECURITY] 📊 DASHBOARD FAILED - User: ${userId}`, { category: 'security', userId, action: 'dashboard', success: false });
      }
    },
    alertAcknowledged: (alertId, userId, success) => {
      if (success) {
        baseLogger.info(`[SECURITY] ✓ ALERT ACKNOWLEDGED - AlertID: ${alertId}, By: ${userId}`, { category: 'security', alertId, userId, action: 'acknowledge', success: true });
      } else {
        baseLogger.warn(`[SECURITY] ✗ ALERT ACKNOWLEDGE FAILED - AlertID: ${alertId}, By: ${userId}`, { category: 'security', alertId, userId, action: 'acknowledge', success: false });
      }
    },
    failedAttempt: (lockId, method, details = null) => {
      baseLogger.warn(`[SECURITY] ⚠️ FAILED ACCESS ATTEMPT - LockID: ${lockId}, Method: ${method}`, { category: 'security', lockId, method, action: 'failed_attempt', ...details });
    },
    failedAttemptsList: (lockId, count) => {
      baseLogger.info(`[SECURITY] ⚠️ FAILED ATTEMPTS LISTED - LockID: ${lockId}, Count: ${count}`, { category: 'security', lockId, count, action: 'list_failed' });
    }
  },

  // ==========================================
  // Access Codes and Invites Logging
  // ==========================================
  access: {
    codeCreated: (lockId, codeType, userId, codeId = null) => {
      baseLogger.info(`[ACCESS] 🔑 CODE CREATED - LockID: ${lockId}, Type: ${codeType}, By: ${userId}`, { category: 'access_code', lockId, codeType, userId, codeId, action: 'create' });
    },
    codeUsed: (lockId, codeId, success) => {
      if (success) {
        baseLogger.info(`[ACCESS] 🔑 CODE USED - LockID: ${lockId}, CodeID: ${codeId}`, { category: 'access_code', lockId, codeId, action: 'use', success: true });
      } else {
        baseLogger.warn(`[ACCESS] 🔑 CODE USE FAILED - LockID: ${lockId}, CodeID: ${codeId}`, { category: 'access_code', lockId, codeId, action: 'use', success: false });
      }
    },
    codeDeleted: (lockId, codeId, userId) => {
      baseLogger.info(`[ACCESS] 🔑 CODE DELETED - LockID: ${lockId}, CodeID: ${codeId}, By: ${userId}`, { category: 'access_code', lockId, codeId, userId, action: 'delete' });
    },
    codesList: (lockId, count) => {
      baseLogger.info(`[ACCESS] 🔑 CODES LISTED - LockID: ${lockId}, Count: ${count}`, { category: 'access_code', lockId, count, action: 'list' });
    },
    inviteCreated: (lockId, inviteCode, userId) => {
      baseLogger.info(`[ACCESS] 📨 INVITE CREATED - LockID: ${lockId}, Code: ${inviteCode}, By: ${userId}`, { category: 'invite', lockId, inviteCode, userId, action: 'create' });
    },
    inviteAccepted: (inviteCode, userId, lockId) => {
      baseLogger.info(`[ACCESS] 📨 INVITE ACCEPTED - Code: ${inviteCode}, By: ${userId}, Lock: ${lockId}`, { category: 'invite', inviteCode, userId, lockId, action: 'accept' });
    },
    inviteRevoked: (inviteId, userId) => {
      baseLogger.info(`[ACCESS] 📨 INVITE REVOKED - InviteID: ${inviteId}, By: ${userId}`, { category: 'invite', inviteId, userId, action: 'revoke' });
    },
    invitesList: (lockId, count) => {
      baseLogger.info(`[ACCESS] 📨 INVITES LISTED - LockID: ${lockId}, Count: ${count}`, { category: 'invite', lockId, count, action: 'list' });
    },
    otpGenerated: (lockId, userId) => {
      baseLogger.info(`[ACCESS] 🔢 OTP GENERATED - LockID: ${lockId}, By: ${userId}`, { category: 'otp', lockId, userId, action: 'generate' });
    },
    otpVerified: (lockId, success) => {
      if (success) {
        baseLogger.info(`[ACCESS] 🔢 OTP VERIFIED - LockID: ${lockId}`, { category: 'otp', lockId, action: 'verify', success: true });
      } else {
        baseLogger.warn(`[ACCESS] 🔢 OTP VERIFICATION FAILED - LockID: ${lockId}`, { category: 'otp', lockId, action: 'verify', success: false });
      }
    },
    guestHistory: (lockId, count) => {
      baseLogger.info(`[ACCESS] 👤 GUEST HISTORY - LockID: ${lockId}, Count: ${count}`, { category: 'guest', lockId, count, action: 'history' });
    }
  },

  // ==========================================
  // Notifications Logging
  // ==========================================
  notification: {
    sent: (userId, type, title) => {
      baseLogger.info(`[NOTIFY] 🔔 NOTIFICATION SENT - User: ${userId}, Type: ${type}, Title: "${title}"`, { category: 'notification', userId, type, title, action: 'send' });
    },
    push: (userId, success, details = null) => {
      if (success) {
        baseLogger.info(`[NOTIFY] 📱 PUSH SENT - User: ${userId}`, { category: 'notification', userId, action: 'push', success: true, ...details });
      } else {
        baseLogger.warn(`[NOTIFY] 📱 PUSH FAILED - User: ${userId}`, { category: 'notification', userId, action: 'push', success: false, ...details });
      }
    },
    preferencesGet: (userId) => {
      baseLogger.info(`[NOTIFY] ⚙️ PREFERENCES RETRIEVED - User: ${userId}`, { category: 'notification', userId, action: 'get_prefs' });
    },
    preferencesUpdate: (userId, success) => {
      if (success) {
        baseLogger.info(`[NOTIFY] ⚙️ PREFERENCES UPDATED - User: ${userId}`, { category: 'notification', userId, action: 'update_prefs', success: true });
      } else {
        baseLogger.warn(`[NOTIFY] ⚙️ PREFERENCES UPDATE FAILED - User: ${userId}`, { category: 'notification', userId, action: 'update_prefs', success: false });
      }
    },
    markRead: (notificationId, userId) => {
      baseLogger.info(`[NOTIFY] ✓ MARKED READ - NotificationID: ${notificationId}, By: ${userId}`, { category: 'notification', notificationId, userId, action: 'mark_read' });
    }
  },

  // ==========================================
  // TTLock Cloud API Logging
  // ==========================================
  ttlock: {
    apiCall: (endpoint, method, success, details = null) => {
      if (success) {
        baseLogger.info(`[TTLOCK-API] ☁️ ${method} ${endpoint} - SUCCESS`, { category: 'ttlock_api', endpoint, method, success: true, ...details });
      } else {
        baseLogger.warn(`[TTLOCK-API] ☁️ ${method} ${endpoint} - FAILED`, { category: 'ttlock_api', endpoint, method, success: false, ...details });
      }
    },
    tokenRefresh: (userId, success) => {
      if (success) {
        baseLogger.info(`[TTLOCK-API] 🔄 CLOUD TOKEN REFRESHED - User: ${userId}`, { category: 'ttlock_api', userId, action: 'token_refresh', success: true });
      } else {
        baseLogger.warn(`[TTLOCK-API] 🔄 CLOUD TOKEN REFRESH FAILED - User: ${userId}`, { category: 'ttlock_api', userId, action: 'token_refresh', success: false });
      }
    },
    lockControl: (lockId, action, success, method = 'cloud') => {
      if (success) {
        baseLogger.info(`[TTLOCK-API] ${action === 'unlock' ? '🔓' : '🔒'} ${action.toUpperCase()} via ${method} - LockID: ${lockId}`, { category: 'ttlock_api', lockId, action, method, success: true });
      } else {
        baseLogger.warn(`[TTLOCK-API] ${action === 'unlock' ? '🔓' : '🔒'} ${action.toUpperCase()} FAILED via ${method} - LockID: ${lockId}`, { category: 'ttlock_api', lockId, action, method, success: false });
      }
    },
    passcode: (lockId, action, success) => {
      if (success) {
        baseLogger.info(`[TTLOCK-API] 🔢 PASSCODE ${action.toUpperCase()} - LockID: ${lockId}`, { category: 'ttlock_api', lockId, action, success: true });
      } else {
        baseLogger.warn(`[TTLOCK-API] 🔢 PASSCODE ${action.toUpperCase()} FAILED - LockID: ${lockId}`, { category: 'ttlock_api', lockId, action, success: false });
      }
    },
    initialize: (lockId, success) => {
      if (success) {
        baseLogger.info(`[TTLOCK-API] 🔧 LOCK INITIALIZED - LockID: ${lockId}`, { category: 'ttlock_api', lockId, action: 'initialize', success: true });
      } else {
        baseLogger.warn(`[TTLOCK-API] 🔧 LOCK INITIALIZE FAILED - LockID: ${lockId}`, { category: 'ttlock_api', lockId, action: 'initialize', success: false });
      }
    }
  },

  // ==========================================
  // User Management Logging
  // ==========================================
  user: {
    accessMethod: (lockId, userId, action, methodType) => {
      baseLogger.info(`[USER] 👤 ACCESS METHOD ${action.toUpperCase()} - Lock: ${lockId}, User: ${userId}, Type: ${methodType}`, { category: 'user', lockId, userId, action, methodType });
    },
    list: (lockId, count) => {
      baseLogger.info(`[USER] 👥 USERS LISTED - LockID: ${lockId}, Count: ${count}`, { category: 'user', lockId, count, action: 'list' });
    },
    add: (lockId, userId, role, addedBy) => {
      baseLogger.info(`[USER] ➕ USER ADDED - Lock: ${lockId}, User: ${userId}, Role: ${role}, By: ${addedBy}`, { category: 'user', lockId, userId, role, addedBy, action: 'add' });
    },
    remove: (lockId, userId, removedBy) => {
      baseLogger.info(`[USER] ➖ USER REMOVED - Lock: ${lockId}, User: ${userId}, By: ${removedBy}`, { category: 'user', lockId, userId, removedBy, action: 'remove' });
    },
    update: (lockId, userId, changes, updatedBy) => {
      baseLogger.info(`[USER] ✏️ USER UPDATED - Lock: ${lockId}, User: ${userId}, By: ${updatedBy}`, { category: 'user', lockId, userId, updatedBy, changes, action: 'update' });
    },
    transfer: (lockId, fromUserId, toUserId) => {
      baseLogger.info(`[USER] 🔄 OWNERSHIP TRANSFERRED - Lock: ${lockId}, From: ${fromUserId}, To: ${toUserId}`, { category: 'user', lockId, fromUserId, toUserId, action: 'transfer' });
    }
  },

  // ==========================================
  // Activity Logging
  // ==========================================
  activity: {
    list: (lockId, count, filters = null) => {
      baseLogger.info(`[ACTIVITY] 📜 ACTIVITY LISTED - LockID: ${lockId}, Count: ${count}`, { category: 'activity', lockId, count, filters, action: 'list' });
    },
    stats: (lockId) => {
      baseLogger.info(`[ACTIVITY] 📊 ACTIVITY STATS - LockID: ${lockId}`, { category: 'activity', lockId, action: 'stats' });
    },
    export: (lockId, format, userId) => {
      baseLogger.info(`[ACTIVITY] 📤 ACTIVITY EXPORTED - LockID: ${lockId}, Format: ${format}, By: ${userId}`, { category: 'activity', lockId, format, userId, action: 'export' });
    },
    recent: (userId, count) => {
      baseLogger.info(`[ACTIVITY] 📜 RECENT ACTIVITY - User: ${userId}, Count: ${count}`, { category: 'activity', userId, count, action: 'recent' });
    }
  },

  // ==========================================
  // Emergency Logging
  // ==========================================
  emergency: {
    unlock: (lockId, userId, reason) => {
      baseLogger.warn(`[EMERGENCY] 🚨 EMERGENCY UNLOCK - LockID: ${lockId}, By: ${userId}, Reason: ${reason}`, { category: 'emergency', lockId, userId, reason, action: 'unlock' });
    },
    alert: (lockId, userId, alertType) => {
      baseLogger.warn(`[EMERGENCY] 🚨 EMERGENCY ALERT - LockID: ${lockId}, By: ${userId}, Type: ${alertType}`, { category: 'emergency', lockId, userId, alertType, action: 'alert' });
    }
  },

  // ==========================================
  // Request/Response Logging (Middleware)
  // ==========================================
  request: (method, path, userId = null, body = null) => {
    const userStr = userId ? `, User: ${userId}` : '';
    const bodyPreview = body && Object.keys(body).length > 0 ? `, Body: ${JSON.stringify(body).substring(0, 100)}` : '';
    baseLogger.debug(`[REQ] ${method} ${path}${userStr}${bodyPreview}`, { category: 'request', method, path, userId });
  },
  response: (method, path, statusCode, duration = null) => {
    const durationStr = duration ? ` (${duration}ms)` : '';
    const logLevel = statusCode < 400 ? 'debug' : 'warn';
    baseLogger[logLevel](`[RES] ${method} ${path} ${statusCode}${durationStr}`, { category: 'response', method, path, statusCode, duration });
  }
};

export default logger;
