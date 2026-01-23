import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AppScreen from '../components/ui/AppScreen';
import { SimpleModeCard, SimpleModeText, SimpleModeButton, VoiceHelperButton } from '../components/ui/SimpleMode';
import Colors from '../constants/Colors';
import Theme from '../constants/Theme';
import { useRole } from '../context/RoleContext';
import { coerceBoolean } from '../utils/lockSettings';

const SimpleModeSettingsScreen = ({ navigation }) => {
  const { isSimpleMode, toggleSimpleMode } = useRole();
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [largeTextEnabled, setLargeTextEnabled] = useState(isSimpleMode);
  const [highContrastEnabled, setHighContrastEnabled] = useState(false);
  const [vibrateEnabled, setVibrateEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);

  const handleSimpleModeToggle = () => {
    toggleSimpleMode();
    setLargeTextEnabled(!isSimpleMode);
    Alert.alert(
      isSimpleMode ? 'Advanced Mode Enabled' : 'Simple Mode Enabled',
      isSimpleMode
        ? 'You now have access to all features and smaller interface elements.'
        : 'Interface is now optimized with larger buttons and text for easier use.'
    );
  };

  const handleTrustedContacts = () => {
    navigation.navigate('TrustedContacts');
  };

  const handleResetSettings = () => {
    Alert.alert(
      'Reset All Settings?',
      'This will return all accessibility settings to their default values.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            setVoiceEnabled(true);
            setLargeTextEnabled(false);
            setHighContrastEnabled(false);
            setVibrateEnabled(true);
            setSoundEnabled(true);
            Alert.alert('Settings Reset', 'All accessibility settings have been reset to defaults.');
          }
        }
      ]
    );
  };

  const SettingRow = ({ icon, title, description, value, onValueChange, type = 'switch' }) => {
    const boolValue = coerceBoolean(value);
    return (
      <View style={styles.settingRow}>
      <View style={styles.settingInfo}>
        <View style={styles.settingIconWrap}>
          <Ionicons name={icon} size={20} color={Colors.iconbackground} />
        </View>
        <View style={styles.settingContent}>
          <SimpleModeText variant="title" style={styles.settingTitle}>
            {title}
          </SimpleModeText>
          <SimpleModeText style={styles.settingDescription}>
            {description}
          </SimpleModeText>
        </View>
      </View>
      {type === 'switch' ? (
        <Switch
          value={boolValue}
          onValueChange={onValueChange}
          trackColor={{ false: Colors.bordercolor, true: Colors.iconbackground }}
          thumbColor={boolValue ? Colors.textwhite : Colors.subtitlecolor}
          style={styles.switch}
        />
      ) : (
        <TouchableOpacity onPress={onValueChange} style={styles.actionButton}>
          <Ionicons name="chevron-forward" size={18} color={Colors.subtitlecolor} />
        </TouchableOpacity>
      )}
      </View>
    );
  };

  return (
    <AppScreen contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={24} color={Colors.titlecolor} />
        </TouchableOpacity>
        <SimpleModeText variant="heading" style={styles.headerTitle}>
          Accessibility Settings
        </SimpleModeText>
      </View>

      <VoiceHelperButton text="Accessibility settings to make the app easier to use with larger text, voice helpers, and simple mode." />

      {/* Simple Mode Toggle */}
      <SimpleModeCard style={[styles.simpleModeCard, isSimpleMode && styles.simpleModeActive]}>
        <View style={styles.simpleModeHeader}>
          <View style={styles.simpleModeIconWrap}>
            <Ionicons
              name={isSimpleMode ? "accessibility" : "accessibility-outline"}
              size={28}
              color={isSimpleMode ? Colors.textwhite : Colors.iconbackground}
            />
          </View>
          <View style={styles.simpleModeContent}>
            <SimpleModeText variant="title" style={[
              styles.simpleModeTitle,
              isSimpleMode && styles.simpleModeActiveText
            ]}>
              Simple Mode
            </SimpleModeText>
            <SimpleModeText style={[
              styles.simpleModeDescription,
              isSimpleMode && styles.simpleModeActiveText
            ]}>
              {isSimpleMode
                ? 'Currently active - larger buttons and text'
                : 'Bigger buttons, larger text, fewer options'
              }
            </SimpleModeText>
          </View>
        </View>

        <SimpleModeButton
          onPress={handleSimpleModeToggle}
          style={isSimpleMode ? styles.disableButton : styles.enableButton}
        >
          {isSimpleMode ? 'Switch to Advanced Mode' : 'Enable Simple Mode'}
        </SimpleModeButton>
      </SimpleModeCard>

      {/* Visual Settings */}
      <SimpleModeCard style={styles.settingsSection}>
        <SimpleModeText variant="title" style={styles.sectionTitle}>
          Visual Settings
        </SimpleModeText>

        <SettingRow
          icon="text-outline"
          title="Large Text"
          description="Increase text size throughout the app"
          value={largeTextEnabled}
          onValueChange={setLargeTextEnabled}
        />

        <SettingRow
          icon="contrast-outline"
          title="High Contrast"
          description="Make text and buttons easier to see"
          value={highContrastEnabled}
          onValueChange={setHighContrastEnabled}
        />
      </SimpleModeCard>

      {/* Audio & Voice Settings */}
      <SimpleModeCard style={styles.settingsSection}>
        <SimpleModeText variant="title" style={styles.sectionTitle}>
          Audio & Voice
        </SimpleModeText>

        <SettingRow
          icon="volume-high-outline"
          title="Voice Helper"
          description="Read screen content aloud when requested"
          value={voiceEnabled}
          onValueChange={setVoiceEnabled}
        />

        <SettingRow
          icon="musical-notes-outline"
          title="Sound Feedback"
          description="Play sounds for button presses and notifications"
          value={soundEnabled}
          onValueChange={setSoundEnabled}
        />

        <SettingRow
          icon="phone-portrait-outline"
          title="Vibrate Feedback"
          description="Vibrate phone for confirmations"
          value={vibrateEnabled}
          onValueChange={setVibrateEnabled}
        />
      </SimpleModeCard>

      {/* Safety Settings */}
      <SimpleModeCard style={styles.settingsSection}>
        <SimpleModeText variant="title" style={styles.sectionTitle}>
          Safety & Support
        </SimpleModeText>

        <SettingRow
          icon="people-outline"
          title="Trusted Contacts"
          description="Family members to call in emergencies"
          type="action"
          onValueChange={handleTrustedContacts}
        />

        <SettingRow
          icon="notifications-outline"
          title="Emergency Notifications"
          description="Get help if locked out multiple times"
          value={true}
          onValueChange={() => {
            Alert.alert('Feature Info', 'This safety feature automatically contacts your trusted contacts if you\'re locked out twice in 10 minutes.');
          }}
        />
      </SimpleModeCard>

      {/* Preview */}
      <SimpleModeCard style={styles.previewCard}>
        <SimpleModeText variant="title" style={styles.previewTitle}>
          Preview
        </SimpleModeText>
        <SimpleModeText style={styles.previewDescription}>
          This is how text will look with your current settings.
        </SimpleModeText>

        <View style={styles.previewDemo}>
          <TouchableOpacity style={[
            styles.previewButton,
            largeTextEnabled && styles.previewButtonLarge
          ]}>
            <Text style={[
              styles.previewButtonText,
              largeTextEnabled && styles.previewButtonTextLarge,
              highContrastEnabled && styles.previewButtonTextHighContrast
            ]}>
              Sample Button
            </Text>
          </TouchableOpacity>
        </View>
      </SimpleModeCard>

      {/* Reset */}
      <TouchableOpacity
        style={styles.resetButton}
        onPress={handleResetSettings}
        activeOpacity={0.7}
      >
        <Ionicons name="refresh-outline" size={18} color={Colors.subtitlecolor} />
        <Text style={styles.resetButtonText}>Reset all settings to default</Text>
      </TouchableOpacity>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
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
  headerTitle: {
    flex: 1,
  },
  simpleModeCard: {
    padding: Theme.spacing.xl,
    gap: Theme.spacing.lg,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  simpleModeActive: {
    backgroundColor: Colors.iconbackground,
    borderColor: Colors.iconbackground,
  },
  simpleModeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.md,
  },
  simpleModeIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  simpleModeContent: {
    flex: 1,
    gap: 4,
  },
  simpleModeTitle: {
    fontSize: 20,
  },
  simpleModeDescription: {
    fontSize: 14,
    opacity: 0.8,
  },
  simpleModeActiveText: {
    color: Colors.textwhite,
  },
  enableButton: {
    backgroundColor: Colors.iconbackground,
  },
  disableButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  settingsSection: {
    padding: Theme.spacing.lg,
    gap: Theme.spacing.md,
  },
  sectionTitle: {
    fontSize: 18,
    marginBottom: Theme.spacing.sm,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Theme.spacing.sm,
    minHeight: Theme.accessibility.minTouchTarget,
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.md,
    flex: 1,
  },
  settingIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingContent: {
    flex: 1,
    gap: 2,
  },
  settingTitle: {
    fontSize: 16,
  },
  settingDescription: {
    fontSize: 13,
    opacity: 0.7,
  },
  switch: {
    marginLeft: Theme.spacing.md,
  },
  actionButton: {
    padding: Theme.spacing.sm,
  },
  previewCard: {
    padding: Theme.spacing.lg,
    gap: Theme.spacing.md,
    backgroundColor: Colors.background,
  },
  previewTitle: {
    fontSize: 16,
  },
  previewDescription: {
    fontSize: 14,
    opacity: 0.7,
  },
  previewDemo: {
    alignItems: 'center',
    paddingVertical: Theme.spacing.md,
  },
  previewButton: {
    backgroundColor: Colors.iconbackground,
    paddingVertical: Theme.spacing.sm,
    paddingHorizontal: Theme.spacing.lg,
    borderRadius: Theme.radius.pill,
    minHeight: Theme.accessibility.minTouchTarget,
    justifyContent: 'center',
  },
  previewButtonLarge: {
    paddingVertical: Theme.spacing.md,
    paddingHorizontal: Theme.spacing.xl,
    minHeight: Theme.accessibility.elderFriendly.touchTarget.button,
  },
  previewButtonText: {
    color: Colors.textwhite,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  previewButtonTextLarge: {
    fontSize: Theme.accessibility.elderFriendly.fontSize.body,
  },
  previewButtonTextHighContrast: {
    fontWeight: '700',
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Theme.spacing.sm,
    paddingVertical: Theme.spacing.md,
    marginTop: Theme.spacing.lg,
  },
  resetButtonText: {
    color: Colors.subtitlecolor,
    fontSize: 14,
    fontWeight: '500',
  },
});

export default SimpleModeSettingsScreen;
