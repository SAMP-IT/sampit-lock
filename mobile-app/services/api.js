import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SUPABASE_URL, SUPABASE_ANON_KEY, BACKEND_API_URL } from '@env';
import { getToastManager } from '../context/ToastContext';

const API_URL = `${SUPABASE_URL}/rest/v1`;

// Supabase REST API client (for direct database access - kept for backwards compatibility)
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_ANON_KEY
  }
});

// Function to get the current backend API URL (checks dev mode)
const getBackendApiUrl = async () => {
  try {
    const devModeEnabled = await AsyncStorage.getItem('devModeEnabled');
    if (devModeEnabled === 'true') {
      const localUrl = await AsyncStorage.getItem('localServerUrl');
      if (localUrl) {
        return localUrl;
      }
      // Default for Android emulator
      return 'http://10.0.2.2:3009/api';
    }
  } catch (error) {
    console.warn('Failed to check dev mode:', error);
  }
  // Production URL from environment or default
  return BACKEND_API_URL || 'https://awakey-project.onrender.com/api';
};

// Initialize with default URL, will be updated when dev mode is checked
const defaultBackendApiUrl = BACKEND_API_URL || 'https://awakey-project.onrender.com/api';

// Backend API client (for custom endpoints - primary API for auth and all features)
const backendApi = axios.create({
  baseURL: defaultBackendApiUrl,
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 15000 // 15 second timeout (increased for Render cold starts)
});

// Update baseURL dynamically based on dev mode
const updateBackendApiUrl = async () => {
  const newUrl = await getBackendApiUrl();
  backendApi.defaults.baseURL = newUrl;
  console.log('🔧 Backend API URL updated:', newUrl);
};

// Initialize on module load
updateBackendApiUrl();

// Export function to update API URL (called when dev mode changes)
export { updateBackendApiUrl };

// Retry configuration for network errors
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second initial delay

// Helper function to delay
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Helper to check if error is retryable
const isRetryableError = (error) => {
  // Retry on network errors
  if (!error.response) {
    return true;
  }
  // Retry on 502, 503, 504 (server overloaded or cold start)
  const status = error.response?.status;
  return status === 502 || status === 503 || status === 504;
};

// Add retry interceptor
backendApi.interceptors.response.use(
  response => response,
  async (error) => {
    const config = error.config;

    // Don't retry if config doesn't exist or retries exhausted
    if (!config || config.__retryCount >= MAX_RETRIES) {
      return Promise.reject(error);
    }

    // Check if this error is retryable
    if (!isRetryableError(error)) {
      return Promise.reject(error);
    }

    // Initialize retry count
    config.__retryCount = config.__retryCount || 0;
    config.__retryCount++;

    console.log(`🔄 Retrying request (${config.__retryCount}/${MAX_RETRIES}): ${config.method?.toUpperCase()} ${config.url}`);

    // Exponential backoff delay
    const backoffDelay = RETRY_DELAY * Math.pow(2, config.__retryCount - 1);
    await delay(backoffDelay);

    // Retry the request
    return backendApi(config);
  }
);

// Interceptor for Supabase REST API (uses JWT token from AsyncStorage)
api.interceptors.request.use(
  async (config) => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.warn('⚠️ Error reading auth token:', error.message);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor for Backend API
backendApi.interceptors.request.use(
  async (config) => {
    console.log('📡 Backend API Request:', config.method?.toUpperCase(), config.url);

    // Skip auth for public endpoints (login, register)
    const publicEndpoints = ['/auth/login', '/auth/register', '/auth/signup'];
    if (publicEndpoints.some(endpoint => config.url?.includes(endpoint))) {
      console.log('🔓 Public endpoint - no auth required');
      return config;
    }

    // Get token from AsyncStorage (TTLock JWT token)
    try {
      const token = await AsyncStorage.getItem('authToken');

      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
        console.log('🔑 Auth token added from AsyncStorage');
        return config;
      }
    } catch (error) {
      console.warn('⚠️ Error reading from AsyncStorage:', error.message);
    }

    console.warn('⚠️ No auth token found - request will be unauthorized');
    return config;
  },
  (error) => {
    console.error('🔴 Backend API Request Error:', error.message);
    return Promise.reject(error);
  }
);

// Helper to get user-friendly error message
const getErrorMessage = (error) => {
  const status = error.response?.status;
  const url = error.config?.url || '';
  const serverMessage = error.response?.data?.error?.message || error.response?.data?.message;

  // Handle specific status codes with user-friendly messages
  if (status === 404) {
    // Don't show toast for expected 404s (e.g., first-time user with no locks)
    if (url.includes('/locks') && !url.includes('/locks/')) {
      return null; // Suppress - no locks is normal
    }
    if (url.includes('/ttlock/status')) {
      return null; // Suppress - TTLock not connected is normal
    }
    return 'The requested resource was not found.';
  }

  if (status === 401) {
    return 'Your session has expired. Please log in again.';
  }

  if (status === 403) {
    return 'You do not have permission to perform this action.';
  }

  if (status === 400) {
    // Use server message if available, otherwise generic message
    return serverMessage || 'Invalid request. Please check your input.';
  }

  if (status === 409) {
    return serverMessage || 'This action conflicts with existing data.';
  }

  if (status === 500) {
    return 'Something went wrong on our end. Please try again later.';
  }

  if (status === 502 || status === 504) {
    return 'Unable to connect to server. Please try again later.';
  }

  if (status === 503) {
    return 'Service is temporarily unavailable. Please try again later.';
  }

  // Network errors
  if (!error.response) {
    if (error.message?.includes('Network Error')) {
      return 'Cannot connect to server. Please check your internet connection.';
    }
    if (error.message?.includes('timeout')) {
      return 'Request timed out. Please check your connection and try again.';
    }
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      return 'Cannot reach server. Please check your internet connection.';
    }

    // Generic network error
    return 'Connection failed. Please check your internet and try again.';
  }

  // If server provided a friendly message, use it
  if (serverMessage && !serverMessage.includes('Error') && !serverMessage.includes('Exception')) {
    return serverMessage;
  }

  // Generic fallback - avoid showing technical error messages
  return 'Something went wrong. Please try again.';
};

// Track if we're currently refreshing the token to prevent multiple refresh attempts
let isRefreshing = false;
let failedQueue = [];

// Process failed request queue after token refresh
const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Attempt to refresh the auth token
const refreshAuthToken = async () => {
  try {
    const refreshToken = await AsyncStorage.getItem('refreshToken');
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    console.log('🔄 Attempting to refresh auth token...');
    const apiUrl = await getBackendApiUrl();
    const response = await axios.post(`${apiUrl}/auth/refresh`, {
      refresh_token: refreshToken
    });

    const { token, refresh_token: newRefreshToken } = response.data.data;

    // Store new tokens
    await AsyncStorage.setItem('authToken', token);
    if (newRefreshToken) {
      await AsyncStorage.setItem('refreshToken', newRefreshToken);
    }

    console.log('✅ Token refreshed successfully');
    return token;
  } catch (error) {
    console.warn('❌ Token refresh failed:', error.message);
    // Clear tokens on refresh failure
    await AsyncStorage.removeItem('authToken');
    await AsyncStorage.removeItem('refreshToken');
    throw error;
  }
};

// Response interceptor for better error logging, toast notifications, and auto token refresh
backendApi.interceptors.response.use(
  (response) => {
    console.log('Backend API Response:', response.status, response.config.url);
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    const status = error.response?.status;
    const url = error.config?.url || '';

    // Handle 401 errors with auto token refresh
    if (status === 401 && !originalRequest._retry) {
      // Skip token refresh for auth endpoints
      if (url.includes('/auth/login') || url.includes('/auth/register') || url.includes('/auth/refresh')) {
        return Promise.reject(error);
      }

      // Skip token refresh for expected 401s (TTLock not connected, etc.)
      const isExpected401 = (
        url.includes('/ttlock/status') ||
        url.includes('/ai/risk-scores') ||
        url.includes('/ai/insights') ||
        url.includes('/ai/chat')
      );
      if (isExpected401) {
        return Promise.reject(error);
      }

      if (isRefreshing) {
        // If already refreshing, queue this request
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return backendApi(originalRequest);
        }).catch(err => {
          return Promise.reject(err);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const newToken = await refreshAuthToken();
        processQueue(null, newToken);
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return backendApi(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        // Show session expired message
        try {
          const toastManager = getToastManager();
          toastManager.showError('Your session has expired. Please log in again.');
        } catch (e) {
          // Toast not initialized
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // Check if this is an expected error that should NOT show a toast
    const isExpectedError = (
      // Expected 404s: no locks, TTLock not connected
      (status === 404 && (
        (url.includes('/locks') && !url.includes('/locks/')) ||
        url.includes('/ttlock/status')
      )) ||
      // Expected 401s: TTLock not connected, AI features not configured, etc.
      (status === 401 && (
        url.includes('/ttlock/status') ||
        url.includes('/ai/risk-scores') ||
        url.includes('/ai/insights') ||
        url.includes('/ai/chat')
      ))
    );

    // Only log unexpected errors (use console.warn instead of console.error to avoid LogBox)
    if (!isExpectedError) {
      const errorData = error.response?.data;
      const errorMessage = errorData?.error?.message || errorData?.message || error.message;
      const errorDetails = errorData?.error?.details || errorData?.details;
      
      console.warn('Backend API Error:', {
        url: url,
        message: errorMessage,
        status: status,
        errorCode: errorData?.error?.code,
        details: errorDetails,
        fullError: errorData
      });
    }

    // Show toast notification ONLY for unexpected errors
    if (!isExpectedError) {
      const errorMessage = getErrorMessage(error);
      if (errorMessage) {
        try {
          const toastManager = getToastManager();
          toastManager.showError(errorMessage);
        } catch (e) {
          // Toast not initialized yet - silently ignore
        }
      }
    }

    return Promise.reject(error);
  }
);

// Authentication using Supabase
export const login = async (email, password) => {
  console.log('🔵 Starting login for:', email);

  try {
    const response = await backendApi.post('/auth/login', {
      email: email,
      password: password
    });

    const { token, refresh_token, user } = response.data.data;

    console.log('✅ Login successful:', user?.email);

    // Store auth data
    await AsyncStorage.setItem('authToken', token);
    await AsyncStorage.setItem('user', JSON.stringify(user));
    if (refresh_token) {
      await AsyncStorage.setItem('refreshToken', refresh_token);
    }

    return {
      data: {
        token,
        user,
        refresh_token
      }
    };
  } catch (err) {
    console.warn('🔴 Login error:', err.response?.data || err.message);
    const errorMessage = err.response?.data?.error?.message || 'Login failed. Please check your email and password.';
    throw { response: { data: { error: { message: errorMessage } } } };
  }
};

// Validate current auth token
export const validateAuthToken = async () => {
  try {
    console.log('🔍 Validating auth token...');
    const token = await AsyncStorage.getItem('authToken');

    if (!token) {
      console.log('❌ No token found in storage');
      return false;
    }

    // Make a simple authenticated request to verify token
    const response = await backendApi.get('/auth/verify');

    if (response.status === 200) {
      console.log('✅ Token is valid');
      return true;
    }

    console.log('❌ Token validation failed');
    return false;
  } catch (error) {
    // 401 means token is invalid/expired - this is an AUTH error
    if (error.response?.status === 401) {
      console.log('❌ Token expired or invalid (401)');
      return false;
    }

    // Check if this is a network error (no response = network issue)
    const isNetworkError = !error.response ||
      error.code === 'ERR_NETWORK' ||
      error.code === 'ECONNABORTED' ||
      error.message?.includes('Network Error') ||
      error.message?.includes('timeout');

    if (isNetworkError) {
      // THROW network errors so RoleContext can handle them differently
      // This allows the app to use cached credentials when server is temporarily down
      console.warn('🔄 Network error during token validation - will throw for RoleContext to handle');
      throw error;
    }

    // Other errors (500, etc.) - return false to require re-login
    console.warn('❌ Token validation error:', error.message);
    return false;
  }
};

// Registration with Supabase: email + password + first_name + last_name
export const signUp = async (userData) => {
  const { email, password, first_name, last_name, phone } = userData;

  console.log('🔵 Starting registration for:', email);

  try {
    const response = await backendApi.post('/auth/signup', {
      email: email,
      password: password,
      first_name: first_name,
      last_name: last_name,
      phone: phone || ''
    });

    const { token, refresh_token, user } = response.data.data;

    console.log('✅ Registration successful:', user?.email);

    // Store auth data
    await AsyncStorage.setItem('authToken', token);
    await AsyncStorage.setItem('user', JSON.stringify(user));
    if (refresh_token) {
      await AsyncStorage.setItem('refreshToken', refresh_token);
    }

    return {
      data: {
        token,
        user,
        refresh_token
      }
    };
  } catch (err) {
    console.warn('🔴 Registration error:', err.response?.data || err.message);
    const errorMessage = err.response?.data?.error?.message || 'Registration failed. Please try again.';
    throw { response: { data: { error: { message: errorMessage } } } };
  }
};

// Complete user profile after TTLock login
export const completeProfile = async (profileData) => {
  const { first_name, last_name, phone } = profileData;

  console.log('📝 Completing user profile...');

  try {
    const response = await backendApi.post('/auth/complete-profile', {
      first_name,
      last_name,
      phone
    });

    const { user } = response.data.data;

    // Update stored user data
    const currentUser = JSON.parse(await AsyncStorage.getItem('user') || '{}');
    const updatedUser = { ...currentUser, ...user };
    await AsyncStorage.setItem('user', JSON.stringify(updatedUser));

    console.log('✅ Profile completed successfully');

    return { data: { user: updatedUser } };
  } catch (err) {
    console.warn('🔴 Profile completion error:', err.response?.data || err.message);
    const errorMessage = err.response?.data?.error?.message || 'Failed to complete profile. Please try again.';
    throw { response: { data: { error: { message: errorMessage } } } };
  }
};

export const logout = async () => {
  console.log('🔓 Logging out...');

  // Clear TTLock cloud service tokens
  const TTLockCloudService = require('./ttlockCloudService').default;
  await TTLockCloudService.logout();

  // Clear all stored auth data
  await AsyncStorage.removeItem('authToken');
  await AsyncStorage.removeItem('user');
  await AsyncStorage.removeItem('userRole');
  await AsyncStorage.removeItem('ttlockUserId');
  await AsyncStorage.removeItem('ttlockEmail');
  await AsyncStorage.removeItem('ttlock_access_token');
  await AsyncStorage.removeItem('ttlock_refresh_token');

  console.log('✅ Logged out successfully');
};

// Connect TTLock account to existing Supabase user
export const connectTTLockAccount = async (credentials) => {
  console.log('🔗 Connecting TTLock account...');

  try {
    const response = await backendApi.post('/auth/connect-ttlock', {
      username: credentials.username,
      password: credentials.password
    });

    console.log('✅ TTLock account connected successfully');

    // Store TTLock tokens
    if (response.data.data.ttlock_access_token) {
      await AsyncStorage.setItem('ttlock_access_token', response.data.data.ttlock_access_token);
    }
    if (response.data.data.ttlock_refresh_token) {
      await AsyncStorage.setItem('ttlock_refresh_token', response.data.data.ttlock_refresh_token);
    }
    if (response.data.data.ttlock_user_id) {
      await AsyncStorage.setItem('ttlockUserId', response.data.data.ttlock_user_id.toString());
    }

    return response;
  } catch (err) {
    console.warn('🔴 TTLock connection error:', err.response?.data || err.message);
    const errorMessage = err.response?.data?.error?.message || 'Failed to connect TTLock account. Please check your credentials.';
    throw { response: { data: { error: { message: errorMessage } } } };
  }
};

// Get locks from TTLock Cloud API
export const getTTLockLocks = async () => {
  console.log('📋 Fetching locks from TTLock Cloud');

  try {
    const TTLockCloudService = require('./ttlockCloudService').default;
    const locks = await TTLockCloudService.getLockList();

    console.log('✅ Found', locks.length, 'locks from TTLock Cloud');
    return {
      data: locks
    };
  } catch (err) {
    console.warn('🔴 Failed to get TTLock locks:', err.message);
    const errorMessage = err.message?.includes('not connected')
      ? 'TTLock account not connected. Please connect your account first.'
      : 'Failed to fetch locks. Please try again.';
    throw { response: { data: { error: { message: errorMessage } } } };
  }
};

// Locks
export const getLocks = () => {
  console.log('🔍 Fetching locks from backend API...');
  return backendApi.get('/locks');
};

export const getLockById = (lockId) => {
  console.log('🔍 Fetching lock details from backend API:', lockId);
  return backendApi.get(`/locks/${lockId}`);
};

export const updateLockStatus = (lockId, isLocked) => {
  console.log('🔄 Updating lock status via backend API:', lockId);
  return backendApi.patch(`/locks/${lockId}`, { isLocked });
};

export const getLockStatus = (lockId) => {
  return backendApi.get(`/locks/${lockId}/status`);
};

export const getBatteryLevel = (lockId) => {
  return backendApi.get(`/locks/${lockId}/battery`);
};

// Fetch battery level from TTLock Cloud API (more accurate)
export const getBatteryFromTTLock = async (lockId, ttlockLockId) => {
  try {
    if (!ttlockLockId) {
      console.log('No TTLock ID - using cached battery level');
      return null;
    }

    console.log('🔋 Fetching battery from TTLock Cloud API...');
    const response = await backendApi.get(`/ttlock-v3/lock/detail`, {
      params: { lockId: ttlockLockId }
    });

    const batteryLevel = response.data?.data?.electricQuantity;
    if (batteryLevel !== undefined) {
      console.log(`✅ Battery level from TTLock: ${batteryLevel}%`);

      // Update battery in database for consistency
      try {
        await backendApi.patch(`/locks/${lockId}`, { battery_level: batteryLevel });
      } catch (dbErr) {
        console.warn('⚠️ Failed to update battery in DB:', dbErr.message);
      }

      return batteryLevel;
    }

    return null;
  } catch (error) {
    console.warn('⚠️ Failed to fetch battery from TTLock:', error.message);
    return null;
  }
};

export const lockDoor = (lockId, accessMethod = 'remote', location = null) => {
  return backendApi.post(`/locks/${lockId}/lock`, { access_method: accessMethod, location });
};

export const unlockDoor = (lockId, accessMethod = 'remote', location = null) => {
  return backendApi.post(`/locks/${lockId}/unlock`, { access_method: accessMethod, location });
};

// Activity
export const getRecentActivity = () => {
  return backendApi.get('/activity/recent');
};

export const logLockActivity = (lockId, action, accessMethod = 'bluetooth', metadata = null) => {
  return backendApi.post(`/locks/${lockId}/activity`, {
    action,
    access_method: accessMethod,
    metadata
  });
};

export const getAllActivity = (filters = {}) => {
  // Use the /activity/all endpoint with filtering support
  const params = {
    limit: filters.limit || 50,
    offset: filters.offset || 0,
  };

  // Add optional filters
  if (filters.action && filters.action !== 'all') {
    params.action = filters.action;
  }
  if (filters.access_method && filters.access_method !== 'all') {
    params.access_method = filters.access_method;
  }
  if (filters.user_id) {
    params.user_id = filters.user_id;
  }
  if (filters.start_date) {
    params.start_date = filters.start_date;
  }
  if (filters.end_date) {
    params.end_date = filters.end_date;
  }
  if (filters.sort_by) {
    params.sort_by = filters.sort_by;
  }
  if (filters.sort_order) {
    params.sort_order = filters.sort_order;
  }

  return backendApi.get('/activity/all', { params });
};

export const getActivityByLockId = async (lockId, options = {}) => {
  // Use the same /activity/recent endpoint that works
  // Then filter client-side for the specific lock
  const params = { limit: options.limit || 100 };
  const response = await backendApi.get('/activity/recent', { params });

  // Filter activities for the specific lock
  const data = response?.data?.data ?? response?.data ?? [];
  const filteredData = Array.isArray(data)
    ? data.filter(activity => activity.lock_id === lockId)
    : [];

  return {
    ...response,
    data: {
      success: true,
      data: filteredData
    }
  };
};

// User Management
export const getUsersForLock = (lockId) => {
  // Use backend API for user management (requires authentication and lock access)
  return backendApi.get(`/locks/${lockId}/users`);
};

export const getAllUsers = () => {
  // Get all users from lock users - use backend API
  return backendApi.get('/locks');  // Will need to aggregate users from locks
};

// New: Get all users across all locks the current user manages
export const getAllUsersForAllLocks = (filters = {}) => {
  const params = {};
  if (filters.role) params.role = filters.role;
  if (filters.lock_id) params.lock_id = filters.lock_id;
  return backendApi.get('/locks/users/all', { params });
};

// Legacy: Add user to single lock
export const addUserToLock = (lockId, userData) => {
  return backendApi.post(`/locks/${lockId}/users`, userData);
};

// New: Add user to multiple locks at once
export const addUserToMultipleLocks = (userData) => {
  // userData: { email, lock_ids: [...], role, notes }
  return backendApi.post('/locks/users/add', userData);
};

export const updateUserAccess = (lockId, userId, accessData) => {
  return backendApi.patch(`/locks/${lockId}/users/${userId}`, accessData);
};

// Legacy: Remove user from single lock
export const removeUserFromLock = (lockId, userId) => {
  return backendApi.delete(`/locks/${lockId}/users/${userId}`);
};

// New: Remove user from multiple locks (selective removal)
export const removeUserFromMultipleLocks = (userId, lockIds) => {
  return backendApi.delete(`/locks/users/${userId}/locks`, {
    data: { lock_ids: lockIds }
  });
};

// Lock Settings
export const getLockSettings = (lockId) => {
  // Use backend API for settings (requires authentication and lock access)
  return backendApi.get(`/locks/${lockId}/settings`);
};

export const updateLockSettings = (lockId, settings) => {
  // Use backend API for settings (requires authentication and modify_settings permission)
  return backendApi.patch(`/locks/${lockId}/settings`, settings);
};

// Update Remote Unlock setting - Lock level (affects all users)
// This controls whether remote unlock via gateway is allowed for this lock
export const updateRemoteUnlockSetting = (lockId, enabled) => {
  return backendApi.patch(`/locks/${lockId}/remote-unlock`, { enabled });
};

export const deleteLock = (lockId) => {
  console.log('🗑️ Deleting lock via backend API:', lockId);
  return backendApi.delete(`/locks/${lockId}`);
};

// Recovery Keys - TTLock emergency passcodes (owner only)
export const getRecoveryKeys = (lockId) => {
  console.log('🔑 Getting recovery keys for lock:', lockId);
  return backendApi.get(`/locks/${lockId}/recovery-keys`);
};

// Add Lock - uses backend API for proper TTLock field handling
export const addLock = (lockData) => {
  return backendApi.post('/locks', lockData);
};

export const updateLock = (lockId, lockData) => {
  return backendApi.patch(`/locks/${lockId}`, lockData);
};

// Pair Lock (Bluetooth)
export const pairLock = (lockId) => {
  return api.post(`/locks/${lockId}/pair`);
};

// Notifications
export const getNotifications = () => {
  return api.get('/notifications');
};

// Live View
export const getSnapshots = (lockId) => {
  return api.get(`/locks/${lockId}/snapshots`);
};

// Access Codes (Backend API)
export const getAccessCodes = (lockId) => {
  return backendApi.get(`/locks/${lockId}/access-codes`);
};

export const createAccessCode = (lockId, codeData) => {
  return backendApi.post(`/locks/${lockId}/access-codes`, codeData);
};

export const deleteAccessCode = (lockId, codeId) => {
  return backendApi.delete(`/locks/${lockId}/access-codes/${codeId}`);
};

export const verifyAccessCode = (lockId, code) => {
  return backendApi.post(`/locks/${lockId}/access-codes/verify`, { code });
};

// Guest Access Codes (Legacy - kept for backwards compatibility)
export const generateGuestCode = (lockId) => {
  return api.post(`/locks/${lockId}/guest-codes`);
};

export const getGuestCodes = (lockId) => {
  return api.get(`/locks/${lockId}/guest-codes`);
};

export const revokeGuestCode = (lockId, codeId) => {
  return api.delete(`/locks/${lockId}/guest-codes/${codeId}`);
};

// TTLock Cloud Passcodes (requires gateway connection)
// Types: 'one_time' (6hr validity, single use), 'permanent', 'timed'
export const createCloudPasscode = (lockId, passcodeData) => {
  return backendApi.post(`/ttlock/lock/${lockId}/passcodes`, passcodeData);
};

export const getCloudPasscodes = (lockId) => {
  return backendApi.get(`/ttlock/lock/${lockId}/passcodes`);
};

export const deleteCloudPasscode = (lockId, passcodeId) => {
  return backendApi.delete(`/ttlock/lock/${lockId}/passcodes/${passcodeId}`);
};

// Insights - Note: This endpoint doesn't exist in backend, returning empty for now
// TODO: If usage insights are needed, create a backend endpoint
export const getUsageInsights = () => {
  // Return a resolved promise with empty data to avoid 404 errors
  // The actual insights should come from getActivityInsights endpoint
  return Promise.resolve({ data: [] });
};

// Authentication - Additional endpoints
export const forgotPassword = (email) => {
  return backendApi.post('/auth/forgot-password', { email });
};

export const resetPassword = (token, password) => {
  return backendApi.post('/auth/reset-password', { token, password });
};

export const verifyEmail = (token) => {
  return backendApi.post('/auth/verify-email', { token });
};

export const updateProfile = (profileData) => {
  return backendApi.patch('/auth/profile', profileData);
};

export const deleteAccount = () => {
  return backendApi.delete('/auth/account');
};

// Lock Settings - Specific toggles
export const toggleAutoLock = (lockId, enabled, delay, options = {}) => {
  return backendApi.post(`/locks/${lockId}/settings/auto-lock`, { enabled, delay, ...options });
};

export const togglePassageMode = (lockId, enabled, options = {}) => {
  return backendApi.post(`/locks/${lockId}/settings/passage-mode`, { enabled, ...options });
};

export const updateSoundSettings = (lockId, soundSettings) => {
  return backendApi.post(`/locks/${lockId}/settings/sound`, soundSettings);
};

export const updateLedSettings = (lockId, ledSettings) => {
  return backendApi.post(`/locks/${lockId}/settings/led`, ledSettings);
};

export const updateSecuritySettings = (lockId, securitySettings) => {
  return backendApi.post(`/locks/${lockId}/settings/security`, securitySettings);
};

export const toggleOneTouchLocking = (lockId, enabled) => {
  return backendApi.post(`/locks/${lockId}/settings/one-touch`, { enabled });
};

export const getFirmwareInfo = (lockId) => {
  return backendApi.get(`/locks/${lockId}/firmware`);
};

export const updateFirmware = (lockId) => {
  return backendApi.post(`/locks/${lockId}/firmware/update`);
};

// User Management - Access Methods
export const getUserAccessMethods = (lockId, userId) => {
  return backendApi.get(`/locks/${lockId}/users/${userId}/access-methods`);
};

export const addAccessMethod = (lockId, userId, methodData) => {
  return backendApi.post(`/locks/${lockId}/users/${userId}/access-methods`, methodData);
};

export const updateAccessMethod = (lockId, userId, methodId, methodData) => {
  return backendApi.patch(`/locks/${lockId}/users/${userId}/access-methods/${methodId}`, methodData);
};

export const deleteAccessMethod = (lockId, userId, methodId) => {
  return backendApi.delete(`/locks/${lockId}/users/${userId}/access-methods/${methodId}`);
};

export const transferLockOwnership = (lockId, newOwnerId) => {
  return backendApi.post(`/locks/${lockId}/transfer`, { new_owner_id: newOwnerId });
};

// Activity - Additional endpoints
export const getActivityStats = (lockId) => {
  return backendApi.get(`/locks/${lockId}/activity/stats`);
};

export const exportActivityLogs = (lockId, format = 'csv') => {
  return backendApi.get(`/locks/${lockId}/activity/export`, {
    params: { format },
    responseType: 'blob'
  });
};

export const getFailedAttempts = (lockId) => {
  return backendApi.get(`/locks/${lockId}/failed-attempts`);
};

export const getUserActivityHistory = (userId) => {
  return backendApi.get(`/locks/users/${userId}/activity`);
};

// Guest Access - Invites
export const createInvite = (lockId, inviteData) => {
  return backendApi.post(`/locks/${lockId}/invites`, inviteData);
};

export const getLockInvites = (lockId) => {
  return backendApi.get(`/locks/${lockId}/invites`);
};

export const revokeInvite = (inviteId) => {
  return backendApi.delete(`/locks/invites/${inviteId}`);
};

export const acceptInvite = (inviteCode) => {
  return backendApi.post(`/locks/invites/${inviteCode}/accept`);
};

// Guest Access - OTP
export const generateOTP = (lockId, otpData) => {
  return backendApi.post(`/locks/${lockId}/otp`, otpData);
};

export const verifyOTP = (lockId, code) => {
  return backendApi.post(`/locks/${lockId}/otp/verify`, { code });
};

export const getGuestAccessHistory = (lockId) => {
  return backendApi.get(`/locks/${lockId}/guest-access`);
};

export const revokeGuestAccess = (accessId) => {
  return backendApi.delete(`/locks/guest-access/${accessId}`);
};

// Access Codes - Update
export const updateAccessCode = (lockId, codeId, codeData) => {
  return backendApi.patch(`/locks/${lockId}/access-codes/${codeId}`, codeData);
};

// Notifications - Management
export const markNotificationAsRead = (notificationId) => {
  return backendApi.patch(`/notifications/${notificationId}/read`);
};

export const markAllNotificationsAsRead = () => {
  return backendApi.post('/notifications/read-all');
};

export const deleteNotification = (notificationId) => {
  return backendApi.delete(`/notifications/${notificationId}`);
};

export const getNotificationPreferences = () => {
  return backendApi.get('/notifications/preferences');
};

export const updateNotificationPreferences = (preferences) => {
  return backendApi.patch('/notifications/preferences', preferences);
};

// Emergency
export const emergencyUnlock = (lockId, reason) => {
  return backendApi.post(`/${lockId}/emergency/unlock`, { reason });
};

export const sendEmergencyAlert = (lockId, alertData) => {
  return backendApi.post(`/${lockId}/emergency/alert`, alertData);
};

export const getTrustedContacts = () => {
  return backendApi.get('/trusted-contacts');
};

export const addTrustedContact = (contactData) => {
  return backendApi.post('/trusted-contacts', contactData);
};

export const updateTrustedContact = (contactId, contactData) => {
  return backendApi.patch(`/trusted-contacts/${contactId}`, contactData);
};

export const deleteTrustedContact = (contactId) => {
  return backendApi.delete(`/trusted-contacts/${contactId}`);
};

// TTLock Integration - Additional
export const getTTLockStatus = () => {
  return backendApi.get('/ttlock/status');
};

export const getTTLockToken = () => {
  return backendApi.get('/ttlock/token');
};

// NOTE: disconnectTTLockAccount removed - Since TTLock IS the auth method,
// users logout entirely instead of disconnecting TTLock separately

export const importTTLockLocks = () => {
  return backendApi.post('/ttlock/import-locks');
};

export const syncTTLockBluetoothData = () => {
  return backendApi.post('/ttlock/sync-lock-data');
};

export const initializeTTLock = (lockData, lockAlias) => {
  return backendApi.post('/ttlock-v3/lock/initialize', {
    lockData,
    lockAlias,
  });
};

// Security Dashboard
export const getSecurityDashboard = () => {
  return backendApi.get('/security/dashboard');
};

export const acknowledgeSecurityAlert = (alertId) => {
  return backendApi.post(`/security/alerts/${alertId}/acknowledge`);
};

// TTLock V3 - Lock Configuration
// Setting types for updateLockConfig:
// - doorSensorLocking: 1=enabled, 0=disabled
// - doubleLock: 1=enabled, 0=disabled
// - antiPeepPassword: 1=enabled, 0=disabled (allows random digits before/after real passcode)
// - privacyLock: 1=enabled, 0=disabled
export const updateLockConfig = (ttlockLockId, settingType, settingValue) => {
  return backendApi.post('/ttlock-v3/lock/config', {
    lockId: ttlockLockId,
    settingType,
    settingValue
  });
};

// Sync lock time with server via gateway
export const syncLockTime = (ttlockLockId) => {
  return backendApi.post('/ttlock-v3/lock/time', {
    lockId: ttlockLockId
  });
};

// Factory reset lock via gateway (TTLock API only)
export const factoryResetLock = (ttlockLockId) => {
  return backendApi.post('/ttlock-v3/lock/reset', {
    lockId: ttlockLockId
  });
};

// Factory reset lock - clears all data (TTLock Cloud + Database) but keeps lock
// Use this after Bluetooth SDK factory reset completes
export const factoryResetLockComplete = (lockId) => {
  console.log('🔄 Factory reset complete API call for lock:', lockId);
  return backendApi.post(`/locks/${lockId}/factory-reset`);
};

// Check for firmware updates
export const checkFirmwareUpdate = (accessToken, ttlockLockId) => {
  return backendApi.post('/ttlock-v3/lock/upgrade-check', {
    accessToken,
    lockId: ttlockLockId
  });
};

// Recheck firmware update with lockData from SDK
export const recheckFirmwareUpdate = (accessToken, ttlockLockId, lockData) => {
  return backendApi.post('/ttlock-v3/lock/upgrade-recheck', {
    accessToken,
    lockId: ttlockLockId,
    lockData
  });
};

// ==========================================
// AI Features API
// ==========================================

// Get AI status and configuration
export const getAIStatus = () => {
  return backendApi.get('/ai/status');
};

// Natural Language Activity Logs
export const getNaturalLanguageActivity = (lockId, limit = 20, offset = 0) => {
  return backendApi.get(`/ai/locks/${lockId}/activity/natural`, {
    params: { limit, offset }
  });
};

// Daily Summary
export const getDailySummary = (lockId, date = null) => {
  return backendApi.get(`/ai/locks/${lockId}/summary/daily`, {
    params: date ? { date } : {}
  });
};

// AI Insights
export const getAIInsights = (lockId, options = {}) => {
  const { type, severity, limit = 20, include_dismissed = false } = options;
  return backendApi.get(`/ai/locks/${lockId}/insights`, {
    params: { type, severity, limit, include_dismissed }
  });
};

export const markInsightRead = (insightId) => {
  return backendApi.post(`/ai/insights/${insightId}/read`);
};

export const dismissInsight = (insightId) => {
  return backendApi.post(`/ai/insights/${insightId}/dismiss`);
};

// Risk Scores
export const getRiskScore = (lockId) => {
  return backendApi.get(`/ai/locks/${lockId}/risk-score`);
};

export const getAllRiskScores = () => {
  return backendApi.get('/ai/risk-scores');
};

// Chat Assistant
export const sendChatMessage = (message, lockId, conversationId = null) => {
  return backendApi.post('/ai/chat', {
    message,
    lockId,
    conversationId
  });
};

export const getChatConversations = (lockId = null, limit = 20) => {
  return backendApi.get('/ai/chat/conversations', {
    params: { lockId, limit }
  });
};

export const getChatConversation = (conversationId) => {
  return backendApi.get(`/ai/chat/conversations/${conversationId}`);
};

export const archiveChatConversation = (conversationId) => {
  return backendApi.delete(`/ai/chat/conversations/${conversationId}`);
};

export const getChatSuggestions = (lockId) => {
  return backendApi.get(`/ai/chat/suggestions/${lockId}`);
};

// ==========================================
// Access Recommendations
// ==========================================

export const getAccessRecommendations = (lockId) => {
  return backendApi.get(`/ai/locks/${lockId}/recommendations`);
};

export const getAIAccessSuggestion = (lockId, userId) => {
  return backendApi.get(`/ai/locks/${lockId}/users/${userId}/suggestion`);
};

export const recordRecommendationAction = (data) => {
  return backendApi.post('/ai/recommendations/action', data);
};

// ==========================================
// Predictive Battery Alerts
// ==========================================

export const getBatteryPrediction = (lockId) => {
  return backendApi.get(`/ai/locks/${lockId}/battery/prediction`);
};

export const getBatteryHistory = (lockId, days = 30) => {
  return backendApi.get(`/ai/locks/${lockId}/battery/history`, {
    params: { days }
  });
};

// ==========================================
// Fraud/Security Detection
// ==========================================

export const getSecurityAlerts = (lockId, days = 7) => {
  return backendApi.get(`/ai/locks/${lockId}/security/alerts`, {
    params: { days }
  });
};

export const getSecuritySummary = (lockId) => {
  return backendApi.get(`/ai/locks/${lockId}/security/summary`);
};

// ==========================================
// Auto Rules Engine
// ==========================================

export const getRuleSuggestions = (lockId) => {
  return backendApi.get(`/ai/locks/${lockId}/rules/suggestions`);
};

export const getActiveRules = (lockId) => {
  return backendApi.get(`/ai/locks/${lockId}/rules`);
};

export const createRule = (lockId, suggestion) => {
  return backendApi.post(`/ai/locks/${lockId}/rules`, { suggestion });
};

export const toggleRule = (ruleId, isActive) => {
  return backendApi.patch(`/ai/rules/${ruleId}`, { is_active: isActive });
};

export const deleteRule = (ruleId) => {
  return backendApi.delete(`/ai/rules/${ruleId}`);
};

// ==========================================
// Smart Scheduling / Home Mode
// ==========================================

export const getHomeMode = () => {
  return backendApi.get('/ai/mode');
};

export const setHomeMode = (mode, options = {}) => {
  return backendApi.post('/ai/mode', { mode, options });
};

export const enableVacationMode = (options = {}) => {
  return backendApi.post('/ai/vacation', options);
};

export const disableVacationMode = () => {
  return backendApi.delete('/ai/vacation');
};

export const getScheduleSuggestions = () => {
  return backendApi.get('/ai/schedule/suggestions');
};

export const activateSchedule = (schedule) => {
  return backendApi.post('/ai/schedule/activate', { schedule });
};

export const setAutoPilot = (enabled) => {
  return backendApi.patch('/ai/settings/auto-pilot', { enabled });
};

export const saveHomeLocation = (location) => {
  return backendApi.post('/ai/settings/location', location);
};

export const getHomeLocation = () => {
  return backendApi.get('/ai/settings/location');
};

export const getUserAISettings = () => {
  return backendApi.get('/ai/settings');
};

export const dismissRuleSuggestion = (lockId, suggestion) => {
  return backendApi.post(`/ai/locks/${lockId}/rules/dismiss`, { suggestion });
};

// ==========================================
// eKey Management (New API - uses stored TTLock tokens)
// ==========================================

// Check TTLock connection status for eKey operations
export const getEkeyTTLockStatus = () => {
  return backendApi.get('/ekeys/status');
};

// Send eKey to a user (auto-uses stored TTLock token)
export const sendEkey = (lockId, data) => {
  return backendApi.post(`/locks/${lockId}/ekeys`, data);
};

// Get list of eKeys for a lock (auto-uses stored TTLock token)
export const getEkeyList = (lockId, params = {}) => {
  return backendApi.get(`/locks/${lockId}/ekeys`, { params });
};

// Delete an eKey
export const deleteEkey = (keyId) => {
  return backendApi.delete(`/ekeys/${keyId}`);
};

// Freeze (disable) an eKey
export const freezeEkey = (keyId) => {
  return backendApi.post(`/ekeys/${keyId}/freeze`);
};

// Unfreeze (re-enable) an eKey
export const unfreezeEkey = (keyId) => {
  return backendApi.post(`/ekeys/${keyId}/unfreeze`);
};

// ==========================================
// Legacy eKey API (TTLock v3 - requires accessToken in body)
// ==========================================

// Legacy: Get a specific eKey for a lock (requires accessToken)
export const getEkey = (data) => {
  return backendApi.post('/ttlock-v3/ekey/get', data);
};

// Legacy: Change eKey validity period (requires accessToken)
export const changeEkeyPeriod = (data) => {
  return backendApi.post('/ttlock-v3/ekey/change-period', data);
};

// Legacy: Authorize an eKey (grant admin rights)
export const authorizeEkey = (data) => {
  return backendApi.post('/ttlock-v3/ekey/authorize', data);
};

// Legacy: Unauthorize an eKey (revoke admin rights)
export const unauthorizeEkey = (data) => {
  return backendApi.post('/ttlock-v3/ekey/unauthorize', data);
};

// ==========================================
// Passcode Management (Local Database)
// ==========================================

// Save a passcode created via Bluetooth to database
export const savePasscode = (lockId, data) => {
  return backendApi.post(`/locks/${lockId}/passcodes`, data);
};

// Get all passcodes for a lock
export const getPasscodes = (lockId, params = {}) => {
  return backendApi.get(`/locks/${lockId}/passcodes`, { params });
};

// Delete a passcode
export const deletePasscodeFromDb = (lockId, passcodeId) => {
  return backendApi.delete(`/locks/${lockId}/passcodes/${passcodeId}`);
};

// Export both API clients
export { backendApi };
export default api;


