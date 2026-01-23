import React, { useState } from 'react';
import { Text, TouchableOpacity, StyleSheet, View, TextInput, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AppScreen from '../../components/ui/AppScreen';
import AppCard from '../../components/ui/AppCard';
import Colors from '../../constants/Colors';
import Theme from '../../constants/Theme';
import { useRole } from '../../context/RoleContext';
import { login } from '../../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import pushNotificationService from '../../services/pushNotificationService';

const LoginScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const { inferRole, setRole } = useRole();

  const handleLogin = async () => {
    setIsLoading(true);
    setError(null);

    try {
      console.log('🔐 LoginScreen: Starting login for:', email);
      const response = await login(email, password);
      const { token, refresh_token, user } = response.data;

      console.log('✅ LoginScreen: Login successful, user:', user?.email);

      // Get user role from user data or default to owner
      const userRole = user?.role || 'owner';
      console.log('✅ LoginScreen: Setting role to:', userRole);

      // Store user role and refresh token in AsyncStorage
      await AsyncStorage.setItem('userRole', userRole);

      // Store refresh token for auto token refresh
      if (refresh_token) {
        await AsyncStorage.setItem('refreshToken', refresh_token);
        console.log('✅ LoginScreen: Refresh token stored');
      }

      // Initialize push notifications after successful login
      console.log('🔔 LoginScreen: Initializing push notifications...');
      pushNotificationService.initializePushNotifications().then((success) => {
        if (success) {
          console.log('✅ Push notifications initialized successfully');
        } else {
          console.log('⚠️ Push notifications not enabled (user may have denied permission)');
        }
      }).catch((err) => {
        console.warn('⚠️ Push notification initialization error:', err);
      });

      // Set role directly to trigger navigation to main app
      // This will cause RootNavigator to show the appropriate screen
      console.log('✅ LoginScreen: Setting user role, will navigate to main app');
      setRole(userRole);
    } catch (err) {
      console.error('❌ LoginScreen: Login failed:', err);
      setError(err.response?.data?.error?.message || 'Invalid email or password.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = () => {
    navigation.navigate('ForgotPassword');
  };

  return (
    <AppScreen contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={24} color={Colors.titlecolor} />
        </TouchableOpacity>
      </View>

      <View style={styles.heroBlock}>
        <Text style={styles.heroBadge}>Welcome back</Text>
        <Text style={styles.heroTitle}>Sign in to your account</Text>
        <Text style={styles.heroSubtitle}>
          Enter your credentials to access your smart locks
        </Text>
      </View>

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <AppCard style={styles.authCard}>
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Email</Text>
          <View style={styles.inputWrapper}>
            <Ionicons name="mail-outline" size={20} color={Colors.subtitlecolor} style={styles.inputIcon} />
            <TextInput
              style={styles.textInput}
              value={email}
              onChangeText={setEmail}
              placeholder="Enter your email"
              placeholderTextColor={Colors.subtitlecolor}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Password</Text>
          <View style={styles.inputWrapper}>
            <Ionicons name="lock-closed-outline" size={20} color={Colors.subtitlecolor} style={styles.inputIcon} />
            <TextInput
              style={styles.textInput}
              value={password}
              onChangeText={setPassword}
              placeholder="Enter your password"
              placeholderTextColor={Colors.subtitlecolor}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              onPress={() => setShowPassword(!showPassword)}
              style={styles.passwordToggle}
            >
              <Ionicons
                name={showPassword ? "eye-off-outline" : "eye-outline"}
                size={20}
                color={Colors.subtitlecolor}
              />
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={styles.forgotPasswordButton}
          onPress={handleForgotPassword}
        >
          <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
          onPress={handleLogin}
          disabled={isLoading}
          activeOpacity={0.9}
        >
          {isLoading ? (
            <Text style={styles.loginButtonText}>Signing in...</Text>
          ) : (
            <>
              <Text style={styles.loginButtonText}>Sign In</Text>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={Colors.textwhite}
                style={styles.loginButtonIcon}
              />
            </>
          )}
        </TouchableOpacity>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        <TouchableOpacity
          style={styles.signUpButton}
          onPress={() => navigation.navigate('SignUp')}
          activeOpacity={0.8}
        >
          <Text style={styles.signUpButtonText}>
            Don't have an account? <Text style={styles.signUpButtonLink}>Sign Up</Text>
          </Text>
        </TouchableOpacity>
      </AppCard>
    </AppScreen>
  );
};

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: Theme.spacing.lg,
    paddingTop: 60,
    paddingBottom: Theme.spacing.xl,
    gap: Theme.spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    padding: Theme.spacing.sm,
    marginLeft: -Theme.spacing.sm,
  },
  heroBlock: {
    backgroundColor: Colors.cardbackground,
    borderRadius: 24,
    padding: Theme.spacing.xl,
    gap: Theme.spacing.sm,
  },
  heroBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.textwhite,
    color: Colors.iconbackground,
    fontWeight: '700',
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.xs,
    borderRadius: Theme.radius.pill,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.titlecolor,
  },
  heroSubtitle: {
    ...Theme.typography.subtitle,
    lineHeight: 22,
  },
  errorContainer: {
    backgroundColor: 'rgba(255, 0, 0, 0.1)',
    borderRadius: Theme.radius.md,
    padding: Theme.spacing.md,
    marginVertical: Theme.spacing.md,
  },
  errorText: {
    color: 'red',
    textAlign: 'center',
  },
  authCard: {
    padding: Theme.spacing.xl,
    gap: Theme.spacing.lg,
  },
  inputContainer: {
    gap: Theme.spacing.sm,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.titlecolor,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardbackground,
    borderRadius: Theme.radius.md,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  inputIcon: {
    marginRight: Theme.spacing.sm,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: Colors.titlecolor,
    paddingVertical: Theme.spacing.xs,
  },
  passwordToggle: {
    padding: Theme.spacing.xs,
  },
  forgotPasswordButton: {
    alignSelf: 'flex-end',
    marginTop: -Theme.spacing.sm,
  },
  forgotPasswordText: {
    color: Colors.iconbackground,
    fontWeight: '600',
    fontSize: 14,
  },
  loginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.iconbackground,
    paddingVertical: Theme.spacing.md,
    borderRadius: Theme.radius.pill,
    marginTop: Theme.spacing.sm,
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loginButtonText: {
    color: Colors.textwhite,
    fontSize: 16,
    fontWeight: '600',
  },
  loginButtonIcon: {
    marginLeft: Theme.spacing.xs,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: Theme.spacing.sm,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.subtitlecolor,
    opacity: 0.3,
  },
  dividerText: {
    marginHorizontal: Theme.spacing.md,
    color: Colors.subtitlecolor,
    fontSize: 14,
  },
  signUpButton: {
    alignSelf: 'center',
  },
  signUpButtonText: {
    color: Colors.subtitlecolor,
    fontSize: 14,
  },
  signUpButtonLink: {
    color: Colors.iconbackground,
    fontWeight: '600',
  },
});

export default LoginScreen;
