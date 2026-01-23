import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AppScreen from '../components/ui/AppScreen';
import { SimpleModeCard, SimpleModeText, SimpleModeButton, VoiceHelperButton } from '../components/ui/SimpleMode';
import Colors from '../constants/Colors';
import Theme from '../constants/Theme';
import { useRole } from '../context/RoleContext';

const PersonalizeAppScreen = ({ navigation, route }) => {
  const { setRole } = useRole();
  const { suggestedRole = null, context = 'onboarding' } = route.params || {};

  const [selectedRole, setSelectedRole] = useState(suggestedRole);

  const roleOptions = [
    {
      id: 'owner',
      title: 'I manage my home lock',
      subtitle: 'Home Owner',
      description: 'Full control over devices, users, and settings. Perfect for homeowners who want complete access.',
      icon: 'home',
      color: Colors.iconbackground,
      features: ['Manage all locks', 'Add/remove users', 'View all activity', 'Full settings access']
    },
    {
      id: 'family',
      title: 'I use a lock someone set up for me',
      subtitle: 'Household Member',
      description: 'Access to locks with some management features. Great for family members and regular users.',
      icon: 'people',
      color: '#4CAF50',
      features: ['Unlock doors', 'Limited user management', 'View own activity', 'Basic settings']
    },
    {
      id: 'guest',
      title: 'I have temporary access',
      subtitle: 'Guest',
      description: 'Simple access to specific locks during scheduled times. Ideal for visitors and temporary users.',
      icon: 'key',
      color: '#FF9800',
      features: ['Unlock assigned doors', 'View schedule', 'Get help', 'No management features']
    },
    {
      id: 'service',
      title: 'I install locks',
      subtitle: 'Installer',
      description: 'Technical tools for installers and maintenance. Advanced diagnostics and setup features.',
      icon: 'construct',
      color: '#9C27B0',
      features: ['Device diagnostics', 'Technical tools', 'Installation guides', 'Advanced settings']
    }
  ];

  const handleRoleSelect = (roleId) => {
    setSelectedRole(roleId);
  };

  const handleContinue = () => {
    if (!selectedRole) {
      Alert.alert('Please select an option', 'Choose the option that best describes how you\'ll use Awakey.');
      return;
    }

    // Set the role and navigate to appropriate screen
    setRole(selectedRole);

    Alert.alert(
      'Personalization Complete',
      `Awakey is now optimized for ${roleOptions.find(r => r.id === selectedRole)?.subtitle}. You can change this anytime in Settings.`,
      [
        {
          text: 'Continue',
          onPress: () => {
            // Navigate based on the selected role
            navigation.reset({
              index: 0,
              routes: [{ name: 'Home' }],
            });
          }
        }
      ]
    );
  };

  const handleSkip = () => {
    Alert.alert(
      'Skip Personalization?',
      'We\'ll use smart defaults based on your usage. You can always personalize later in Settings.',
      [
        { text: 'Go Back', style: 'cancel' },
        {
          text: 'Skip',
          onPress: () => {
            // Use suggested role or default to 'owner'
            setRole(suggestedRole || 'owner');
            navigation.reset({
              index: 0,
              routes: [{ name: 'Home' }],
            });
          }
        }
      ]
    );
  };

  const RoleCard = ({ role }) => {
    const isSelected = selectedRole === role.id;
    const isSuggested = suggestedRole === role.id;

    return (
      <TouchableOpacity
        onPress={() => handleRoleSelect(role.id)}
        activeOpacity={0.9}
      >
        <SimpleModeCard style={[
          styles.roleCard,
          isSelected && styles.selectedCard,
          isSuggested && !isSelected && styles.suggestedCard
        ]}>
          <View style={styles.cardHeader}>
            <View style={[styles.roleIconWrap, { backgroundColor: role.color }]}>
              <Ionicons name={role.icon} size={24} color={Colors.textwhite} />
            </View>
            <View style={styles.cardHeaderContent}>
              <SimpleModeText variant="title" style={[
                styles.roleTitle,
                isSelected && styles.selectedText
              ]}>
                {role.title}
              </SimpleModeText>
              <Text style={[
                styles.roleSubtitle,
                isSelected && styles.selectedSubtitle
              ]}>
                {role.subtitle}
                {isSuggested && !isSelected && ' (Suggested)'}
                {isSelected && ' ✓'}
              </Text>
            </View>
            {isSelected && (
              <View style={styles.selectedIcon}>
                <Ionicons name="checkmark-circle" size={24} color={role.color} />
              </View>
            )}
          </View>

          <SimpleModeText style={[
            styles.roleDescription,
            isSelected && styles.selectedText
          ]}>
            {role.description}
          </SimpleModeText>

          <View style={styles.featuresList}>
            {role.features.map((feature, index) => (
              <View key={index} style={styles.featureItem}>
                <Ionicons
                  name="checkmark"
                  size={14}
                  color={isSelected ? Colors.textwhite : role.color}
                />
                <Text style={[
                  styles.featureText,
                  isSelected && styles.selectedText
                ]}>
                  {feature}
                </Text>
              </View>
            ))}
          </View>
        </SimpleModeCard>
      </TouchableOpacity>
    );
  };

  return (
    <AppScreen contentContainerStyle={styles.content}>
      {/* Header */}
      <SimpleModeCard style={styles.headerCard}>
        <View style={styles.headerIconWrap}>
          <Ionicons name="person-circle-outline" size={48} color={Colors.iconbackground} />
        </View>
        <SimpleModeText variant="heading" style={styles.headerTitle}>
          Personalize your app
        </SimpleModeText>
        <SimpleModeText style={styles.headerDescription}>
          We'll show the right controls for your needs. You can change this anytime in Settings.
        </SimpleModeText>
        {suggestedRole && (
          <View style={styles.suggestionBadge}>
            <Ionicons name="sparkles" size={16} color={Colors.iconbackground} />
            <Text style={styles.suggestionText}>
              We suggest "{roleOptions.find(r => r.id === suggestedRole)?.subtitle}" based on what you just did
            </Text>
          </View>
        )}
      </SimpleModeCard>

      <VoiceHelperButton text="Choose how you'll use Awakey. This helps us show you the right features and controls." />

      {/* Role Options */}
      <View style={styles.rolesContainer}>
        <SimpleModeText variant="title" style={styles.sectionTitle}>
          Choose your role
        </SimpleModeText>

        <View style={styles.rolesList}>
          {roleOptions.map(role => (
            <RoleCard key={role.id} role={role} />
          ))}
        </View>
      </View>

      {/* Actions */}
      <View style={styles.actionsContainer}>
        <SimpleModeButton
          onPress={handleContinue}
          disabled={!selectedRole}
          style={[
            styles.continueButton,
            !selectedRole && styles.disabledButton
          ]}
        >
          Continue
        </SimpleModeButton>

        <TouchableOpacity
          style={styles.skipButton}
          onPress={handleSkip}
          activeOpacity={0.7}
        >
          <Text style={styles.skipButtonText}>
            {suggestedRole ? 'Use suggested settings' : 'Skip for now'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Help */}
      <SimpleModeCard style={styles.helpCard}>
        <View style={styles.helpHeader}>
          <View style={styles.helpIconWrap}>
            <Ionicons name="help-circle-outline" size={20} color={Colors.iconbackground} />
          </View>
          <SimpleModeText variant="title" style={styles.helpTitle}>
            Not sure which to choose?
          </SimpleModeText>
        </View>
        <SimpleModeText style={styles.helpText}>
          • If you bought the lock yourself → Choose "Home Owner"
          {'\n'}• If someone invited you to use it → Choose "Household Member" or "Guest"
          {'\n'}• If you install locks professionally → Choose "Installer"
        </SimpleModeText>
      </SimpleModeCard>
    </AppScreen>
  );
};

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: Theme.spacing.lg,
    paddingTop: Theme.spacing.lg,
    paddingBottom: Theme.spacing.xl,
    gap: Theme.spacing.lg,
  },
  headerCard: {
    padding: Theme.spacing.xl,
    alignItems: 'center',
    gap: Theme.spacing.md,
    backgroundColor: '#E8F5E8',
  },
  headerIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.textwhite,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Theme.spacing.sm,
  },
  headerTitle: {
    textAlign: 'center',
  },
  headerDescription: {
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
  },
  suggestionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.xs,
    backgroundColor: Colors.textwhite,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.xs,
    borderRadius: Theme.radius.pill,
    marginTop: Theme.spacing.sm,
  },
  suggestionText: {
    fontSize: 12,
    color: Colors.iconbackground,
    fontWeight: '600',
  },
  rolesContainer: {
    gap: Theme.spacing.md,
  },
  sectionTitle: {
    fontSize: 18,
    textAlign: 'center',
  },
  rolesList: {
    gap: Theme.spacing.md,
  },
  roleCard: {
    padding: Theme.spacing.lg,
    gap: Theme.spacing.md,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedCard: {
    backgroundColor: Colors.iconbackground,
    borderColor: Colors.iconbackground,
  },
  suggestedCard: {
    borderColor: Colors.iconbackground,
    borderStyle: 'dashed',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.md,
  },
  roleIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeaderContent: {
    flex: 1,
    gap: 2,
  },
  roleTitle: {
    fontSize: 16,
  },
  selectedText: {
    color: Colors.textwhite,
  },
  roleSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.iconbackground,
  },
  selectedSubtitle: {
    color: 'rgba(255, 255, 255, 0.9)',
  },
  selectedIcon: {
    marginLeft: Theme.spacing.sm,
  },
  roleDescription: {
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.8,
  },
  featuresList: {
    gap: Theme.spacing.xs,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.xs,
  },
  featureText: {
    fontSize: 13,
    flex: 1,
  },
  actionsContainer: {
    gap: Theme.spacing.md,
    alignItems: 'center',
  },
  continueButton: {
    minWidth: 160,
  },
  disabledButton: {
    backgroundColor: Colors.subtitlecolor,
    opacity: 0.5,
  },
  skipButton: {
    paddingVertical: Theme.spacing.sm,
    paddingHorizontal: Theme.spacing.lg,
  },
  skipButtonText: {
    color: Colors.subtitlecolor,
    fontSize: 14,
    fontWeight: '500',
  },
  helpCard: {
    padding: Theme.spacing.lg,
    gap: Theme.spacing.md,
  },
  helpHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  helpIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  helpTitle: {
    fontSize: 16,
  },
  helpText: {
    fontSize: 14,
    lineHeight: 20,
  },
});

export default PersonalizeAppScreen;