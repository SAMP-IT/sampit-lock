import React, { useState } from 'react';
import { Text, TouchableOpacity, StyleSheet, View, TextInput, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AppScreen from '../../components/ui/AppScreen';
import AppCard from '../../components/ui/AppCard';
import Colors from '../../constants/Colors';
import Theme from '../../constants/Theme';
import { useRole } from '../../context/RoleContext';
import { signUp } from '../../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import secureStorage from '../../services/secureStorage';

const SignUpScreen = ({ navigation }) => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const { setRole } = useRole();

  const updateFormData = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSignUp = async () => {
    setIsLoading(true);
    setError(null);

    // Validate email
    if (!formData.email || !formData.email.includes('@')) {
      setError("Please enter a valid email address.");
      setIsLoading(false);
      return;
    }

    // Validate first name
    if (!formData.firstName.trim()) {
      setError("Please enter your first name.");
      setIsLoading(false);
      return;
    }

    // Validate last name
    if (!formData.lastName.trim()) {
      setError("Please enter your last name.");
      setIsLoading(false);
      return;
    }

    // Validate password length
    if (formData.password.length < 8) {
      setError("Password must be at least 8 characters.");
      setIsLoading(false);
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match.");
      setIsLoading(false);
      return;
    }

    if (!agreeToTerms) {
      setError("You must agree to the terms of service.");
      setIsLoading(false);
      return;
    }

    try {
      console.log('🔐 SignUpScreen: Starting registration for:', formData.email);
      const response = await signUp({
        email: formData.email,
        password: formData.password,
        first_name: formData.firstName,
        last_name: formData.lastName
      });

      const { token, refresh_token, user } = response.data;

      console.log('✅ SignUpScreen: Registration successful, user:', user?.email);

      // Get user role from user data or default to owner
      const userRole = user?.role || 'owner';
      console.log('✅ SignUpScreen: Setting role to:', userRole);

      // Store user role in AsyncStorage (non-sensitive)
      await AsyncStorage.setItem('userRole', userRole);

      // Store refresh token securely (iOS Keychain)
      if (refresh_token) {
        await secureStorage.setItem('refreshToken', refresh_token);
        console.log('✅ SignUpScreen: Refresh token stored securely');
      }

      // Set role directly to trigger navigation to main app
      console.log('✅ SignUpScreen: Setting user role, will navigate to main app');
      setRole(userRole);

    } catch (err) {
      console.error('❌ SignUpScreen: Registration failed:', err);
      setError(err.response?.data?.error?.message || 'An unexpected error occurred during sign up.');
    } finally {
      setIsLoading(false);
    }
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
        <Text style={styles.heroBadge}>Create account</Text>
        <Text style={styles.heroTitle}>Join Awakey</Text>
        <Text style={styles.heroSubtitle}>
          Create your account to start managing your smart locks
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
              value={formData.email}
              onChangeText={(value) => updateFormData('email', value)}
              placeholder="Enter your email"
              placeholderTextColor={Colors.subtitlecolor}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        </View>

        <View style={styles.nameRow}>
          <View style={[styles.inputContainer, { flex: 1 }]}>
            <Text style={styles.inputLabel}>First Name</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.textInput}
                value={formData.firstName}
                onChangeText={(value) => updateFormData('firstName', value)}
                placeholder="First name"
                placeholderTextColor={Colors.subtitlecolor}
                autoCapitalize="words"
                autoCorrect={false}
              />
            </View>
          </View>
          <View style={{ width: 12 }} />
          <View style={[styles.inputContainer, { flex: 1 }]}>
            <Text style={styles.inputLabel}>Last Name</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.textInput}
                value={formData.lastName}
                onChangeText={(value) => updateFormData('lastName', value)}
                placeholder="Last name"
                placeholderTextColor={Colors.subtitlecolor}
                autoCapitalize="words"
                autoCorrect={false}
              />
            </View>
          </View>
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Password</Text>
          <View style={styles.inputWrapper}>
            <Ionicons name="lock-closed-outline" size={20} color={Colors.subtitlecolor} style={styles.inputIcon} />
            <TextInput
              style={styles.textInput}
              value={formData.password}
              onChangeText={(value) => updateFormData('password', value)}
              placeholder="Create a password (min 8 characters)"
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

        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Confirm Password</Text>
          <View style={styles.inputWrapper}>
            <Ionicons name="lock-closed-outline" size={20} color={Colors.subtitlecolor} style={styles.inputIcon} />
            <TextInput
              style={styles.textInput}
              value={formData.confirmPassword}
              onChangeText={(value) => updateFormData('confirmPassword', value)}
              placeholder="Confirm your password"
              placeholderTextColor={Colors.subtitlecolor}
              secureTextEntry={!showConfirmPassword}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              style={styles.passwordToggle}
            >
              <Ionicons
                name={showConfirmPassword ? "eye-off-outline" : "eye-outline"}
                size={20}
                color={Colors.subtitlecolor}
              />
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={styles.termsContainer}
          onPress={() => setAgreeToTerms(!agreeToTerms)}
        >
          <View style={[styles.checkbox, agreeToTerms && styles.checkboxChecked]}>
            {agreeToTerms && (
              <Ionicons name="checkmark" size={16} color={Colors.textwhite} />
            )}
          </View>
          <Text style={styles.termsText}>
            I agree to the <Text style={styles.termsLink}>Terms of Service</Text> and{' '}
            <Text style={styles.termsLink}>Privacy Policy</Text>
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.signUpButton, isLoading && styles.signUpButtonDisabled]}
          onPress={handleSignUp}
          disabled={isLoading}
          activeOpacity={0.9}
        >
          {isLoading ? (
            <Text style={styles.signUpButtonText}>Creating Account...</Text>
          ) : (
            <>
              <Text style={styles.signUpButtonText}>Create Account</Text>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={Colors.textwhite}
                style={styles.signUpButtonIcon}
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
          style={styles.loginButton}
          onPress={() => navigation.navigate('Login')}
          activeOpacity={0.8}
        >
          <Text style={styles.loginButtonText}>
            Already have an account? <Text style={styles.loginButtonLink}>Sign In</Text>
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
    gap: Theme.spacing.md,
  },
  inputContainer: {
    gap: Theme.spacing.sm,
  },
  nameRow: {
    flexDirection: 'row',
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
  termsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Theme.spacing.sm,
    marginTop: Theme.spacing.sm,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: Colors.subtitlecolor,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: Colors.iconbackground,
    borderColor: Colors.iconbackground,
  },
  termsText: {
    flex: 1,
    fontSize: 14,
    color: Colors.subtitlecolor,
    lineHeight: 20,
  },
  termsLink: {
    color: Colors.iconbackground,
    fontWeight: '600',
  },
  signUpButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.iconbackground,
    paddingVertical: Theme.spacing.md,
    borderRadius: Theme.radius.pill,
    marginTop: Theme.spacing.md,
  },
  signUpButtonDisabled: {
    opacity: 0.6,
  },
  signUpButtonText: {
    color: Colors.textwhite,
    fontSize: 16,
    fontWeight: '600',
  },
  signUpButtonIcon: {
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
  loginButton: {
    alignSelf: 'center',
  },
  loginButtonText: {
    color: Colors.subtitlecolor,
    fontSize: 14,
  },
  loginButtonLink: {
    color: Colors.iconbackground,
    fontWeight: '600',
  },
});

export default SignUpScreen;
