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
import {
  validateEmail,
  validatePassword,
  validatePasswordMatch,
  validateName,
  sanitizeInput
} from '../../utils/validation';

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
  const [fieldErrors, setFieldErrors] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
  });
  const [touchedFields, setTouchedFields] = useState({
    email: false,
    password: false,
    confirmPassword: false,
    firstName: false,
    lastName: false,
  });
  const { setRole } = useRole();

  const updateFormData = (field, value) => {
    // Sanitize input based on field type
    let sanitizedValue = value;
    
    if (field === 'email') {
      // For email, allow email-valid characters
      sanitizedValue = sanitizeInput(value, { allowSpecialChars: true, trim: false });
    } else if (field === 'firstName' || field === 'lastName') {
      // For names, allow letters, spaces, hyphens, apostrophes
      sanitizedValue = sanitizeInput(value, { allowSpaces: true, allowSpecialChars: false, trim: false });
      // Further sanitize to only allow name-valid characters
      sanitizedValue = sanitizedValue.replace(/[^a-zA-Z\s'-]/g, '');
    } else if (field === 'password' || field === 'confirmPassword') {
      // For passwords, allow most characters but remove SQL injection patterns
      sanitizedValue = sanitizeInput(value, { allowSpecialChars: true, trim: false });
    }

    setFormData(prev => ({ ...prev, [field]: sanitizedValue }));

    // Real-time validation
    if (touchedFields[field] || value.length > 0) {
      validateField(field, sanitizedValue);
    }
  };

  const validateField = (field, value) => {
    let error = '';

    switch (field) {
      case 'email':
        const emailValidation = validateEmail(value);
        if (!emailValidation.isValid && value.length > 0) {
          error = emailValidation.message;
        }
        break;
      case 'password':
        const passwordValidation = validatePassword(value);
        if (!passwordValidation.isValid && value.length > 0) {
          error = passwordValidation.message;
        }
        break;
      case 'confirmPassword':
        if (value.length > 0) {
          const matchValidation = validatePasswordMatch(formData.password, value);
          if (!matchValidation.isValid) {
            error = matchValidation.message;
          }
        }
        break;
      case 'firstName':
        const firstNameValidation = validateName(value);
        if (!firstNameValidation.isValid && value.length > 0) {
          error = firstNameValidation.message;
        }
        break;
      case 'lastName':
        const lastNameValidation = validateName(value);
        if (!lastNameValidation.isValid && value.length > 0) {
          error = lastNameValidation.message;
        }
        break;
    }

    setFieldErrors(prev => ({ ...prev, [field]: error }));
  };

  const handleBlur = (field) => {
    setTouchedFields(prev => ({ ...prev, [field]: true }));
    validateField(field, formData[field]);
  };

  const handleSignUp = async () => {
    setIsLoading(true);
    setError(null);

    // Mark all fields as touched
    const allFields = ['email', 'firstName', 'lastName', 'password', 'confirmPassword'];
    allFields.forEach(field => {
      setTouchedFields(prev => ({ ...prev, [field]: true }));
      validateField(field, formData[field]);
    });

    // Validate all fields
    const emailValidation = validateEmail(formData.email);
    const firstNameValidation = validateName(formData.firstName);
    const lastNameValidation = validateName(formData.lastName);
    const passwordValidation = validatePassword(formData.password);
    const passwordMatchValidation = validatePasswordMatch(formData.password, formData.confirmPassword);

    // Check if any validation failed
    if (!emailValidation.isValid) {
      setFieldErrors(prev => ({ ...prev, email: emailValidation.message }));
      setError(emailValidation.message);
      setIsLoading(false);
      return;
    }

    if (!firstNameValidation.isValid) {
      setFieldErrors(prev => ({ ...prev, firstName: firstNameValidation.message }));
      setError(firstNameValidation.message);
      setIsLoading(false);
      return;
    }

    if (!lastNameValidation.isValid) {
      setFieldErrors(prev => ({ ...prev, lastName: lastNameValidation.message }));
      setError(lastNameValidation.message);
      setIsLoading(false);
      return;
    }

    if (!passwordValidation.isValid) {
      setFieldErrors(prev => ({ ...prev, password: passwordValidation.message }));
      setError(passwordValidation.message);
      setIsLoading(false);
      return;
    }

    if (!passwordMatchValidation.isValid) {
      setFieldErrors(prev => ({ ...prev, confirmPassword: passwordMatchValidation.message }));
      setError(passwordMatchValidation.message);
      setIsLoading(false);
      return;
    }

    if (!agreeToTerms) {
      setError("You must agree to the terms of service.");
      setIsLoading(false);
      return;
    }

    // Sanitize all inputs before sending
    const sanitizedEmail = emailValidation.sanitized || sanitizeInput(formData.email.trim().toLowerCase(), { allowSpecialChars: true });
    const sanitizedFirstName = sanitizeInput(formData.firstName.trim(), { allowSpaces: true, allowSpecialChars: false });
    const sanitizedLastName = sanitizeInput(formData.lastName.trim(), { allowSpaces: true, allowSpecialChars: false });

    try {
      console.log('🔐 SignUpScreen: Starting registration for:', sanitizedEmail);
      const response = await signUp({
        email: sanitizedEmail,
        password: formData.password, // Password is already validated, no need to sanitize
        first_name: sanitizedFirstName,
        last_name: sanitizedLastName
      });

      const { token, refresh_token, user } = response.data;

      console.log('✅ SignUpScreen: Registration successful, user:', user?.email);

      // Get user role from user data or default to owner
      const userRole = user?.role || 'owner';
      console.log('✅ SignUpScreen: Setting role to:', userRole);

      // Store user role in AsyncStorage
      await AsyncStorage.setItem('userRole', userRole);

      // Store refresh token for auto token refresh
      if (refresh_token) {
        await AsyncStorage.setItem('refreshToken', refresh_token);
        console.log('✅ SignUpScreen: Refresh token stored');
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
          <View style={[
            styles.inputWrapper,
            touchedFields.email && fieldErrors.email && styles.inputWrapperError
          ]}>
            <Ionicons 
              name="mail-outline" 
              size={20} 
              color={touchedFields.email && fieldErrors.email ? '#ef4444' : Colors.subtitlecolor} 
              style={styles.inputIcon} 
            />
            <TextInput
              style={styles.textInput}
              value={formData.email}
              onChangeText={(value) => updateFormData('email', value)}
              onBlur={() => handleBlur('email')}
              placeholder="Enter your email"
              placeholderTextColor={Colors.subtitlecolor}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          {touchedFields.email && fieldErrors.email && (
            <Text style={styles.fieldErrorText}>{fieldErrors.email}</Text>
          )}
        </View>

        <View style={styles.nameRow}>
          <View style={[styles.inputContainer, { flex: 1 }]}>
            <Text style={styles.inputLabel}>First Name</Text>
            <View style={[
              styles.inputWrapper,
              touchedFields.firstName && fieldErrors.firstName && styles.inputWrapperError
            ]}>
              <TextInput
                style={styles.textInput}
                value={formData.firstName}
                onChangeText={(value) => updateFormData('firstName', value)}
                onBlur={() => handleBlur('firstName')}
                placeholder="First name"
                placeholderTextColor={Colors.subtitlecolor}
                autoCapitalize="words"
                autoCorrect={false}
              />
            </View>
            {touchedFields.firstName && fieldErrors.firstName && (
              <Text style={styles.fieldErrorText}>{fieldErrors.firstName}</Text>
            )}
          </View>
          <View style={{ width: 12 }} />
          <View style={[styles.inputContainer, { flex: 1 }]}>
            <Text style={styles.inputLabel}>Last Name</Text>
            <View style={[
              styles.inputWrapper,
              touchedFields.lastName && fieldErrors.lastName && styles.inputWrapperError
            ]}>
              <TextInput
                style={styles.textInput}
                value={formData.lastName}
                onChangeText={(value) => updateFormData('lastName', value)}
                onBlur={() => handleBlur('lastName')}
                placeholder="Last name"
                placeholderTextColor={Colors.subtitlecolor}
                autoCapitalize="words"
                autoCorrect={false}
              />
            </View>
            {touchedFields.lastName && fieldErrors.lastName && (
              <Text style={styles.fieldErrorText}>{fieldErrors.lastName}</Text>
            )}
          </View>
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Password</Text>
          <View style={[
            styles.inputWrapper,
            touchedFields.password && fieldErrors.password && styles.inputWrapperError
          ]}>
            <Ionicons 
              name="lock-closed-outline" 
              size={20} 
              color={touchedFields.password && fieldErrors.password ? '#ef4444' : Colors.subtitlecolor} 
              style={styles.inputIcon} 
            />
            <TextInput
              style={styles.textInput}
              value={formData.password}
              onChangeText={(value) => updateFormData('password', value)}
              onBlur={() => handleBlur('password')}
              placeholder="Create a strong password"
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
                color={touchedFields.password && fieldErrors.password ? '#ef4444' : Colors.subtitlecolor}
              />
            </TouchableOpacity>
          </View>
          {touchedFields.password && fieldErrors.password && (
            <Text style={styles.fieldErrorText}>{fieldErrors.password}</Text>
          )}
          {formData.password.length > 0 && (
            <View style={styles.passwordRequirements}>
              <Text style={styles.passwordRequirementText}>
                Password must contain: 8+ characters, uppercase, lowercase, number, special character
              </Text>
            </View>
          )}
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Confirm Password</Text>
          <View style={[
            styles.inputWrapper,
            touchedFields.confirmPassword && fieldErrors.confirmPassword && styles.inputWrapperError
          ]}>
            <Ionicons 
              name="lock-closed-outline" 
              size={20} 
              color={touchedFields.confirmPassword && fieldErrors.confirmPassword ? '#ef4444' : Colors.subtitlecolor} 
              style={styles.inputIcon} 
            />
            <TextInput
              style={styles.textInput}
              value={formData.confirmPassword}
              onChangeText={(value) => updateFormData('confirmPassword', value)}
              onBlur={() => handleBlur('confirmPassword')}
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
                color={touchedFields.confirmPassword && fieldErrors.confirmPassword ? '#ef4444' : Colors.subtitlecolor}
              />
            </TouchableOpacity>
          </View>
          {touchedFields.confirmPassword && fieldErrors.confirmPassword && (
            <Text style={styles.fieldErrorText}>{fieldErrors.confirmPassword}</Text>
          )}
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
  inputWrapperError: {
    borderColor: '#ef4444',
    borderWidth: 2,
  },
  fieldErrorText: {
    color: '#ef4444',
    fontSize: 12,
    marginTop: 4,
    marginLeft: Theme.spacing.xs,
  },
  passwordRequirements: {
    marginTop: Theme.spacing.xs,
    paddingLeft: Theme.spacing.xs,
  },
  passwordRequirementText: {
    fontSize: 11,
    color: Colors.subtitlecolor,
    lineHeight: 16,
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
