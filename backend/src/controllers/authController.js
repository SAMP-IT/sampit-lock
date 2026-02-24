import { supabase, supabaseAnon } from '../services/supabase.js';
import bcrypt from 'bcrypt';
import axios from 'axios';
import md5 from 'md5';
import { encrypt } from '../utils/ttlockCrypto.js';

// TTLock API Configuration
const TTLOCK_CLIENT_ID = process.env.TTLOCK_CLIENT_ID;
const TTLOCK_CLIENT_SECRET = process.env.TTLOCK_CLIENT_SECRET;
const TTLOCK_API_BASE_URL = process.env.TTLOCK_API_BASE_URL || 'https://api.sciener.com';

/**
 * Convert email to TTLock-compatible username
 * TTLock requires alphanumeric only (6-20 chars)
 * Uses email prefix (before @) and removes special chars
 */
const emailToTTLockUsername = (email) => {
  if (!email) return null;
  // Extract part before @ and remove all non-alphanumeric characters
  const emailPrefix = email.split('@')[0];
  const username = emailPrefix.replace(/[^a-zA-Z0-9]/g, '');
  
  // Ensure minimum length (pad with numbers if needed)
  if (username.length < 6) {
    return username + '123456'.substring(0, 6 - username.length);
  }
  
  // Truncate if too long
  return username.substring(0, 20);
};

/**
 * Validate TTLock username
 */
const validateTTLockUsername = (username) => {
  if (!username || username.length < 6) {
    return { valid: false, reason: 'Username must be at least 6 characters long' };
  }
  if (username.length > 20) {
    return { valid: false, reason: 'Username must be 20 characters or less' };
  }
  if (/[^a-zA-Z0-9]/.test(username)) {
    return { valid: false, reason: 'Username can only contain letters and numbers' };
  }
  return { valid: true };
};

/**
 * Register user in TTLock Cloud API and get access token
 * Returns full TTLock connection data including tokens
 */
const registerAndConnectTTLock = async (username, password) => {
  try {
    // Hash password with MD5 and convert to lowercase (TTLock requirement)
    const hashedPassword = md5(password).toLowerCase();
    
    // Step 1: Register user with TTLock
    const registerParams = {
      clientId: TTLOCK_CLIENT_ID,
      clientSecret: TTLOCK_CLIENT_SECRET,
      username: username,
      password: hashedPassword,
      date: Date.now()
    };

    const registerFormData = new URLSearchParams(registerParams);

    console.log('🔐 Step 1: Registering user with TTLock Cloud API...');
    const registerResponse = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/user/register`,
      registerFormData,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    // Check for registration errors
    if (registerResponse.data.errcode && registerResponse.data.errcode !== 0) {
      return {
        success: false,
        error: {
          code: 'TTLOCK_REGISTRATION_FAILED',
          message: registerResponse.data.errmsg || 'TTLock registration failed',
          errcode: registerResponse.data.errcode
        }
      };
    }

    // TTLock may return a different username than what we sent (e.g., if username was taken, it might add suffix)
    // Always use the username TTLock returns, as that's what the user needs to login with
    const registeredUsername = registerResponse.data.username || username;
    console.log('✅ TTLock account created:', {
      requestedUsername: username,
      registeredUsername: registeredUsername,
      match: username === registeredUsername
    });
    
    // If TTLock returned a different username, log a warning
    if (registeredUsername !== username) {
      console.warn('⚠️ TTLock returned different username:', {
        requested: username,
        received: registeredUsername
      });
    }

    // Step 2: Brief wait for TTLock account propagation
    await new Promise(resolve => setTimeout(resolve, 500));

    // Step 3: Get access token by logging in
    const loginParams = {
      client_id: TTLOCK_CLIENT_ID,
      client_secret: TTLOCK_CLIENT_SECRET,
      username: registeredUsername,
      password: hashedPassword,
      grant_type: 'password'
    };
    const loginFormData = new URLSearchParams(loginParams);

    console.log('🔑 Step 2: Getting TTLock access token...');
    
    // Retry logic for getting token (TTLock may need time to propagate)
    let loginResponse;
    let loginAttempts = 0;
    const maxAttempts = 3;

    while (loginAttempts < maxAttempts) {
      loginAttempts++;
      console.log(`🔄 Login attempt ${loginAttempts}/${maxAttempts}...`);

      try {
        loginResponse = await axios.post(
          `${TTLOCK_API_BASE_URL}/oauth2/token`,
          loginFormData,
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded'
            }
          }
        );

        // If successful, break
        if (!loginResponse.data.errcode || loginResponse.data.errcode === 0) {
          break;
        }

        // If error 10007 (invalid credentials) and we have more attempts, wait and retry
        if (loginResponse.data.errcode === 10007 && loginAttempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        } else {
          break; // Non-retryable error or last attempt
        }
      } catch (error) {
        if (loginAttempts >= maxAttempts) {
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Check for login errors
    if (loginResponse.data.errcode && loginResponse.data.errcode !== 0) {
      console.warn('⚠️ TTLock login failed after registration:', loginResponse.data);
      return {
        success: false,
        error: {
          code: 'TTLOCK_LOGIN_FAILED',
          message: loginResponse.data.errmsg || 'Failed to get TTLock access token',
          errcode: loginResponse.data.errcode
        }
      };
    }

    const {
      access_token,
      refresh_token,
      uid,
      expires_in
    } = loginResponse.data;

    console.log('✅ TTLock access token obtained:', { uid, expires_in });

    // Calculate token expiration
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + expires_in);

    // Encrypt tokens for storage
    const encryptedAccessToken = encrypt(access_token);
    const encryptedRefreshToken = refresh_token ? encrypt(refresh_token) : null;

    return {
      success: true,
      username: registeredUsername,
      ttlock_user_id: parseInt(uid),
      ttlock_access_token: encryptedAccessToken,
      ttlock_refresh_token: encryptedRefreshToken,
      ttlock_token_expires_at: expiresAt.toISOString()
    };
  } catch (error) {
    console.error('TTLock registration/connection error:', error.response?.data || error.message);
    return {
      success: false,
      error: {
        code: 'TTLOCK_REGISTRATION_FAILED',
        message: error.response?.data?.errmsg || 'Failed to register and connect with TTLock',
        errcode: error.response?.data?.errcode
      }
    };
  }
};

/**
 * User Sign Up
 * POST /auth/signup
 */
export const signup = async (req, res) => {
  try {
    const { email, password, first_name, last_name, phone, role } = req.body;

    // Hash password
    const password_hash = await bcrypt.hash(password, 10);

    // Generate TTLock username from email (or phone if provided)
    // IMPORTANT: Phone is preferred as it's more reliable for TTLock registration
    let ttlockUsername = null;
    if (phone) {
      // Use phone if provided (remove all non-alphanumeric characters)
      ttlockUsername = phone.replace(/[^a-zA-Z0-9]/g, '');
      console.log('📱 Using phone as TTLock username:', { phone, ttlockUsername });
    } else {
      // Generate from email (fallback)
      ttlockUsername = emailToTTLockUsername(email);
      console.log('📧 Using email to generate TTLock username:', { email, ttlockUsername });
    }

    // Validate TTLock username - REQUIRED for signup
    const usernameValidation = validateTTLockUsername(ttlockUsername);
    if (!usernameValidation.valid) {
      console.error('❌ TTLock username validation failed:', usernameValidation.reason);
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_USERNAME',
          message: `Unable to generate valid TTLock username: ${usernameValidation.reason}. ${phone ? 'Please check your phone number format (must be 6-20 alphanumeric characters).' : 'Please provide a phone number or use an email with at least 6 alphanumeric characters before @.'}`
        }
      });
    }

    // Register and connect with TTLock Cloud API
    console.log('🔐 Registering and connecting user with TTLock Cloud API...');
    const ttlockConnectionResult = await registerAndConnectTTLock(ttlockUsername, password);
    
    if (!ttlockConnectionResult.success) {
      console.error('❌ TTLock registration/connection failed:', ttlockConnectionResult.error);
      return res.status(400).json({
        success: false,
        error: {
          code: 'TTLOCK_REGISTRATION_FAILED',
          message: ttlockConnectionResult.error.message || 'Failed to create TTLock account. Please try again.',
          errcode: ttlockConnectionResult.error.errcode
        }
      });
    }

    console.log('✅ TTLock account created and connected:', {
      requestedUsername: ttlockUsername,
      registeredUsername: ttlockConnectionResult.username,
      match: ttlockUsername === ttlockConnectionResult.username
    });

    // Create user in Supabase Auth
    const { data: authData, error: authError } = await supabaseAnon.auth.signUp({
      email,
      password
    });

    if (authError) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'SIGNUP_FAILED',
          message: authError.message
        }
      });
    }

    // Prepare user data for database
    const userData = {
      id: authData.user.id,
      email,
      password_hash,
      first_name,
      last_name,
      phone,
      role: role || 'owner',
      email_verified: false
    };

    // Add TTLock connection data (always present since we require successful registration)
    if (ttlockConnectionResult?.success) {
      userData.ttlock_username = ttlockConnectionResult.username;
      userData.ttlock_user_id = ttlockConnectionResult.ttlock_user_id;
      userData.ttlock_email = email;
      userData.ttlock_access_token = ttlockConnectionResult.ttlock_access_token;
      userData.ttlock_refresh_token = ttlockConnectionResult.ttlock_refresh_token;
      userData.ttlock_token_expires_at = ttlockConnectionResult.ttlock_token_expires_at;
      userData.ttlock_connected_at = new Date().toISOString();
    }

    // Create user in database
    const { data: user, error: dbError } = await supabase
      .from('users')
      .insert([userData])
      .select()
      .single();

    if (dbError) {
      // Rollback auth user if database insert fails
      await supabase.auth.admin.deleteUser(authData.user.id);

      console.error('Database user creation error:', dbError);
      console.error('Error details:', {
        code: dbError.code,
        message: dbError.message,
        details: dbError.details,
        hint: dbError.hint
      });

      // Provide more specific error message
      let errorMessage = 'Failed to create user in database';
      if (dbError.code === '23505') { // Unique violation
        errorMessage = 'Email already exists';
      } else if (dbError.code === '23502') { // Not null violation
        errorMessage = 'Missing required fields';
      } else if (dbError.message) {
        errorMessage = dbError.message;
      }

      return res.status(500).json({
        success: false,
        error: {
          code: 'SIGNUP_FAILED',
          message: errorMessage,
          details: process.env.NODE_ENV === 'development' ? dbError.message : undefined
        }
      });
    }

    // Remove sensitive data
    delete user.password_hash;
    delete user.ttlock_access_token;
    delete user.ttlock_refresh_token;

    // Prepare response
    const responseData = {
      user,
      token: authData.session?.access_token,
      refresh_token: authData.session?.refresh_token
    };

    // Add TTLock connection status (always true since we require it)
    if (ttlockConnectionResult?.success) {
      responseData.ttlock_connected = true;
      responseData.ttlock_username = ttlockConnectionResult.username;
      responseData.message = 'Account created successfully. TTLock account is automatically connected.';
      responseData.ttlock_login_info = {
        username: ttlockConnectionResult.username,
        note: 'You can use this username and your password to login to the TTLock app'
      };
    }

    console.log('✅ Signup complete - User and TTLock account created and connected');

    res.status(201).json({
      success: true,
      data: responseData
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Signup failed'
      }
    });
  }
};

/**
 * User Login
 * POST /auth/login
 */
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Authenticate with Supabase Auth
    const { data, error } = await supabaseAnon.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid email or password'
        }
      });
    }

    // Update last login timestamp
    await supabase
      .from('users')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', data.user.id);

    // Fetch full user details
    const { data: user } = await supabase
      .from('users')
      .select('id, email, first_name, last_name, phone, role, avatar_url, email_verified, simple_mode, created_at')
      .eq('id', data.user.id)
      .single();

    res.json({
      success: true,
      data: {
        user,
        token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_in: data.session.expires_in
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Login failed'
      }
    });
  }
};

/**
 * User Logout
 * POST /auth/logout
 */
export const logout = async (req, res) => {
  try {
    const { error } = await supabase.auth.signOut();

    if (error) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'LOGOUT_FAILED',
          message: error.message
        }
      });
    }

    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Logout error:', error);
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
 * Forgot Password
 * POST /auth/forgot-password
 */
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const { error } = await supabaseAnon.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.FRONTEND_URL}/reset-password`
    });

    if (error) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'RESET_FAILED',
          message: error.message
        }
      });
    }

    res.json({
      success: true,
      message: 'Password reset email sent'
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to send reset email'
      }
    });
  }
};

/**
 * Reset Password
 * POST /auth/reset-password
 */
export const resetPassword = async (req, res) => {
  try {
    const { reset_token, new_password } = req.body;

    // Update password
    const { data, error } = await supabase.auth.updateUser({
      password: new_password
    });

    if (error) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'RESET_FAILED',
          message: error.message
        }
      });
    }

    // Hash and update in database
    const password_hash = await bcrypt.hash(new_password, 10);
    await supabase
      .from('users')
      .update({ password_hash })
      .eq('id', data.user.id);

    res.json({
      success: true,
      message: 'Password reset successful'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Password reset failed'
      }
    });
  }
};

/**
 * Verify Email
 * POST /auth/verify-email
 */
export const verifyEmail = async (req, res) => {
  try {
    const { verification_token } = req.body;

    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: verification_token,
      type: 'email'
    });

    if (error) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VERIFICATION_FAILED',
          message: error.message
        }
      });
    }

    // Update email_verified in database
    await supabase
      .from('users')
      .update({ email_verified: true })
      .eq('id', data.user.id);

    res.json({
      success: true,
      message: 'Email verified successfully'
    });
  } catch (error) {
    console.error('Verify email error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Email verification failed'
      }
    });
  }
};

/**
 * Get Current User
 * GET /auth/me
 */
export const getCurrentUser = async (req, res) => {
  try {
    // User is already attached by auth middleware
    const user = { ...req.user };
    delete user.password_hash;

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Get current user error:', error);
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
 * Refresh Access Token
 * POST /auth/refresh
 * Uses Supabase refresh token to get a new access token
 */
export const refreshToken = async (req, res) => {
  try {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_REFRESH_TOKEN',
          message: 'Refresh token is required'
        }
      });
    }

    console.log('🔄 Attempting to refresh token...');

    // Use Supabase to refresh the session
    const { data, error } = await supabaseAnon.auth.refreshSession({
      refresh_token
    });

    if (error) {
      console.error('❌ Token refresh failed:', error.message);
      return res.status(401).json({
        success: false,
        error: {
          code: 'REFRESH_FAILED',
          message: 'Failed to refresh token. Please log in again.'
        }
      });
    }

    if (!data.session) {
      console.error('❌ No session returned from refresh');
      return res.status(401).json({
        success: false,
        error: {
          code: 'REFRESH_FAILED',
          message: 'Session expired. Please log in again.'
        }
      });
    }

    console.log('✅ Token refreshed successfully for user:', data.user?.email);

    // Fetch updated user details
    const { data: user } = await supabase
      .from('users')
      .select('id, email, first_name, last_name, phone, role, avatar_url, email_verified, simple_mode, created_at')
      .eq('id', data.user.id)
      .single();

    res.json({
      success: true,
      data: {
        user,
        token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_in: data.session.expires_in
      }
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Token refresh failed'
      }
    });
  }
};

/**
 * Update User Profile
 * PATCH /auth/profile
 */
export const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const updates = { ...req.body };
    
    // Convert empty phone string to null for database (phone is optional)
    if (updates.phone !== undefined) {
      updates.phone = updates.phone === '' ? null : updates.phone;
    }

    // Update user in database
    const { data: user, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', userId)
      .select('id, email, first_name, last_name, phone, role, avatar_url, simple_mode')
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
    console.error('Update profile error:', error);
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
 * Delete User Account
 * DELETE /auth/account
 */
export const deleteAccount = async (req, res) => {
  try {
    const userId = req.user.id;

    // Fetch user details to get TTLock username before deletion
    const { data: userData, error: fetchError } = await supabase
      .from('users')
      .select('ttlock_username')
      .eq('id', userId)
      .single();

    if (fetchError) {
      console.error('Error fetching user for deletion:', fetchError.message);
    }

    // Delete TTLock user from TTLock Cloud (best-effort)
    if (userData?.ttlock_username) {
      try {
        const ttlockResponse = await axios.post(
          `${TTLOCK_API_BASE_URL}/v3/user/delete`,
          null,
          {
            params: {
              clientId: TTLOCK_CLIENT_ID,
              clientSecret: TTLOCK_CLIENT_SECRET,
              username: userData.ttlock_username,
              date: Date.now()
            }
          }
        );

        if (ttlockResponse.data.errcode && ttlockResponse.data.errcode !== 0) {
          console.error('TTLock user deletion failed:', ttlockResponse.data.errmsg);
        }
      } catch (ttlockError) {
        console.error('TTLock user deletion error:', ttlockError.message);
        // Continue with account deletion even if TTLock fails
      }
    }

    // Delete all user's locks first (cascades to related data)
    const { error: locksError } = await supabase
      .from('locks')
      .delete()
      .eq('owner_id', userId);

    if (locksError) {
      console.error('Error deleting user locks:', locksError.message);
    }

    // Delete user_locks entries (shared access)
    const { error: userLocksError } = await supabase
      .from('user_locks')
      .delete()
      .eq('user_id', userId);

    if (userLocksError) {
      console.error('Error deleting user_locks:', userLocksError.message);
    }

    // Clean up orphaned records in related tables
    const orphanTables = [
      { table: 'activity_logs', column: 'user_id' },
      { table: 'guest_codes', column: 'created_by_user_id' },
      { table: 'guest_access', column: 'created_by_user_id' },
      { table: 'notifications', column: 'user_id' },
      { table: 'access_codes', column: 'created_by_user_id' },
      { table: 'invite_codes', column: 'created_by_user_id' }
    ];

    for (const { table, column } of orphanTables) {
      const { error } = await supabase.from(table).delete().eq(column, userId);
      if (error) {
        console.error(`Error cleaning ${table}:`, error.message);
      }
    }

    // Delete user from database
    const { error: dbError } = await supabase
      .from('users')
      .delete()
      .eq('id', userId);

    if (dbError) {
      console.error('Error deleting user from database:', dbError.message);
      return res.status(500).json({
        success: false,
        error: {
          code: 'DELETE_FAILED',
          message: 'Failed to delete user data'
        }
      });
    }

    // Delete user from Supabase Auth
    const { error: authError } = await supabase.auth.admin.deleteUser(userId);

    if (authError) {
      console.error('Error deleting user from Supabase Auth:', authError.message);
      // Don't fail here since DB data is already deleted
    }

    res.json({
      success: true,
      message: 'Account deleted successfully'
    });
  } catch (error) {
    console.error('Delete account error:', error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Account deletion failed'
      }
    });
  }
};
