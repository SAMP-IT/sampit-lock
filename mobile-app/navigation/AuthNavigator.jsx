import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import LogoSplashScreen from '../screens/auth/LogoSplashScreen';
import SplashScreen from '../screens/auth/SplashScreen';
import WelcomeScreen from '../screens/auth/WelcomeScreen';
import AuthFlowScreen from '../screens/auth/AuthFlowScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import SignUpScreen from '../screens/auth/SignUpScreen';
import CompleteProfileScreen from '../screens/auth/CompleteProfileScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';
import ResetPasswordScreen from '../screens/auth/ResetPasswordScreen';
import EmailVerificationScreen from '../screens/auth/EmailVerificationScreen';
import IntentScreen from '../screens/auth/IntentScreen';
import InviteCodeScreen from '../screens/auth/InviteCodeScreen';
import AccessScreen from '../screens/auth/AccessScreen';
import RoleSelectionScreen from '../screens/auth/RoleSelectionScreen';
import OnboardingScreen from '../screens/auth/OnboardingScreen';
import AddLockWizardScreen from '../screens/devices/AddLockWizardScreen';
import PairLockScreen from '../screens/devices/PairLockScreen';
import NameDoorScreen from '../screens/devices/NameDoorScreen';
import SafetyBackupScreen from '../screens/devices/SafetyBackupScreen';
import AddLockConfirmationScreen from '../screens/devices/AddLockConfirmationScreen';
import EmergencyNotificationScreen from '../screens/EmergencyNotificationScreen';
import PersonalizeAppScreen from '../screens/PersonalizeAppScreen';

const Stack = createStackNavigator();

const AuthNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName="LogoSplash">
      <Stack.Screen name="LogoSplash" component={LogoSplashScreen} />
      <Stack.Screen name="Splash" component={SplashScreen} />
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="AuthFlow" component={AuthFlowScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="SignUp" component={SignUpScreen} />
      <Stack.Screen name="CompleteProfile" component={CompleteProfileScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
      <Stack.Screen name="EmailVerification" component={EmailVerificationScreen} />
      <Stack.Screen name="Intent" component={IntentScreen} />
      <Stack.Screen name="AddLockWizard" component={AddLockWizardScreen} />
      <Stack.Screen name="PairLock" component={PairLockScreen} />
      <Stack.Screen name="NameDoor" component={NameDoorScreen} />
      <Stack.Screen name="SafetyBackup" component={SafetyBackupScreen} />
      <Stack.Screen name="AddLockConfirmation" component={AddLockConfirmationScreen} />
      <Stack.Screen name="InviteCode" component={InviteCodeScreen} />
      <Stack.Screen name="AccessScreen" component={AccessScreen} />

      {/* New optional screens */}
      <Stack.Screen name="EmergencyNotification" component={EmergencyNotificationScreen} />
      <Stack.Screen name="PersonalizeApp" component={PersonalizeAppScreen} />

      {/* Legacy screens - keep for optional fallback */}
      <Stack.Screen name="RoleSelection" component={RoleSelectionScreen} />
      <Stack.Screen name="Onboarding" component={OnboardingScreen} />
    </Stack.Navigator>
  );
};

export default AuthNavigator;
