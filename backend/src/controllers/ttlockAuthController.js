import { supabase } from '../services/supabase.js';
import axios from 'axios';
import md5 from 'md5';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import logger from '../utils/logger.js';
import { encrypt, decrypt } from '../utils/ttlockCrypto.js';

// TTLock API Configuration
const TTLOCK_CLIENT_ID = process.env.TTLOCK_CLIENT_ID;
const TTLOCK_CLIENT_SECRET = process.env.TTLOCK_CLIENT_SECRET;
const TTLOCK_API_BASE_URL = process.env.TTLOCK_API_BASE_URL || 'https://api.sciener.com';
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

/**
 * Validate TTLock username
 * TTLock API requires usernames to be ONLY alphanumeric (letters and numbers)
 * Length: 6-20 characters
 */
const validateTTLockUsername = (username) => {
  if (!username || username.length < 6) {
    return { valid: false, reason: 'Username must be at least 6 characters long' };
  }
  if (username.length > 20) {
    return { valid: false, reason: 'Username must be 20 characters or less' };
  }
  if (/[^a-zA-Z0-9]/.test(username)) {
    return { valid: false, reason: 'Username can only contain letters and numbers (no spaces, dots, or special characters)' };
  }
  return { valid: true };
};

// Generate JWT token for our app
const generateAppToken = (userId, ttlockUserId, email) => {
  return jwt.sign(
    {
      userId,
      ttlockUserId,
      email,
      type: 'ttlock_auth'
    },
    JWT_SECRET,
    { expiresIn: '90d' } // Match TTLock token expiry
  );
};

/**
 * Convert phone number to TTLock-compatible username
 * Removes all non-alphanumeric characters (spaces, dashes, plus signs, etc.)
 */
const phoneToTTLockUsername = (phone) => {
  // Remove all non-alphanumeric characters
  return phone.replace(/[^a-zA-Z0-9]/g, '');
};

/**
 * Register new user via TTLock API
 * POST /auth/register
 *
 * New users provide: email + phone + password
 * Phone number becomes the TTLock username (alphanumeric only)
 * Email is stored for communication purposes
 */
export const register = async (req, res) => {
  try {
    const { email, phone, password } = req.body;

    // Validate required fields
    if (!email || !phone || !password) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_CREDENTIALS',
          message: 'Email, phone number, and password are required'
        }
      });
    }

    // Validate email format
    if (!email.includes('@')) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_EMAIL',
          message: 'Please enter a valid email address'
        }
      });
    }

    // Validate password length (TTLock requires max 32 characters)
    if (password.length > 32) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_PASSWORD',
          message: 'Password must be 32 characters or less'
        }
      });
    }

    // Convert phone to TTLock-compatible username (remove all special chars)
    const ttlockUsername = phoneToTTLockUsername(phone);

    // Validate TTLock username requirements
    const validation = validateTTLockUsername(ttlockUsername);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_PHONE',
          message: `Phone number issue: ${validation.reason}. Phone must be 6-20 digits.`
        }
      });
    }

    logger.info('[AUTH] 📝 TTLock Registration - Creating new account', {
      email: email,
      phone: phone,
      ttlockUsername: ttlockUsername
    });

    // Hash password with MD5 and convert to lowercase (TTLock requirement)
    const hashedPassword = md5(password).toLowerCase();

    // Prepare registration request - use generated alphanumeric username for TTLock
    const params = {
      clientId: TTLOCK_CLIENT_ID,
      clientSecret: TTLOCK_CLIENT_SECRET,
      username: ttlockUsername,  // Use alphanumeric username, NOT email
      password: hashedPassword,
      date: Date.now()
    };
    const formData = new URLSearchParams(params);

    logger.ttlock.apiCall('/v3/user/register', 'POST', true, { email, phone, ttlockUsername });

    // Call TTLock registration endpoint
    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/user/register`,
      formData,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    // Check for errors
    if (response.data.errcode && response.data.errcode !== 0) {
      logger.auth.register(email, false, { errcode: response.data.errcode, errmsg: response.data.errmsg });

      // Map common TTLock error codes
      let errorMessage = response.data.errmsg || 'Registration failed';
      if (response.data.errcode === 30003) {
        errorMessage = 'This phone number is already registered. Please login instead.';
      } else if (response.data.errcode === 30002) {
        errorMessage = 'Invalid phone number format. Please use digits only (6-20 characters).';
      }

      return res.status(400).json({
        success: false,
        error: {
          code: 'REGISTRATION_FAILED',
          message: errorMessage,
          ttlock_errcode: response.data.errcode
        }
      });
    }

    logger.info('[AUTH] ✅ TTLock account created on TTLock cloud', { email, phone, ttlockUsername });

    // Add a small delay before attempting login (TTLock may need time to propagate the new user)
    await new Promise(resolve => setTimeout(resolve, 2000));
    logger.info('[AUTH] ⏳ Waited 2 seconds before login attempt');

    // Now login to get the access token - use the same ttlockUsername
    const loginParams = {
      client_id: TTLOCK_CLIENT_ID,
      client_secret: TTLOCK_CLIENT_SECRET,
      username: ttlockUsername,  // Use alphanumeric username, NOT email
      password: hashedPassword,
      grant_type: 'password'
    };
    const loginFormData = new URLSearchParams(loginParams);

    logger.ttlock.apiCall('/oauth2/token', 'POST', true, { action: 'get_token_after_register' });

    // Try login with retry logic (TTLock may have propagation delay)
    let loginResponse;
    let loginAttempts = 0;
    const maxAttempts = 3;

    while (loginAttempts < maxAttempts) {
      loginAttempts++;
      logger.info(`[AUTH] 🔄 Login attempt ${loginAttempts}/${maxAttempts} after registration`);

      loginResponse = await axios.post(
        `${TTLOCK_API_BASE_URL}/oauth2/token`,
        loginFormData,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      // If successful or error is not a propagation-related error, break
      if (!loginResponse.data.errcode || loginResponse.data.errcode === 0) {
        break; // Success!
      }

      // If error 10007 (invalid credentials) and we have more attempts, wait and retry
      if (loginResponse.data.errcode === 10007 && loginAttempts < maxAttempts) {
        logger.info(`[AUTH] ⏳ Got 10007, waiting 2 seconds before retry...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      } else {
        break; // Non-retryable error or last attempt
      }
    }

    // If login failed after all retries, still create the user in our DB without TTLock tokens
    // User can login manually later once TTLock propagates the account
    if (loginResponse.data.errcode && loginResponse.data.errcode !== 0) {
      logger.ttlock.apiCall('/oauth2/token', 'POST', false, { errcode: loginResponse.data.errcode, attempts: loginAttempts });
      logger.warn('[AUTH] ⚠️ Post-registration login failed, creating user without tokens', { email, ttlockUsername });

      // Generate a UUID for the new user
      const userId = crypto.randomUUID();

      // Create user in database WITHOUT TTLock tokens (they'll get tokens on first manual login)
      const { data: user, error: dbError } = await supabase
        .from('users')
        .insert([{
          id: userId,
          email: email,
          phone: phone,
          password_hash: 'ttlock_auth',
          first_name: '',
          last_name: '',
          role: 'owner',
          is_active: true,
          email_verified: true,
          profile_completed: false,
          ttlock_user_id: null,  // Will be set on first login
          ttlock_email: email,
          ttlock_username: ttlockUsername,
          ttlock_access_token: null,
          ttlock_refresh_token: null,
          ttlock_token_expires_at: null,
          ttlock_connected_at: new Date().toISOString()
        }])
        .select('id, email, phone, first_name, last_name, role, ttlock_user_id, ttlock_email, profile_completed, created_at')
        .single();

      if (dbError) {
        logger.error('[AUTH] Database user creation failed', { error: dbError.message, email });
        return res.status(500).json({
          success: false,
          error: {
            code: 'DATABASE_ERROR',
            message: 'Account created on TTLock but failed to save user data. Please try logging in.'
          }
        });
      }

      logger.auth.register(email, true, { userId, note: 'Created without tokens - will get on first login' });

      // Generate app JWT token (user can use app, but TTLock operations will require login)
      const appToken = generateAppToken(userId, null, email);

      return res.status(201).json({
        success: true,
        message: 'Account created successfully. Please login to complete setup.',
        data: {
          user: {
            ...user,
            profile_completed: false
          },
          token: appToken,
          ttlock_access_token: null,
          ttlock_refresh_token: null,
          expires_in: null,
          requires_profile_completion: true,
          requires_manual_login: true  // Flag to tell frontend to redirect to login
        }
      });
    }

    const {
      access_token,
      refresh_token,
      uid,
      expires_in
    } = loginResponse.data;

    logger.info('[AUTH] ✅ Access token obtained for new user', { email, ttlockUserId: uid });

    // Calculate token expiration
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + expires_in);

    // Encrypt tokens for storage
    const encryptedAccessToken = encrypt(access_token);
    const encryptedRefreshToken = refresh_token ? encrypt(refresh_token) : null;

    // Generate a UUID for the new user
    const userId = crypto.randomUUID();

    // Create user in database
    // Store email for communication, phone/ttlockUsername for TTLock API
    const { data: user, error: dbError } = await supabase
      .from('users')
      .insert([{
        id: userId,
        email: email,  // User's email for communication
        phone: phone,  // User's phone number (original format)
        password_hash: 'ttlock_auth', // Placeholder - auth handled by TTLock
        first_name: '', // Will be filled in profile completion
        last_name: '',
        role: 'owner',
        is_active: true,
        email_verified: true, // TTLock handles verification
        profile_completed: false,
        ttlock_user_id: parseInt(uid),
        ttlock_email: email,  // User's email
        ttlock_username: ttlockUsername,  // Phone number as TTLock username (alphanumeric)
        ttlock_access_token: encryptedAccessToken,
        ttlock_refresh_token: encryptedRefreshToken,
        ttlock_token_expires_at: expiresAt.toISOString(),
        ttlock_connected_at: new Date().toISOString()
      }])
      .select('id, email, phone, first_name, last_name, role, ttlock_user_id, ttlock_email, profile_completed, created_at')
      .single();

    if (dbError) {
      logger.error('[AUTH] Database user creation failed', { error: dbError.message, email });
      return res.status(500).json({
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: 'TTLock account created but failed to save user data. Please try logging in.'
        }
      });
    }

    logger.auth.register(email, true, { userId, ttlockUserId: uid });

    // Generate app JWT token
    const appToken = generateAppToken(userId, uid, email);

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      data: {
        user: {
          ...user,
          profile_completed: false
        },
        token: appToken,
        ttlock_access_token: access_token,
        ttlock_refresh_token: refresh_token,
        expires_in,
        requires_profile_completion: true
      }
    });
  } catch (error) {
    logger.auth.register(req.body?.email || 'unknown', false, { error: error.message });
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: error.response?.data?.errmsg || 'Registration failed',
        details: error.message
      }
    });
  }
};

/**
 * Login via TTLock OAuth
 * POST /auth/login
 *
 * Supports both:
 * 1. New users from our app (phone number as username)
 * 2. Existing TTLock app users (their TTLock username directly)
 *
 * User enters: username (phone or TTLock username) + password
 */
export const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_CREDENTIALS',
          message: 'Username/Phone and password are required'
        }
      });
    }

    // Convert username to TTLock-compatible format (remove any special chars)
    // This works for both phone numbers and existing TTLock usernames
    // Note: Do NOT lowercase - must match how we registered the user
    const ttlockUsername = username.replace(/[^a-zA-Z0-9]/g, '');

    // Validate username format
    const validation = validateTTLockUsername(ttlockUsername);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_USERNAME',
          message: validation.reason
        }
      });
    }

    logger.info('[AUTH] 🔐 TTLock Login attempt', { inputUsername: username, ttlockUsername });

    // Hash password with MD5 and convert to lowercase (TTLock requirement)
    const hashedPassword = md5(password).toLowerCase();

    // Prepare login request
    const params = {
      client_id: TTLOCK_CLIENT_ID,
      client_secret: TTLOCK_CLIENT_SECRET,
      username: ttlockUsername,
      password: hashedPassword,
      grant_type: 'password'
    };
    const formData = new URLSearchParams(params);

    logger.ttlock.apiCall('/oauth2/token', 'POST', true, { action: 'login', ttlockUsername });

    // Call TTLock OAuth endpoint
    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/oauth2/token`,
      formData,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    // Check for errors
    if (response.data.errcode && response.data.errcode !== 0) {
      logger.auth.login(ttlockUsername, false, { errcode: response.data.errcode, errmsg: response.data.errmsg });

      let errorMessage = 'Invalid username or password';
      if (response.data.errcode === 10003 || response.data.errcode === 10007) {
        errorMessage = 'Invalid username or password. Make sure you are using your TTLock username or phone number.';
      } else if (response.data.errcode === 10011) {
        errorMessage = 'Account locked. Please try again later.';
      }

      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: errorMessage,
          ttlock_errcode: response.data.errcode
        }
      });
    }

    const {
      access_token,
      refresh_token,
      uid,
      expires_in
    } = response.data;

    logger.info('[AUTH] ✅ TTLock OAuth successful', { ttlockUsername, ttlockUserId: uid });

    // Calculate token expiration
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + expires_in);

    // Encrypt tokens for storage
    const encryptedAccessToken = encrypt(access_token);
    const encryptedRefreshToken = refresh_token ? encrypt(refresh_token) : null;

    // Check if user exists in our database
    let { data: existingUser, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('ttlock_user_id', parseInt(uid))
      .single();

    let user;
    let isNewUser = false;
    let requiresProfileCompletion = false;

    if (fetchError && fetchError.code === 'PGRST116') {
      // User doesn't exist in our database - this is an existing TTLock user logging in
      // Create a new profile for them (they can add email later in profile completion)
      logger.info('[AUTH] 🆕 Creating new user in database (existing TTLock user)', { ttlockUsername, ttlockUserId: uid });
      isNewUser = true;
      requiresProfileCompletion = true;

      const userId = crypto.randomUUID();

      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert([{
          id: userId,
          email: null,  // Existing TTLock users may not have provided email
          phone: username,  // Store original input (could be phone or username)
          password_hash: 'ttlock_auth',
          first_name: '',
          last_name: '',
          role: 'owner',
          is_active: true,
          email_verified: false,  // They need to add email in profile
          profile_completed: false,
          ttlock_user_id: parseInt(uid),
          ttlock_email: null,
          ttlock_username: ttlockUsername,
          ttlock_access_token: encryptedAccessToken,
          ttlock_refresh_token: encryptedRefreshToken,
          ttlock_token_expires_at: expiresAt.toISOString(),
          ttlock_connected_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (createError) {
        logger.error('[AUTH] Failed to create user in DB', { error: createError.message, ttlockUsername });
        return res.status(500).json({
          success: false,
          error: {
            code: 'DATABASE_ERROR',
            message: 'Failed to create user profile'
          }
        });
      }

      user = newUser;
    } else if (fetchError) {
      logger.error('[AUTH] Database fetch error', { error: fetchError.message, ttlockUsername });
      return res.status(500).json({
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: 'Failed to fetch user'
        }
      });
    } else {
      // User exists - update tokens and last login
      user = existingUser;
      requiresProfileCompletion = !user.profile_completed || !user.first_name;

      const { error: updateError } = await supabase
        .from('users')
        .update({
          ttlock_access_token: encryptedAccessToken,
          ttlock_refresh_token: encryptedRefreshToken,
          ttlock_token_expires_at: expiresAt.toISOString(),
          last_login_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (updateError) {
        logger.warn('[AUTH] Failed to update tokens', { error: updateError.message, userId: user.id });
      }
    }

    // Check if user is active
    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Account is inactive'
        }
      });
    }

    logger.auth.login(username, true, { userId: user.id, ttlockUserId: uid, isNewUser, requiresProfileCompletion });

    // Generate app JWT token
    const appToken = generateAppToken(user.id, uid, username);

    // Remove sensitive data
    const userResponse = { ...user };
    delete userResponse.password_hash;
    delete userResponse.ttlock_access_token;
    delete userResponse.ttlock_refresh_token;

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: userResponse,
        token: appToken,
        ttlock_access_token: access_token,
        ttlock_refresh_token: refresh_token,
        expires_in,
        is_new_user: isNewUser,
        requires_profile_completion: requiresProfileCompletion
      }
    });
  } catch (error) {
    logger.auth.login(req.body?.username || 'unknown', false, { error: error.message });
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: error.response?.data?.errmsg || 'Login failed',
        details: error.message
      }
    });
  }
};

/**
 * Complete user profile after TTLock login
 * POST /auth/complete-profile
 */
export const completeProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { first_name, last_name, phone } = req.body;

    if (!first_name || !last_name) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'First name and last name are required'
        }
      });
    }

    logger.info('[AUTH] 📝 Completing profile', { userId, first_name, last_name });

    const { data: user, error } = await supabase
      .from('users')
      .update({
        first_name,
        last_name,
        phone: phone || null,
        profile_completed: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select('id, email, first_name, last_name, phone, role, avatar_url, profile_completed, created_at')
      .single();

    if (error) {
      logger.auth.profileComplete(userId, false, { error: error.message });
      return res.status(500).json({
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: 'Failed to update profile'
        }
      });
    }

    logger.auth.profileComplete(userId, true, { first_name, last_name });

    res.json({
      success: true,
      message: 'Profile completed successfully',
      data: { user }
    });
  } catch (error) {
    logger.auth.profileComplete(req.user?.id || 'unknown', false, { error: error.message });
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to complete profile'
      }
    });
  }
};

/**
 * Refresh TTLock access token
 * POST /auth/refresh-token
 */
export const refreshToken = async (req, res) => {
  try {
    const userId = req.user.id;

    logger.info('[AUTH] 🔄 Refreshing TTLock token', { userId });

    // Get user's current refresh token from database
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('ttlock_refresh_token, ttlock_email')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found'
        }
      });
    }

    if (!user.ttlock_refresh_token) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'NO_REFRESH_TOKEN',
          message: 'No refresh token available. Please login again.'
        }
      });
    }

    // Decrypt the refresh token
    const refreshTokenValue = decrypt(user.ttlock_refresh_token);

    // Prepare refresh request
    const params = {
      client_id: TTLOCK_CLIENT_ID,
      client_secret: TTLOCK_CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: refreshTokenValue
    };
    const formData = new URLSearchParams(params);

    logger.ttlock.apiCall('/oauth2/token', 'POST', true, { action: 'refresh_token', userId });

    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/oauth2/token`,
      formData,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    if (response.data.errcode && response.data.errcode !== 0) {
      logger.auth.tokenRefresh(userId, false, { errcode: response.data.errcode });
      return res.status(401).json({
        success: false,
        error: {
          code: 'REFRESH_FAILED',
          message: 'Session expired. Please login again.',
          ttlock_errcode: response.data.errcode
        }
      });
    }

    const {
      access_token,
      refresh_token: new_refresh_token,
      expires_in
    } = response.data;

    // Calculate new expiration
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + expires_in);

    // Encrypt new tokens
    const encryptedAccessToken = encrypt(access_token);
    const encryptedRefreshToken = new_refresh_token ? encrypt(new_refresh_token) : user.ttlock_refresh_token;

    // Update tokens in database
    await supabase
      .from('users')
      .update({
        ttlock_access_token: encryptedAccessToken,
        ttlock_refresh_token: encryptedRefreshToken,
        ttlock_token_expires_at: expiresAt.toISOString()
      })
      .eq('id', userId);

    logger.auth.tokenRefresh(userId, true);

    res.json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        ttlock_access_token: access_token,
        ttlock_refresh_token: new_refresh_token,
        expires_in
      }
    });
  } catch (error) {
    logger.auth.tokenRefresh(req.user?.id || 'unknown', false, { error: error.message });
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to refresh token'
      }
    });
  }
};

/**
 * Get current user
 * GET /auth/me
 */
export const getCurrentUser = async (req, res) => {
  try {
    const user = { ...req.user };
    delete user.password_hash;
    delete user.ttlock_access_token;
    delete user.ttlock_refresh_token;

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    logger.error('[AUTH] Get current user error', { error: error.message });
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to fetch user'
      }
    });
  }
};

/**
 * Update user profile
 * PATCH /auth/profile
 */
export const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { first_name, last_name, phone, simple_mode, avatar_url } = req.body;

    const updates = {};
    if (first_name !== undefined) updates.first_name = first_name;
    if (last_name !== undefined) updates.last_name = last_name;
    // Allow phone to be empty string or null (optional field)
    // Convert empty string to null for database storage
    if (phone !== undefined) {
      updates.phone = phone === '' || phone === null ? null : phone;
    }
    if (simple_mode !== undefined) updates.simple_mode = simple_mode;
    if (avatar_url !== undefined) updates.avatar_url = avatar_url;
    updates.updated_at = new Date().toISOString();

    const { data: user, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', userId)
      .select('id, email, first_name, last_name, phone, role, avatar_url, simple_mode, profile_completed')
      .single();

    if (error) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'UPDATE_FAILED',
          message: 'Failed to update profile'
        }
      });
    }

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    logger.error('[AUTH] Update profile error', { error: error.message, userId: req.user?.id });
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Profile update failed'
      }
    });
  }
};

/**
 * Logout
 * POST /auth/logout
 */
export const logout = async (req, res) => {
  try {
    // For TTLock auth, we just clear the tokens client-side
    logger.auth.logout(req.user?.id || 'unknown');

    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    logger.error('[AUTH] Logout error', { error: error.message });
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Logout failed'
      }
    });
  }
};

/**
 * Check TTLock connection status
 * GET /auth/ttlock-status
 */
export const getTTLockStatus = async (req, res) => {
  try {
    const user = req.user;

    const isConnected = !!user.ttlock_user_id;
    const tokenExpiresAt = user.ttlock_token_expires_at ? new Date(user.ttlock_token_expires_at) : null;
    const isTokenValid = tokenExpiresAt && tokenExpiresAt > new Date();

    res.json({
      success: true,
      data: {
        connected: isConnected,
        token_valid: isTokenValid,
        ttlock_user_id: user.ttlock_user_id,
        ttlock_email: user.ttlock_email,
        token_expires_at: user.ttlock_token_expires_at
      }
    });
  } catch (error) {
    logger.error('[AUTH] TTLock status error', { error: error.message });
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to get TTLock status'
      }
    });
  }
};

/**
 * Get decrypted TTLock access token for frontend use
 * GET /auth/ttlock-token
 */
export const getTTLockToken = async (req, res) => {
  try {
    logger.info('[AUTH] Getting TTLock token', { userId: req.user?.id });
    const user = req.user;

    if (!user.ttlock_access_token) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'NOT_CONNECTED',
          message: 'TTLock account not connected'
        }
      });
    }

    // Check if token is expired
    const tokenExpiresAt = new Date(user.ttlock_token_expires_at);
    if (tokenExpiresAt <= new Date()) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'TOKEN_EXPIRED',
          message: 'TTLock token expired. Please refresh.'
        }
      });
    }

    // Decrypt access token
    const accessToken = decrypt(user.ttlock_access_token);

    res.json({
      success: true,
      data: {
        access_token: accessToken,
        expires_at: user.ttlock_token_expires_at,
        ttlock_user_id: user.ttlock_user_id
      }
    });
  } catch (error) {
    logger.error('[AUTH] Get TTLock token error', { error: error.message, userId: req.user?.id });
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to get TTLock token'
      }
    });
  }
};

/**
 * Connect existing TTLock account to current Supabase user
 * POST /auth/connect-ttlock
 * For users who signed up with Supabase auth and want to link their TTLock account
 */
export const connectTTLockAccount = async (req, res) => {
  try {
    const userId = req.user.id;
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_CREDENTIALS',
          message: 'TTLock username and password are required'
        }
      });
    }

    // Use username as-is (TTLock supports email addresses)
    // Only strip special characters if it's NOT an email
    const ttlockUsername = username.includes('@')
      ? username.trim()  // Email - use as-is
      : username.replace(/[^a-zA-Z0-9]/g, '');  // Phone/username - strip special chars

    logger.info('[AUTH] 🔗 Connecting TTLock account', { userId, ttlockUsername });

    // Hash password with MD5
    const hashedPassword = md5(password).toLowerCase();

    // Prepare login request to TTLock API
    const params = {
      client_id: TTLOCK_CLIENT_ID,
      client_secret: TTLOCK_CLIENT_SECRET,
      username: ttlockUsername,
      password: hashedPassword,
      grant_type: 'password'
    };
    const formData = new URLSearchParams(params);

    logger.ttlock.apiCall('/oauth2/token', 'POST', true, { action: 'connect_account', userId });

    // Call TTLock OAuth endpoint
    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/oauth2/token`,
      formData,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    // Check for errors
    if (response.data.errcode && response.data.errcode !== 0) {
      logger.ttlock.apiCall('/oauth2/token', 'POST', false, { errcode: response.data.errcode });

      let errorMessage = 'Invalid TTLock credentials';
      if (response.data.errcode === 10003 || response.data.errcode === 10007) {
        errorMessage = 'Invalid TTLock username or password. Please check your credentials.';
      } else if (response.data.errcode === 10011) {
        errorMessage = 'TTLock account is locked. Please try again later.';
      }

      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: errorMessage,
          ttlock_errcode: response.data.errcode
        }
      });
    }

    const {
      access_token,
      refresh_token,
      uid,
      expires_in
    } = response.data;

    logger.info('[AUTH] ✅ TTLock OAuth successful', { userId, ttlockUserId: uid });

    // Calculate token expiration
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + expires_in);

    // Encrypt tokens for storage
    const encryptedAccessToken = encrypt(access_token);
    const encryptedRefreshToken = refresh_token ? encrypt(refresh_token) : null;

    // Update user with TTLock credentials
    const { error: updateError } = await supabase
      .from('users')
      .update({
        ttlock_user_id: parseInt(uid),
        ttlock_username: ttlockUsername,
        ttlock_access_token: encryptedAccessToken,
        ttlock_refresh_token: encryptedRefreshToken,
        ttlock_token_expires_at: expiresAt.toISOString(),
        ttlock_connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (updateError) {
      logger.error('[AUTH] Failed to update user with TTLock credentials', { error: updateError.message, userId });
      return res.status(500).json({
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: 'Failed to save TTLock credentials'
        }
      });
    }

    logger.info('[AUTH] ✅ TTLock account connected successfully', { userId, ttlockUserId: uid });

    // Try to fetch locks count from TTLock Cloud
    let locksFound = 0;
    try {
      const locksParams = {
        clientId: TTLOCK_CLIENT_ID,
        accessToken: access_token,
        pageNo: 1,
        pageSize: 100,
        date: Date.now()
      };
      const locksFormData = new URLSearchParams(locksParams);

      const locksResponse = await axios.post(
        `${TTLOCK_API_BASE_URL}/v3/lock/list`,
        locksFormData,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      if (locksResponse.data.errcode === 0 && locksResponse.data.list) {
        locksFound = locksResponse.data.list.length;
      }
    } catch (error) {
      logger.warn('[AUTH] Failed to fetch locks count', { error: error.message });
    }

    res.json({
      success: true,
      message: 'TTLock account connected successfully',
      data: {
        ttlock_user_id: parseInt(uid),
        ttlock_access_token: access_token,
        ttlock_refresh_token: refresh_token,
        expires_in,
        locks_found: locksFound
      }
    });
  } catch (error) {
    logger.error('[AUTH] Connect TTLock account error', { error: error.message, userId: req.user?.id });
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: error.response?.data?.errmsg || 'Failed to connect TTLock account',
        details: error.message
      }
    });
  }
};
