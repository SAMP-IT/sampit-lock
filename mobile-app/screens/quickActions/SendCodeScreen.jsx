import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  TextInput,
  ActivityIndicator,
  ScrollView,
  FlatList
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import AppScreen from '../../components/ui/AppScreen';
import Section from '../../components/ui/Section';
import AppCard from '../../components/ui/AppCard';
import Colors from '../../constants/Colors';
import Theme from '../../constants/Theme';
import TTLockService from '../../services/ttlockService';
import LockControlService from '../../services/lockControlService';
import { createCloudPasscode, savePasscode, getPasscodes, deletePasscodeFromDb } from '../../services/api';

// Helper to extract lockData from ttlock_data field
function extractLockData(ttlockData) {
  if (!ttlockData) return null;
  if (typeof ttlockData === 'string' && !ttlockData.startsWith('{')) {
    return ttlockData;
  }
  try {
    const parsed = JSON.parse(ttlockData);
    if (parsed.lockData && typeof parsed.lockData === 'string') {
      return parsed.lockData;
    }
    return null;
  } catch (e) {
    return ttlockData;
  }
}

const SendCodeScreen = ({ navigation, route }) => {
  const { lockId, lock } = route.params || {};
  const [passcode, setPasscode] = useState('');
  const [codeName, setCodeName] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [codeType, setCodeType] = useState('permanent');
  const [validHours, setValidHours] = useState(24);
  const [savedCodes, setSavedCodes] = useState([]);
  const [loadingCodes, setLoadingCodes] = useState(true);
  const [deleting, setDeleting] = useState(null);
  const passcodeInputRef = useRef(null);

  // Check available control methods
  const controlMethods = lock ? LockControlService.getAvailableControlMethods(lock) : { bluetooth: false, cloud: false };
  const canCreateCode = controlMethods.bluetooth || controlMethods.cloud;
  const hasGateway = lock?.has_gateway === true;
  const canUseCloudApi = hasGateway && lock?.id;

  // Generate a random 6-digit passcode
  const generateRandomCode = () => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setPasscode(code);
  };

  useEffect(() => {
    loadSavedCodes();
  }, []);

  // When switching to temporary, optionally pre-fill with a generated code; permanent stays empty
  const handleCodeTypeChange = (type) => {
    setCodeType(type);
    if (type === 'permanent') {
      setPasscode('');
    } else if (type === 'temporary') {
      generateRandomCode();
    }
  };

  const loadSavedCodes = async () => {
    if (!lockId) return;

    setLoadingCodes(true);
    try {
      console.log('[SendCode] Loading saved passcodes...');
      const response = await getPasscodes(lockId);
      if (response.data?.success) {
        setSavedCodes(response.data.data || []);
      }
    } catch (error) {
      console.error('[SendCode] Error loading passcodes:', error);
    } finally {
      setLoadingCodes(false);
    }
  };

  const handleCreatePasscode = async () => {
    if (!passcode || passcode.length < 4 || passcode.length > 9) {
      Alert.alert('Invalid Code', 'Passcode must be 4-9 digits');
      return;
    }

    // One-time passcodes can be created via Bluetooth or Cloud API
    // If gateway available, use Cloud API (addType=2). Otherwise, use Bluetooth (addType=1)
    const useCloudApi = codeType === 'one_time' && canUseCloudApi;

    if (!useCloudApi && !controlMethods.bluetooth) {
      Alert.alert(
        'Bluetooth Required',
        'Creating passcodes requires Bluetooth connection to the lock. Please stand near the lock and try again.',
        [{ text: 'OK' }]
      );
      return;
    }

    const lockData = extractLockData(lock?.ttlock_data);
    if (!useCloudApi && !lockData) {
      Alert.alert(
        'Lock Not Paired',
        'This lock needs to be re-paired via Bluetooth to create passcodes.',
        [{ text: 'OK' }]
      );
      return;
    }

    setIsGenerating(true);

    try {
      const now = Date.now();
      let startDate = now;
      let endDate;
      let actualPasscode = passcode;

      if (useCloudApi) {
        console.log('[SendCode] Creating ONE-TIME passcode via Cloud API...');
        const response = await createCloudPasscode(lock.id, {
          passcode: passcode,
          type: 'one_time',
          name: codeName || 'One-time code'
        });

        if (response.data?.success) {
          actualPasscode = response.data.data.passcode || passcode;
          endDate = response.data.data.end_date ? new Date(response.data.data.end_date).getTime() : now + (6 * 60 * 60 * 1000);
        } else {
          throw new Error(response.data?.error?.message || 'Failed to create cloud passcode');
        }
      } else {
        // Bluetooth passcodes - can be permanent, temporary, or one-time
        if (codeType === 'permanent') {
          endDate = now + (5 * 365 * 24 * 60 * 60 * 1000);
        } else if (codeType === 'temporary') {
          endDate = now + (validHours * 60 * 60 * 1000);
        } else if (codeType === 'one_time') {
          // For one-time passcodes via Bluetooth:
          // Generate passcode via Cloud API (/v3/keyboardPwd/get) and sync via Bluetooth (addType=1)
          console.log('[SendCode] Creating ONE-TIME passcode via API, syncing via Bluetooth...');
          
          // Generate one-time passcode via API (this generates type 1 passcode)
          // Backend will handle syncing via Bluetooth (addType=1) if no gateway
          const generateResponse = await createCloudPasscode(lock.id, {
            passcode: passcode,
            type: 'one_time',
            name: codeName || 'One-time code',
            useBluetooth: true // Flag to indicate we'll sync via Bluetooth
          });
          
          if (generateResponse.data?.success) {
            actualPasscode = generateResponse.data.data.passcode || passcode;
            endDate = generateResponse.data.data.end_date ? new Date(generateResponse.data.data.end_date).getTime() : now + (6 * 60 * 60 * 1000);
            // Backend handles the Bluetooth sync via API with addType=1
            console.log('[SendCode] ✅ One-time passcode generated and synced via Bluetooth');
          } else {
            throw new Error(generateResponse.data?.error?.message || 'Failed to generate one-time passcode');
          }
        } else {
          throw new Error(`Unsupported passcode type: ${codeType}`);
        }
        
        // For permanent and temporary, use standard Bluetooth creation
        if (codeType !== 'one_time') {
          console.log('[SendCode] Creating passcode via Bluetooth...');
          const result = await TTLockService.createCustomPasscode(
            passcode,
            startDate,
            endDate,
            lockData
          );

          if (!result.success) {
            throw new Error(result.error || 'Failed to create passcode');
          }
        }
      }

      // Save to database
      try {
        await savePasscode(lockId, {
          code: actualPasscode,
          name: codeName || `${codeType.charAt(0).toUpperCase() + codeType.slice(1)} Code`,
          code_type: codeType,
          valid_from: new Date(startDate).toISOString(),
          valid_until: new Date(endDate).toISOString()
        });
        console.log('[SendCode] Passcode saved to database');
      } catch (saveErr) {
        console.warn('[SendCode] Failed to save to database:', saveErr);
      }

      Alert.alert(
        'Passcode Created!',
        `The code ${actualPasscode} has been programmed into your lock.\n\n` +
        (codeType === 'permanent' ? 'This is a permanent code.' :
         codeType === 'temporary' ? `Valid for ${validHours} hours.` :
         useCloudApi ? 'This is a ONE-TIME code. It works ONLY ONCE within 6 hours from now. After the first successful unlock, it will be automatically invalidated.' : 'This code expires in 1 hour.'),
        [{ text: 'OK' }]
      );

      generateRandomCode();
      setCodeName('');
      loadSavedCodes();

    } catch (err) {
      console.error('[SendCode] Error creating passcode:', err);
      const errorMsg = err.response?.data?.error?.message || err.message || 'Failed to create passcode.';
      Alert.alert('Error', errorMsg);
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = async () => {
    await Clipboard.setStringAsync(passcode);
    Alert.alert('Copied!', `Code ${passcode} copied to clipboard`);
  };

  const handleDeleteCode = (code) => {
    const lockData = extractLockData(lock?.ttlock_data);
    const hasBluetoothData = !!lockData;

    // Show Bluetooth proximity warning
    Alert.alert(
      'Delete Passcode?',
      hasBluetoothData
        ? `Are you sure you want to delete "${code.name || code.code}"?\n\n⚠️ IMPORTANT: You must be near the lock to delete this passcode from the physical lock.\n\nThis will remove the passcode from both the lock and the app.`
        : `Are you sure you want to delete "${code.name || code.code}"?\n\nThis will remove the passcode from the app database.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: hasBluetoothData ? "I'm Near the Lock - Delete" : 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(code.id);
            try {
              // First, try to delete from the lock via Bluetooth
              if (lockData && code.code) {
                try {
                  console.log('[SendCode] Deleting passcode from lock via Bluetooth:', code.code);
                  await TTLockService.deletePasscode(code.code, lockData);
                  console.log('[SendCode] Passcode deleted from lock successfully');
                } catch (btError) {
                  console.warn('[SendCode] Failed to delete from lock:', btError.message);
                  // Show warning that lock deletion failed
                  Alert.alert(
                    'Partial Delete',
                    'Could not connect to the lock via Bluetooth. The passcode was removed from the app, but may still work on the physical lock.\n\nPlease try again when you are near the lock to fully delete it.',
                    [{ text: 'OK' }]
                  );
                }
              }

              // Then delete from database
              await deletePasscodeFromDb(lockId, code.id);
              if (lockData && code.code) {
                // Only show success if we didn't already show a partial delete warning
              } else {
                Alert.alert('Success', 'Passcode deleted from app');
              }
              loadSavedCodes();
            } catch (error) {
              console.error('[SendCode] Delete passcode error:', error);
              Alert.alert('Error', 'Failed to delete passcode. Please try again.');
            } finally {
              setDeleting(null);
            }
          }
        }
      ]
    );
  };

  const getCodeTypeLabel = (type) => {
    switch (type) {
      case 'permanent': return 'Permanent';
      case 'temporary': return 'Temporary';
      case 'one_time': return 'One-Time';
      default: return type;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return '#4CAF50';
      case 'expired': return Colors.red;
      case 'scheduled': return '#2196F3';
      default: return Colors.subtitlecolor;
    }
  };

  const renderPasscodeItem = ({ item }) => (
    <View style={styles.codeItem}>
      <View style={styles.codeIconContainer}>
        <Ionicons
          name="keypad"
          size={20}
          color={getStatusColor(item.status)}
        />
      </View>
      <View style={styles.codeDetails}>
        <Text style={styles.codeItemName}>{item.name || 'Unnamed Code'}</Text>
        <View style={styles.codeMetaRow}>
          <Text style={styles.codeItemCode}>{item.code}</Text>
          <View style={[styles.typeBadge, { backgroundColor: `${getStatusColor(item.status)}20` }]}>
            <Text style={[styles.typeBadgeText, { color: getStatusColor(item.status) }]}>
              {getCodeTypeLabel(item.code_type)}
            </Text>
          </View>
        </View>
        {item.valid_until && item.code_type !== 'permanent' && (
          item.code_type === 'temporary' && item.valid_from && item.valid_until ? (
            <View style={styles.codeExpiryRow}>
              <Text style={styles.codeExpiry} numberOfLines={1}>Valid for </Text>
              <View style={styles.validForBadge}>
                <Text style={styles.validForBadgeText}>
                  {(() => {
                    const from = new Date(item.valid_from).getTime();
                    const to = new Date(item.valid_until).getTime();
                    return Math.round((to - from) / (1000 * 60 * 60));
                  })()} hr
                </Text>
              </View>
              <Text style={styles.codeExpiry} numberOfLines={1} ellipsizeMode="tail">
                {' · Expires: '}{new Date(item.valid_until).toLocaleDateString()}
              </Text>
            </View>
          ) : (
            <Text style={styles.codeExpiry}>
              {item.status === 'expired' ? 'Expired' : 
               item.code_type === 'one_time' ? 
                 (() => {
                   const now = new Date();
                   const expiry = new Date(item.valid_until);
                   const diff = expiry - now;
                   if (diff <= 0) return 'Expired';
                   const hours = Math.floor(diff / (1000 * 60 * 60));
                   const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                   return hours > 0 ? `Expires in ${hours}h ${minutes}m (one-time use)` : `Expires in ${minutes}m (one-time use)`;
                 })() :
                 `Expires: ${new Date(item.valid_until).toLocaleDateString()}`
              }
            </Text>
          )
        )}
      </View>
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => handleDeleteCode(item)}
        disabled={deleting === item.id}
      >
        {deleting === item.id ? (
          <ActivityIndicator size="small" color={Colors.red} />
        ) : (
          <Ionicons name="trash-outline" size={18} color={Colors.red} />
        )}
      </TouchableOpacity>
    </View>
  );

  return (
    <AppScreen contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={Colors.titlecolor} />
        </TouchableOpacity>
        <View style={styles.headerTextContainer}>
          <Text style={styles.headerTitle}>Create Access Code</Text>
          <Text style={styles.headerSubtitle}>
            {lock?.name || 'Program a new code into your lock'}
          </Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {!canCreateCode && (
          <AppCard style={styles.warningCard}>
            <Ionicons name="warning-outline" size={24} color="#FF9500" />
            <Text style={styles.warningText}>
              This lock was imported from cloud and doesn't have Bluetooth control data.
              Please delete and re-pair the lock via Bluetooth to enable passcode creation.
            </Text>
          </AppCard>
        )}

        {/* Code Type and Valid for - Top Section (Outside Card) */}
        <View style={styles.topSection}>
          {/* Code Type */}
          <View style={styles.topSectionItem}>
            <Text style={styles.topSectionLabel}>Code Type</Text>
            <View style={styles.typeContainer}>
              <TouchableOpacity
                style={[styles.typeButton, codeType === 'permanent' && styles.typeButtonActive]}
                onPress={() => handleCodeTypeChange('permanent')}
              >
                <Text style={[styles.typeText, codeType === 'permanent' && styles.typeTextActive]}>
                  Permanent
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.typeButton, codeType === 'temporary' && styles.typeButtonActive]}
                onPress={() => handleCodeTypeChange('temporary')}
              >
                <Text style={[styles.typeText, codeType === 'temporary' && styles.typeTextActive]}>
                  Temporary
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Valid for - Only show for temporary codes */}
          {codeType === 'temporary' && (
            <View style={styles.topSectionItem}>
              <Text style={[styles.topSectionLabel, styles.centeredLabel]}>Valid for</Text>
              <View style={styles.durationButtons}>
                {[1, 6, 12, 24, 48, 72].map((hours) => (
                  <TouchableOpacity
                    key={hours}
                    style={[styles.durationButton, validHours === hours && styles.durationButtonActive]}
                    onPress={() => setValidHours(hours)}
                  >
                    <Text style={[styles.durationText, validHours === hours && styles.durationTextActive]}>
                      {hours}h
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </View>

        <Section gapless>
          <AppCard style={styles.card}>
            {/* Passcode Input */}
            <Text style={styles.sectionLabel}>Passcode</Text>
            <View style={styles.codeInputContainer}>
              <TextInput
                ref={passcodeInputRef}
                style={[styles.codeInput, !passcode && styles.codeInputPlaceholder]}
                value={passcode}
                onChangeText={(text) => setPasscode(text.replace(/[^0-9]/g, '').slice(0, 9))}
                keyboardType="number-pad"
                maxLength={9}
                placeholder="Enter 4-9 digits"
                placeholderTextColor={Colors.subtitlecolor}
              />
              {codeType === 'temporary' && (
                <TouchableOpacity
                  onPress={() => passcodeInputRef.current?.focus()}
                  style={styles.copyIconButton}
                >
                  <Ionicons name="pencil-outline" size={20} color={Colors.iconbackground} />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={copyToClipboard}
                style={[styles.copyIconButton, !passcode && styles.copyIconButtonDisabled]}
                disabled={!passcode}
              >
                <Ionicons
                  name="copy-outline"
                  size={20}
                  color={passcode ? Colors.iconbackground : Colors.subtitlecolor}
                />
              </TouchableOpacity>
            </View>

            {/* Generate - new line with heading */}
            <View style={styles.generateRow}>
              <Text style={styles.generateLabel}>Generate</Text>
              <TouchableOpacity onPress={generateRandomCode} style={styles.randomButton}>
                <Ionicons name="shuffle-outline" size={20} color={Colors.iconbackground} />
              </TouchableOpacity>
            </View>

            {/* Code Name */}
            <Text style={styles.sectionLabel}>Code Name</Text>
            <TextInput
              style={styles.nameInput}
              value={codeName}
              onChangeText={setCodeName}
              maxLength={50}
            />

            {/* Create Button */}
            <TouchableOpacity
              style={[styles.primaryButton, (!canCreateCode || isGenerating) && styles.primaryButtonDisabled]}
              onPress={handleCreatePasscode}
              disabled={!canCreateCode || isGenerating}
            >
              {isGenerating ? (
                <ActivityIndicator color={Colors.textwhite} />
              ) : (
                <Text style={styles.primaryLabel}>
                  {canCreateCode ? 'Create Code on Lock' : 'Bluetooth Required'}
                </Text>
              )}
            </TouchableOpacity>
          </AppCard>
        </Section>

        {/* Saved Passcodes List */}
        <Section title={`Saved Codes${savedCodes.length > 0 ? ` (${savedCodes.length})` : ''}`}>
          {loadingCodes ? (
            <AppCard style={styles.centerCard}>
              <ActivityIndicator size="large" color={Colors.iconbackground} />
              <Text style={styles.loadingText}>Loading passcodes...</Text>
            </AppCard>
          ) : savedCodes.length === 0 ? (
            <AppCard style={styles.emptyCard}>
              <Ionicons name="keypad-outline" size={48} color={Colors.subtitlecolor} />
              <Text style={styles.emptyText}>No passcodes saved yet</Text>
              <Text style={styles.emptySubtext}>
                Created codes will appear here for tracking
              </Text>
            </AppCard>
          ) : (
            <AppCard padding="none">
              <FlatList
                data={savedCodes}
                renderItem={renderPasscodeItem}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
                ItemSeparatorComponent={() => <View style={styles.separator} />}
              />
            </AppCard>
          )}
        </Section>

        {/* How It Works */}
        <Section title="How It Works">
          <AppCard style={styles.helpCard}>
            {hasGateway && (
              <View style={styles.helpItem}>
                <Ionicons name="cloud-outline" size={20} color={Colors.iconbackground} />
                <Text style={styles.helpText}>One-Time codes use Cloud API - work once then expire</Text>
              </View>
            )}
            <View style={styles.helpItem}>
              <Ionicons name="bluetooth-outline" size={20} color={Colors.iconbackground} />
              <Text style={styles.helpText}>Codes are programmed directly into the lock via Bluetooth</Text>
            </View>
            <View style={styles.helpItem}>
              <Ionicons name="keypad-outline" size={20} color={Colors.iconbackground} />
              <Text style={styles.helpText}>Guest enters the code on the lock's keypad to unlock</Text>
            </View>
            <View style={styles.helpItem}>
              <Ionicons name="time-outline" size={20} color={Colors.iconbackground} />
              <Text style={styles.helpText}>Temporary codes expire automatically after the set time</Text>
            </View>
          </AppCard>
        </Section>
      </ScrollView>
    </AppScreen>
  );
};

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: Theme.spacing.lg,
    paddingTop: Theme.spacing.lg,
    paddingBottom: Theme.spacing.xl,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.md,
    marginBottom: Theme.spacing.lg,
  },
  headerTextContainer: {
    flex: 1,
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
    fontSize: 20,
    fontWeight: '700',
    color: Colors.titlecolor,
  },
  headerSubtitle: {
    fontSize: 14,
    color: Colors.subtitlecolor,
  },
  warningCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.md,
    backgroundColor: '#FFF3E0',
    padding: Theme.spacing.md,
    marginBottom: Theme.spacing.lg,
  },
  warningText: {
    flex: 1,
    fontSize: 14,
    color: '#E65100',
  },
  topSection: {
    marginBottom: Theme.spacing.lg,
    gap: Theme.spacing.md,
  },
  topSectionItem: {
    gap: Theme.spacing.sm,
  },
  topSectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.titlecolor,
  },
  centeredLabel: {
    textAlign: 'center',
  },
  card: {
    gap: Theme.spacing.md,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.titlecolor,
  },
  codeInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  codeInput: {
    flex: 1,
    backgroundColor: Colors.cardbackground,
    borderRadius: Theme.radius.md,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.md,
    fontSize: 24,
    fontWeight: '700',
    color: Colors.titlecolor,
    textAlign: 'center',
    letterSpacing: 4,
  },
  codeInputPlaceholder: {
    fontSize: 15,
    letterSpacing: 0,
  },
  randomButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.cardbackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copyIconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.cardbackground,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.bordercolor,
  },
  copyIconButtonDisabled: {
    opacity: 0.5,
  },
  generateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  generateLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.titlecolor,
  },
  nameInput: {
    backgroundColor: Colors.cardbackground,
    borderRadius: Theme.radius.md,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
    fontSize: 16,
    color: Colors.titlecolor,
  },
  typeContainer: {
    flexDirection: 'row',
    gap: Theme.spacing.sm,
  },
  typeButton: {
    flex: 1,
    paddingVertical: Theme.spacing.sm,
    paddingHorizontal: 4,
    borderRadius: Theme.radius.md,
    backgroundColor: Colors.cardbackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeButtonActive: {
    backgroundColor: Colors.iconbackground,
  },
  typeText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.subtitlecolor,
  },
  typeTextActive: {
    color: Colors.textwhite,
  },
  durationContainer: {
    gap: Theme.spacing.sm,
  },
  durationButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Theme.spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  durationButton: {
    paddingVertical: Theme.spacing.xs,
    paddingHorizontal: Theme.spacing.md,
    borderRadius: Theme.radius.sm,
    backgroundColor: Colors.cardbackground,
  },
  durationButtonActive: {
    backgroundColor: Colors.iconbackground,
  },
  durationText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.subtitlecolor,
  },
  durationTextActive: {
    color: Colors.textwhite,
  },
  primaryButton: {
    backgroundColor: Colors.iconbackground,
    borderRadius: Theme.radius.pill,
    paddingVertical: Theme.spacing.md,
    alignItems: 'center',
    marginTop: Theme.spacing.sm,
  },
  primaryButtonDisabled: {
    opacity: 0.5,
  },
  primaryLabel: {
    color: Colors.textwhite,
    fontWeight: '600',
    fontSize: 16,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Theme.spacing.xs,
    borderRadius: Theme.radius.pill,
    borderWidth: 1,
    borderColor: Colors.iconbackground,
    paddingVertical: Theme.spacing.sm,
  },
  secondaryLabel: {
    color: Colors.iconbackground,
    fontWeight: '600',
  },
  // Saved codes list
  centerCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Theme.spacing.xl,
    gap: Theme.spacing.sm,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.subtitlecolor,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: Theme.spacing.xl,
    gap: Theme.spacing.sm,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.titlecolor,
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.subtitlecolor,
    textAlign: 'center',
  },
  codeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.md,
  },
  separator: {
    height: 1,
    backgroundColor: Colors.bordercolor,
    marginHorizontal: Theme.spacing.md,
  },
  codeIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: `${Colors.iconbackground}15`,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Theme.spacing.md,
  },
  codeDetails: {
    flex: 1,
  },
  codeItemName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.titlecolor,
    marginBottom: 2,
  },
  codeMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  codeItemCode: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.iconbackground,
    letterSpacing: 1,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  codeExpiry: {
    fontSize: 12,
    color: Colors.subtitlecolor,
    marginTop: 2,
    flexShrink: 1,
  },
  codeExpiryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'nowrap',
    marginTop: 2,
    gap: 4,
  },
  validForBadge: {
    backgroundColor: 'rgba(220, 38, 38, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  validForBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#b91c1c',
  },
  deleteButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: `${Colors.red}15`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  helpCard: {
    gap: Theme.spacing.md,
  },
  helpItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.md,
  },
  helpText: {
    flex: 1,
    fontSize: 14,
    color: Colors.subtitlecolor,
  },
});

export default SendCodeScreen;
