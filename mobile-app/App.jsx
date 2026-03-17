import React, { useEffect, useState, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, LogBox, Platform } from 'react-native';
import * as Font from 'expo-font';
import { Ionicons } from '@expo/vector-icons';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './utils/queryClient';
import RootNavigator from './navigation/RootNavigator';
import { RoleProvider } from './context/RoleContext';
import { ToastProvider, useToast, setToastManager } from './context/ToastContext';
import { DevModeProvider } from './context/DevModeContext';
import { PermissionsProvider } from './context/PermissionsContext';
import pushNotificationService from './services/pushNotificationService';
import logCollector from './utils/LogCollector'; // Initialize log collector

// Suppress only unavoidable third-party SDK warnings (not app errors)
if (__DEV__) {
  LogBox.ignoreLogs([
    // TTLock SDK uses deprecated NativeEventEmitter pattern - cannot be fixed in app code
    '`new NativeEventEmitter()` was called with a non-null argument',
    // React Navigation serialization warning - passing callbacks in params is intentional
    'Non-serializable values were found in the navigation state',
    // FlatList inside ScrollView is used intentionally in some layouts
    'VirtualizedLists should never be nested',
    // Deprecated React lifecycle methods used by third-party libraries
    'componentWillReceiveProps',
    'componentWillMount',
  ]);
}

// Component to initialize toast manager after context is available
const ToastManagerInitializer = ({ children }) => {
  const toastContext = useToast();

  useEffect(() => {
    setToastManager(toastContext);
  }, [toastContext]);

  return children;
};

export default function App() {
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const navigationRef = useRef(null);
  const notificationListener = useRef(null);
  const responseListener = useRef(null);

  useEffect(() => {
    async function loadFonts() {
      await Font.loadAsync({
        ...Ionicons.font,
      });
      setFontsLoaded(true);
    }
    loadFonts();
  }, []);

  // Setup push notification listeners
  useEffect(() => {
    // Listen for notifications received while app is in foreground
    notificationListener.current = pushNotificationService.addNotificationReceivedListener(
      notification => {
        console.log('Notification received:', notification);
      }
    );

    // Listen for user tapping on notification
    responseListener.current = pushNotificationService.addNotificationResponseListener(
      response => {
        console.log('Notification response:', response);
        // Handle navigation when user taps notification
        if (navigationRef.current) {
          pushNotificationService.handleNotificationNavigation(
            response.notification,
            navigationRef.current
          );
        }
      }
    );

    // Check if app was opened by a notification
    pushNotificationService.getLastNotificationResponse().then(response => {
      if (response) {
        console.log('App opened by notification:', response);
      }
    });

    // Cleanup listeners on unmount
    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, []);

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#00B5A5" />
      </View>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <DevModeProvider>
        <RoleProvider>
          <PermissionsProvider>
            <ToastProvider>
              <ToastManagerInitializer>
                <NavigationContainer ref={navigationRef}>
                  <StatusBar style="dark" />
                  <RootNavigator />
                </NavigationContainer>
              </ToastManagerInitializer>
            </ToastProvider>
          </PermissionsProvider>
        </RoleProvider>
      </DevModeProvider>
    </QueryClientProvider>
  );
}
