import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import MinimalHomeScreen from '../screens/MinimalHomeScreen';
import HelpScreen from '../screens/HelpScreen';
import GlossaryScreen from '../screens/GlossaryScreen';
import SimpleModeSettingsScreen from '../screens/SimpleModeSettingsScreen';
import TrustedContactsScreen from '../screens/TrustedContactsScreen';
import EmergencyNotificationScreen from '../screens/EmergencyNotificationScreen';
import PersonalizeAppScreen from '../screens/PersonalizeAppScreen';
// Shared screens
import LockDetailScreen from '../screens/LockDetailScreen';

// Legacy screens
import GuestAccessScreen from '../screens/guest/GuestAccessScreen';
import GuestHelpScreen from '../screens/guest/GuestHelpScreen';

const Stack = createStackNavigator();

const GuestNavigator = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    {/* Main guest interface */}
    <Stack.Screen name="Home" component={MinimalHomeScreen} />

    {/* Help and support */}
    <Stack.Screen name="Help" component={HelpScreen} />
    <Stack.Screen name="Glossary" component={GlossaryScreen} />

    {/* Settings (limited for guests) */}
    <Stack.Screen name="Settings" component={SimpleModeSettingsScreen} />
    <Stack.Screen name="SimpleModeSettings" component={SimpleModeSettingsScreen} />
    <Stack.Screen name="TrustedContacts" component={TrustedContactsScreen} />

    {/* Emergency and optional screens */}
    <Stack.Screen name="EmergencyNotification" component={EmergencyNotificationScreen} />
    <Stack.Screen name="PersonalizeApp" component={PersonalizeAppScreen} />

    {/* Shared screens (read-only for guests) */}
    <Stack.Screen name="LockDetail" component={LockDetailScreen} />

    {/* Legacy screens - keep for backward compatibility */}
    <Stack.Screen name="GuestAccess" component={GuestAccessScreen} />
    <Stack.Screen name="GuestHelp" component={GuestHelpScreen} />
  </Stack.Navigator>
);

export default GuestNavigator;
