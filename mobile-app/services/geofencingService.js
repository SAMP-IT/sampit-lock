import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { setHomeMode } from './api';

const GEOFENCE_TASK_NAME = 'AWAYKEY_GEOFENCE_TASK';

// Define the background task at module level (required by expo-task-manager)
TaskManager.defineTask(GEOFENCE_TASK_NAME, ({ data, error }) => {
  if (error) {
    console.error('[Geofencing] Task error:', error.message);
    return;
  }

  if (!data) return;

  const { eventType, region } = data;

  if (eventType === Location.GeofencingEventType.Enter) {
    console.log('[Geofencing] Entered home region:', region?.identifier);
    setHomeMode('home').catch(err =>
      console.error('[Geofencing] Failed to set home mode:', err.message)
    );
  } else if (eventType === Location.GeofencingEventType.Exit) {
    console.log('[Geofencing] Exited home region:', region?.identifier);
    setHomeMode('away').catch(err =>
      console.error('[Geofencing] Failed to set away mode:', err.message)
    );
  }
});

/**
 * Request foreground + background location permissions
 */
export const requestLocationPermissions = async () => {
  const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
  if (foregroundStatus !== 'granted') {
    return { granted: false, reason: 'Foreground location permission is required.' };
  }

  const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
  if (backgroundStatus !== 'granted') {
    return { granted: false, reason: 'Background location permission is required for automatic mode switching.' };
  }

  return { granted: true };
};

/**
 * Start geofencing for a home location
 */
export const startGeofencing = async (location) => {
  const { latitude, longitude, radius = 100 } = location;

  await Location.startGeofencingAsync(GEOFENCE_TASK_NAME, [{
    identifier: 'home',
    latitude,
    longitude,
    radius,
    notifyOnEnter: true,
    notifyOnExit: true
  }]);

  console.log(`[Geofencing] Started monitoring home region (${latitude}, ${longitude}, ${radius}m)`);
};

/**
 * Stop geofencing
 */
export const stopGeofencing = async () => {
  const isRunning = await Location.hasStartedGeofencingAsync(GEOFENCE_TASK_NAME);
  if (isRunning) {
    await Location.stopGeofencingAsync(GEOFENCE_TASK_NAME);
    console.log('[Geofencing] Stopped monitoring');
  }
};

/**
 * Check if geofencing is currently active
 */
export const isGeofencingActive = async () => {
  return await Location.hasStartedGeofencingAsync(GEOFENCE_TASK_NAME);
};

/**
 * Get current GPS position
 */
export const getCurrentPosition = async () => {
  return await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced
  });
};
