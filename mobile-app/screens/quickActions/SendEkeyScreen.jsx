import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  ScrollView,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AppScreen from '../../components/ui/AppScreen';
import Section from '../../components/ui/Section';
import AppCard from '../../components/ui/AppCard';
import Colors from '../../constants/Colors';
import Theme from '../../constants/Theme';
import { getEkeyTTLockStatus, sendEkey, getEkeyList, deleteEkey, freezeEkey, unfreezeEkey } from '../../services/api';

const SendEkeyScreen = ({ navigation, route }) => {
  const { lockId, lock } = route.params || {};

  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [ekeys, setEkeys] = useState([]);
  const [loadingEkeys, setLoadingEkeys] = useState(true);
  const [showSendForm, setShowSendForm] = useState(false);
  const [ttlockStatus, setTtlockStatus] = useState(null);
  const [checkingStatus, setCheckingStatus] = useState(true);

  // Form state
  const [receiverUsername, setReceiverUsername] = useState('');
  const [keyName, setKeyName] = useState('');
  const [ekeyType, setEkeyType] = useState('permanent'); // permanent, timed
  const [validDays, setValidDays] = useState(7);
  const [remoteEnabled, setRemoteEnabled] = useState(true);
  const [remarks, setRemarks] = useState('');

  // Get the TTLock lock ID
  const ttlockLockId = lock?.ttlock_lock_id;

  useEffect(() => {
    checkTTLockConnection();
  }, []);

  useEffect(() => {
    if (ttlockStatus?.isConnected && !ttlockStatus?.isExpired && lockId) {
      loadEkeys();
    } else {
      setLoadingEkeys(false);
    }
  }, [ttlockStatus, lockId]);

  const checkTTLockConnection = async () => {
    setCheckingStatus(true);
    try {
      console.log('🔍 Checking TTLock connection status...');
      const response = await getEkeyTTLockStatus();
      console.log('📡 TTLock status response:', response.data);

      if (response.data?.success) {
        setTtlockStatus(response.data.data);
      } else {
        setTtlockStatus({ isConnected: false, status: 'not_connected' });
      }
    } catch (error) {
      console.error('❌ Error checking TTLock status:', error);
      setTtlockStatus({ isConnected: false, status: 'error' });
    } finally {
      setCheckingStatus(false);
    }
  };

  const loadEkeys = async () => {
    if (!lockId) return;

    setLoadingEkeys(true);
    try {
      console.log('📋 Loading eKeys for lock:', lockId);
      const response = await getEkeyList(lockId);
      console.log('📡 eKey list response:', response.data);

      if (response.data?.success) {
        setEkeys(response.data.data.ekeys || []);
      } else {
        setEkeys([]);
      }
    } catch (error) {
      console.error('❌ Error loading eKeys:', error);
      setEkeys([]);
    } finally {
      setLoadingEkeys(false);
    }
  };

  const handleSendEkey = async () => {
    if (!receiverUsername.trim()) {
      Alert.alert('Missing Information', 'Please enter the recipient\'s email or phone number.');
      return;
    }

    if (!keyName.trim()) {
      Alert.alert('Missing Information', 'Please enter a name for this eKey.');
      return;
    }

    if (!lockId) {
      Alert.alert('Error', 'Lock ID is missing.');
      return;
    }

    if (!ttlockLockId) {
      Alert.alert('Error', 'This lock does not have a valid TTLock ID.');
      return;
    }

    setSending(true);
    try {
      const now = Date.now();
      let startDate = 0;
      let endDate = 0;

      if (ekeyType === 'timed') {
        startDate = now;
        endDate = now + (validDays * 24 * 60 * 60 * 1000);
      }

      console.log('📤 Sending eKey:', { lockId, receiverUsername, keyName, ekeyType });

      const response = await sendEkey(lockId, {
        receiverUsername: receiverUsername.trim(),
        keyName: keyName.trim(),
        startDate,
        endDate,
        remarks: remarks.trim() || undefined,
        remoteEnable: remoteEnabled ? 1 : 2,
        createUser: 1 // Auto-create user if they don't have TTLock account
      });

      console.log('📡 Send eKey response:', response.data);

      if (response.data?.success) {
        Alert.alert(
          'eKey Sent Successfully!',
          `An eKey has been sent to ${receiverUsername}.\n\n` +
          (ekeyType === 'permanent'
            ? 'This is a permanent eKey with no expiration.'
            : `This eKey is valid for ${validDays} days.`) +
          '\n\nThe recipient will receive a notification and can use the lock app to unlock the door.',
          [{ text: 'OK', onPress: () => {
            resetForm();
            loadEkeys();
          }}]
        );
      } else {
        throw new Error(response.data?.error?.message || 'Failed to send eKey');
      }
    } catch (error) {
      console.error('❌ Error sending eKey:', error);
      const errorMsg = error.response?.data?.error?.message || error.message || 'Failed to send eKey.';
      Alert.alert('Error', errorMsg);
    } finally {
      setSending(false);
    }
  };

  const handleDeleteEkey = (ekey) => {
    Alert.alert(
      'Delete eKey?',
      `Are you sure you want to delete "${ekey.keyName || 'this eKey'}"?\n\nThis will revoke the user's access to the lock.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              await deleteEkey(ekey.keyId);
              Alert.alert('Success', 'eKey deleted successfully');
              loadEkeys();
            } catch (error) {
              console.error('❌ Error deleting eKey:', error);
              Alert.alert('Error', error.response?.data?.error?.message || 'Failed to delete eKey');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleToggleFreeze = async (ekey) => {
    const action = ekey.isFrozen ? 'unfreeze' : 'freeze';
    const actionPast = ekey.isFrozen ? 'unfrozen' : 'frozen';

    try {
      setLoading(true);
      if (ekey.isFrozen) {
        await unfreezeEkey(ekey.keyId);
      } else {
        await freezeEkey(ekey.keyId);
      }
      Alert.alert('Success', `eKey ${actionPast} successfully`);
      loadEkeys();
    } catch (error) {
      console.error(`❌ Error ${action}ing eKey:`, error);
      Alert.alert('Error', error.response?.data?.error?.message || `Failed to ${action} eKey`);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setReceiverUsername('');
    setKeyName('');
    setEkeyType('permanent');
    setValidDays(7);
    setRemoteEnabled(true);
    setRemarks('');
    setShowSendForm(false);
  };

  const getStatusColor = (ekey) => {
    if (ekey.isExpired || ekey.isDeleted) return Colors.red;
    if (ekey.isFrozen) return '#FF9500';
    if (ekey.isActive) return '#4CAF50';
    return Colors.subtitlecolor;
  };

  const getStatusText = (ekey) => {
    if (ekey.isDeleted) return 'Deleted';
    if (ekey.isExpired) return 'Expired';
    if (ekey.isFrozen) return 'Frozen';
    if (ekey.isActive) return 'Active';
    return ekey.keyStatusText || 'Unknown';
  };

  const renderEkeyItem = ({ item: ekey }) => (
    <View style={styles.ekeyItem}>
      <View style={styles.ekeyIconContainer}>
        <Ionicons
          name={ekey.isAdmin ? 'key' : 'key-outline'}
          size={24}
          color={getStatusColor(ekey)}
        />
      </View>

      <View style={styles.ekeyDetails}>
        <Text style={styles.ekeyName}>{ekey.keyName || 'Unnamed Key'}</Text>
        <Text style={styles.ekeyUser}>
          {ekey.username || 'Unknown User'}
        </Text>
        <View style={styles.ekeyMetaRow}>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(ekey) }]}>
            <Text style={styles.statusBadgeText}>{getStatusText(ekey)}</Text>
          </View>
          <Text style={styles.ekeyType}>
            {ekey.isPermanent ? 'Permanent' : 'Timed'}
          </Text>
        </View>
        {!ekey.isPermanent && ekey.validUntil && (
          <Text style={styles.ekeyExpiry}>
            Expires: {new Date(ekey.validUntil).toLocaleDateString()}
          </Text>
        )}
      </View>

      {!ekey.isAdmin && (
        <View style={styles.ekeyActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleToggleFreeze(ekey)}
            disabled={loading}
          >
            <Ionicons
              name={ekey.isFrozen ? 'play-circle-outline' : 'pause-circle-outline'}
              size={20}
              color={ekey.isFrozen ? '#4CAF50' : '#FF9500'}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleDeleteEkey(ekey)}
            disabled={loading}
          >
            <Ionicons name="trash-outline" size={20} color={Colors.red} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  // Show loading while checking TTLock status
  if (checkingStatus) {
    return (
      <AppScreen contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color={Colors.titlecolor} />
          </TouchableOpacity>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>Share eKey</Text>
            <Text style={styles.headerSubtitle}>
              {lock?.name || 'Loading...'}
            </Text>
          </View>
        </View>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={Colors.iconbackground} />
          <Text style={styles.loadingText}>Checking TTLock connection...</Text>
        </View>
      </AppScreen>
    );
  }

  // Show connect prompt if TTLock is not connected
  if (!ttlockStatus?.isConnected || ttlockStatus?.isExpired) {
    return (
      <AppScreen contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color={Colors.titlecolor} />
          </TouchableOpacity>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>Share eKey</Text>
            <Text style={styles.headerSubtitle}>
              {lock?.name || 'Connect cloud account'}
            </Text>
          </View>
        </View>

        <Section>
          <AppCard style={styles.connectCard}>
            <Ionicons name="cloud-offline-outline" size={64} color={Colors.iconbackground} />
            <Text style={styles.connectTitle}>
              {ttlockStatus?.isExpired ? 'Cloud Session Expired' : 'Cloud Not Connected'}
            </Text>
            <Text style={styles.connectText}>
              {ttlockStatus?.isExpired
                ? 'Your cloud session has expired. Please reconnect to continue sharing eKeys.'
                : 'To share eKeys with others, you need to connect your cloud account first.'}
            </Text>
            <TouchableOpacity
              style={styles.connectButton}
              onPress={() => navigation.navigate('ConnectTTLock')}
            >
              <Ionicons name="cloud-outline" size={20} color={Colors.textwhite} />
              <Text style={styles.connectButtonText}>
                {ttlockStatus?.isExpired ? 'Reconnect Cloud' : 'Connect Cloud Account'}
              </Text>
            </TouchableOpacity>
          </AppCard>
        </Section>

        <Section title="What is eKey?">
          <AppCard style={styles.helpCard}>
            <View style={styles.helpItem}>
              <Ionicons name="key-outline" size={20} color={Colors.iconbackground} />
              <Text style={styles.helpText}>eKeys are digital keys that let others unlock your lock</Text>
            </View>
            <View style={styles.helpItem}>
              <Ionicons name="time-outline" size={20} color={Colors.iconbackground} />
              <Text style={styles.helpText}>Set permanent or time-limited access</Text>
            </View>
            <View style={styles.helpItem}>
              <Ionicons name="phone-portrait-outline" size={20} color={Colors.iconbackground} />
              <Text style={styles.helpText}>Recipients use the lock app to unlock</Text>
            </View>
            <View style={styles.helpItem}>
              <Ionicons name="shield-checkmark-outline" size={20} color={Colors.iconbackground} />
              <Text style={styles.helpText}>You can freeze or delete eKeys anytime</Text>
            </View>
          </AppCard>
        </Section>
      </AppScreen>
    );
  }

  return (
    <AppScreen contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={Colors.titlecolor} />
        </TouchableOpacity>
        <View style={styles.headerTextContainer}>
          <Text style={styles.headerTitle}>Share eKey</Text>
          <Text style={styles.headerSubtitle}>
            {lock?.name || 'Send digital keys to others'}
          </Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Info Card */}
        <Section>
          <AppCard style={styles.infoCard}>
            <Ionicons name="information-circle-outline" size={24} color={Colors.iconbackground} />
            <Text style={styles.infoText}>
              Share eKeys with family, friends, or service providers. Recipients need the lock app to unlock the door.
            </Text>
          </AppCard>
        </Section>

        {/* Send Form */}
        {showSendForm ? (
          <Section title="Send New eKey">
            <AppCard>
              {/* Recipient */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Recipient Email or Phone</Text>
                <TextInput
                  style={styles.textInput}
                  value={receiverUsername}
                  onChangeText={setReceiverUsername}
                  placeholder="email@example.com or +1234567890"
                  placeholderTextColor={Colors.subtitlecolor}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  editable={!sending}
                />
              </View>

              {/* Key Name */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>eKey Name</Text>
                <TextInput
                  style={styles.textInput}
                  value={keyName}
                  onChangeText={setKeyName}
                  placeholder="e.g., Guest Key, Housekeeper"
                  placeholderTextColor={Colors.subtitlecolor}
                  editable={!sending}
                />
              </View>

              {/* eKey Type */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Access Duration</Text>
                <View style={styles.typeButtons}>
                  <TouchableOpacity
                    style={[styles.typeButton, ekeyType === 'permanent' && styles.typeButtonActive]}
                    onPress={() => setEkeyType('permanent')}
                    disabled={sending}
                  >
                    <Ionicons
                      name="infinite-outline"
                      size={20}
                      color={ekeyType === 'permanent' ? Colors.textwhite : Colors.titlecolor}
                    />
                    <Text style={[styles.typeButtonText, ekeyType === 'permanent' && styles.typeButtonTextActive]}>
                      Permanent
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.typeButton, ekeyType === 'timed' && styles.typeButtonActive]}
                    onPress={() => setEkeyType('timed')}
                    disabled={sending}
                  >
                    <Ionicons
                      name="time-outline"
                      size={20}
                      color={ekeyType === 'timed' ? Colors.textwhite : Colors.titlecolor}
                    />
                    <Text style={[styles.typeButtonText, ekeyType === 'timed' && styles.typeButtonTextActive]}>
                      Temporary
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Duration for timed keys */}
              {ekeyType === 'timed' && (
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Valid for</Text>
                  <View style={styles.durationButtons}>
                    {[1, 3, 7, 14, 30, 90].map((days) => (
                      <TouchableOpacity
                        key={days}
                        style={[styles.durationButton, validDays === days && styles.durationButtonActive]}
                        onPress={() => setValidDays(days)}
                        disabled={sending}
                      >
                        <Text style={[styles.durationText, validDays === days && styles.durationTextActive]}>
                          {days === 1 ? '1 Day' : `${days} Days`}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {/* Remote Unlock Toggle */}
              <TouchableOpacity
                style={styles.toggleRow}
                onPress={() => setRemoteEnabled(!remoteEnabled)}
                disabled={sending}
              >
                <View style={styles.toggleInfo}>
                  <Ionicons name="globe-outline" size={24} color={Colors.iconbackground} />
                  <View>
                    <Text style={styles.toggleLabel}>Remote Unlock</Text>
                    <Text style={styles.toggleDescription}>Allow unlocking via internet/WiFi gateway</Text>
                  </View>
                </View>
                <Ionicons
                  name={remoteEnabled ? 'checkbox' : 'square-outline'}
                  size={24}
                  color={remoteEnabled ? Colors.iconbackground : Colors.subtitlecolor}
                />
              </TouchableOpacity>

              {/* Remarks (optional) */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Notes (optional)</Text>
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  value={remarks}
                  onChangeText={setRemarks}
                  placeholder="Add any notes for this eKey"
                  placeholderTextColor={Colors.subtitlecolor}
                  multiline
                  numberOfLines={2}
                  editable={!sending}
                />
              </View>

              {/* Action Buttons */}
              <View style={styles.formActions}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={resetForm}
                  disabled={sending}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.sendButton, sending && styles.sendButtonDisabled]}
                  onPress={handleSendEkey}
                  disabled={sending}
                >
                  {sending ? (
                    <ActivityIndicator color={Colors.textwhite} />
                  ) : (
                    <Text style={styles.sendButtonText}>Send eKey</Text>
                  )}
                </TouchableOpacity>
              </View>
            </AppCard>
          </Section>
        ) : (
          <Section>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => setShowSendForm(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="send-outline" size={24} color={Colors.textwhite} />
              <Text style={styles.addButtonText}>Send New eKey</Text>
            </TouchableOpacity>
          </Section>
        )}

        {/* Existing eKeys */}
        <Section title={`Shared eKeys${ekeys.length > 0 ? ` (${ekeys.length})` : ''}`}>
          {loadingEkeys ? (
            <AppCard style={styles.centerCard}>
              <ActivityIndicator size="large" color={Colors.iconbackground} />
              <Text style={styles.loadingText}>Loading eKeys...</Text>
            </AppCard>
          ) : ekeys.length === 0 ? (
            <AppCard style={styles.emptyCard}>
              <Ionicons name="key-outline" size={48} color={Colors.subtitlecolor} />
              <Text style={styles.emptyText}>No eKeys shared yet</Text>
              <Text style={styles.emptySubtext}>
                Send an eKey to give someone access to this lock
              </Text>
            </AppCard>
          ) : (
            <AppCard padding="none">
              <FlatList
                data={ekeys}
                renderItem={renderEkeyItem}
                keyExtractor={(item) => item.keyId?.toString() || Math.random().toString()}
                scrollEnabled={false}
                ItemSeparatorComponent={() => <View style={styles.separator} />}
              />
            </AppCard>
          )}
        </Section>

        {/* Help Section */}
        <Section title="How eKeys Work">
          <AppCard style={styles.helpCard}>
            <View style={styles.helpItem}>
              <Ionicons name="send-outline" size={20} color={Colors.iconbackground} />
              <Text style={styles.helpText}>Send an eKey to any email or phone number</Text>
            </View>
            <View style={styles.helpItem}>
              <Ionicons name="phone-portrait-outline" size={20} color={Colors.iconbackground} />
              <Text style={styles.helpText}>Recipient downloads lock app and logs in</Text>
            </View>
            <View style={styles.helpItem}>
              <Ionicons name="key-outline" size={20} color={Colors.iconbackground} />
              <Text style={styles.helpText}>They can unlock via Bluetooth or remotely (if enabled)</Text>
            </View>
            <View style={styles.helpItem}>
              <Ionicons name="shield-checkmark-outline" size={20} color={Colors.iconbackground} />
              <Text style={styles.helpText}>You can freeze or delete eKeys at any time</Text>
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
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Theme.spacing.md,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.subtitlecolor,
  },
  connectCard: {
    alignItems: 'center',
    paddingVertical: Theme.spacing.xl,
    gap: Theme.spacing.md,
  },
  connectTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.titlecolor,
    textAlign: 'center',
  },
  connectText: {
    fontSize: 14,
    color: Colors.subtitlecolor,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: Theme.spacing.md,
  },
  connectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Theme.spacing.sm,
    backgroundColor: Colors.iconbackground,
    borderRadius: Theme.radius.pill,
    paddingVertical: Theme.spacing.md,
    paddingHorizontal: Theme.spacing.xl,
    marginTop: Theme.spacing.md,
  },
  connectButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textwhite,
  },
  infoCard: {
    flexDirection: 'row',
    gap: Theme.spacing.sm,
    backgroundColor: Colors.cardbackground,
    padding: Theme.spacing.md,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: Colors.subtitlecolor,
    lineHeight: 18,
  },
  addButton: {
    backgroundColor: Colors.iconbackground,
    borderRadius: Theme.radius.pill,
    paddingVertical: Theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Theme.spacing.sm,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textwhite,
  },
  inputGroup: {
    marginBottom: Theme.spacing.md,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.titlecolor,
    marginBottom: Theme.spacing.xs,
  },
  textInput: {
    backgroundColor: Colors.background,
    borderRadius: Theme.radius.md,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
    fontSize: 16,
    color: Colors.titlecolor,
    borderWidth: 1,
    borderColor: Colors.bordercolor,
  },
  textArea: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  typeButtons: {
    flexDirection: 'row',
    gap: Theme.spacing.sm,
  },
  typeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Theme.spacing.xs,
    backgroundColor: Colors.background,
    borderRadius: Theme.radius.md,
    paddingVertical: Theme.spacing.sm,
    borderWidth: 1,
    borderColor: Colors.bordercolor,
  },
  typeButtonActive: {
    backgroundColor: Colors.iconbackground,
    borderColor: Colors.iconbackground,
  },
  typeButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.titlecolor,
  },
  typeButtonTextActive: {
    color: Colors.textwhite,
  },
  durationButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Theme.spacing.xs,
  },
  durationButton: {
    backgroundColor: Colors.background,
    borderRadius: Theme.radius.md,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
    borderWidth: 1,
    borderColor: Colors.bordercolor,
  },
  durationButtonActive: {
    backgroundColor: Colors.iconbackground,
    borderColor: Colors.iconbackground,
  },
  durationText: {
    fontSize: 13,
    color: Colors.titlecolor,
  },
  durationTextActive: {
    color: Colors.textwhite,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.background,
    borderRadius: Theme.radius.md,
    padding: Theme.spacing.md,
    marginBottom: Theme.spacing.md,
    borderWidth: 1,
    borderColor: Colors.bordercolor,
  },
  toggleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
    flex: 1,
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.titlecolor,
  },
  toggleDescription: {
    fontSize: 12,
    color: Colors.subtitlecolor,
  },
  formActions: {
    flexDirection: 'row',
    gap: Theme.spacing.md,
    marginTop: Theme.spacing.md,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: Theme.radius.pill,
    paddingVertical: Theme.spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.bordercolor,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.subtitlecolor,
  },
  sendButton: {
    flex: 1,
    backgroundColor: Colors.iconbackground,
    borderRadius: Theme.radius.pill,
    paddingVertical: Theme.spacing.sm,
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.6,
  },
  sendButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textwhite,
  },
  centerCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Theme.spacing.xl,
    gap: Theme.spacing.sm,
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
  ekeyItem: {
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
  ekeyIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: `${Colors.iconbackground}15`,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Theme.spacing.md,
  },
  ekeyDetails: {
    flex: 1,
  },
  ekeyName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.titlecolor,
    marginBottom: 2,
  },
  ekeyUser: {
    fontSize: 13,
    color: Colors.subtitlecolor,
    marginBottom: 4,
  },
  ekeyMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textwhite,
  },
  ekeyType: {
    fontSize: 12,
    color: Colors.subtitlecolor,
  },
  ekeyExpiry: {
    fontSize: 12,
    color: Colors.subtitlecolor,
    marginTop: 2,
  },
  ekeyActions: {
    flexDirection: 'row',
    gap: Theme.spacing.xs,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.background,
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

export default SendEkeyScreen;
