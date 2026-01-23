import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { validateAuthToken } from '../services/api';

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
      // Check if user has auth token
      const token = await AsyncStorage.getItem('authToken');
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
      await AsyncStorage.multiRemove(['authToken', 'refreshToken', 'user', 'userRole']);
      setRole(null);
    } catch (error) {
      console.error('Error during logout:', error);
      setRole(null);
    }
  };

  const inferRole = (context) => {
    switch (context.type) {
      case 'lock_added':
        // User completed "Add Lock" wizard -> Owner
        setRole('owner');
        break;
      case 'invite_accepted':
        // User entered invite code -> Resident/Guest based on invite scope
        setRole(context.inviteScope === 'limited' ? 'guest' : 'family');
        break;
      default:
        setRole('auth');
    }
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
