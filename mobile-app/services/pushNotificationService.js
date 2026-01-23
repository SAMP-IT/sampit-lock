import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { backendApi } from './api';

/**
 * Push Notification Service
 * Handles all push notification functionality for the mobile app
 */

// Configure how notifications should be displayed when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Storage keys
const STORAGE_KEYS = {
  PUSH_TOKEN: 'expo_push_token',
  NOTIFICATIONS_ENABLED: 'notifications_enabled',
};

/**
 * Request notification permissions
 * @returns {Promise<boolean>} True if permission granted
 */
export async function requestPermissions() {
  if (!Device.isDevice) {
    // Silent - not a physical device
    return false;
  }

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    return finalStatus === 'granted';
  } catch (error) {
    // Silent fail
    return false;
  }
}

/**
 * Get Expo push token
 * @returns {Promise<string|null>} Expo push token or null
 */
export async function getExpoPushToken() {
  if (!Device.isDevice) {
    console.log('Push notifications require a physical device');
    return null;
  }

  try {
    // Check if we have permission
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      console.log('Push notification permission not granted');
      return null;
    }

    // Get the project ID from Constants
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;

    if (!projectId) {
      // Silent - this is expected without EAS configuration
    }

    // Get the token
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: projectId,
    });

    const token = tokenData.data;
    console.log('📱 Expo Push Token:', token);

    // Store locally
    await AsyncStorage.setItem(STORAGE_KEYS.PUSH_TOKEN, token);

    return token;
  } catch (error) {
    // Check if error is due to Firebase not being configured
    const errorMessage = error?.message || '';
    if (
      errorMessage.includes('FirebaseApp is not initialized') ||
      errorMessage.includes('Firebase') ||
      errorMessage.includes('google-services.json')
    ) {
      // Silent fail - Firebase not configured, this is expected in dev builds
      // To enable push notifications, add google-services.json from Firebase Console
      return null;
    }
    // Only log unexpected errors
    console.log('ℹ️ Push token unavailable:', errorMessage);
    return null;
  }
}

/**
 * Register device token with backend
 * @param {string} expoPushToken - Expo push token
 * @returns {Promise<boolean>} True if successful
 */
export async function registerDeviceToken(expoPushToken) {
  try {
    const platform = Platform.OS;
    const deviceName = Device.deviceName || `${Device.brand} ${Device.modelName}`;

    console.log('📱 Registering device token with backend...');

    const response = await backendApi.post('/push/register', {
      expoPushToken,
      platform,
      deviceName,
    });

    if (response.data.success) {
      console.log('✅ Device token registered successfully');
      await AsyncStorage.setItem(STORAGE_KEYS.NOTIFICATIONS_ENABLED, 'true');
      return true;
    }

    return false;
  } catch (error) {
    console.error('Error registering device token:', error.response?.data || error.message);
    return false;
  }
}

/**
 * Unregister device token from backend
 * @returns {Promise<boolean>} True if successful
 */
export async function unregisterDeviceToken() {
  try {
    const expoPushToken = await AsyncStorage.getItem(STORAGE_KEYS.PUSH_TOKEN);

    if (!expoPushToken) {
      console.log('No push token to unregister');
      return true;
    }

    console.log('📱 Unregistering device token from backend...');

    const response = await backendApi.delete('/push/unregister', {
      data: { expoPushToken },
    });

    if (response.data.success) {
      console.log('✅ Device token unregistered successfully');
      await AsyncStorage.removeItem(STORAGE_KEYS.NOTIFICATIONS_ENABLED);
      return true;
    }

    return false;
  } catch (error) {
    console.error('Error unregistering device token:', error.response?.data || error.message);
    return false;
  }
}

/**
 * Initialize push notifications
 * Requests permissions and registers device token
 * @returns {Promise<boolean>} True if successful
 */
export async function initializePushNotifications() {
  try {
    // Request permissions (silent if denied)
    const hasPermission = await requestPermissions();
    if (!hasPermission) {
      return false;
    }

    // Get push token (will silently fail if Firebase not configured)
    const token = await getExpoPushToken();
    if (!token) {
      // Silent - Firebase not configured or token unavailable
      return false;
    }

    // Register with backend
    const registered = await registerDeviceToken(token);
    if (!registered) {
      return false;
    }

    // Configure Android notification channel
    if (Platform.OS === 'android') {
      await setupAndroidNotificationChannels();
    }

    console.log('✅ Push notifications initialized successfully');
    return true;
  } catch (error) {
    // Silent fail - push notifications are optional
    return false;
  }
}

/**
 * Setup Android notification channels
 */
async function setupAndroidNotificationChannels() {
  // Default channel
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Default',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#00B5A5',
  });

  // Lock events channel
  await Notifications.setNotificationChannelAsync('lock-events', {
    name: 'Lock Events',
    description: 'Lock and unlock notifications',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#00B5A5',
    sound: 'default',
  });

  // Alerts channel (high priority)
  await Notifications.setNotificationChannelAsync('alerts', {
    name: 'Security Alerts',
    description: 'Battery warnings, tamper alerts, and security notifications',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 500, 200, 500],
    lightColor: '#FF0000',
    sound: 'default',
  });

  console.log('✅ Android notification channels configured');
}

/**
 * Add notification received listener (foreground)
 * @param {Function} callback - Function to call when notification received
 * @returns {Object} Subscription object (call .remove() to unsubscribe)
 */
export function addNotificationReceivedListener(callback) {
  return Notifications.addNotificationReceivedListener(callback);
}

/**
 * Add notification response listener (user tapped notification)
 * @param {Function} callback - Function to call when user taps notification
 * @returns {Object} Subscription object (call .remove() to unsubscribe)
 */
export function addNotificationResponseListener(callback) {
  return Notifications.addNotificationResponseReceivedListener(callback);
}

/**
 * Get last notification response (if app was opened by notification)
 * @returns {Promise<Object|null>} Last notification response
 */
export async function getLastNotificationResponse() {
  return await Notifications.getLastNotificationResponseAsync();
}

/**
 * Schedule a local notification
 * @param {Object} options - Notification options
 * @returns {Promise<string>} Notification identifier
 */
export async function scheduleLocalNotification(options) {
  const { title, body, data, delay = 0 } = options;

  return await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
      sound: true,
    },
    trigger: delay > 0 ? { seconds: delay } : null,
  });
}

/**
 * Cancel all scheduled notifications
 */
export async function cancelAllNotifications() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

/**
 * Get badge count
 * @returns {Promise<number>} Current badge count
 */
export async function getBadgeCount() {
  return await Notifications.getBadgeCountAsync();
}

/**
 * Set badge count
 * @param {number} count - Badge count
 */
export async function setBadgeCount(count) {
  await Notifications.setBadgeCountAsync(count);
}

/**
 * Clear badge
 */
export async function clearBadge() {
  await Notifications.setBadgeCountAsync(0);
}

/**
 * Send test notification (via backend)
 * @returns {Promise<boolean>} True if successful
 */
export async function sendTestNotification() {
  try {
    const response = await backendApi.post('/push/test');
    return response.data.success;
  } catch (error) {
    console.error('Error sending test notification:', error.response?.data || error.message);
    return false;
  }
}

/**
 * Check if push notifications are enabled
 * @returns {Promise<boolean>} True if enabled
 */
export async function isPushNotificationsEnabled() {
  const enabled = await AsyncStorage.getItem(STORAGE_KEYS.NOTIFICATIONS_ENABLED);
  return enabled === 'true';
}

/**
 * Get notification preferences from backend
 * @returns {Promise<Object|null>} Preferences or null
 */
export async function getNotificationPreferences() {
  try {
    const response = await backendApi.get('/push/preferences');
    return response.data.data;
  } catch (error) {
    console.error('Error getting notification preferences:', error.response?.data || error.message);
    return null;
  }
}

/**
 * Update notification preferences
 * @param {Object} preferences - Preferences to update
 * @returns {Promise<boolean>} True if successful
 */
export async function updateNotificationPreferences(preferences) {
  try {
    const response = await backendApi.patch('/push/preferences', preferences);
    return response.data.success;
  } catch (error) {
    console.error('Error updating notification preferences:', error.response?.data || error.message);
    return false;
  }
}

/**
 * Handle notification navigation
 * Call this when user taps a notification to navigate to appropriate screen
 * @param {Object} notification - Notification data
 * @param {Object} navigation - React Navigation object
 */
export function handleNotificationNavigation(notification, navigation) {
  const data = notification?.request?.content?.data;

  if (!data || !navigation) {
    return;
  }

  const { type, lockId } = data;

  switch (type) {
    case 'unlock':
    case 'lock':
    case 'passcode_used':
    case 'fingerprint_used':
    case 'card_used':
      if (lockId) {
        navigation.navigate('LockDetail', { lockId });
      }
      break;

    case 'battery_low':
    case 'battery_critical':
      if (lockId) {
        navigation.navigate('LockSettings', { lockId });
      }
      break;

    case 'tamper':
    case 'failed_attempt':
      if (lockId) {
        navigation.navigate('History', { lockId });
      } else {
        navigation.navigate('SecurityDashboard');
      }
      break;

    case 'guest_access':
      navigation.navigate('GuestAccessHistory');
      break;

    case 'offline':
    case 'online':
      navigation.navigate('Devices');
      break;

    default:
      // Default to notifications screen
      navigation.navigate('Notifications');
  }
}

export default {
  requestPermissions,
  getExpoPushToken,
  registerDeviceToken,
  unregisterDeviceToken,
  initializePushNotifications,
  addNotificationReceivedListener,
  addNotificationResponseListener,
  getLastNotificationResponse,
  scheduleLocalNotification,
  cancelAllNotifications,
  getBadgeCount,
  setBadgeCount,
  clearBadge,
  sendTestNotification,
  isPushNotificationsEnabled,
  getNotificationPreferences,
  updateNotificationPreferences,
  handleNotificationNavigation,
};
