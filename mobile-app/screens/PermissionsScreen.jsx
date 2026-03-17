import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  PermissionsAndroid,
  Linking,
  AppState,
  ScrollView,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Notifications from "expo-notifications";
import Colors from "../constants/Colors";
import TTLockService from "../services/ttlockService";

const PermissionsScreen = ({ navigation, onPermissionsGranted }) => {
  const { height: screenHeight } = useWindowDimensions();
  const isSmallScreen = screenHeight < 700;
  const [isChecking, setIsChecking] = useState(true);
  const [permissions, setPermissions] = useState({
    notifications: { granted: false, checking: false },
    bluetooth: { granted: false, checking: false },
    nearbyDevices: { granted: false, checking: false },
  });
  const [bluetoothEnabled, setBluetoothEnabled] = useState(false);
  const [checkingBluetooth, setCheckingBluetooth] = useState(false);

  // Check all permissions on mount and when app comes to foreground
  useEffect(() => {
    checkAllPermissions();

    // Listen for app state changes to recheck when app comes to foreground
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "active") {
        console.log(
          "[Permissions] App came to foreground, rechecking permissions...",
        );
        checkAllPermissions();
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const checkAllPermissions = async () => {
    setIsChecking(true);
    console.log("[Permissions] Checking all permissions...");

    try {
      // Check all permissions in parallel
      const [notifStatus, btPerms, btState] = await Promise.all([
        checkNotificationPermission(),
        checkBluetoothPermissions(),
        checkBluetoothState(),
      ]);

      console.log("[Permissions] Results:", {
        notifications: notifStatus,
        bluetoothPermissions: btPerms,
        bluetoothEnabled: btState,
      });

      // If all permissions are granted AND Bluetooth is on, proceed
      if (notifStatus && btPerms && btState) {
        console.log(
          "[Permissions] All permissions granted and Bluetooth is ON!",
        );
        if (onPermissionsGranted) {
          onPermissionsGranted();
        }
      }
    } catch (error) {
      console.error("[Permissions] Error checking permissions:", error);
    } finally {
      setIsChecking(false);
    }
  };

  const checkNotificationPermission = async () => {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      const granted = status === "granted";
      setPermissions((prev) => ({
        ...prev,
        notifications: { granted, checking: false },
      }));
      return granted;
    } catch (error) {
      console.error("[Permissions] Notification check error:", error);
      return false;
    }
  };

  const checkBluetoothPermissions = async () => {
    if (Platform.OS === "android") {
      try {
        // Android 12+ (API 31+) requires BLUETOOTH_SCAN and BLUETOOTH_CONNECT
        // Older versions only need ACCESS_FINE_LOCATION for BLE scanning
        const androidVersion = Platform.Version;

        if (androidVersion >= 31) {
          // Android 12+
          const bluetoothScan = await PermissionsAndroid.check(
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          );
          const bluetoothConnect = await PermissionsAndroid.check(
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          );
          const fineLocation = await PermissionsAndroid.check(
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          );

          const granted = bluetoothScan && bluetoothConnect && fineLocation;
          setPermissions((prev) => ({
            ...prev,
            bluetooth: { granted: bluetoothConnect, checking: false },
            nearbyDevices: {
              granted: bluetoothScan && fineLocation,
              checking: false,
            },
          }));
          return granted;
        } else {
          // Android 11 and below - only location needed for BLE
          const fineLocation = await PermissionsAndroid.check(
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          );

          setPermissions((prev) => ({
            ...prev,
            bluetooth: { granted: true, checking: false }, // No separate BT permission needed
            nearbyDevices: { granted: fineLocation, checking: false },
          }));
          return fineLocation;
        }
      } catch (error) {
        console.error(
          "[Permissions] Bluetooth permissions check error:",
          error,
        );
        return false;
      }
    } else {
      // iOS handles Bluetooth permissions differently
      setPermissions((prev) => ({
        ...prev,
        bluetooth: { granted: true, checking: false },
        nearbyDevices: { granted: true, checking: false },
      }));
      return true;
    }
  };

  const checkBluetoothState = async () => {
    try {
      setCheckingBluetooth(true);
      const state = await TTLockService.getBluetoothState();
      const isOn = state === "poweredOn";
      setBluetoothEnabled(isOn);
      setCheckingBluetooth(false);
      return isOn;
    } catch (error) {
      console.error("[Permissions] Bluetooth state check error:", error);
      setCheckingBluetooth(false);
      return false;
    }
  };

  const requestNotificationPermission = async () => {
    setPermissions((prev) => ({
      ...prev,
      notifications: { ...prev.notifications, checking: true },
    }));

    try {
      const { status } = await Notifications.requestPermissionsAsync();
      const granted = status === "granted";

      setPermissions((prev) => ({
        ...prev,
        notifications: { granted, checking: false },
      }));

      if (!granted) {
        // If denied, open settings
        Linking.openSettings();
      }

      return granted;
    } catch (error) {
      console.error("[Permissions] Notification request error:", error);
      setPermissions((prev) => ({
        ...prev,
        notifications: { granted: false, checking: false },
      }));
      return false;
    }
  };

  const requestBluetoothPermissions = async () => {
    if (Platform.OS !== "android") {
      return true;
    }

    setPermissions((prev) => ({
      ...prev,
      bluetooth: { ...prev.bluetooth, checking: true },
      nearbyDevices: { ...prev.nearbyDevices, checking: true },
    }));

    try {
      const androidVersion = Platform.Version;

      if (androidVersion >= 31) {
        // Android 12+ needs all three permissions
        const permissions = [
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ];

        const results = await PermissionsAndroid.requestMultiple(permissions);

        const bluetoothScan =
          results[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] ===
          PermissionsAndroid.RESULTS.GRANTED;
        const bluetoothConnect =
          results[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] ===
          PermissionsAndroid.RESULTS.GRANTED;
        const fineLocation =
          results[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] ===
          PermissionsAndroid.RESULTS.GRANTED;

        const allGranted = bluetoothScan && bluetoothConnect && fineLocation;

        setPermissions((prev) => ({
          ...prev,
          bluetooth: { granted: bluetoothConnect, checking: false },
          nearbyDevices: {
            granted: bluetoothScan && fineLocation,
            checking: false,
          },
        }));

        if (!allGranted) {
          Linking.openSettings();
        }

        return allGranted;
      } else {
        // Android 11 and below - only location needed
        const result = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        );

        const fineLocation = result === PermissionsAndroid.RESULTS.GRANTED;

        setPermissions((prev) => ({
          ...prev,
          bluetooth: { granted: true, checking: false },
          nearbyDevices: { granted: fineLocation, checking: false },
        }));

        if (!fineLocation) {
          Linking.openSettings();
        }

        return fineLocation;
      }
    } catch (error) {
      console.error(
        "[Permissions] Bluetooth permissions request error:",
        error,
      );
      setPermissions((prev) => ({
        ...prev,
        bluetooth: { granted: false, checking: false },
        nearbyDevices: { granted: false, checking: false },
      }));
      return false;
    }
  };

  const openBluetoothSettings = () => {
    if (Platform.OS === "android") {
      Linking.sendIntent("android.settings.BLUETOOTH_SETTINGS");
    } else {
      Linking.openURL("App-Prefs:Bluetooth");
    }
  };

  const handleContinue = async () => {
    // Recheck everything before proceeding
    await checkAllPermissions();
  };

  const allPermissionsGranted =
    permissions.notifications.granted &&
    permissions.bluetooth.granted &&
    permissions.nearbyDevices.granted;

  const canProceed = allPermissionsGranted && bluetoothEnabled;

  const renderPermissionItem = (
    icon,
    title,
    description,
    granted,
    checking,
    onPress,
  ) => (
    <TouchableOpacity
      style={[
        styles.permissionItem,
        granted ? styles.permissionGranted : styles.permissionPending,
        isSmallScreen && styles.permissionItemCompact,
      ]}
      onPress={onPress}
      disabled={checking || granted}
    >
      <View
        style={[
          styles.iconContainer,
          granted ? styles.iconGranted : styles.iconPending,
          isSmallScreen && styles.iconContainerCompact,
        ]}
      >
        <Ionicons
          name={icon}
          size={isSmallScreen ? 24 : 28}
          color={granted ? Colors.green : Colors.subtitlecolor}
        />
      </View>
      <View style={styles.permissionInfo}>
        <Text style={styles.permissionTitle}>{title}</Text>
        <Text style={styles.permissionDescription}>{description}</Text>
      </View>
      <View style={styles.statusContainer}>
        {checking ? (
          <ActivityIndicator size="small" color={Colors.primary} />
        ) : granted ? (
          <Ionicons name="checkmark-circle" size={28} color={Colors.green} />
        ) : (
          <TouchableOpacity style={styles.grantButton} onPress={onPress}>
            <Text style={styles.grantButtonText}>Grant</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );

  if (isChecking) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Checking permissions...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Sticky header - always visible */}
      <View style={[styles.header, isSmallScreen && styles.headerCompact]}>
        <View
          style={[styles.headerIcon, isSmallScreen && styles.headerIconCompact]}
        >
          <Ionicons
            name="shield-checkmark"
            size={isSmallScreen ? 40 : 48}
            color={Colors.primary}
          />
        </View>
        <Text style={[styles.title, isSmallScreen && styles.titleCompact]}>
          Permissions Required
        </Text>
        <Text
          style={[styles.subtitle, isSmallScreen && styles.subtitleCompact]}
        >
          To use all features of this app, please grant the following
          permissions and enable Bluetooth.
        </Text>
        <View style={styles.scrollHint}>
          <Ionicons
            name="chevron-down"
            size={16}
            color={Colors.subtitlecolor}
          />
          <Text style={styles.scrollHintText}>
            Scroll down to see all permissions
          </Text>
        </View>
      </View>

      {/* Scrollable permissions list only */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          isSmallScreen && styles.scrollContentCompact,
        ]}
        showsVerticalScrollIndicator={true}
        bounces={false}
      >
        <View style={styles.permissionsList}>
          {renderPermissionItem(
            "notifications",
            "Notifications",
            "Receive alerts about lock activity and security events",
            permissions.notifications.granted,
            permissions.notifications.checking,
            requestNotificationPermission,
          )}

          {renderPermissionItem(
            "bluetooth",
            "Bluetooth",
            "Connect to and control your smart locks",
            permissions.bluetooth.granted,
            permissions.bluetooth.checking,
            requestBluetoothPermissions,
          )}

          {renderPermissionItem(
            "location",
            "Nearby Devices",
            "Discover and pair with nearby locks",
            permissions.nearbyDevices.granted,
            permissions.nearbyDevices.checking,
            requestBluetoothPermissions,
          )}
        </View>

        {/* Bluetooth Status Card */}
        <View
          style={[
            styles.bluetoothStatusCard,
            bluetoothEnabled ? styles.bluetoothOn : styles.bluetoothOff,
          ]}
        >
          <View style={styles.bluetoothStatusContent}>
            <Ionicons
              name="bluetooth"
              size={28}
              color={bluetoothEnabled ? Colors.green : Colors.red}
            />
            <View style={styles.bluetoothStatusInfo}>
              <Text style={styles.bluetoothStatusTitle}>
                Bluetooth is {bluetoothEnabled ? "ON" : "OFF"}
              </Text>
              <Text style={styles.bluetoothStatusSubtitle}>
                {bluetoothEnabled
                  ? "Ready to connect to your locks"
                  : "Turn on Bluetooth to continue"}
              </Text>
            </View>
            {!bluetoothEnabled && (
              <TouchableOpacity
                style={styles.enableBluetoothButton}
                onPress={openBluetoothSettings}
              >
                <Text style={styles.enableBluetoothText}>Enable</Text>
              </TouchableOpacity>
            )}
            {bluetoothEnabled && (
              <Ionicons
                name="checkmark-circle"
                size={24}
                color={Colors.green}
              />
            )}
          </View>
        </View>

        <View style={styles.scrollBottomSpacer} />
      </ScrollView>

      <View style={[styles.footer, isSmallScreen && styles.footerCompact]}>
        {!canProceed && (
          <Text style={styles.warningText} numberOfLines={2}>
            Please grant all permissions and enable Bluetooth to continue.
          </Text>
        )}

        <TouchableOpacity
          style={[
            styles.continueButton,
            !canProceed && styles.continueButtonDisabled,
          ]}
          onPress={handleContinue}
          disabled={checkingBluetooth}
        >
          {checkingBluetooth ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={styles.continueButtonText}>
                {canProceed ? "Continue" : "Check Again"}
              </Text>
              <Ionicons
                name={canProceed ? "arrow-forward" : "refresh"}
                size={20}
                color="#fff"
              />
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.refreshButton}
          onPress={checkAllPermissions}
        >
          <Ionicons name="refresh" size={16} color={Colors.primary} />
          <Text style={styles.refreshButtonText}>Refresh Status</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.background,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: Colors.subtitlecolor,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 24,
  },
  scrollContentCompact: {
    paddingBottom: 16,
  },
  header: {
    flexShrink: 0,
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 16,
    backgroundColor: Colors.background,
  },
  headerCompact: {
    paddingTop: 24,
    paddingBottom: 12,
  },
  headerIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primary + "20",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  headerIconCompact: {
    width: 64,
    height: 64,
    borderRadius: 32,
    marginBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: Colors.titlecolor,
    marginBottom: 8,
    textAlign: "center",
  },
  titleCompact: {
    fontSize: 22,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.subtitlecolor,
    textAlign: "center",
    lineHeight: 22,
  },
  subtitleCompact: {
    fontSize: 14,
    lineHeight: 20,
  },
  scrollHint: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 12,
  },
  scrollHintText: {
    fontSize: 13,
    color: Colors.subtitlecolor,
  },
  permissionsList: {
    paddingHorizontal: 16,
    gap: 10,
  },
  permissionItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#fff",
    borderWidth: 2,
  },
  permissionGranted: {
    borderColor: Colors.green,
    backgroundColor: Colors.green + "10",
  },
  permissionPending: {
    borderColor: "#e0e0e0",
  },
  permissionItemCompact: {
    padding: 12,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  iconGranted: {
    backgroundColor: Colors.green + "20",
  },
  iconPending: {
    backgroundColor: "#f0f0f0",
  },
  iconContainerCompact: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  permissionInfo: {
    flex: 1,
  },
  permissionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.titlecolor,
    marginBottom: 4,
  },
  permissionDescription: {
    fontSize: 13,
    color: Colors.subtitlecolor,
    lineHeight: 18,
  },
  statusContainer: {
    marginLeft: 12,
  },
  grantButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  grantButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  bluetoothStatusCard: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 14,
    borderWidth: 2,
  },
  bluetoothOn: {
    backgroundColor: Colors.green + "10",
    borderColor: Colors.green,
  },
  bluetoothOff: {
    backgroundColor: Colors.red + "10",
    borderColor: Colors.red,
  },
  bluetoothStatusContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  bluetoothStatusInfo: {
    flex: 1,
    marginLeft: 12,
  },
  bluetoothStatusTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.titlecolor,
    marginBottom: 4,
  },
  bluetoothStatusSubtitle: {
    fontSize: 13,
    color: Colors.subtitlecolor,
  },
  enableBluetoothButton: {
    backgroundColor: Colors.red,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  enableBluetoothText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  scrollBottomSpacer: {
    height: 16,
  },
  footer: {
    flexShrink: 0,
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingBottom: Platform.OS === "ios" ? 34 : 24,
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.06)",
  },
  footerCompact: {
    paddingVertical: 12,
    paddingBottom: Platform.OS === "ios" ? 28 : 20,
  },
  warningText: {
    fontSize: 13,
    color: Colors.red,
    textAlign: "center",
    marginBottom: 12,
    paddingHorizontal: 8,
  },
  continueButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.primary,
    minHeight: 52,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
  },
  continueButtonDisabled: {
    backgroundColor: Colors.subtitlecolor,
  },
  continueButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  refreshButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
    paddingVertical: 12,
    minHeight: 44,
    gap: 8,
  },
  refreshButtonText: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: "500",
  },
});

export default PermissionsScreen;
