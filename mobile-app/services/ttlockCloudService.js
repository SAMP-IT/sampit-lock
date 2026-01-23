import axios from 'axios';
import md5 from 'md5';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TTLOCK_CLIENT_ID, TTLOCK_CLIENT_SECRET, TTLOCK_API_BASE_URL } from '@env';

/**
 * TTLock Cloud API Service
 * Enables remote control of locks via internet (requires Gateway)
 *
 * Features:
 * - Remote lock/unlock from anywhere
 * - Access token management (OAuth2)
 * - Lock list synchronization
 * - Passcode management
 * - Operation records
 */

const STORAGE_KEYS = {
  ACCESS_TOKEN: 'ttlock_access_token',
  REFRESH_TOKEN: 'ttlock_refresh_token',
  TOKEN_EXPIRY: 'ttlock_token_expiry',
  USER_ID: 'ttlock_user_id',
};

class TTLockCloudService {
  constructor() {
    this.baseURL = TTLOCK_API_BASE_URL || 'https://api.sciener.com';
    this.clientId = TTLOCK_CLIENT_ID;
    this.clientSecret = TTLOCK_CLIENT_SECRET;

    console.log('🌐 TTLock Cloud Service initialized');
    console.log('   Client ID:', this.clientId ? '✅ Loaded' : '❌ Missing');
    console.log('   Base URL:', this.baseURL);
  }

  /**
   * Get OAuth2 Access Token
   * @param {string} username - User email or phone
   * @param {string} password - User password (plain text, will be MD5 hashed)
   * @returns {Promise<Object>} Token data
   */
  async getAccessToken(username, password) {
    try {
      console.log('🔐 TTLock Cloud: Getting access token for:', username);

      // MD5 hash the password (32 chars, lowercase)
      const hashedPassword = md5(password).toLowerCase();

      const response = await axios.post(
        `${this.baseURL}/oauth2/token`,
        new URLSearchParams({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          username: username,
          password: hashedPassword,
          grant_type: 'password',
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      const { access_token, uid, expires_in, refresh_token } = response.data;

      // Store tokens in AsyncStorage
      const expiryTime = Date.now() + (expires_in * 1000);
      await AsyncStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, access_token);
      await AsyncStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refresh_token);
      await AsyncStorage.setItem(STORAGE_KEYS.TOKEN_EXPIRY, expiryTime.toString());
      await AsyncStorage.setItem(STORAGE_KEYS.USER_ID, uid.toString());

      console.log('✅ TTLock Cloud: Access token obtained');
      console.log('   User ID:', uid);
      console.log('   Expires in:', Math.floor(expires_in / 86400), 'days');

      return {
        accessToken: access_token,
        refreshToken: refresh_token,
        userId: uid,
        expiresIn: Math.floor(expires_in / 86400), // Convert seconds to days
      };
    } catch (error) {
      console.error('🔴 TTLock Cloud: Failed to get access token:', error.response?.data || error.message);
      throw new Error(error.response?.data?.errmsg || 'Failed to authenticate with TTLock Cloud');
    }
  }

  /**
   * Refresh Access Token
   * @param {string} refreshToken - Refresh token
   * @returns {Promise<Object>} New token data
   */
  async refreshAccessToken(refreshToken) {
    try {
      console.log('🔄 TTLock Cloud: Refreshing access token');

      const response = await axios.post(
        `${this.baseURL}/oauth2/token`,
        new URLSearchParams({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      const { access_token, expires_in, refresh_token: new_refresh_token } = response.data;

      // Update stored tokens
      const expiryTime = Date.now() + (expires_in * 1000);
      await AsyncStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, access_token);
      await AsyncStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, new_refresh_token);
      await AsyncStorage.setItem(STORAGE_KEYS.TOKEN_EXPIRY, expiryTime.toString());

      console.log('✅ TTLock Cloud: Token refreshed');

      return {
        accessToken: access_token,
        refreshToken: new_refresh_token,
        expiresIn: expires_in,
      };
    } catch (error) {
      console.error('🔴 TTLock Cloud: Failed to refresh token:', error.response?.data || error.message);
      throw new Error('Failed to refresh access token');
    }
  }

  /**
   * Get valid access token (auto-refresh if expired)
   * @returns {Promise<string>} Valid access token
   */
  async getValidAccessToken() {
    const accessToken = await AsyncStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    const expiryTime = await AsyncStorage.getItem(STORAGE_KEYS.TOKEN_EXPIRY);
    const refreshToken = await AsyncStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);

    if (!accessToken || !expiryTime) {
      throw new Error('No access token found. Please login first.');
    }

    // Check if token is expired (with 1 hour buffer)
    const isExpired = Date.now() > (parseInt(expiryTime) - 3600000);

    if (isExpired && refreshToken) {
      console.log('⚠️ TTLock Cloud: Token expired, refreshing...');
      const newTokens = await this.refreshAccessToken(refreshToken);
      return newTokens.accessToken;
    }

    return accessToken;
  }

  /**
   * Unlock lock remotely via Gateway
   * @param {number} lockId - TTLock Cloud lock ID
   * @returns {Promise<Object>} Unlock result
   */
  async unlockRemotely(lockId) {
    try {
      console.log('🔓 TTLock Cloud: Unlocking lock remotely:', lockId);

      const accessToken = await this.getValidAccessToken();

      const response = await axios.post(
        `${this.baseURL}/v3/lock/unlock`,
        new URLSearchParams({
          clientId: this.clientId,
          accessToken: accessToken,
          lockId: lockId.toString(),
          date: Date.now().toString(),
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      if (response.data.errcode === 0) {
        console.log('✅ TTLock Cloud: Lock unlocked successfully');
        return {
          success: true,
          action: 'unlock',
          lockId: lockId,
          timestamp: Date.now(),
        };
      } else {
        throw new Error(response.data.errmsg || 'Failed to unlock');
      }
    } catch (error) {
      console.error('🔴 TTLock Cloud: Failed to unlock:', error.response?.data || error.message);

      // Handle specific error codes
      if (error.response?.data?.errcode === -4043) {
        throw new Error('Remote unlock not enabled. Please enable it in lock settings.');
      } else if (error.response?.data?.errcode === -2011) {
        throw new Error('Gateway is offline. Please check gateway connection.');
      }

      throw new Error(error.response?.data?.errmsg || 'Failed to unlock remotely');
    }
  }

  /**
   * Lock remotely via Gateway
   * @param {number} lockId - TTLock Cloud lock ID
   * @returns {Promise<Object>} Lock result
   */
  async lockRemotely(lockId) {
    try {
      console.log('🔒 TTLock Cloud: Locking lock remotely:', lockId);

      const accessToken = await this.getValidAccessToken();

      const response = await axios.post(
        `${this.baseURL}/v3/lock/lock`,
        new URLSearchParams({
          clientId: this.clientId,
          accessToken: accessToken,
          lockId: lockId.toString(),
          date: Date.now().toString(),
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      if (response.data.errcode === 0) {
        console.log('✅ TTLock Cloud: Lock locked successfully');
        return {
          success: true,
          action: 'lock',
          lockId: lockId,
          timestamp: Date.now(),
        };
      } else {
        throw new Error(response.data.errmsg || 'Failed to lock');
      }
    } catch (error) {
      console.error('🔴 TTLock Cloud: Failed to lock:', error.response?.data || error.message);
      throw new Error(error.response?.data?.errmsg || 'Failed to lock remotely');
    }
  }

  /**
   * Get list of all locks from TTLock Cloud
   * @param {number} pageNo - Page number (default: 1)
   * @param {number} pageSize - Page size (default: 100)
   * @returns {Promise<Array>} List of locks
   */
  async getLockList(pageNo = 1, pageSize = 100) {
    try {
      console.log('📋 TTLock Cloud: Getting lock list');

      const accessToken = await this.getValidAccessToken();

      const response = await axios.get(`${this.baseURL}/v3/lock/list`, {
        params: {
          clientId: this.clientId,
          accessToken: accessToken,
          pageNo: pageNo,
          pageSize: pageSize,
          date: Date.now(),
        },
      });

      console.log('📊 TTLock Cloud API Response:', response.data);

      // Check if response has errcode field (error response) or list field (success response)
      if (response.data.errcode !== undefined && response.data.errcode !== 0) {
        // Error response from TTLock API
        console.error('❌ TTLock Cloud API Error Code:', response.data.errcode);
        console.error('❌ TTLock Cloud API Error Message:', response.data.errmsg);
        throw new Error(response.data.errmsg || 'Failed to get lock list');
      }

      // Success response - either errcode === 0 or response has list field
      const locks = response.data.list || [];
      console.log('✅ TTLock Cloud: Found', locks.length, 'locks');
      return locks;
    } catch (error) {
      console.error('🔴 TTLock Cloud: Failed to get lock list');
      console.error('   Error:', error.response?.data || error.message);
      console.error('   Full error:', JSON.stringify(error, null, 2));
      throw new Error(error.response?.data?.errmsg || error.message || 'Failed to get lock list');
    }
  }

  /**
   * Get lock detail/status
   * @param {number} lockId - TTLock Cloud lock ID
   * @returns {Promise<Object>} Lock details
   */
  async getLockDetail(lockId) {
    try {
      console.log('🔍 TTLock Cloud: Getting lock detail:', lockId);

      const accessToken = await this.getValidAccessToken();

      const response = await axios.get(`${this.baseURL}/v3/lock/detail`, {
        params: {
          clientId: this.clientId,
          accessToken: accessToken,
          lockId: lockId,
          date: Date.now(),
        },
      });

      if (response.data.errcode === 0) {
        console.log('✅ TTLock Cloud: Lock detail retrieved');
        return response.data;
      } else {
        throw new Error(response.data.errmsg || 'Failed to get lock detail');
      }
    } catch (error) {
      console.error('🔴 TTLock Cloud: Failed to get lock detail:', error.response?.data || error.message);
      throw new Error(error.response?.data?.errmsg || 'Failed to get lock detail');
    }
  }

  /**
   * Create custom passcode remotely
   * @param {number} lockId - TTLock Cloud lock ID
   * @param {string} passcode - 4-9 digit passcode
   * @param {number} startDate - Start timestamp (ms)
   * @param {number} endDate - End timestamp (ms)
   * @param {string} pascodeName - Name for the passcode
   * @returns {Promise<Object>} Created passcode info
   */
  async createPasscode(lockId, passcode, startDate, endDate, pascodeName = 'Guest') {
    try {
      console.log('🔑 TTLock Cloud: Creating passcode for lock:', lockId);

      const accessToken = await this.getValidAccessToken();

      const response = await axios.post(
        `${this.baseURL}/v3/lock/addKeyboardPwd`,
        new URLSearchParams({
          clientId: this.clientId,
          accessToken: accessToken,
          lockId: lockId.toString(),
          keyboardPwd: passcode,
          keyboardPwdName: pascodeName,
          startDate: startDate.toString(),
          endDate: endDate.toString(),
          addType: '2', // 2 = custom passcode
          date: Date.now().toString(),
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      if (response.data.errcode === 0) {
        console.log('✅ TTLock Cloud: Passcode created');
        return response.data;
      } else {
        throw new Error(response.data.errmsg || 'Failed to create passcode');
      }
    } catch (error) {
      console.error('🔴 TTLock Cloud: Failed to create passcode:', error.response?.data || error.message);
      throw new Error(error.response?.data?.errmsg || 'Failed to create passcode');
    }
  }

  /**
   * Get operation records (unlock history)
   * @param {number} lockId - TTLock Cloud lock ID
   * @param {number} startDate - Start timestamp (ms)
   * @param {number} endDate - End timestamp (ms)
   * @param {number} pageNo - Page number (default: 1)
   * @param {number} pageSize - Page size (default: 20)
   * @returns {Promise<Array>} List of operation records
   */
  async getOperationRecords(lockId, startDate, endDate, pageNo = 1, pageSize = 20) {
    try {
      console.log('📜 TTLock Cloud: Getting operation records for lock:', lockId);

      const accessToken = await this.getValidAccessToken();

      const response = await axios.get(`${this.baseURL}/v3/lockRecord/list`, {
        params: {
          clientId: this.clientId,
          accessToken: accessToken,
          lockId: lockId,
          startDate: startDate,
          endDate: endDate,
          pageNo: pageNo,
          pageSize: pageSize,
          date: Date.now(),
        },
      });

      if (response.data.errcode === 0) {
        const records = response.data.list || [];
        console.log('✅ TTLock Cloud: Found', records.length, 'records');
        return records;
      } else {
        throw new Error(response.data.errmsg || 'Failed to get records');
      }
    } catch (error) {
      console.error('🔴 TTLock Cloud: Failed to get records:', error.response?.data || error.message);
      throw new Error(error.response?.data?.errmsg || 'Failed to get operation records');
    }
  }

  /**
   * Check if user is authenticated with TTLock Cloud
   * @returns {Promise<boolean>} True if authenticated
   */
  async isAuthenticated() {
    const accessToken = await AsyncStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    const expiryTime = await AsyncStorage.getItem(STORAGE_KEYS.TOKEN_EXPIRY);

    if (!accessToken || !expiryTime) {
      return false;
    }

    // Check if token is still valid (with 1 hour buffer)
    const isValid = Date.now() < (parseInt(expiryTime) - 3600000);
    return isValid;
  }

  /**
   * Logout from TTLock Cloud (clear tokens)
   */
  async logout() {
    console.log('🚪 TTLock Cloud: Logging out');
    await AsyncStorage.multiRemove([
      STORAGE_KEYS.ACCESS_TOKEN,
      STORAGE_KEYS.REFRESH_TOKEN,
      STORAGE_KEYS.TOKEN_EXPIRY,
      STORAGE_KEYS.USER_ID,
    ]);
    console.log('✅ TTLock Cloud: Logged out');
  }
}

export default new TTLockCloudService();
