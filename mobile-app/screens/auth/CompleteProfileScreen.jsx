import React, { useState } from 'react';
import { Text, TouchableOpacity, StyleSheet, View, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AppScreen from '../../components/ui/AppScreen';
import AppCard from '../../components/ui/AppCard';
import Colors from '../../constants/Colors';
import Theme from '../../constants/Theme';
import { completeProfile } from '../../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import pushNotificationService from '../../services/pushNotificationService';

const CompleteProfileScreen = ({ navigation }) => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const updateFormData = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleCompleteProfile = async () => {
    setIsLoading(true);
    setError(null);

    // Validate required fields
    if (!formData.firstName.trim()) {
      setError("Please enter your first name.");
      setIsLoading(false);
      return;
    }

    if (!formData.lastName.trim()) {
      setError("Please enter your last name.");
      setIsLoading(false);
      return;
    }

    try {
      console.log('📝 CompleteProfileScreen: Completing profile...');
      const response = await completeProfile({
        first_name: formData.firstName.trim(),
        last_name: formData.lastName.trim(),
        phone: formData.phone.trim() || null
      });

      const { user } = response.data;

      console.log('📝 CompleteProfileScreen: Profile completed successfully');

      // Get user role from user data or default to owner
      const userRole = user?.role || 'owner';
      console.log('📝 CompleteProfileScreen: Setting role to:', userRole);

      // Store user role in AsyncStorage
      await AsyncStorage.setItem('userRole', userRole);

      // Initialize push notifications
      console.log('🔔 CompleteProfileScreen: Initializing push notifications...');
      pushNotificationService.initializePushNotifications().then((success) => {
        if (success) {
          console.log('✅ Push notifications initialized successfully');
        } else {
          console.log('⚠️ Push notifications not enabled (user may have denied permission)');
        }
      }).catch((err) => {
        console.warn('⚠️ Push notification initialization error:', err);
      });

      // Navigate to Intent screen to let user choose what to do next
      // (set up new lock or use invite code)
      console.log('📝 CompleteProfileScreen: Navigating to Intent screen...');
      navigation.navigate('Intent');

    } catch (err) {
      console.error('📝 CompleteProfileScreen: Profile completion failed:', err);
      setError(err.response?.data?.error?.message || 'Failed to complete profile. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AppScreen contentContainerStyle={styles.content}>
      <View style={styles.heroBlock}>
        <Text style={styles.heroBadge}>Almost done!</Text>
        <Text style={styles.heroTitle}>Complete Your Profile</Text>
        <Text style={styles.heroSubtitle}>
          Tell us a bit about yourself to personalize your experience
        </Text>
      </View>

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <AppCard style={styles.authCard}>
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>First Name *</Text>
          <View style={styles.inputWrapper}>
            <Ionicons name="person-outline" size={20} color={Colors.subtitlecolor} style={styles.inputIcon} />
            <TextInput
              style={styles.textInput}
              value={formData.firstName}
              onChangeText={(value) => updateFormData('firstName', value)}
              placeholder="Enter your first name"
              placeholderTextColor={Colors.subtitlecolor}
              autoCapitalize="words"
              autoCorrect={false}
            />
          </View>
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Last Name *</Text>
          <View style={styles.inputWrapper}>
            <Ionicons name="person-outline" size={20} color={Colors.subtitlecolor} style={styles.inputIcon} />
            <TextInput
              style={styles.textInput}
              value={formData.lastName}
              onChangeText={(value) => updateFormData('lastName', value)}
              placeholder="Enter your last name"
              placeholderTextColor={Colors.subtitlecolor}
              autoCapitalize="words"
              autoCorrect={false}
            />
          </View>
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Phone Number (Optional)</Text>
          <View style={styles.inputWrapper}>
            <Ionicons name="call-outline" size={20} color={Colors.subtitlecolor} style={styles.inputIcon} />
            <TextInput
              style={styles.textInput}
              value={formData.phone}
              onChangeText={(value) => updateFormData('phone', value)}
              placeholder="Enter your phone number"
              placeholderTextColor={Colors.subtitlecolor}
              keyboardType="phone-pad"
              autoCorrect={false}
            />
          </View>
        </View>

        <TouchableOpacity
          style={[styles.continueButton, isLoading && styles.continueButtonDisabled]}
          onPress={handleCompleteProfile}
          disabled={isLoading}
          activeOpacity={0.9}
        >
          {isLoading ? (
            <Text style={styles.continueButtonText}>Saving...</Text>
          ) : (
            <>
              <Text style={styles.continueButtonText}>Continue</Text>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={Colors.textwhite}
                style={styles.continueButtonIcon}
              />
            </>
          )}
        </TouchableOpacity>

        <Text style={styles.requiredNote}>* Required fields</Text>
      </AppCard>
    </AppScreen>
  );
};

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: Theme.spacing.lg,
    paddingTop: 80,
    paddingBottom: Theme.spacing.xl,
    gap: Theme.spacing.lg,
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
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.iconbackground,
    paddingVertical: Theme.spacing.md,
    borderRadius: Theme.radius.pill,
    marginTop: Theme.spacing.md,
  },
  continueButtonDisabled: {
    opacity: 0.6,
  },
  continueButtonText: {
    color: Colors.textwhite,
    fontSize: 16,
    fontWeight: '600',
  },
  continueButtonIcon: {
    marginLeft: Theme.spacing.xs,
  },
  requiredNote: {
    textAlign: 'center',
    color: Colors.subtitlecolor,
    fontSize: 12,
    marginTop: Theme.spacing.sm,
  },
});

export default CompleteProfileScreen;
