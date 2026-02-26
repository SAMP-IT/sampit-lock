import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import AuthNavigator from './AuthNavigator';
import ConsumerNavigator from './ConsumerNavigator';
import GuestNavigator from './GuestNavigator';
import FamilyNavigator from './FamilyNavigator';
import { useRole } from '../context/RoleContext';
import { usePermissions } from '../context/PermissionsContext';
import PermissionsScreen from '../screens/PermissionsScreen';
import Colors from '../constants/Colors';

const RootNavigator = () => {
  const { role, isAuthenticating } = useRole();
  const {
    shouldShowPermissionsScreen,
    isCheckingPermissions,
    setPermissionsVerified,
  } = usePermissions();

  console.log('🔐 RootNavigator - Current role:', role, '| Authenticating:', isAuthenticating);

  // Show loading screen while checking authentication
  if (isAuthenticating) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.iconbackground} />
      </View>
    );
  }

  // If not authenticated, show auth navigator (no permissions check needed)
  if (role === null || role === 'auth') {
    console.log('🔒 RootNavigator: Showing AuthNavigator');
    return <AuthNavigator />;
  }

  // User is authenticated - check permissions and Bluetooth
  // Show permissions screen if permissions not granted or Bluetooth is off
  if (shouldShowPermissionsScreen) {
    console.log('🔑 RootNavigator: Showing PermissionsScreen');
    return (
      <PermissionsScreen
        onPermissionsGranted={() => {
          console.log('✅ RootNavigator: Permissions granted, proceeding to main app');
          setPermissionsVerified(true);
        }}
      />
    );
  }

  // All permissions granted and Bluetooth is ON - show main app
  // Map all 6 DB roles (owner, admin, family, scheduled, guest_otp, guest_longterm)
  // to the appropriate navigator
  switch (role) {
    case 'owner':
    case 'admin':
      console.log(`✅ RootNavigator: Showing ConsumerNavigator for ${role}`);
      return <ConsumerNavigator />;
    case 'family':
    case 'scheduled':
    case 'guest_longterm':
      console.log(`✅ RootNavigator: Showing FamilyNavigator for ${role}`);
      return <FamilyNavigator />;
    case 'guest':
    case 'guest_otp':
      console.log(`✅ RootNavigator: Showing GuestNavigator for ${role}`);
      return <GuestNavigator />;
    default:
      console.log(`✅ RootNavigator: Showing FamilyNavigator (default for role: ${role})`);
      return <FamilyNavigator />;
  }
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
});

export default RootNavigator;
