import React from "react";
import { View } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createStackNavigator } from "@react-navigation/stack";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";

// New elder-friendly screens
import MinimalHomeScreen from "../screens/MinimalHomeScreen";
import HelpScreen from "../screens/HelpScreen";
import GlossaryScreen from "../screens/GlossaryScreen";
import SimpleModeSettingsScreen from "../screens/SimpleModeSettingsScreen";
import TrustedContactsScreen from "../screens/TrustedContactsScreen";
import PairLockScreen from "../screens/devices/PairLockScreen";
import NameDoorScreen from "../screens/devices/NameDoorScreen";
import SafetyBackupScreen from "../screens/devices/SafetyBackupScreen";
import EmergencyNotificationScreen from "../screens/EmergencyNotificationScreen";
import PersonalizeAppScreen from "../screens/PersonalizeAppScreen";

// Existing screens
import HomeScreen from "../screens/HomeScreen";
import LockDetailScreen from "../screens/LockDetailScreen";
import DevicesScreen from "../screens/DevicesScreen";
import SettingsScreen from "../screens/SettingsScreen";
import UserManagementScreen from "../screens/UserManagementScreen";
import HistoryScreen from "../screens/HistoryScreen";
import MenuScreen from "../screens/MenuScreen";
import NotificationsScreen from "../screens/NotificationsScreen";
import ActivityListScreen from "../screens/history/ActivityListScreen";
import LiveViewScreen from "../screens/quickActions/LiveViewScreen";
import SendCodeScreen from "../screens/quickActions/SendCodeScreen";
import AccessLogsScreen from "../screens/quickActions/AccessLogsScreen";
import GuestOTPScreen from "../screens/quickActions/GuestOTPScreen";
import AddLockWizardScreen from "../screens/devices/AddLockWizardScreen";
import AddLockConfirmationScreen from "../screens/devices/AddLockConfirmationScreen";
import DeviceDiagnosticsScreen from "../screens/devices/DeviceDiagnosticsScreen";
import DeviceDiagnosticsSummaryScreen from "../screens/devices/DeviceDiagnosticsSummaryScreen";
import AddUserScreen from "../screens/AddUserScreen";
import UserHistoryScreen from "../screens/UserHistoryScreen";
import EditUserAccessScreen from "../screens/EditUserAccessScreen";
import LockSettingsScreen from "../screens/LockSettingsScreen";
import ConnectTTLockScreen from "../screens/ConnectTTLockScreen";
import AddLockMethodScreen from "../screens/devices/AddLockMethodScreen";
import TTLockCloudLoginScreen from "../screens/devices/TTLockCloudLoginScreen";
import BluetoothLockPairingScreen from "../screens/devices/BluetoothLockPairingScreen";
import ProfileScreen from "../screens/ProfileScreen";
import NotificationPreferencesScreen from "../screens/NotificationPreferencesScreen";
import AccessMethodsManagementScreen from "../screens/AccessMethodsManagementScreen";
import InviteManagementScreen from "../screens/InviteManagementScreen";
import ActivityStatsScreen from "../screens/ActivityStatsScreen";
import SecurityDashboardScreen from "../screens/SecurityDashboardScreen";
import DebugLogsScreen from "../screens/DebugLogsScreen";
import LockSoundSettingsScreen from "../screens/LockSoundSettingsScreen";
import EmergencyUnlockScreen from "../screens/EmergencyUnlockScreen";
import GuestAccessHistoryScreen from "../screens/GuestAccessHistoryScreen";
import UserActivityHistoryScreen from "../screens/UserActivityHistoryScreen";
import LockPairingScreen from "../screens/LockPairingScreen";
import FingerprintManagementScreen from "../screens/FingerprintManagementScreen";
import CardManagementScreen from "../screens/CardManagementScreen";
import AccessCodeManagementScreen from "../screens/AccessCodeManagementScreen";
import OfflinePasscodeScreen from "../screens/OfflinePasscodeScreen";
import FactoryResetScreen from "../screens/FactoryResetScreen";
import RecoveryKeysScreen from "../screens/RecoveryKeysScreen";
import NotificationSettingsScreen from "../screens/NotificationSettingsScreen";
import AppearanceSettingsScreen from "../screens/AppearanceSettingsScreen";
import SecuritySettingsScreen from "../screens/SecuritySettingsScreen";
import HelpSupportScreen from "../screens/HelpSupportScreen";
import AboutScreen from "../screens/AboutScreen";
import AIInsightsScreen from "../screens/AIInsightsScreen";
import ChatAssistantScreen from "../screens/ChatAssistantScreen";
import SmartRulesScreen from "../screens/SmartRulesScreen";
import HomeModeScreen from "../screens/HomeModeScreen";
import BatteryPredictionScreen from "../screens/BatteryPredictionScreen";
import Colors from "../constants/Colors";

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

const ConsumerTabs = () => (
  <Tab.Navigator
    screenOptions={({ route }) => ({
      tabBarIcon: ({ focused, color, size }) => {
        let iconName;
        let IconComponent = Ionicons;

        if (route.name === "Home") {
          iconName = focused ? "home" : "home-outline";
        } else if (route.name === "UserManagement") {
          IconComponent = MaterialIcons;
          iconName = "group";
          color = focused ? Colors.iconbackground : Colors.subtitlecolor;
        } else if (route.name === "Devices") {
          iconName = focused ? "hardware-chip" : "hardware-chip-outline";
        } else if (route.name === "History") {
          iconName = focused ? "time" : "time-outline";
        } else if (route.name === "Settings") {
          iconName = focused ? "settings" : "settings-outline";
        }

        return <IconComponent name={iconName} size={size} color={color} />;
      },
      tabBarActiveTintColor: Colors.iconbackground,
      tabBarInactiveTintColor: "gray",
      headerShown: false,
      tabBarStyle: {
        backgroundColor: Colors.cardbackground,
        paddingBottom: 18,
        height: 90,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: "#f0f0f0",
      },
      tabBarLabelStyle: {
        fontSize: 12,
        fontWeight: "500",
      },
    })}
  >
    <Tab.Screen name="Home" component={HomeScreen} />
    <Tab.Screen
      name="UserManagement"
      component={UserManagementScreen}
      options={{ tabBarLabel: "Users" }}
    />
    <Tab.Screen
      name="Devices"
      component={DevicesScreen}
      options={{ tabBarLabel: "Devices" }}
    />
    <Tab.Screen name="History" component={HistoryScreen} />
    <Tab.Screen name="Settings" component={SettingsScreen} />
  </Tab.Navigator>
);

const ConsumerNavigator = () => (
  <Stack.Navigator>
    <Stack.Screen
      name="ConsumerTabs"
      component={ConsumerTabs}
      options={{ headerShown: false }}
    />

    {/* New elder-friendly screens */}
    <Stack.Screen name="MinimalHome" component={MinimalHomeScreen} options={{ headerShown: false }} />
    <Stack.Screen name="Help" component={HelpScreen} options={{ headerShown: false }} />
    <Stack.Screen name="Glossary" component={GlossaryScreen} options={{ headerShown: false }} />
    <Stack.Screen name="SimpleModeSettings" component={SimpleModeSettingsScreen} options={{ headerShown: false }} />
    <Stack.Screen name="TrustedContacts" component={TrustedContactsScreen} options={{ headerShown: false }} />

    {/* Emergency and optional screens */}
    <Stack.Screen name="EmergencyNotification" component={EmergencyNotificationScreen} options={{ headerShown: false }} />
    <Stack.Screen name="PersonalizeApp" component={PersonalizeAppScreen} options={{ headerShown: false }} />

    {/* Add Lock Wizard steps */}
    <Stack.Screen name="PairLock" component={PairLockScreen} options={{ headerShown: false }} />
    <Stack.Screen name="NameDoor" component={NameDoorScreen} options={{ headerShown: false }} />
    <Stack.Screen name="SafetyBackup" component={SafetyBackupScreen} options={{ headerShown: false }} />

    {/* Existing screens */}
    <Stack.Screen name="LockDetail" component={LockDetailScreen} options={{ headerShown: false }} />
    <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ headerShown: false }} />
    <Stack.Screen name="ActivityList" component={ActivityListScreen} options={{ headerShown: false }} />
    <Stack.Screen name="LiveView" component={LiveViewScreen} options={{ headerShown: false }} />
    <Stack.Screen name="SendCode" component={SendCodeScreen} options={{ headerShown: false }} />
    <Stack.Screen name="AccessLogs" component={AccessLogsScreen} options={{ headerShown: false }} />
    <Stack.Screen name="GuestOtp" component={GuestOTPScreen} options={{ headerShown: false }} />
    <Stack.Screen name="AddLockWizard" component={AddLockWizardScreen} options={{ headerShown: false }} />
    <Stack.Screen name="AddLockConfirmation" component={AddLockConfirmationScreen} options={{ headerShown: false }} />
    <Stack.Screen name="DeviceDiagnostics" component={DeviceDiagnosticsScreen} options={{ headerShown: false }} />
    <Stack.Screen
      name="DeviceDiagnosticsSummary"
      component={DeviceDiagnosticsSummaryScreen}
      options={{ headerShown: false }}
    />
    <Stack.Screen name="AddUser" component={AddUserScreen} options={{ headerShown: false }} />
    <Stack.Screen name="UserHistory" component={UserHistoryScreen} options={{ headerShown: false }} />
    <Stack.Screen name="EditUserAccess" component={EditUserAccessScreen} options={{ headerShown: false }} />
    <Stack.Screen name="LockSettings" component={LockSettingsScreen} options={{ headerShown: false }} />
    <Stack.Screen name="ConnectTTLock" component={ConnectTTLockScreen} options={{ headerShown: false }} />
    <Stack.Screen name="AddLockMethod" component={AddLockMethodScreen} options={{ headerShown: false }} />
    <Stack.Screen name="TTLockCloudLogin" component={TTLockCloudLoginScreen} options={{ headerShown: false }} />
    <Stack.Screen name="BluetoothLockPairing" component={BluetoothLockPairingScreen} options={{ headerShown: false }} />
    <Stack.Screen name="UserManagementLock" component={UserManagementScreen} options={{ headerShown: false }} />
    <Stack.Screen name="Profile" component={ProfileScreen} options={{ headerShown: false }} />
    <Stack.Screen name="NotificationPreferences" component={NotificationPreferencesScreen} options={{ headerShown: false }} />
    <Stack.Screen name="AccessMethodsManagement" component={AccessMethodsManagementScreen} options={{ headerShown: false }} />
    <Stack.Screen name="InviteManagement" component={InviteManagementScreen} options={{ headerShown: false }} />
    <Stack.Screen name="ActivityStats" component={ActivityStatsScreen} options={{ headerShown: false }} />
    <Stack.Screen name="SecurityDashboard" component={SecurityDashboardScreen} options={{ headerShown: false }} />
    <Stack.Screen name="DebugLogs" component={DebugLogsScreen} options={{ headerShown: false }} />
    <Stack.Screen name="LockSoundSettings" component={LockSoundSettingsScreen} options={{ headerShown: false }} />
    <Stack.Screen name="EmergencyUnlock" component={EmergencyUnlockScreen} options={{ headerShown: false }} />
    <Stack.Screen name="GuestAccessHistory" component={GuestAccessHistoryScreen} options={{ headerShown: false }} />
    <Stack.Screen name="UserActivityHistory" component={UserActivityHistoryScreen} options={{ headerShown: false }} />
    <Stack.Screen name="LockPairing" component={LockPairingScreen} options={{ headerShown: false }} />
    <Stack.Screen name="FingerprintManagement" component={FingerprintManagementScreen} options={{ headerShown: false }} />
    <Stack.Screen name="CardManagement" component={CardManagementScreen} options={{ headerShown: false }} />
    <Stack.Screen name="AccessCodeManagement" component={AccessCodeManagementScreen} options={{ headerShown: false }} />
    <Stack.Screen name="OfflinePasscode" component={OfflinePasscodeScreen} options={{ headerShown: false }} />
    <Stack.Screen name="FactoryReset" component={FactoryResetScreen} options={{ headerShown: false }} />
    <Stack.Screen name="RecoveryKeys" component={RecoveryKeysScreen} options={{ headerShown: false }} />

    {/* Settings Sub-screens */}
    <Stack.Screen name="NotificationSettings" component={NotificationSettingsScreen} options={{ headerShown: false }} />
    <Stack.Screen name="AppearanceSettings" component={AppearanceSettingsScreen} options={{ headerShown: false }} />
    <Stack.Screen name="SecuritySettings" component={SecuritySettingsScreen} options={{ headerShown: false }} />
    <Stack.Screen name="HelpSupport" component={HelpSupportScreen} options={{ headerShown: false }} />
    <Stack.Screen name="About" component={AboutScreen} options={{ headerShown: false }} />

    {/* AI Features */}
    <Stack.Screen name="AIInsights" component={AIInsightsScreen} options={{ headerShown: false }} />
    <Stack.Screen name="ChatAssistant" component={ChatAssistantScreen} options={{ headerShown: false }} />
    <Stack.Screen name="SmartRules" component={SmartRulesScreen} options={{ headerShown: false }} />
    <Stack.Screen name="HomeMode" component={HomeModeScreen} options={{ headerShown: false }} />
    <Stack.Screen name="BatteryPrediction" component={BatteryPredictionScreen} options={{ headerShown: false }} />

    <Stack.Screen
      name="Menu"
      component={MenuScreen}
      options={{
        headerShown: false,
        presentation: "transparentModal",
        cardStyleInterpolator: ({ current, layouts }) => {
          return {
            cardStyle: {
              transform: [
                {
                  translateX: current.progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-layouts.screen.width, 0],
                  }),
                },
              ],
            },
          };
        },
        gestureEnabled: true,
        gestureDirection: "horizontal-inverted"
      }}
    />
  </Stack.Navigator>
);

export default ConsumerNavigator;
