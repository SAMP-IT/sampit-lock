import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';

// New elder-friendly screens
import MinimalHomeScreen from '../screens/MinimalHomeScreen';
import HelpScreen from '../screens/HelpScreen';
import GlossaryScreen from '../screens/GlossaryScreen';
import SimpleModeSettingsScreen from '../screens/SimpleModeSettingsScreen';
import TrustedContactsScreen from '../screens/TrustedContactsScreen';
import EmergencyNotificationScreen from '../screens/EmergencyNotificationScreen';
import PersonalizeAppScreen from '../screens/PersonalizeAppScreen';

// Family screens
import FamilyHomeScreen from '../screens/family/FamilyHomeScreen';
import FamilySettingsScreen from '../screens/family/FamilySettingsScreen';

// Shared screens
import LockDetailScreen from '../screens/LockDetailScreen';
import UserManagementScreen from '../screens/UserManagementScreen';

// Quick action screens
import LiveViewScreen from '../screens/quickActions/LiveViewScreen';
import SendCodeScreen from '../screens/quickActions/SendCodeScreen';
import AccessLogsScreen from '../screens/quickActions/AccessLogsScreen';
import GuestOTPScreen from '../screens/quickActions/GuestOTPScreen';
import AccessCodeManagementScreen from '../screens/AccessCodeManagementScreen';
import FingerprintManagementScreen from '../screens/FingerprintManagementScreen';

const Stack = createStackNavigator();

const FamilyNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {/* Main home screen - can be MinimalHome or FamilyHome based on Simple Mode */}
      <Stack.Screen name="Home" component={MinimalHomeScreen} />

      {/* Help and support */}
      <Stack.Screen name="Help" component={HelpScreen} />
      <Stack.Screen name="Glossary" component={GlossaryScreen} />

      {/* Settings and accessibility */}
      <Stack.Screen name="Settings" component={SimpleModeSettingsScreen} />
      <Stack.Screen name="SimpleModeSettings" component={SimpleModeSettingsScreen} />
      <Stack.Screen name="TrustedContacts" component={TrustedContactsScreen} />

      {/* Emergency and optional screens */}
      <Stack.Screen name="EmergencyNotification" component={EmergencyNotificationScreen} />
      <Stack.Screen name="PersonalizeApp" component={PersonalizeAppScreen} />

      {/* Quick actions - family members have more access than guests */}
      <Stack.Screen name="LiveView" component={LiveViewScreen} />
      <Stack.Screen name="SendCode" component={SendCodeScreen} />
      <Stack.Screen name="AccessLogs" component={AccessLogsScreen} />
      <Stack.Screen name="GuestOtp" component={GuestOTPScreen} />
      <Stack.Screen name="AccessCodeManagement" component={AccessCodeManagementScreen} />
      <Stack.Screen name="FingerprintManagement" component={FingerprintManagementScreen} />

      {/* Shared screens */}
      <Stack.Screen name="LockDetail" component={LockDetailScreen} />
      <Stack.Screen name="UserManagement" component={UserManagementScreen} />

      {/* Legacy family screens - keep for advanced mode */}
      <Stack.Screen name="FamilyHome" component={FamilyHomeScreen} />
      <Stack.Screen name="FamilySettings" component={FamilySettingsScreen} />
    </Stack.Navigator>
  );
};

export default FamilyNavigator;
