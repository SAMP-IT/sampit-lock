import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DevModeContext = createContext();

export const useDevMode = () => {
  const context = useContext(DevModeContext);
  if (!context) {
    throw new Error('useDevMode must be used within DevModeProvider');
  }
  return context;
};

export const DevModeProvider = ({ children }) => {
  const [isDevMode, setIsDevMode] = useState(false);
  const [localServerUrl, setLocalServerUrl] = useState('http://localhost:3009/api');
  const [loading, setLoading] = useState(true);

  // Load dev mode settings on mount
  useEffect(() => {
    loadDevModeSettings();
  }, []);

  const loadDevModeSettings = async () => {
    try {
      const savedDevMode = await AsyncStorage.getItem('devModeEnabled');
      const savedLocalUrl = await AsyncStorage.getItem('localServerUrl');
      
      if (savedDevMode !== null) {
        setIsDevMode(savedDevMode === 'true');
      }
      
      if (savedLocalUrl) {
        setLocalServerUrl(savedLocalUrl);
      } else {
        // Default to localhost, but Android needs IP address
        // User can configure this in settings
        setLocalServerUrl('http://10.0.2.2:3009/api'); // Android emulator default
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Failed to load dev mode settings:', error);
      setLoading(false);
    }
  };

  const toggleDevMode = async (enabled) => {
    try {
      setIsDevMode(enabled);
      await AsyncStorage.setItem('devModeEnabled', enabled.toString());
      
      // Show alert to inform user they need to restart app
      if (enabled) {
        console.log('🔧 Development mode enabled. Using local server:', localServerUrl);
      } else {
        console.log('🔧 Development mode disabled. Using production server.');
      }
    } catch (error) {
      console.error('Failed to save dev mode setting:', error);
    }
  };

  const updateLocalServerUrl = async (url) => {
    try {
      setLocalServerUrl(url);
      await AsyncStorage.setItem('localServerUrl', url);
      console.log('🔧 Local server URL updated:', url);
    } catch (error) {
      console.error('Failed to save local server URL:', error);
    }
  };

  const getApiUrl = () => {
    if (isDevMode) {
      return localServerUrl;
    }
    // Return production URL from environment or default
    return process.env.BACKEND_API_URL || 'https://awakey-project.onrender.com/api';
  };

  const value = {
    isDevMode,
    localServerUrl,
    loading,
    toggleDevMode,
    updateLocalServerUrl,
    getApiUrl,
  };

  return (
    <DevModeContext.Provider value={value}>
      {children}
    </DevModeContext.Provider>
  );
};

export default DevModeContext;


