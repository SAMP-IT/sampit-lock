/**
 * Secure Storage Service
 *
 * Uses expo-secure-store (iOS Keychain / Android Keystore) for sensitive data
 * like auth tokens and credentials. Falls back to AsyncStorage for non-sensitive data.
 *
 * This is critical for iOS App Store compliance - Apple requires that sensitive
 * credentials are stored in the Keychain, not in plaintext UserDefaults/AsyncStorage.
 */

import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Keys that must be stored securely (tokens, credentials)
const SECURE_KEYS = new Set([
  'authToken',
  'refreshToken',
  'ttlock_access_token',
  'ttlock_refresh_token',
]);

/**
 * Determine if a key should use secure storage
 */
function isSecureKey(key) {
  return SECURE_KEYS.has(key);
}

/**
 * Store a value - automatically routes to SecureStore or AsyncStorage
 * @param {string} key
 * @param {string} value
 */
export async function setItem(key, value) {
  if (isSecureKey(key)) {
    try {
      await SecureStore.setItemAsync(key, value);
      // Remove from AsyncStorage if it was previously stored there (migration)
      try { await AsyncStorage.removeItem(key); } catch (e) { /* ignore */ }
      return;
    } catch (error) {
      // SecureStore can fail on some devices (e.g., no hardware security module)
      // Fall back to AsyncStorage in that case
      console.warn(`SecureStore failed for ${key}, falling back to AsyncStorage:`, error.message);
    }
  }
  await AsyncStorage.setItem(key, value);
}

/**
 * Get a value - checks SecureStore first for secure keys, then AsyncStorage
 * @param {string} key
 * @returns {Promise<string|null>}
 */
export async function getItem(key) {
  if (isSecureKey(key)) {
    try {
      const secureValue = await SecureStore.getItemAsync(key);
      if (secureValue !== null) {
        return secureValue;
      }
      // If not in SecureStore, check AsyncStorage (handles migration from old storage)
      const asyncValue = await AsyncStorage.getItem(key);
      if (asyncValue !== null) {
        // Migrate to SecureStore
        try {
          await SecureStore.setItemAsync(key, asyncValue);
          await AsyncStorage.removeItem(key);
        } catch (e) { /* migration failed, keep in AsyncStorage */ }
      }
      return asyncValue;
    } catch (error) {
      console.warn(`SecureStore read failed for ${key}, falling back to AsyncStorage:`, error.message);
    }
  }
  return AsyncStorage.getItem(key);
}

/**
 * Remove a value from both stores
 * @param {string} key
 */
export async function removeItem(key) {
  if (isSecureKey(key)) {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      // Ignore - key may not exist in SecureStore
    }
  }
  try {
    await AsyncStorage.removeItem(key);
  } catch (error) {
    // Ignore - key may not exist in AsyncStorage
  }
}

/**
 * Remove multiple items
 * @param {string[]} keys
 */
export async function multiRemove(keys) {
  const secureKeys = keys.filter(k => isSecureKey(k));
  const asyncKeys = keys.filter(k => !isSecureKey(k));

  // Remove secure keys individually
  await Promise.all(
    secureKeys.map(async (key) => {
      try { await SecureStore.deleteItemAsync(key); } catch (e) { /* ignore */ }
    })
  );

  // Remove all keys from AsyncStorage (secure keys may still be there from before migration)
  try {
    await AsyncStorage.multiRemove(keys);
  } catch (error) {
    // Ignore
  }
}

export default {
  setItem,
  getItem,
  removeItem,
  multiRemove,
};
