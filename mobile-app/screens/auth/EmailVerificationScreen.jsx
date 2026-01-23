import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AppScreen from '../../components/ui/AppScreen';
import Section from '../../components/ui/Section';
import AppCard from '../../components/ui/AppCard';
import Colors from '../../constants/Colors';
import Theme from '../../constants/Theme';
import { verifyEmail } from '../../services/api';
import { useRole } from '../../context/RoleContext';

const EmailVerificationScreen = ({ route, navigation }) => {
  const { token, email } = route.params || {};
  const { setRole } = useRole();

  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // If token is provided in URL/params, auto-verify
    if (token) {
      handleVerification();
    }
  }, [token]);

  const handleVerification = async () => {
    if (!token) {
      setError('No verification token provided');
      return;
    }

    setVerifying(true);
    setError(null);

    try {
      const response = await verifyEmail(token);

      if (response.data.success) {
        setVerified(true);
        Alert.alert(
          'Email Verified!',
          'Your email has been successfully verified. You can now log in.',
          [
            {
              text: 'Continue to Login',
              onPress: () => navigation.navigate('Login')
            }
          ]
        );
      } else {
        setError(response.data.message || 'Verification failed');
      }
    } catch (err) {
      console.error('Email verification error:', err);
      const errorMessage = err.response?.data?.error?.message
        || 'Failed to verify email. The link may have expired.';
      setError(errorMessage);

      Alert.alert(
        'Verification Failed',
        errorMessage,
        [
          {
            text: 'Try Again',
            onPress: () => setError(null)
          },
          {
            text: 'Back to Login',
            onPress: () => navigation.navigate('Login')
          }
        ]
      );
    } finally {
      setVerifying(false);
    }
  };

  const handleResendEmail = () => {
    Alert.alert(
      'Resend Verification Email',
      'This feature will send a new verification email to your registered address.',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Send',
          onPress: () => {
            // TODO: Implement resend verification email API call
            Alert.alert('Email Sent', 'Please check your inbox for a new verification email.');
          }
        }
      ]
    );
  };

  const handleBackToLogin = () => {
    navigation.navigate('Login');
  };

  if (verifying) {
    return (
      <AppScreen contentContainerStyle={[styles.content, styles.centerContent]}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Verifying your email...</Text>
      </AppScreen>
    );
  }

  if (verified) {
    return (
      <AppScreen contentContainerStyle={styles.content}>
        <View style={styles.centerContent}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark-circle" size={80} color={Colors.success} />
          </View>

          <Text style={styles.title}>Email Verified!</Text>
          <Text style={styles.subtitle}>
            Your email has been successfully verified. You can now access all features of Awaykey.
          </Text>

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleBackToLogin}
          >
            <Text style={styles.primaryButtonText}>Continue to Login</Text>
          </TouchableOpacity>
        </View>
      </AppScreen>
    );
  }

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

      <View style={styles.centerContent}>
        <View style={styles.iconContainer}>
          <Ionicons name="mail-outline" size={64} color={Colors.iconbackground} />
        </View>

        <Text style={styles.title}>Verify Your Email</Text>

        {email && (
          <Text style={styles.emailText}>{email}</Text>
        )}

        <Text style={styles.subtitle}>
          {token
            ? 'Click the button below to verify your email address.'
            : 'We sent a verification link to your email address. Please check your inbox and click the link to verify your account.'
          }
        </Text>
      </View>

      <Section>
        {token && !error && (
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleVerification}
            disabled={verifying}
          >
            {verifying ? (
              <ActivityIndicator color={Colors.textwhite} />
            ) : (
              <Text style={styles.primaryButtonText}>Verify Email</Text>
            )}
          </TouchableOpacity>
        )}

        {error && (
          <AppCard style={styles.errorCard}>
            <Ionicons name="alert-circle-outline" size={40} color={Colors.red} />
            <Text style={styles.errorTitle}>Verification Failed</Text>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={handleVerification}
            >
              <Text style={styles.secondaryButtonText}>Try Again</Text>
            </TouchableOpacity>
          </AppCard>
        )}

        <View style={styles.helpSection}>
          <Text style={styles.helpTitle}>Didn't receive the email?</Text>
          <Text style={styles.helpText}>
            • Check your spam or junk folder{'\n'}
            • Make sure you entered the correct email address{'\n'}
            • Wait a few minutes and check again
          </Text>

          <TouchableOpacity
            style={styles.linkButton}
            onPress={handleResendEmail}
          >
            <Text style={styles.linkButtonText}>Resend Verification Email</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.linkButton, styles.linkButtonSecondary]}
            onPress={handleBackToLogin}
          >
            <Text style={styles.linkButtonTextSecondary}>Back to Login</Text>
          </TouchableOpacity>
        </View>
      </Section>
    </AppScreen>
  );
};

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: Theme.spacing.lg,
    paddingTop: Theme.spacing.xl,
    paddingBottom: Theme.spacing.xl,
    gap: Theme.spacing.lg,
  },
  centerContent: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Theme.spacing.md,
  },
  loadingText: {
    marginTop: Theme.spacing.md,
    fontSize: 16,
    color: Colors.subtitlecolor,
  },
  header: {
    marginBottom: Theme.spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.bordercolor,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.cardbackground,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Theme.spacing.md,
  },
  successIcon: {
    marginBottom: Theme.spacing.lg,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.titlecolor,
    textAlign: 'center',
    marginBottom: Theme.spacing.sm,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.subtitlecolor,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: Theme.spacing.lg,
    paddingHorizontal: Theme.spacing.md,
  },
  emailText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.iconbackground,
    marginBottom: Theme.spacing.sm,
  },
  primaryButton: {
    backgroundColor: Colors.iconbackground,
    borderRadius: Theme.radius.pill,
    paddingVertical: Theme.spacing.md,
    paddingHorizontal: Theme.spacing.xl,
    width: '100%',
    alignItems: 'center',
    marginVertical: Theme.spacing.md,
  },
  primaryButtonText: {
    color: Colors.textwhite,
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: Colors.iconbackground,
    borderRadius: Theme.radius.pill,
    paddingVertical: Theme.spacing.sm,
    paddingHorizontal: Theme.spacing.lg,
    marginTop: Theme.spacing.md,
  },
  secondaryButtonText: {
    color: Colors.iconbackground,
    fontSize: 14,
    fontWeight: '600',
  },
  errorCard: {
    alignItems: 'center',
    gap: Theme.spacing.sm,
    padding: Theme.spacing.lg,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.titlecolor,
  },
  errorText: {
    fontSize: 14,
    color: Colors.subtitlecolor,
    textAlign: 'center',
    lineHeight: 20,
  },
  helpSection: {
    marginTop: Theme.spacing.lg,
    gap: Theme.spacing.md,
  },
  helpTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.titlecolor,
    marginBottom: Theme.spacing.xs,
  },
  helpText: {
    fontSize: 14,
    color: Colors.subtitlecolor,
    lineHeight: 22,
  },
  linkButton: {
    marginTop: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
    alignItems: 'center',
  },
  linkButtonSecondary: {
    marginTop: Theme.spacing.xs,
  },
  linkButtonText: {
    color: Colors.iconbackground,
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  linkButtonTextSecondary: {
    color: Colors.subtitlecolor,
    fontSize: 14,
    fontWeight: '500',
  },
});

export default EmailVerificationScreen;
