import { supabase } from '../../services/supabase.js';
import axios from 'axios';
import md5 from 'md5';
import { encrypt, decrypt } from '../../utils/ttlockCrypto.js';

// TTLock API Configuration
const TTLOCK_CLIENT_ID = process.env.TTLOCK_CLIENT_ID;
const TTLOCK_CLIENT_SECRET = process.env.TTLOCK_CLIENT_SECRET;
const TTLOCK_API_BASE_URL = process.env.TTLOCK_API_BASE_URL || 'https://api.sciener.com';

/**
 * Get Access Token (OAuth - Resource Owner Password Grant)
 * POST /api/ttlock-v3/oauth/token
 *
 * @description Use OAuth (Resource Owner Password) to get access token
 * @route POST /oauth2/token
 */
export const getAccessToken = async (req, res) => {
  try {
    const userId = req.user.id;
    const { username, password, nickname, country } = req.body;

    // Validate required fields
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_CREDENTIALS',
          message: 'Username and password are required'
        }
      });
    }

    console.log('= TTLock OAuth - Get Access Token');
    console.log('   Username:', username);

    // Hash password with MD5 and convert to lowercase (TTLock requirement)
    const hashedPassword = md5(password).toLowerCase();

    // Prepare request parameters as form-encoded body
    const params = {
      client_id: TTLOCK_CLIENT_ID,
      client_secret: TTLOCK_CLIENT_SECRET,
      username: username,
      password: hashedPassword,
      grant_type: 'password'
    };
    const formData = new URLSearchParams(params);

    console.log('=� Calling TTLock OAuth API...');

    // Call TTLock OAuth endpoint with form-encoded body
    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/oauth2/token`,
      formData,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    console.log('=� Response:', response.data);

    // Check for errors
    if (response.data.errcode && response.data.errcode !== 0) {
      console.error('L TTLock OAuth Error:', response.data);
      return res.status(401).json({
        success: false,
        error: {
          code: 'TTLOCK_AUTH_ERROR',
          message: response.data.errmsg || 'Authentication failed',
          ttlock_errcode: response.data.errcode
        }
      });
    }

    // Extract response data
    const {
      access_token,
      refresh_token,
      uid,
      expires_in,
      scope
    } = response.data;

    if (!access_token) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'NO_TOKEN',
          message: 'No access token received from TTLock'
        }
      });
    }

    console.log(' OAuth successful');
    console.log('   User ID:', uid);
    console.log('   Expires in:', expires_in, 'seconds');

    // Calculate token expiration
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + expires_in);

    // Encrypt tokens for storage
    const encryptedAccessToken = encrypt(access_token);
    const encryptedRefreshToken = refresh_token ? encrypt(refresh_token) : null;

    console.log('=� Saving credentials to database...');

    // Prepare update data
    const updateData = {
      ttlock_user_id: parseInt(uid),
      ttlock_email: username,
      ttlock_access_token: encryptedAccessToken,
      ttlock_refresh_token: encryptedRefreshToken,
      ttlock_token_expires_at: expiresAt.toISOString(),
      ttlock_connected_at: new Date().toISOString()
    };

    if (nickname) updateData.ttlock_nickname = nickname;
    if (country) updateData.ttlock_country = country;

    // Save to database
    const { data: updatedUser, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', userId)
      .select('id, ttlock_user_id, ttlock_email, ttlock_nickname, ttlock_country, ttlock_connected_at, ttlock_token_expires_at')
      .single();

    if (error) {
      console.error('L Failed to save credentials:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: 'Failed to save TTLock credentials'
        }
      });
    }

    console.log(' Credentials saved successfully');

    // Return response
    res.json({
      success: true,
      message: 'TTLock account connected successfully',
      data: {
        access_token,
        refresh_token,
        uid,
        expires_in,
        scope,
        user: {
          id: updatedUser.id,
          ttlock_user_id: updatedUser.ttlock_user_id,
          ttlock_email: updatedUser.ttlock_email,
          ttlock_nickname: updatedUser.ttlock_nickname,
          ttlock_country: updatedUser.ttlock_country,
          ttlock_connected_at: updatedUser.ttlock_connected_at,
          ttlock_token_expires_at: updatedUser.ttlock_token_expires_at
        }
      }
    });
  } catch (error) {
    console.error('L Get access token error:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: error.response?.data?.errmsg || 'Failed to get access token',
        details: error.message
      }
    });
  }
};

/**
 * Refresh Access Token
 * POST /api/ttlock-v3/oauth/refresh
 *
 * @description Use refresh_token to get new access token and refresh token
 * @route POST /oauth2/token (with grant_type=refresh_token)
 */
export const refreshAccessToken = async (req, res) => {
  try {
    const userId = req.user.id;

    console.log('🔄 TTLock OAuth - Refresh Access Token');
    console.log('   User ID:', userId);

    // Get user's current refresh token from database
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('ttlock_refresh_token, ttlock_email')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      console.error('❌ User not found:', userError);
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found'
        }
      });
    }

    if (!user.ttlock_refresh_token) {
      console.log('❌ No refresh token available');
      return res.status(400).json({
        success: false,
        error: {
          code: 'NO_REFRESH_TOKEN',
          message: 'TTLock account not connected or no refresh token available'
        }
      });
    }

    // Decrypt the refresh token
    const refreshToken = decrypt(user.ttlock_refresh_token);

    console.log('📡 Calling TTLock token refresh API...');

    // Prepare request parameters
    const params = {
      client_id: TTLOCK_CLIENT_ID,
      client_secret: TTLOCK_CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: refreshToken
    };
    const formData = new URLSearchParams(params);

    // Call TTLock OAuth endpoint with form-encoded body
    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/oauth2/token`,
      formData,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    console.log('📊 Response:', response.data);

    // Check for errors
    if (response.data.errcode && response.data.errcode !== 0) {
      console.error('❌ TTLock refresh error:', response.data);
      return res.status(401).json({
        success: false,
        error: {
          code: 'REFRESH_FAILED',
          message: response.data.errmsg || 'Failed to refresh token',
          ttlock_errcode: response.data.errcode
        }
      });
    }

    // Extract response data
    const {
      access_token,
      refresh_token: new_refresh_token,
      expires_in,
      scope
    } = response.data;

    if (!access_token) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'NO_TOKEN',
          message: 'No access token received from TTLock'
        }
      });
    }

    console.log('✅ Token refreshed successfully');
    console.log('   New token expires in:', expires_in, 'seconds');

    // Calculate new expiration
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + expires_in);

    // Encrypt new tokens
    const encryptedAccessToken = encrypt(access_token);
    const encryptedRefreshToken = new_refresh_token ? encrypt(new_refresh_token) : user.ttlock_refresh_token;

    console.log('💾 Saving refreshed tokens to database...');

    // Update tokens in database
    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update({
        ttlock_access_token: encryptedAccessToken,
        ttlock_refresh_token: encryptedRefreshToken,
        ttlock_token_expires_at: expiresAt.toISOString()
      })
      .eq('id', userId)
      .select('id, ttlock_email, ttlock_token_expires_at')
      .single();

    if (updateError) {
      console.error('❌ Failed to save refreshed tokens:', updateError);
      return res.status(500).json({
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: 'Failed to save refreshed tokens'
        }
      });
    }

    console.log('✅ Refreshed tokens saved successfully');

    // Return response
    res.json({
      success: true,
      message: 'Access token refreshed successfully',
      data: {
        access_token,
        refresh_token: new_refresh_token,
        expires_in,
        scope,
        user: {
          ttlock_email: updatedUser.ttlock_email,
          ttlock_token_expires_at: updatedUser.ttlock_token_expires_at
        }
      }
    });
  } catch (error) {
    console.error('❌ Refresh token error:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: error.response?.data?.errmsg || 'Failed to refresh access token',
        details: error.message
      }
    });
  }
};
