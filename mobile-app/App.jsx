import React, { useEffect, useState, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, LogBox, Platform } from 'react-native';
import * as Font from 'expo-font';
import { Ionicons } from '@expo/vector-icons';
import RootNavigator from './navigation/RootNavigator';
import { RoleProvider } from './context/RoleContext';
import { ToastProvider, useToast, setToastManager } from './context/ToastContext';
import { DevModeProvider } from './context/DevModeContext';
import { PermissionsProvider } from './context/PermissionsContext';
import pushNotificationService from './services/pushNotificationService';
import logCollector from './utils/LogCollector'; // Initialize log collector

// Suppress specific LogBox warnings that are handled gracefully
LogBox.ignoreLogs([
  // Suppress expected 404 API errors (no locks yet, TTLock not connected)
  'AxiosError: Request failed with status code 404',
  'Request failed with status code 404',
  'Request failed with status code 500',
  'Request failed with status code 401',
  // Suppress NativeEventEmitter warnings (TTLock SDK limitation)
  '`new NativeEventEmitter()` was called with a non-null argument',
  // Suppress navigation warnings
  'Non-serializable values were found in the navigation state',
  // Suppress TTLock Bluetooth errors (handled gracefully in UI via toast)
  'Bluetooth state query failed',
  'queryLockState failed',
  'Not administrator',
  'has no permission',
  'Lock operation failed',
  'errorCode',
  'Bluetooth unlock failed',
  'Bluetooth lock failed',
  'Unlock failed',
  'Lock failed',
  'lock connect time out',
  'connection is disconnected',
  'lock is busy',
  'Lock toggle error',
  // Suppress VirtualizedLists warning (FlatList inside ScrollView is intentional)
  'VirtualizedLists should never be nested',
  // Suppress other common warnings
  'Sending `onAnimatedValueUpdate`',
  'componentWillReceiveProps',
  'componentWillMount',
  // Suppress navigation warnings (dev-only)
  "The action 'GO_BACK' was not handled",
  "The action 'NAVIGATE' was not handled",
]);

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
  );
}
