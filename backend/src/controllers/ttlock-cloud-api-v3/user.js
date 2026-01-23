import { supabase } from '../../services/supabase.js';
import axios from 'axios';
import md5 from 'md5';

// TTLock API Configuration
const TTLOCK_CLIENT_ID = process.env.TTLOCK_CLIENT_ID;
const TTLOCK_CLIENT_SECRET = process.env.TTLOCK_CLIENT_SECRET;
const TTLOCK_API_BASE_URL = process.env.TTLOCK_API_BASE_URL || 'https://api.sciener.com';

/**
 * User Register
 * POST /api/ttlock-v3/user/register
 *
 * @description Register a new user in TTLock Cloud
 * @route POST /v3/user/register
 */
export const registerUser = async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validate required fields
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_FIELDS',
          message: 'Username and password are required'
        }
      });
    }

    console.log('=� TTLock User Register');
    console.log('   Username:', username);

    // Hash password with MD5 and convert to lowercase (TTLock requirement)
    const hashedPassword = md5(password).toLowerCase();

    // Prepare request parameters
    const params = {
      clientId: TTLOCK_CLIENT_ID,
      clientSecret: TTLOCK_CLIENT_SECRET,
      username: username,
      password: hashedPassword,
      date: Date.now()
    };

    console.log('=� Calling TTLock User Register API...');

    // Call TTLock API
    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/user/register`,
      null,
      { params }
    );

    console.log('=� Response:', response.data);

    // Check for errors
    if (response.data.errcode && response.data.errcode !== 0) {
      console.error('L TTLock register error:', response.data);
      return res.status(400).json({
        success: false,
        error: {
          code: 'REGISTRATION_FAILED',
          message: response.data.errmsg || response.data.description || 'User registration failed',
          ttlock_errcode: response.data.errcode
        }
      });
    }

    // Extract response data
    const { username: registeredUsername } = response.data;

    if (!registeredUsername) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'NO_USERNAME',
          message: 'No username received from TTLock'
        }
      });
    }

    console.log(' User registered successfully');
    console.log('   Registered Username:', registeredUsername);

    // Save to Supabase if user is authenticated
    const userId = req.user?.id;
    let supabaseUser = null;

    if (userId) {
      console.log('💾 Updating existing Supabase user with TTLock credentials...');

      const { data: updatedUser, error: supabaseError } = await supabase
        .from('users')
        .update({
          ttlock_email: registeredUsername
        })
        .eq('id', userId)
        .select('id, email, ttlock_email')
        .single();

      if (supabaseError) {
        console.error('⚠️  Warning: Failed to update Supabase user:', supabaseError);
      } else {
        console.log('✅ Supabase user updated');
        supabaseUser = updatedUser;
      }
    }

    // Return response
    res.json({
      success: true,
      message: 'User registered successfully in TTLock Cloud',
      data: {
        username: registeredUsername,
        ...(supabaseUser && {
          supabase_user: {
            id: supabaseUser.id,
            email: supabaseUser.email,
            ttlock_email: supabaseUser.ttlock_email
          }
        })
      }
    });
  } catch (error) {
    console.error('L Register user error:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: error.response?.data?.errmsg || error.response?.data?.description || 'Failed to register user',
        details: error.message
      }
    });
  }
};

/**
 * Reset Password
 * POST /api/ttlock-v3/user/reset-password
 *
 * @description Reset user password in TTLock Cloud
 * @route POST /v3/user/resetPassword
 */
export const resetPassword = async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validate required fields
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_FIELDS',
          message: 'Username and new password are required'
        }
      });
    }

    console.log('🔄 TTLock User Reset Password');
    console.log('   Username:', username);

    // Hash password with MD5 and convert to lowercase (TTLock requirement)
    const hashedPassword = md5(password).toLowerCase();

    // Prepare request parameters
    const params = {
      clientId: TTLOCK_CLIENT_ID,
      clientSecret: TTLOCK_CLIENT_SECRET,
      username: username,
      password: hashedPassword,
      date: Date.now()
    };

    console.log('📡 Calling TTLock Reset Password API...');

    // Call TTLock API
    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/user/resetPassword`,
      null,
      { params }
    );

    console.log('📊 Response:', response.data);

    // Check for errors
    if (response.data.errcode && response.data.errcode !== 0) {
      console.error('❌ TTLock reset password error:', response.data);
      return res.status(400).json({
        success: false,
        error: {
          code: 'RESET_PASSWORD_FAILED',
          message: response.data.errmsg || response.data.description || 'Password reset failed',
          ttlock_errcode: response.data.errcode
        }
      });
    }

    console.log('✅ Password reset successfully');

    // Return response
    res.json({
      success: true,
      message: 'Password reset successfully in TTLock Cloud',
      data: {
        username: username
      }
    });
  } catch (error) {
    console.error('❌ Reset password error:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: error.response?.data?.errmsg || error.response?.data?.description || 'Failed to reset password',
        details: error.message
      }
    });
  }
};

/**
 * Get User List
 * POST /api/ttlock-v3/user/list
 *
 * @description Get list of users registered under this app
 * @route POST /v3/user/list
 */
export const getUserList = async (req, res) => {
  try {
    const { startDate = 0, endDate = 0, pageNo = 1, pageSize = 20 } = req.body;

    // Validate pageSize
    if (pageSize > 100) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_PAGE_SIZE',
          message: 'Page size cannot exceed 100'
        }
      });
    }

    console.log('📋 TTLock Get User List');
    console.log('   Start Date:', startDate === 0 ? 'No constraint' : new Date(startDate).toISOString());
    console.log('   End Date:', endDate === 0 ? 'No constraint' : new Date(endDate).toISOString());
    console.log('   Page:', pageNo);
    console.log('   Page Size:', pageSize);

    // Prepare request parameters
    const params = {
      clientId: TTLOCK_CLIENT_ID,
      clientSecret: TTLOCK_CLIENT_SECRET,
      startDate: startDate,
      endDate: endDate,
      pageNo: pageNo,
      pageSize: pageSize,
      date: Date.now()
    };

    console.log('📡 Calling TTLock Get User List API...');

    // Call TTLock API
    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/user/list`,
      null,
      { params }
    );

    console.log('📊 Response:', response.data);

    // Check for errors
    if (response.data.errcode && response.data.errcode !== 0) {
      console.error('❌ TTLock get user list error:', response.data);
      return res.status(400).json({
        success: false,
        error: {
          code: 'GET_USER_LIST_FAILED',
          message: response.data.errmsg || response.data.description || 'Failed to get user list',
          ttlock_errcode: response.data.errcode
        }
      });
    }

    const { list, pageNo: resPageNo, pageSize: resPageSize, pages, total } = response.data;

    console.log('✅ User list retrieved successfully');
    console.log('   Total users:', total);
    console.log('   Total pages:', pages);
    console.log('   Current page:', resPageNo);

    // Return response
    res.json({
      success: true,
      message: 'User list retrieved successfully',
      data: {
        list: list || [],
        pagination: {
          pageNo: resPageNo,
          pageSize: resPageSize,
          pages: pages,
          total: total
        }
      }
    });
  } catch (error) {
    console.error('❌ Get user list error:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: error.response?.data?.errmsg || error.response?.data?.description || 'Failed to get user list',
        details: error.message
      }
    });
  }
};

/**
 * Delete User
 * POST /api/ttlock-v3/user/delete
 *
 * @description Delete a user from TTLock Cloud
 * @route POST /v3/user/delete
 */
export const deleteUser = async (req, res) => {
  try {
    const { username } = req.body;

    // Validate required fields
    if (!username) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_USERNAME',
          message: 'Username is required'
        }
      });
    }

    console.log('🗑️  TTLock Delete User');
    console.log('   Username:', username);

    // Prepare request parameters
    const params = {
      clientId: TTLOCK_CLIENT_ID,
      clientSecret: TTLOCK_CLIENT_SECRET,
      username: username,
      date: Date.now()
    };

    console.log('📡 Calling TTLock Delete User API...');

    // Call TTLock API
    const response = await axios.post(
      `${TTLOCK_API_BASE_URL}/v3/user/delete`,
      null,
      { params }
    );

    console.log('📊 Response:', response.data);

    // Check for errors
    if (response.data.errcode && response.data.errcode !== 0) {
      console.error('❌ TTLock delete user error:', response.data);
      return res.status(400).json({
        success: false,
        error: {
          code: 'DELETE_USER_FAILED',
          message: response.data.errmsg || response.data.description || 'User deletion failed',
          ttlock_errcode: response.data.errcode
        }
      });
    }

    console.log('✅ User deleted successfully');

    // Return response
    res.json({
      success: true,
      message: 'User deleted successfully from TTLock Cloud',
      data: {
        username: username
      }
    });
  } catch (error) {
    console.error('❌ Delete user error:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: error.response?.data?.errmsg || error.response?.data?.description || 'Failed to delete user',
        details: error.message
      }
    });
  }
};
