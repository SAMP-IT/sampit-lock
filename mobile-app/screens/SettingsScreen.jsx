import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  TextInput,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import Colors from "../constants/Colors";
import Theme from "../constants/Theme";
import AppScreen from "../components/ui/AppScreen";
import Section from "../components/ui/Section";
import AppCard from "../components/ui/AppCard";
import { useRole } from "../context/RoleContext";
import { useDevMode } from "../context/DevModeContext";
import { logout, updateBackendApiUrl } from "../services/api";

const settingsData = [
  {
    id: 1,
    title: "Account",
    subtitle: "Manage your profile",
    icon: "person-outline",
  },
  {
    id: 3,
    title: "Help & Support",
    subtitle: "Get assistance",
    icon: "help-circle-outline",
  },
  {
    id: 4,
    title: "About",
    subtitle: "App version, policies",
    icon: "information-circle-outline",
  },
  {
    id: 5,
    title: "Logout",
    subtitle: "",
    icon: "log-out-outline",
    isDestructive: true,
  },
];

const SettingsScreen = ({ navigation }) => {
  // Hidden debug mode - tap version number 7 times
  const [debugTapCount, setDebugTapCount] = useState(0);
  const debugTapTimer = useRef(null);
  const { isDevMode, localServerUrl, toggleDevMode, updateLocalServerUrl } =
    useDevMode();
  const [editingServerUrl, setEditingServerUrl] = useState(false);
  const [serverUrlInput, setServerUrlInput] = useState(localServerUrl);

  useEffect(() => {
    setServerUrlInput(localServerUrl);
  }, [localServerUrl]);

  const handleBackPress = () => {
    navigation.goBack();
  };

  const handleDevModeToggle = async (value) => {
    await toggleDevMode(value);
    await updateBackendApiUrl();
    Alert.alert(
      value ? "Development Mode Enabled" : "Development Mode Disabled",
      value
        ? `Using local server: ${localServerUrl}\n\nPlease restart the app for changes to take full effect.`
        : "Using production server.\n\nPlease restart the app for changes to take full effect.",
      [{ text: "OK" }],
    );
  };

  const handleServerUrlSave = async () => {
    if (serverUrlInput && serverUrlInput.trim()) {
      await updateLocalServerUrl(serverUrlInput.trim());
      await updateBackendApiUrl();
      setEditingServerUrl(false);
      Alert.alert(
        "Server URL Updated",
        "The local server URL has been updated. Please restart the app for changes to take effect.",
      );
    } else {
      Alert.alert("Invalid URL", "Please enter a valid server URL.");
    }
  };

  const handleVersionTap = () => {
    // Clear any existing reset timer so rapid taps don't get killed
    if (debugTapTimer.current) {
      clearTimeout(debugTapTimer.current);
    }

    const newCount = debugTapCount + 1;
    setDebugTapCount(newCount);

    if (newCount >= 7) {
      console.log("Debug mode activated");
      navigation.navigate("DebugLogs");
      setDebugTapCount(0);
      return;
    }

    // Reset counter after 3 seconds of inactivity
    debugTapTimer.current = setTimeout(() => setDebugTapCount(0), 3000);
  };

  const { setRole } = useRole();
  const handleLogout = async () => {
    await logout();
    setRole(null);
  };

  const handleSettingPress = (setting) => {
    switch (setting.id) {
      case 1: // Account
        navigation.navigate("Profile");
        break;
      case 3: // Help & Support
        navigation.navigate("HelpSupport");
        break;
      case 4: // About
        navigation.navigate("About");
        break;
      case 5: // Logout
        handleLogout();
        break;
      default:
        console.log("handle setting", setting.title);
    }
  };

  const renderSettingItem = (setting, index, array) => {
    const isLast = index === array.length - 1;

    return (
      <TouchableOpacity
        key={setting.id}
        style={[styles.settingItem, isLast && styles.settingItemLast]}
        onPress={() => handleSettingPress(setting)}
        activeOpacity={0.7}
      >
        <View
          style={[
            styles.settingIcon,
            setting.isDestructive && styles.destructiveIcon,
          ]}
        >
          <Ionicons
            name={setting.icon}
            size={20}
            color={setting.isDestructive ? Colors.red : Colors.iconbackground}
          />
        </View>

        <View style={styles.settingContent}>
          <Text
            style={[
              styles.settingTitle,
              setting.isDestructive && styles.destructiveText,
            ]}
          >
            {setting.title}
          </Text>
          {setting.subtitle ? (
            <Text style={styles.settingSubtitle}>{setting.subtitle}</Text>
          ) : null}
        </View>

        <Ionicons
          name="chevron-forward"
          size={20}
          color={Colors.subtitlecolor}
        />
      </TouchableOpacity>
    );
  };

  return (
    <AppScreen>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBackPress}>
          <Ionicons name="chevron-back" size={24} color={Colors.titlecolor} />
        </TouchableOpacity>
        <View style={styles.headerTitle}>
          <Text style={styles.title}>Settings</Text>
          <Text style={styles.subtitle}>App configuration</Text>
        </View>
      </View>

      {/* <Section title="General" gapless>
        <AppCard padding="none" elevated={false}>
          {settingsData
            .slice(0, 4)
            .map((setting, index, array) =>
              renderSettingItem(setting, index, array),
            )}
        </AppCard>
      </Section>

      <Section title="" gapless>
        <AppCard padding="none" elevated={false}>
          {settingsData
            .slice(4)
            .map((setting, index, array) =>
              renderSettingItem(setting, index, array),
            )}
        </AppCard>
      </Section> */}

      {/* Development Mode Section - only visible in development builds */}
      {__DEV__ && (
        <Section title="Development" gapless>
          <AppCard padding="none" elevated={false}>
            <View style={styles.devModeItem}>
              <View style={styles.devModeContent}>
                <View style={styles.settingIcon}>
                  <Ionicons
                    name="code-outline"
                    size={20}
                    color={Colors.iconbackground}
                  />
                </View>
                <View style={styles.devModeText}>
                  <Text style={styles.settingTitle}>Development Mode</Text>
                  <Text style={styles.settingSubtitle}>
                    {isDevMode
                      ? "Using local server"
                      : "Using production server"}
                  </Text>
                </View>
              </View>
              <Switch
                value={isDevMode}
                onValueChange={handleDevModeToggle}
                trackColor={{ false: Colors.bordercolor, true: Colors.primary }}
                thumbColor={isDevMode ? "#fff" : "#f4f3f4"}
              />
            </View>

            {isDevMode && (
              <View style={styles.serverUrlContainer}>
                <View style={styles.serverUrlHeader}>
                  <Ionicons
                    name="server-outline"
                    size={16}
                    color={Colors.subtitlecolor}
                  />
                  <Text style={styles.serverUrlLabel}>Local Server URL</Text>
                </View>
                {editingServerUrl ? (
                  <View style={styles.serverUrlInputContainer}>
                    <TextInput
                      style={styles.serverUrlInput}
                      value={serverUrlInput}
                      onChangeText={setServerUrlInput}
                      placeholder="http://10.0.2.2:3009/api"
                      placeholderTextColor={Colors.subtitlecolor}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    <TouchableOpacity
                      onPress={handleServerUrlSave}
                      style={styles.saveButton}
                    >
                      <Ionicons
                        name="checkmark"
                        size={20}
                        color={Colors.primary}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => {
                        setEditingServerUrl(false);
                        setServerUrlInput(localServerUrl);
                      }}
                      style={styles.cancelButton}
                    >
                      <Ionicons
                        name="close"
                        size={20}
                        color={Colors.subtitlecolor}
                      />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    onPress={() => setEditingServerUrl(true)}
                    style={styles.serverUrlDisplay}
                  >
                    <Text style={styles.serverUrlText}>{localServerUrl}</Text>
                    <Ionicons
                      name="pencil"
                      size={16}
                      color={Colors.subtitlecolor}
                    />
                  </TouchableOpacity>
                )}
                <Text style={styles.serverUrlHint}>
                  For Android emulator: use 10.0.2.2 instead of localhost{"\n"}
                  For physical device: use your computer's IP address (e.g.,
                  192.168.1.100:3009/api)
                </Text>
              </View>
            )}
          </AppCard>
        </Section>
      )}

      {/* Hidden debug mode activator - tap 7 times to access logs */}
      <TouchableOpacity
        onPress={handleVersionTap}
        activeOpacity={0.7}
        style={styles.versionFooter}
      >
        <Text style={styles.versionText}>AwayKey v1.0.0</Text>
        <Text style={styles.versionSubtext}>Tap to view app info</Text>
      </TouchableOpacity>
    </AppScreen>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Theme.spacing.lg,
    paddingTop: Theme.spacing.lg,
    paddingBottom: Theme.spacing.lg,
  },
  headerTitle: {
    marginLeft: Theme.spacing.md,
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
    color: Colors.titlecolor,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.subtitlecolor,
    marginTop: 2,
  },
  settingItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.bordercolor,
  },
  settingItemLast: {
    borderBottomWidth: 0,
  },
  settingIcon: {
    backgroundColor: Colors.cardbackground,
    width: 40,
    height: 40,
    borderRadius: Theme.radius.md,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Theme.spacing.md,
  },
  destructiveIcon: {
    backgroundColor: "#FFEBEE",
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: "500",
    color: Colors.titlecolor,
    marginBottom: 2,
  },
  destructiveText: {
    color: Colors.red,
  },
  settingSubtitle: {
    fontSize: 14,
    color: Colors.subtitlecolor,
  },
  versionFooter: {
    alignItems: "center",
    paddingVertical: Theme.spacing.xl,
    paddingHorizontal: Theme.spacing.lg,
    marginTop: Theme.spacing.md,
  },
  versionText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.subtitlecolor,
  },
  versionSubtext: {
    fontSize: 12,
    color: Colors.subtitlecolor,
    opacity: 0.6,
    marginTop: 4,
  },
  devModeItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.bordercolor,
  },
  devModeContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  devModeText: {
    flex: 1,
    marginLeft: Theme.spacing.md,
  },
  serverUrlContainer: {
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.bordercolor,
    backgroundColor: Colors.cardbackground,
  },
  serverUrlHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Theme.spacing.sm,
  },
  serverUrlLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: Colors.titlecolor,
    marginLeft: Theme.spacing.xs,
  },
  serverUrlInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Theme.spacing.sm,
  },
  serverUrlInput: {
    flex: 1,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.bordercolor,
    borderRadius: Theme.radius.sm,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
    fontSize: 14,
    color: Colors.titlecolor,
    marginRight: Theme.spacing.xs,
  },
  saveButton: {
    padding: Theme.spacing.xs,
    marginRight: Theme.spacing.xs,
  },
  cancelButton: {
    padding: Theme.spacing.xs,
  },
  serverUrlDisplay: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.bordercolor,
    borderRadius: Theme.radius.sm,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
    marginBottom: Theme.spacing.sm,
  },
  serverUrlText: {
    flex: 1,
    fontSize: 14,
    color: Colors.titlecolor,
  },
  serverUrlHint: {
    fontSize: 12,
    color: Colors.subtitlecolor,
    lineHeight: 16,
  },
});

export default SettingsScreen;
