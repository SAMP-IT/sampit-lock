import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AppScreen from '../../components/ui/AppScreen';
import AppCard from '../../components/ui/AppCard';
import Colors from '../../constants/Colors';
import Theme from '../../constants/Theme';
import { SimpleModeText, SimpleModeButton } from '../../components/ui/SimpleMode';
import { updateLock, addLock } from '../../services/api';

const NameDoorScreen = ({ navigation, route }) => {
  // Get params - lockId is passed when lock was saved in PairLockScreen
  // needsSave is true if lock couldn't be saved and needs to be created here
  const { lockId, lockData, lockMac, lockName: originalLockName, needsSave } = route.params || {};
  const [doorName, setDoorName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const suggestionExamples = [
    'Front Door',
    'Back Door',
    'Grandma\'s Room',
    'Main Entrance',
    'Office Door',
    'Bedroom Door',
  ];

  const handleContinue = async () => {
    if (doorName.trim()) {
      setIsLoading(true);
      setError(null);
      try {
        let finalLockId = lockId;

        if (needsSave && !lockId) {
          // Lock needs to be saved to database first (fallback case)
          console.log('[NameDoor] Saving lock to database...');

          // Extract the actual lockData string (encrypted blob from SDK)
          const encryptedLockData = typeof lockData === 'string'
            ? lockData
            : (lockData?.lockData || JSON.stringify(lockData));

          const lockPayload = {
            name: doorName.trim(),
            ttlock_mac: lockMac,
            ttlock_data: encryptedLockData,
            ttlock_lock_name: originalLockName,
            is_bluetooth_paired: true,
            device_id: `ttlock_bt_${lockMac}`,
            mac_address: lockMac,
            is_locked: true,
            battery_level: 100, // Default, will be updated on first Bluetooth connection
          };

          const response = await addLock(lockPayload);
          // Backend returns { success: true, data: lockObject }, axios wraps in response.data
          const savedLock = response.data?.data || response.data;
          finalLockId = savedLock.id;
          console.log('[NameDoor] Lock saved! ID:', finalLockId);
        } else if (lockId) {
          // Lock already exists, just update the name
          console.log('[NameDoor] Updating lock name...');
          await updateLock(lockId, { name: doorName.trim() });
        }

        // Navigate to safety backup with lockId
        navigation.navigate('SafetyBackup', {
          lockId: finalLockId,
          doorName: doorName.trim()
        });
      } catch (err) {
        console.error('[NameDoor] Error:', err);
        setError(needsSave ? "Failed to save lock." : "Failed to update lock name.");
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleSuggestionSelect = (suggestion) => {
    setDoorName(suggestion);
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
          <Text style={styles.stepIndicator}>Step 2 of 3</Text>
          <SimpleModeText variant="heading" style={styles.headerTitle}>
            Name your door
          </SimpleModeText>
        </View>
      </View>

      {error && (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle-outline" size={20} color="#F57C00" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <AppCard style={styles.mainCard}>
        <View style={styles.iconWrap}>
          <Ionicons name="create-outline" size={32} color={Colors.iconbackground} />
        </View>

        <SimpleModeText variant="title" style={styles.cardTitle}>
          Give it a name
        </SimpleModeText>

        <SimpleModeText style={styles.cardDescription}>
          Choose a name that's easy to remember. You can change this later.
        </SimpleModeText>

        <View style={styles.inputSection}>
          <Text style={styles.inputLabel}>Door name</Text>
          <TextInput
            style={styles.textInput}
            value={doorName}
            onChangeText={setDoorName}
            placeholder="Enter door name"
            placeholderTextColor={Colors.subtitlecolor}
            autoCapitalize="words"
            autoCorrect={false}
            maxLength={30}
          />
        </View>

        <SimpleModeButton
          onPress={handleContinue}
          disabled={!doorName.trim() || isLoading}
          style={[
            styles.continueButton,
            !doorName.trim() && styles.disabledButton,
            isLoading && styles.loadingButton
          ]}
        >
          {isLoading ? 'Saving...' : 'Continue'}
        </SimpleModeButton>
      </AppCard>

      <AppCard style={styles.suggestionsCard}>
        <View style={styles.suggestionsHeader}>
          <View style={styles.suggestionsIconWrap}>
            <Ionicons name="bulb-outline" size={20} color={Colors.iconbackground} />
          </View>
          <SimpleModeText variant="title" style={styles.suggestionsTitle}>
            Popular names
          </SimpleModeText>
        </View>

        <View style={styles.suggestionsList}>
          {suggestionExamples.map((suggestion, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.suggestionButton,
                doorName === suggestion && styles.selectedSuggestion
              ]}
              onPress={() => handleSuggestionSelect(suggestion)}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.suggestionText,
                doorName === suggestion && styles.selectedSuggestionText
              ]}>
                {suggestion}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </AppCard>

      <AppCard style={styles.helpCard}>
        <View style={styles.helpHeader}>
          <View style={styles.helpIconWrap}>
            <Ionicons name="information-circle-outline" size={20} color={Colors.iconbackground} />
          </View>
          <SimpleModeText variant="title" style={styles.helpTitle}>
            Naming tips
          </SimpleModeText>
        </View>
        <View style={styles.helpList}>
          <SimpleModeText style={styles.helpItem}>
            • Use simple, memorable names
          </SimpleModeText>
          <SimpleModeText style={styles.helpItem}>
            • Avoid numbers or special characters
          </SimpleModeText>
          <SimpleModeText style={styles.helpItem}>
            • You can rename it anytime in settings
          </SimpleModeText>
        </View>
      </AppCard>
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
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    padding: Theme.spacing.md,
    borderRadius: Theme.radius.md,
    gap: Theme.spacing.sm,
  },
  errorText: {
    flex: 1,
    color: '#E65100',
    fontSize: 14,
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
    backgroundColor: Colors.cardbackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    textAlign: 'center',
  },
  cardDescription: {
    textAlign: 'center',
    maxWidth: 280,
  },
  inputSection: {
    width: '100%',
    gap: Theme.spacing.sm,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.titlecolor,
  },
  textInput: {
    backgroundColor: Colors.background,
    borderRadius: Theme.radius.md,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
    fontSize: 18, // Larger for accessibility
    color: Colors.titlecolor,
    borderWidth: 2,
    borderColor: 'transparent',
    minHeight: Theme.accessibility.minTouchTarget,
  },
  continueButton: {
    minWidth: 140,
  },
  disabledButton: {
    backgroundColor: Colors.subtitlecolor,
    opacity: 0.5,
  },
  loadingButton: {
    backgroundColor: Colors.subtitlecolor,
    opacity: 0.5,
  },
  suggestionsCard: {
    padding: Theme.spacing.lg,
    gap: Theme.spacing.md,
  },
  suggestionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  suggestionsIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionsTitle: {
    fontSize: 16,
  },
  suggestionsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Theme.spacing.sm,
  },
  suggestionButton: {
    backgroundColor: Colors.background,
    borderRadius: Theme.radius.md,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
    borderWidth: 1,
    borderColor: Colors.bordercolor,
    minHeight: Theme.accessibility.minTouchTarget,
    justifyContent: 'center',
  },
  selectedSuggestion: {
    backgroundColor: Colors.iconbackground,
    borderColor: Colors.iconbackground,
  },
  suggestionText: {
    fontSize: 14,
    color: Colors.titlecolor,
    fontWeight: '500',
  },
  selectedSuggestionText: {
    color: Colors.textwhite,
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
  helpList: {
    gap: Theme.spacing.xs,
  },
  helpItem: {
    fontSize: 14,
    lineHeight: 20,
  },
});

export default NameDoorScreen;