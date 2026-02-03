import Joi from 'joi';

/**
 * Validation middleware factory
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

      // Log validation errors for debugging
      console.error('❌ Validation Error:', {
        path: req.path,
        method: req.method,
        body: req.body,
        errors: errors
      });

      // Create a more user-friendly error message
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

    // Replace body with validated value
    req.body = value;
    next();
  };
};

// Common validation schemas
export const schemas = {
  // TTLock Authentication (new primary auth)
  // Registration: email (for communication) + phone (becomes TTLock username) + password
  ttlockRegister: Joi.object({
    email: Joi.string().email().required().messages({
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

  // Login: username (phone or existing TTLock username) + password
  ttlockLogin: Joi.object({
    username: Joi.string().min(6).max(50).required().messages({
      'string.min': 'Username must be at least 6 characters',
      'any.required': 'Username or phone number is required'
    }),
    password: Joi.string().required().messages({
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
    phone: Joi.string().optional().allow('', null)
  }),

  // Legacy Supabase Authentication (kept for backwards compatibility)
  signup: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(8).required(),
    first_name: Joi.string().min(1).max(100).required(),
    last_name: Joi.string().min(1).max(100).required(),
    phone: Joi.string().optional().allow('', null),
    role: Joi.string().valid('owner', 'family', 'guest', 'service', 'enterprise').default('owner')
  }),

  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
  }),

  forgotPassword: Joi.object({
    email: Joi.string().email().required()
  }),

  resetPassword: Joi.object({
    reset_token: Joi.string().required(),
    new_password: Joi.string().min(8).required()
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
    avatar_url: Joi.string().uri().optional()
  }),

  // Locks
  addLock: Joi.object({
    name: Joi.string().min(1).max(100).optional().allow('', null), // Optional during initial pairing, can be set later
    location: Joi.string().max(200).optional().allow('', null),
    device_id: Joi.string().optional().allow('', null),
    mac_address: Joi.string().optional().allow('', null),
    // TTLock-specific fields for Bluetooth pairing
    ttlock_mac: Joi.string().optional().allow('', null),
    ttlock_data: Joi.string().optional().allow('', null),
    ttlock_lock_name: Joi.string().optional().allow('', null),
    ttlock_lock_id: Joi.alternatives().try(Joi.string(), Joi.number()).optional().allow(null),
    is_bluetooth_paired: Joi.boolean().optional(),
    battery_level: Joi.number().min(0).max(100).optional().allow(null),
    is_locked: Joi.boolean().optional(),
    // TTLock recovery keys (from SDK initialization)
    admin_pwd: Joi.string().optional().allow('', null),
    delete_pwd: Joi.string().optional().allow('', null),
    no_key_pwd: Joi.string().optional().allow('', null)
  }),

  updateLock: Joi.object({
    name: Joi.string().min(1).max(100).optional(),
    location: Joi.string().max(200).optional().allow('', null),
    recovery_key: Joi.string().max(100).optional().allow(null)
  }),

  // Lock Control
  lockAction: Joi.object({
    access_method: Joi.string().valid('remote', 'auto').optional(),
    location: Joi.object({
      lat: Joi.number().min(-90).max(90).optional(),
      lon: Joi.number().min(-180).max(180).optional()
    }).optional()
  }),

  // User Management
  addUser: Joi.object({
    email: Joi.string().email().required(),
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
    ).optional(),
    time_restrictions: Joi.object({
      enabled: Joi.boolean().default(false),
      start_time: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
      end_time: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
      days_of_week: Joi.array().items(Joi.number().min(0).max(6)).optional()
    }).optional()
  }),

  // Guest Access
  createInvite: Joi.object({
    lock_id: Joi.string().uuid().required(),
    email: Joi.string().email().required(),
    role: Joi.string().valid('family', 'guest').required(),
    permissions: Joi.object().required(),
    valid_days: Joi.number().min(1).max(365).default(7)
  }),

  generateOTP: Joi.object({
    guest_name: Joi.string().min(1).max(100).required(),
    access_start: Joi.date().iso().optional(),
    access_end: Joi.date().iso().optional(),
    expires_at: Joi.date().iso().optional(),
    valid_duration: Joi.number().min(60).max(86400 * 30).optional(), // 1 min to 30 days in seconds
    max_uses: Joi.number().min(1).default(1)
  }),

  // Access Codes
  createAccessCode: Joi.object({
    name: Joi.string().max(100).optional(),
    code_type: Joi.string().valid('permanent', 'temporary', 'one_time').required(),
    code: Joi.string().pattern(/^[0-9]{4,8}$/).required(),
    valid_from: Joi.date().iso().optional(),
    valid_until: Joi.date().iso().optional(),
    max_usage_count: Joi.number().min(1).optional()
  })
};
