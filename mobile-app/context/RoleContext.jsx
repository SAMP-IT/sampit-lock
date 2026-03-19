import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearLockDataCache } from '../screens/LockDetailScreen';
import secureStorage from '../services/secureStorage';
import { validateAuthToken } from '../services/api';
import { clearQueryCacheOnLogout } from '../utils/queryClient';

const RoleContext = createContext({
  role: null,
  setRole: () => {},
  inferRole: () => {},
  switchRole: () => {},
  isSimpleMode: false,
  toggleSimpleMode: () => {},
  isAuthenticating: true,
  logout: () => {},
});

export const RoleProvider = ({ children }) => {
  // Start with null role - user must authenticate first
  const [role, setRole] = useState(null);
  const [isSimpleMode, setIsSimpleMode] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(true);

  // Check authentication status on mount
  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    console.log('🔐 RoleContext: Starting authentication check...');
    setIsAuthenticating(true);

    try {
      // Check if user has auth token (token is in secure storage)
      const token = await secureStorage.getItem('authToken');
      const user = await AsyncStorage.getItem('user');

      if (!token || !user) {
        // No token or user - user must log in
        console.log('❌ RoleContext: No auth token or user data found - user must login');
        setRole(null);
        setIsAuthenticating(false);
        return;
      }

      console.log('🔑 RoleContext: Token found, validating with backend...');

      // Validate token with backend to ensure it's still valid
      try {
        const isValid = await validateAuthToken();

        if (!isValid) {
          console.log('❌ RoleContext: Token validation failed - token expired or invalid');
          // Token is invalid/expired - clear auth data and force login
          await logout();
          setIsAuthenticating(false);
          return;
        }

        console.log('✅ RoleContext: Token is valid');
      } catch (validationError) {
        console.error('❌ RoleContext: Token validation error:', validationError.message);

        // Check if this is a genuine network error vs an auth/config error
        // Only treat as network error if:
        // 1. No response AND it's a known network error code/message
        // 2. NOT a configuration or code error (like missing variables)
        const errorMessage = validationError.message || '';
        const isConfigError = errorMessage.includes("doesn't exist") ||
          errorMessage.includes('undefined') ||
          errorMessage.includes('is not defined');

        const isNetworkError = !isConfigError && (
          validationError.code === 'ERR_NETWORK' ||
          validationError.code === 'ECONNABORTED' ||
          errorMessage.includes('Network Error') ||
          errorMessage.includes('timeout') ||
          errorMessage.includes('ECONNREFUSED') ||
          errorMessage.includes('ENOTFOUND')
        );

        if (isNetworkError) {
          // Network error - don't log out, just continue with cached credentials
          // This prevents unnecessary logouts when the server is temporarily unavailable
          console.log('⚠️ RoleContext: Network error during validation - using cached credentials');
          // Continue to use the cached role
          const userRole = await AsyncStorage.getItem('userRole');
          const finalRole = userRole || 'owner';
          console.log('✅ RoleContext: Using cached role:', finalRole);
          setRole(finalRole);
          setIsAuthenticating(false);
          return;
        }

        // Auth error (401, etc.) or config error - clear auth and force login
        console.log('❌ RoleContext: Auth/config error - forcing logout');
        await logout();
        setIsAuthenticating(false);
        return;
      }

      // User is authenticated
      const userData = JSON.parse(user);

      // Check if profile is complete
      if (userData.profile_completed === false) {
        console.log('⚠️ RoleContext: User needs to complete profile');
        setRole('auth');
        setIsAuthenticating(false);
        return;
      }

      // Get user role from AsyncStorage
      const userRole = await AsyncStorage.getItem('userRole');
      const finalRole = userRole || 'owner';

      console.log('✅ RoleContext: User authenticated successfully, role:', finalRole);
      setRole(finalRole);
      setIsAuthenticating(false);
    } catch (error) {
      console.error('❌ RoleContext: Auth check error:', error);
      // On any error, force logout to be safe
      await logout();
      setIsAuthenticating(false);
    }
  };

  const logout = async () => {
    console.log('🚪 RoleContext: Logging out - clearing all auth data');
    try {
      // Clear React Query cache so stale data from previous user doesn't cause permission errors for new user
      clearQueryCacheOnLogout();
      // Clear tokens from secure storage, user data from AsyncStorage
      await secureStorage.multiRemove(['authToken', 'refreshToken', 'ttlock_access_token', 'ttlock_refresh_token']);
      await AsyncStorage.multiRemove(['user', 'userRole']);
      // Clear lock data cache so stale data doesn't persist across account switches
      clearLockDataCache();
      setRole(null);
    } catch (error) {
      console.error('Error during logout:', error);
      clearQueryCacheOnLogout();
      clearLockDataCache();
      setRole(null);
    }
  };

  const inferRole = async (context) => {
    let newRole = 'auth';

    switch (context.type) {
      case 'lock_added':
        // User completed "Add Lock" wizard -> Owner
        newRole = 'owner';
        break;
      case 'invite_accepted':
        // Use the actual DB role from the invite (owner, admin, family, scheduled, guest_otp, guest_longterm)
        // Falls back to mapping by scope for backwards compatibility
        if (context.role) {
          newRole = context.role;
        } else if (context.inviteScope === 'limited') {
          newRole = 'guest';
        } else {
          newRole = 'family';
        }
        break;
      default:
        newRole = 'auth';
    }

    // Persist to AsyncStorage so it survives app restarts
    if (newRole && newRole !== 'auth') {
      await AsyncStorage.setItem('userRole', newRole);
    }
    setRole(newRole);
  };

  const toggleSimpleMode = () => {
    setIsSimpleMode(!isSimpleMode);
  };

  // Quick role switcher for exploration
  const switchRole = (newRole) => {
    setRole(newRole);
  };

  return (
    <RoleContext.Provider value={{
      role,
      setRole,
      inferRole,
      switchRole,
      isSimpleMode,
      toggleSimpleMode,
      isAuthenticating,
      logout
    }}>
      {children}
    </RoleContext.Provider>
  );
};

export const useRole = () => useContext(RoleContext);
