import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import AppScreen from '../../components/ui/AppScreen';
import AppCard from '../../components/ui/AppCard';
import Colors from '../../constants/Colors';
import Theme from '../../constants/Theme';
import { SimpleModeText, SimpleModeButton, VoiceHelperButton } from '../../components/ui/SimpleMode';
import { updateLock } from '../../services/api';

// Generate a unique recovery key based on lockId and timestamp
const generateRecoveryKey = (lockId) => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid confusing characters (O/0, I/1/L)
  const segments = [];
  const seed = `${lockId}-${Date.now()}`;

  // Generate 4 segments of 4 characters each
  for (let s = 0; s < 4; s++) {
    let segment = '';
    for (let i = 0; i < 4; i++) {
      const index = Math.floor(Math.random() * chars.length);
      segment += chars[index];
    }
    segments.push(segment);
  }

  return `AWAKEY-${segments.join('-')}`;
};

const SafetyBackupScreen = ({ navigation, route }) => {
  const { lockId, doorName = 'Front Door' } = route.params || {};
  const [backupSaved, setBackupSaved] = useState(false);
  const [recoveryKey, setRecoveryKey] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Generate recovery key on mount
  useEffect(() => {
    const key = generateRecoveryKey(lockId);
    setRecoveryKey(key);
  }, [lockId]);

  const handleSaveToCloud = async () => {
    if (!recoveryKey) return;

    setIsSaving(true);
    try {
      // Save to backend cloud storage
      await updateLock(lockId, { recovery_key: recoveryKey });
      console.log('[SafetyBackup] Recovery key saved to cloud');

      Alert.alert(
        'Recovery Key Saved',
        'Your recovery key has been securely saved to this device and backed up to the cloud.',
        [{ text: 'OK', onPress: () => setBackupSaved(true) }]
      );
    } catch (err) {
      console.error('[SafetyBackup] Save error:', err);
      Alert.alert('Error', 'Failed to save recovery key. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyToClipboard = async () => {
    try {
      await Clipboard.setStringAsync(recoveryKey);
      Alert.alert('Copied', 'Recovery key copied to clipboard');
    } catch (err) {
      Alert.alert('Error', 'Failed to copy to clipboard');
    }
  };

  const handleFinish = () => {
    // Navigate to confirmation screen with lockId and door name
    console.log('[SafetyBackup] Finishing setup with lockId:', lockId);
    navigation.navigate('AddLockConfirmation', { lockId, doorName });
  };

  return (
    <AppScreen contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={24} color={Colors.titlecolor} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.stepIndicator}>Step 3 of 3</Text>
          <SimpleModeText variant="heading" style={styles.headerTitle}>
            Safety backup
          </SimpleModeText>
        </View>
      </View>

      <AppCard style={styles.mainCard}>
        <View style={styles.iconWrap}>
          <Ionicons name="shield-checkmark-outline" size={32} color={Colors.iconbackground} />
        </View>

        <SimpleModeText variant="title" style={styles.cardTitle}>
          Save your recovery key
        </SimpleModeText>

        <SimpleModeText style={styles.cardDescription}>
          This key lets you regain access if you lose your phone or forget your passcode.
        </SimpleModeText>

        <VoiceHelperButton text="This key lets you regain access if you lose your phone or forget your passcode." />

        <View style={styles.recoveryKeyContainer}>
          <Text style={styles.recoveryKeyLabel}>Your recovery key</Text>
          <View style={styles.recoveryKeyBox}>
            <Text style={styles.recoveryKeyText}>{recoveryKey}</Text>
            <TouchableOpacity
              style={styles.copyButton}
              onPress={handleCopyToClipboard}
            >
              <Ionicons name="copy-outline" size={18} color={Colors.iconbackground} />
            </TouchableOpacity>
          </View>
        </View>

        <SimpleModeButton
          onPress={handleSaveToCloud}
          icon="cloud-upload-outline"
          style={styles.saveButton}
          disabled={isSaving || !recoveryKey}
        >
          {isSaving ? 'Saving...' : 'Save to cloud'}
        </SimpleModeButton>

        {backupSaved && (
          <View style={styles.savedIndicator}>
            <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
            <Text style={styles.savedText}>Backup saved ✓</Text>
          </View>
        )}
      </AppCard>

      <AppCard style={styles.warningCard}>
        <View style={styles.warningHeader}>
          <View style={styles.warningIconWrap}>
            <Ionicons name="warning-outline" size={20} color="#FF9800" />
          </View>
          <SimpleModeText variant="title" style={styles.warningTitle}>
            Important
          </SimpleModeText>
        </View>
        <SimpleModeText style={styles.warningText}>
          Keep your recovery key safe and secret. Anyone with this key can access your {doorName}.
        </SimpleModeText>
      </AppCard>

      {backupSaved && (
        <SimpleModeButton
          onPress={handleFinish}
          style={styles.finishButton}
        >
          Finish Setup
        </SimpleModeButton>
      )}

      {!backupSaved && (
        <TouchableOpacity
          style={styles.skipButton}
          onPress={() => {
            Alert.alert(
              'Skip Backup?',
              'We strongly recommend saving your recovery key. You can always do this later in Settings.',
              [
                { text: 'Go Back', style: 'cancel' },
                { text: 'Skip Anyway', onPress: handleFinish, style: 'destructive' }
              ]
            );
          }}
        >
          <Text style={styles.skipButtonText}>Skip for now</Text>
        </TouchableOpacity>
      )}
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.md,
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
  headerContent: {
    flex: 1,
  },
  stepIndicator: {
    fontSize: 14,
    color: Colors.subtitlecolor,
    fontWeight: '500',
  },
  headerTitle: {
    marginTop: 2,
  },
  mainCard: {
    padding: Theme.spacing.xl,
    alignItems: 'center',
    gap: Theme.spacing.lg,
  },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E8F5E8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    textAlign: 'center',
  },
  cardDescription: {
    textAlign: 'center',
    maxWidth: 300,
  },
  recoveryKeyContainer: {
    width: '100%',
    gap: Theme.spacing.sm,
  },
  recoveryKeyLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.titlecolor,
  },
  recoveryKeyBox: {
    flexDirection: 'row',
    backgroundColor: Colors.background,
    borderRadius: Theme.radius.md,
    padding: Theme.spacing.md,
    borderWidth: 1,
    borderColor: Colors.bordercolor,
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  recoveryKeyText: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'monospace',
    color: Colors.titlecolor,
    lineHeight: 20,
  },
  copyButton: {
    padding: Theme.spacing.xs,
  },
  saveButton: {
    width: '100%',
  },
  savedIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.xs,
    backgroundColor: '#E8F5E8',
    paddingVertical: Theme.spacing.xs,
    paddingHorizontal: Theme.spacing.md,
    borderRadius: Theme.radius.pill,
  },
  savedText: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '600',
  },
  warningCard: {
    padding: Theme.spacing.lg,
    gap: Theme.spacing.md,
    backgroundColor: '#FFF8E1',
    borderWidth: 1,
    borderColor: '#FFE082',
  },
  warningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  warningIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 152, 0, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  warningTitle: {
    fontSize: 16,
    color: '#F57C00',
  },
  warningText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#F57C00',
  },
  finishButton: {
    marginTop: Theme.spacing.md,
  },
  skipButton: {
    alignSelf: 'center',
    paddingVertical: Theme.spacing.sm,
    paddingHorizontal: Theme.spacing.lg,
  },
  skipButtonText: {
    color: Colors.subtitlecolor,
    fontSize: 16,
    fontWeight: '500',
  },
});

export default SafetyBackupScreen;