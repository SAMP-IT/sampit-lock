import Joi from 'joi';

// ============================================================
// Reusable field definitions
// ============================================================
const uuid = Joi.string().uuid();
const uuidRequired = Joi.string().uuid().required();
const paginationLimit = Joi.number().integer().min(1).max(200).default(20);
const paginationOffset = Joi.number().integer().min(0).default(0);
const pageNo = Joi.number().integer().min(1).default(1);

// ============================================================
// Validation middleware factories
// ============================================================

/**
 * Validate req.body
 */
export const validate = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      // Log validation errors for debugging (never log raw body - may contain passwords/tokens)
      console.error('❌ Validation Error:', {
        path: req.path,
        method: req.method,
        fields: Object.keys(req.body || {}),
        errors: errors
      });

      const errorMessages = errors.map(e => `${e.field}: ${e.message}`).join(', ');

      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Invalid request data: ${errorMessages}`,
          details: errors
        }
      });
    }

    req.body = value;
    next();
  };
};

/**
 * Validate req.params
 */
export const validateParams = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.params, {
      abortEarly: false,
      allowUnknown: false
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Invalid URL parameters: ${errors.map(e => `${e.field}: ${e.message}`).join(', ')}`,
          details: errors
        }
      });
    }

    req.params = value;
    next();
  };
};

/**
 * Validate req.query
 */
export const validateQuery = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.query, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Invalid query parameters: ${errors.map(e => `${e.field}: ${e.message}`).join(', ')}`,
          details: errors
        }
      });
    }

    req.query = value;
    next();
  };
};

// ============================================================
// Common param schemas
// ============================================================
export const params = {
  lockId: Joi.object({ lockId: uuidRequired }),
  lockIdAndUserId: Joi.object({ lockId: uuidRequired, userId: uuidRequired }),
  userId: Joi.object({ userId: uuidRequired }),
  inviteId: Joi.object({ inviteId: uuidRequired }),
  inviteCode: Joi.object({ inviteCode: Joi.string().max(100).required() }),
  accessId: Joi.object({ accessId: uuidRequired }),
  codeId: Joi.object({ lockId: uuidRequired, codeId: uuidRequired }),
  notificationId: Joi.object({ notificationId: uuidRequired }),
  contactId: Joi.object({ contactId: uuidRequired }),
  alertId: Joi.object({ alertId: uuidRequired }),
  fingerprintId: Joi.object({ lockId: uuidRequired, fingerprintId: uuidRequired }),
  cardId: Joi.object({ lockId: uuidRequired, cardId: uuidRequired }),
  passcodeId: Joi.object({ lockId: uuidRequired, passcodeId: uuidRequired }),
  keyId: Joi.object({ keyId: uuidRequired }),
  ruleId: Joi.object({ ruleId: uuidRequired }),
  insightId: Joi.object({ insightId: uuidRequired }),
  conversationId: Joi.object({ conversationId: uuidRequired }),
  lockIdAndMethodId: Joi.object({ lockId: uuidRequired, userId: uuidRequired, methodId: uuidRequired }),
  functionSlug: Joi.object({ functionSlug: Joi.string().max(100).required() }),
};

// ============================================================
// Common query schemas
// ============================================================
export const queries = {
  pagination: Joi.object({
    limit: paginationLimit,
    offset: paginationOffset,
    page: pageNo,
    pageSize: Joi.number().integer().min(1).max(200).optional()
  }),

  lockList: Joi.object({
    role: Joi.string().max(30).optional()
  }),

  activityList: Joi.object({
    lock_id: uuid.optional(),
    action: Joi.string().max(50).optional(),
    access_method: Joi.string().max(50).optional(),
    start_date: Joi.date().iso().optional(),
    end_date: Joi.date().iso().optional(),
    limit: paginationLimit,
    offset: paginationOffset
  }),

  userActivity: Joi.object({
    limit: paginationLimit,
    offset: paginationOffset
  }),

  securityDashboard: Joi.object({
    lockId: uuidRequired
  }),

  aiInsights: Joi.object({
    type: Joi.string().max(50).optional(),
    severity: Joi.string().max(20).optional(),
    limit: paginationLimit,
    include_dismissed: Joi.boolean().optional()
  }),

  aiBatteryHistory: Joi.object({
    days: Joi.number().integer().min(1).max(365).default(30)
  }),

  aiSecurityAlerts: Joi.object({
    days: Joi.number().integer().min(1).max(365).default(7)
  }),

  aiConversations: Joi.object({
    lockId: uuid.optional()
  }),

  dailySummary: Joi.object({
    date: Joi.date().iso().optional()
  }),

  notifications: Joi.object({
    limit: paginationLimit,
    offset: paginationOffset,
    unread_only: Joi.boolean().optional()
  })
};

// ============================================================
// Body schemas
// ============================================================
export const schemas = {
  // ---- Authentication ----
  ttlockRegister: Joi.object({
    email: Joi.string().email().max(254).required().messages({
      'string.email': 'Please enter a valid email address',
      'any.required': 'Email is required'
    }),
    phone: Joi.string().min(6).max(20).required().messages({
      'string.min': 'Phone number must be at least 6 digits',
      'string.max': 'Phone number must be 20 digits or less',
      'any.required': 'Phone number is required'
    }),
    password: Joi.string().min(6).max(32).required().messages({
      'string.min': 'Password must be at least 6 characters',
      'string.max': 'Password must be 32 characters or less',
      'any.required': 'Password is required'
    })
  }),

  ttlockLogin: Joi.object({
    username: Joi.string().min(6).max(50).required().messages({
      'string.min': 'Username must be at least 6 characters',
      'any.required': 'Username or phone number is required'
    }),
    password: Joi.string().max(128).required().messages({
      'any.required': 'Password is required'
    })
  }),

  completeProfile: Joi.object({
    first_name: Joi.string().min(1).max(100).required().messages({
      'string.min': 'First name is required',
      'any.required': 'First name is required'
    }),
    last_name: Joi.string().min(1).max(100).required().messages({
      'string.min': 'Last name is required',
      'any.required': 'Last name is required'
    }),
    phone: Joi.string().max(20).optional().allow('', null)
  }),

  signup: Joi.object({
    email: Joi.string().email().max(254).required(),
    password: Joi.string().min(8).max(128).required(),
    first_name: Joi.string().min(1).max(100).required(),
    last_name: Joi.string().min(1).max(100).required(),
    phone: Joi.string().max(20).optional().allow('', null)
    // role intentionally omitted - server always assigns 'owner' on signup
  }),

  login: Joi.object({
    email: Joi.string().email().max(254).required(),
    password: Joi.string().max(128).required()
  }),

  forgotPassword: Joi.object({
    email: Joi.string().email().max(254).required()
  }),

  resetPassword: Joi.object({
    reset_token: Joi.string().max(2048).required(),
    new_password: Joi.string().min(8).max(128).required()
  }),

  verifyEmail: Joi.object({
    verification_token: Joi.string().max(2048).required()
  }),

  refreshToken: Joi.object({
    refresh_token: Joi.string().max(2048).required()
  }),

  updateProfile: Joi.object({
    first_name: Joi.string().min(1).max(100).optional(),
    last_name: Joi.string().min(1).max(100).optional(),
    phone: Joi.alternatives().try(
      Joi.string().min(6).max(20),
      Joi.string().allow(''),
      Joi.valid(null)
    ).optional(),
    simple_mode: Joi.boolean().optional(),
    avatar_url: Joi.string().uri().max(2048).optional()
  }),

  // ---- Locks ----
  addLock: Joi.object({
    name: Joi.string().min(1).max(100).optional().allow('', null),
    location: Joi.string().max(200).optional().allow('', null),
    device_id: Joi.string().max(200).optional().allow('', null),
    mac_address: Joi.string().max(50).optional().allow('', null),
    ttlock_mac: Joi.string().max(50).optional().allow('', null),
    ttlock_data: Joi.string().max(10000).optional().allow('', null),
    ttlock_lock_name: Joi.string().max(200).optional().allow('', null),
    ttlock_lock_id: Joi.alternatives().try(
      Joi.string().max(50),
      Joi.number()
    ).optional().allow(null),
    is_bluetooth_paired: Joi.boolean().optional(),
    battery_level: Joi.number().min(0).max(100).optional().allow(null),
    is_locked: Joi.boolean().optional(),
    admin_pwd: Joi.string().max(200).optional().allow('', null),
    delete_pwd: Joi.string().max(200).optional().allow('', null),
    no_key_pwd: Joi.string().max(200).optional().allow('', null)
  }),

  updateLock: Joi.object({
    name: Joi.string().min(1).max(100).optional(),
    location: Joi.string().max(200).optional().allow('', null),
    recovery_key: Joi.string().max(100).optional().allow(null)
  }),

  lockAction: Joi.object({
    access_method: Joi.string().valid('remote', 'auto').optional(),
    location: Joi.object({
      lat: Joi.number().min(-90).max(90).optional(),
      lon: Joi.number().min(-180).max(180).optional()
    }).optional()
  }),

  pairLock: Joi.object({
    mac_address: Joi.string().max(50).optional(),
    ttlock_data: Joi.string().max(10000).optional(),
    ttlock_mac: Joi.string().max(50).optional()
  }),

  logActivity: Joi.object({
    action: Joi.string().max(50).required(),
    access_method: Joi.string().max(50).optional(),
    metadata: Joi.object().max(20).optional().allow(null).default({})
  }),

  // ---- User Management ----
  addUser: Joi.object({
    email: Joi.string().email().max(254).required(),
    first_name: Joi.string().min(1).max(100).required(),
    last_name: Joi.string().min(1).max(100).required(),
    role: Joi.string().valid('admin', 'family', 'guest').required(),
    permissions: Joi.object({
      can_unlock: Joi.boolean().default(true),
      can_lock: Joi.boolean().default(true),
      can_view_logs: Joi.boolean().default(true),
      can_manage_users: Joi.boolean().default(false),
      can_modify_settings: Joi.boolean().default(false),
      remote_unlock_enabled: Joi.boolean().default(true)
    }).optional(),
    access_methods: Joi.array().items(
      Joi.string().valid('phone', 'pin', 'fingerprint', 'card')
    ).max(10).optional(),
    time_restrictions: Joi.object({
      enabled: Joi.boolean().default(false),
      start_time: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
      end_time: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
      days_of_week: Joi.array().items(Joi.number().min(0).max(6)).max(7).optional()
    }).optional()
  }),

  updateUserPermissions: Joi.object({
    role: Joi.string().valid('admin', 'family', 'guest', 'scheduled', 'guest_otp', 'guest_longterm').optional(),
    can_unlock: Joi.boolean().optional(),
    can_lock: Joi.boolean().optional(),
    can_view_logs: Joi.boolean().optional(),
    can_manage_users: Joi.boolean().optional(),
    can_modify_settings: Joi.boolean().optional(),
    remote_unlock_enabled: Joi.boolean().optional(),
    time_restricted: Joi.boolean().optional(),
    time_restriction_start: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional().allow(null),
    time_restriction_end: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional().allow(null),
    days_of_week: Joi.array().items(Joi.number().min(0).max(6)).max(7).optional().allow(null),
    access_valid_from: Joi.date().iso().optional().allow(null),
    access_valid_until: Joi.date().iso().optional().allow(null)
  }),

  transferOwnership: Joi.object({
    new_owner_email: Joi.string().email().max(254).optional(),
    new_owner_id: Joi.string().uuid().optional()
  }).or('new_owner_email', 'new_owner_id'),

  // ---- Guest Access ----
  createInvite: Joi.object({
    lock_id: Joi.string().uuid().required(),
    email: Joi.string().email().max(254).required(),
    role: Joi.string().valid('family', 'guest').required(),
    permissions: Joi.object({
      can_unlock: Joi.boolean().optional(),
      can_lock: Joi.boolean().optional(),
      can_view_logs: Joi.boolean().optional(),
      can_manage_users: Joi.boolean().optional(),
      can_modify_settings: Joi.boolean().optional(),
      remote_unlock_enabled: Joi.boolean().optional()
    }).required(),
    valid_days: Joi.number().min(1).max(365).default(7)
  }),

  generateOTP: Joi.object({
    guest_name: Joi.string().min(1).max(100).required(),
    access_start: Joi.date().iso().optional(),
    access_end: Joi.date().iso().optional(),
    expires_at: Joi.date().iso().optional(),
    valid_duration: Joi.number().min(60).max(86400 * 30).optional(),
    max_uses: Joi.number().min(1).max(1000).default(1)
  }),

  verifyOTP: Joi.object({
    otp_code: Joi.string().max(20).required(),
    guest_name: Joi.string().max(100).optional()
  }),

  // ---- Access Codes ----
  createAccessCode: Joi.object({
    name: Joi.string().max(100).optional(),
    code_type: Joi.string().valid('permanent', 'temporary', 'one_time').required(),
    code: Joi.string().pattern(/^[0-9]{4,8}$/).required(),
    valid_from: Joi.date().iso().optional(),
    valid_until: Joi.date().iso().optional(),
    max_usage_count: Joi.number().min(1).max(100000).optional()
  }),

  updateAccessCode: Joi.object({
    name: Joi.string().max(100).optional(),
    is_active: Joi.boolean().optional(),
    valid_from: Joi.date().iso().optional(),
    valid_until: Joi.date().iso().optional()
  }),

  verifyAccessCode: Joi.object({
    code: Joi.string().pattern(/^[0-9]{4,8}$/).required()
  }),

  // ---- Emergency ----
  emergencyUnlock: Joi.object({
    reason: Joi.string().max(500).optional()
  }),

  emergencyAlert: Joi.object({
    message: Joi.string().max(1000).optional(),
    alert_type: Joi.string().valid('general', 'break_in', 'fire', 'medical', 'other').default('general')
  }),

  addTrustedContact: Joi.object({
    name: Joi.string().min(1).max(100).required(),
    phone: Joi.string().max(20).optional().allow('', null),
    email: Joi.string().email().max(254).optional().allow('', null),
    relationship: Joi.string().max(50).optional().allow('', null),
    can_emergency_unlock: Joi.boolean().default(false),
    notify_on_emergency: Joi.boolean().default(true)
  }),

  updateTrustedContact: Joi.object({
    name: Joi.string().min(1).max(100).optional(),
    phone: Joi.string().max(20).optional().allow('', null),
    email: Joi.string().email().max(254).optional().allow('', null),
    relationship: Joi.string().max(50).optional().allow('', null),
    can_emergency_unlock: Joi.boolean().optional(),
    notify_on_emergency: Joi.boolean().optional(),
    is_active: Joi.boolean().optional()
  }),

  // ---- Lock Settings ----
  updateLockSettings: Joi.object({
    auto_lock_enabled: Joi.boolean().optional(),
    auto_lock_delay: Joi.number().integer().min(0).max(3600).optional(),
    passage_mode: Joi.boolean().optional(),
    sound_enabled: Joi.boolean().optional(),
    led_enabled: Joi.boolean().optional(),
    security_mode: Joi.boolean().optional(),
    one_touch_lock: Joi.boolean().optional()
  }),

  autoLockSetting: Joi.object({
    enabled: Joi.boolean().required(),
    delay: Joi.number().integer().min(0).max(3600).optional()
  }),

  booleanSetting: Joi.object({
    enabled: Joi.boolean().required()
  }),

  remoteUnlockSetting: Joi.object({
    enabled: Joi.boolean().required()
  }),

  // ---- Notifications ----
  updateNotificationPreferences: Joi.object({
    push_enabled: Joi.boolean().optional(),
    unlock_notifications: Joi.boolean().optional(),
    lock_notifications: Joi.boolean().optional(),
    battery_notifications: Joi.boolean().optional(),
    tamper_notifications: Joi.boolean().optional(),
    guest_notifications: Joi.boolean().optional()
  }),

  // ---- Push Notifications ----
  registerPushToken: Joi.object({
    expoPushToken: Joi.string().max(500).required(),
    platform: Joi.string().valid('ios', 'android', 'web').optional(),
    deviceName: Joi.string().max(200).optional()
  }),

  unregisterPushToken: Joi.object({
    expoPushToken: Joi.string().max(500).required()
  }),

  // ---- Fingerprints ----
  addFingerprint: Joi.object({
    name: Joi.string().max(100).optional(),
    finger_number: Joi.number().integer().min(0).max(9).optional(),
    ttlock_fingerprint_id: Joi.alternatives().try(Joi.string().max(50), Joi.number()).optional()
  }),

  updateFingerprint: Joi.object({
    name: Joi.string().max(100).optional(),
    is_active: Joi.boolean().optional()
  }),

  // ---- IC Cards ----
  addICCard: Joi.object({
    cardNumber: Joi.string().max(50).optional(),
    card_number: Joi.string().max(50).optional(),
    cardName: Joi.string().max(100).optional(),
    name: Joi.string().max(100).optional(),
    startDate: Joi.alternatives().try(Joi.date().iso(), Joi.number()).optional(),
    endDate: Joi.alternatives().try(Joi.date().iso(), Joi.number()).optional(),
    addType: Joi.number().integer().valid(1, 2).optional(),
    ttlock_card_id: Joi.alternatives().try(Joi.string().max(50), Joi.number()).optional()
  }),

  updateICCard: Joi.object({
    name: Joi.string().max(100).optional(),
    is_active: Joi.boolean().optional()
  }),

  // ---- Passcodes ----
  addPasscode: Joi.object({
    name: Joi.string().max(100).optional(),
    // Accept both field name conventions
    code: Joi.string().pattern(/^[0-9]{4,9}$/).optional(),
    passcode: Joi.string().pattern(/^[0-9]{4,9}$/).optional(),
    code_type: Joi.string().valid('permanent', 'temporary', 'one_time', 'custom').optional(),
    passcode_type: Joi.string().valid('permanent', 'temporary', 'one_time', 'custom').optional(),
    valid_from: Joi.date().iso().optional(),
    valid_until: Joi.date().iso().optional(),
    start_date: Joi.date().iso().optional(),
    end_date: Joi.date().iso().optional()
  }),

  // ---- eKeys ----
  sendEkey: Joi.object({
    recipient_email: Joi.string().email().max(254).optional(),
    recipient_username: Joi.string().max(50).optional(),
    name: Joi.string().max(100).optional(),
    start_date: Joi.date().iso().optional(),
    end_date: Joi.date().iso().optional(),
    remarks: Joi.string().max(500).optional()
  }),

  // ---- Access Methods ----
  addAccessMethod: Joi.object({
    method_type: Joi.string().valid('phone', 'pin', 'fingerprint', 'card').required(),
    name: Joi.string().max(100).optional(),
    identifier: Joi.string().max(200).optional()
  }),

  updateAccessMethod: Joi.object({
    name: Joi.string().max(100).optional(),
    is_active: Joi.boolean().optional()
  }),

  // ---- AI ----
  aiChat: Joi.object({
    message: Joi.string().min(1).max(2000).required(),
    lockId: Joi.string().uuid().optional(),
    conversationId: Joi.string().uuid().optional()
  }),

  aiCreateRule: Joi.object({
    name: Joi.string().max(200).required(),
    description: Joi.string().max(1000).optional(),
    rule_type: Joi.string().max(50).optional(),
    conditions: Joi.object().optional(),
    actions: Joi.object().optional(),
    is_active: Joi.boolean().default(true)
  }),

  aiUpdateRule: Joi.object({
    name: Joi.string().max(200).optional(),
    description: Joi.string().max(1000).optional(),
    is_active: Joi.boolean().optional(),
    conditions: Joi.object().optional(),
    actions: Joi.object().optional()
  }),

  aiDismissRule: Joi.object({
    suggestion_id: Joi.string().max(100).optional(),
    rule_type: Joi.string().max(50).optional()
  }),

  aiRecommendationAction: Joi.object({
    lockId: Joi.string().uuid().required(),
    userId: Joi.string().uuid().required(),
    recommendationType: Joi.string().max(50).required(),
    action: Joi.string().valid('accept', 'dismiss', 'defer').required(),
    metadata: Joi.object().optional().allow(null).default({})
  }),

  // ---- Security ----
  acknowledgeAlert: Joi.object({
    notes: Joi.string().max(500).optional()
  }),

  // ---- TTLock Control ----
  ttlockControl: Joi.object({
    action: Joi.string().valid('lock', 'unlock').required()
  }),

  ttlockPasscode: Joi.object({
    // Support both controller field names (passcode) and TTLock API field names (keyboardPwd)
    passcode: Joi.string().pattern(/^[0-9]{4,9}$/).optional(),
    keyboardPwd: Joi.string().pattern(/^[0-9]{4,9}$/).optional(),
    keyboardPwdName: Joi.string().max(100).optional(),
    name: Joi.string().max(100).optional(),
    type: Joi.string().valid('one_time', 'permanent', 'timed').optional(),
    startDate: Joi.number().optional(),
    endDate: Joi.number().optional(),
    validHours: Joi.number().integer().min(1).max(8760).optional(),
    useBluetooth: Joi.boolean().optional(),
    keyboardPwdType: Joi.number().integer().min(1).max(5).optional()
  })
};
