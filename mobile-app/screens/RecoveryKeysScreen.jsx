import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, Share } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import AppScreen from '../components/ui/AppScreen';
import AppCard from '../components/ui/AppCard';
import Colors from '../constants/Colors';
import Theme from '../constants/Theme';
import { getRecoveryKeys } from '../services/api';

const RecoveryKeysScreen = ({ navigation, route }) => {
  const { lockId, lockName = 'Lock' } = route.params || {};
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [recoveryKeys, setRecoveryKeys] = useState(null);
  const [showKeys, setShowKeys] = useState(false);

  useEffect(() => {
    fetchRecoveryKeys();
  }, [lockId]);

  const fetchRecoveryKeys = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await getRecoveryKeys(lockId);
      const data = response?.data?.data || response?.data;

      console.log('[RecoveryKeys] Fetched keys:', {
        hasAdminPwd: !!data?.admin_pwd,
        hasDeletePwd: !!data?.delete_pwd,
        hasNoKeyPwd: !!data?.no_key_pwd,
      });

      setRecoveryKeys(data);
    } catch (err) {
      console.error('[RecoveryKeys] Error:', err);
      setError(err.message || 'Failed to load recovery keys');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyKey = async (key, name) => {
    if (!key) {
      Alert.alert('Not Available', `${name} was not saved when this lock was paired.`);
      return;
    }

    try {
      await Clipboard.setStringAsync(key);
      Alert.alert('Copied', `${name} copied to clipboard`);
    } catch (err) {
      Alert.alert('Error', 'Failed to copy to clipboard');
    }
  };

  const handleShareAll = async () => {
    if (!recoveryKeys) return;

    const keys = [];
    if (recoveryKeys.admin_pwd) keys.push(`Admin Code: ${recoveryKeys.admin_pwd}`);
    if (recoveryKeys.delete_pwd) keys.push(`Reset Code: ${recoveryKeys.delete_pwd}`);
    if (recoveryKeys.no_key_pwd) keys.push(`Emergency Code: ${recoveryKeys.no_key_pwd}`);
    if (recoveryKeys.recovery_key) keys.push(`Recovery Key: ${recoveryKeys.recovery_key}`);

    if (keys.length === 0) {
      Alert.alert('No Keys', 'No recovery keys are available for this lock.');
      return;
    }

    const message = `AwayKey Recovery Keys for "${lockName}"\n\n${keys.join('\n')}\n\nKeep these codes safe and secret. They provide emergency access to your lock.`;

    try {
      await Share.share({
        message,
        title: 'AwayKey Recovery Keys',
      });
    } catch (err) {
      if (err.message !== 'User cancelled') {
        Alert.alert('Error', 'Failed to share recovery keys');
      }
    }
  };

  const maskKey = (key) => {
    if (!key) return '(Not saved)';
    if (!showKeys) return '••••••••';
    return key;
  };

  const hasAnyKey = recoveryKeys && (
    recoveryKeys.admin_pwd ||
    recoveryKeys.delete_pwd ||
    recoveryKeys.no_key_pwd ||
    recoveryKeys.recovery_key
  );

  if (loading) {
    return (
      <AppScreen contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="chevron-back" size={24} color={Colors.titlecolor} />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Recovery Keys</Text>
            <Text style={styles.headerSubtitle}>{lockName}</Text>
          </View>
        </View>

        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.iconbackground} />
          <Text style={styles.loadingText}>Loading recovery keys...</Text>
        </View>
      </AppScreen>
    );
  }

  if (error) {
    return (
      <AppScreen contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="chevron-back" size={24} color={Colors.titlecolor} />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Recovery Keys</Text>
            <Text style={styles.headerSubtitle}>{lockName}</Text>
          </View>
        </View>

        <AppCard style={styles.errorCard}>
          <Ionicons name="alert-circle-outline" size={48} color={Colors.red} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchRecoveryKeys}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </AppCard>
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
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Recovery Keys</Text>
          <Text style={styles.headerSubtitle}>{lockName}</Text>
        </View>
      </View>

      {/* Info Card */}
      <AppCard style={styles.infoCard}>
        <View style={styles.infoHeader}>
          <Ionicons name="information-circle-outline" size={24} color={Colors.iconbackground} />
          <Text style={styles.infoTitle}>What are Recovery Keys?</Text>
        </View>
        <Text style={styles.infoText}>
          Recovery keys are special codes from your lock that can be used in emergencies:{'\n\n'}
          <Text style={styles.bulletPoint}>Admin Code</Text> - Enter on the lock's keypad for management access{'\n'}
          <Text style={styles.bulletPoint}>Reset Code</Text> - Factory reset the lock if you lose app access{'\n'}
          <Text style={styles.bulletPoint}>Emergency Code</Text> - Unlock without the app (enter on keypad)
        </Text>
      </AppCard>

      {/* Warning Card */}
      <AppCard style={styles.warningCard}>
        <View style={styles.warningHeader}>
          <Ionicons name="warning-outline" size={24} color="#FF9800" />
          <Text style={styles.warningTitle}>Keep These Safe</Text>
        </View>
        <Text style={styles.warningText}>
          These codes provide emergency access to your lock. Keep them private and store them securely. Never share these codes with anyone you don't trust.
        </Text>
      </AppCard>

      {/* Show/Hide Toggle */}
      <TouchableOpacity
        style={styles.toggleButton}
        onPress={() => setShowKeys(!showKeys)}
      >
        <Ionicons
          name={showKeys ? 'eye-off-outline' : 'eye-outline'}
          size={20}
          color={Colors.iconbackground}
        />
        <Text style={styles.toggleText}>
          {showKeys ? 'Hide Keys' : 'Show Keys'}
        </Text>
      </TouchableOpacity>

      {/* Recovery Keys */}
      {!hasAnyKey ? (
        <AppCard style={styles.noKeysCard}>
          <Ionicons name="key-outline" size={48} color={Colors.subtitlecolor} />
          <Text style={styles.noKeysTitle}>No Recovery Keys</Text>
          <Text style={styles.noKeysText}>
            Recovery keys are generated when a lock is paired via Bluetooth. If you paired this lock through the lock app or cloud, recovery keys may not be available.
          </Text>
        </AppCard>
      ) : (
        <AppCard padding="none">
          {/* Admin Password */}
          <TouchableOpacity
            style={styles.keyItem}
            onPress={() => handleCopyKey(recoveryKeys?.admin_pwd, 'Admin Code')}
            disabled={!recoveryKeys?.admin_pwd}
          >
            <View style={styles.keyIcon}>
              <Ionicons name="person-outline" size={20} color={Colors.iconbackground} />
            </View>
            <View style={styles.keyContent}>
              <Text style={styles.keyName}>Admin Code</Text>
              <Text style={[styles.keyValue, !recoveryKeys?.admin_pwd && styles.keyNotAvailable]}>
                {maskKey(recoveryKeys?.admin_pwd)}
              </Text>
              <Text style={styles.keyDescription}>Lock management access</Text>
            </View>
            {recoveryKeys?.admin_pwd && (
              <Ionicons name="copy-outline" size={20} color={Colors.subtitlecolor} />
            )}
          </TouchableOpacity>

          {/* Delete Password */}
          <TouchableOpacity
            style={styles.keyItem}
            onPress={() => handleCopyKey(recoveryKeys?.delete_pwd, 'Reset Code')}
            disabled={!recoveryKeys?.delete_pwd}
          >
            <View style={styles.keyIcon}>
              <Ionicons name="refresh-outline" size={20} color={Colors.iconbackground} />
            </View>
            <View style={styles.keyContent}>
              <Text style={styles.keyName}>Reset Code</Text>
              <Text style={[styles.keyValue, !recoveryKeys?.delete_pwd && styles.keyNotAvailable]}>
                {maskKey(recoveryKeys?.delete_pwd)}
              </Text>
              <Text style={styles.keyDescription}>Factory reset the lock</Text>
            </View>
            {recoveryKeys?.delete_pwd && (
              <Ionicons name="copy-outline" size={20} color={Colors.subtitlecolor} />
            )}
          </TouchableOpacity>

          {/* No Key Password (Super Code) */}
          <TouchableOpacity
            style={styles.keyItem}
            onPress={() => handleCopyKey(recoveryKeys?.no_key_pwd, 'Emergency Code')}
            disabled={!recoveryKeys?.no_key_pwd}
          >
            <View style={styles.keyIcon}>
              <Ionicons name="shield-checkmark-outline" size={20} color={Colors.iconbackground} />
            </View>
            <View style={styles.keyContent}>
              <Text style={styles.keyName}>Emergency Code</Text>
              <Text style={[styles.keyValue, !recoveryKeys?.no_key_pwd && styles.keyNotAvailable]}>
                {maskKey(recoveryKeys?.no_key_pwd)}
              </Text>
              <Text style={styles.keyDescription}>Unlock without credentials</Text>
            </View>
            {recoveryKeys?.no_key_pwd && (
              <Ionicons name="copy-outline" size={20} color={Colors.subtitlecolor} />
            )}
          </TouchableOpacity>

          {/* App Recovery Key */}
          {recoveryKeys?.recovery_key && (
            <TouchableOpacity
              style={[styles.keyItem, styles.keyItemLast]}
              onPress={() => handleCopyKey(recoveryKeys?.recovery_key, 'Recovery Key')}
            >
              <View style={styles.keyIcon}>
                <Ionicons name="key-outline" size={20} color={Colors.iconbackground} />
              </View>
              <View style={styles.keyContent}>
                <Text style={styles.keyName}>Recovery Key</Text>
                <Text style={styles.keyValue}>
                  {maskKey(recoveryKeys?.recovery_key)}
                </Text>
                <Text style={styles.keyDescription}>App-generated recovery</Text>
              </View>
              <Ionicons name="copy-outline" size={20} color={Colors.subtitlecolor} />
            </TouchableOpacity>
          )}
        </AppCard>
      )}

      {/* Share Button */}
      {hasAnyKey && (
        <TouchableOpacity style={styles.shareButton} onPress={handleShareAll}>
          <Ionicons name="share-outline" size={20} color={Colors.textwhite} />
          <Text style={styles.shareButtonText}>Share All Keys</Text>
        </TouchableOpacity>
      )}
    </AppScreen>
  );
};

const styles = StyleSheet.create({
  content: {
    paddingTop: 60,
    paddingHorizontal: Theme.spacing.lg,
    paddingBottom: Theme.spacing.xl,
    gap: Theme.spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Theme.spacing.md,
  },
  backButton: {
    padding: Theme.spacing.sm,
    marginLeft: -Theme.spacing.sm,
  },
  headerContent: {
    flex: 1,
    marginLeft: Theme.spacing.sm,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.titlecolor,
  },
  headerSubtitle: {
    fontSize: 14,
    color: Colors.subtitlecolor,
    marginTop: 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Theme.spacing.md,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.subtitlecolor,
  },
  errorCard: {
    alignItems: 'center',
    padding: Theme.spacing.xl,
    gap: Theme.spacing.md,
  },
  errorText: {
    fontSize: 14,
    color: Colors.red,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: Theme.spacing.sm,
    backgroundColor: Colors.iconbackground,
    borderRadius: Theme.radius.md,
    marginTop: Theme.spacing.sm,
  },
  retryButtonText: {
    color: Colors.textwhite,
    fontWeight: '600',
  },
  infoCard: {
    backgroundColor: '#E3F2FD',
    borderWidth: 1,
    borderColor: '#90CAF9',
    padding: Theme.spacing.lg,
    gap: Theme.spacing.sm,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.iconbackground,
  },
  infoText: {
    fontSize: 14,
    color: '#1565C0',
    lineHeight: 22,
  },
  bulletPoint: {
    fontWeight: '600',
  },
  warningCard: {
    backgroundColor: '#FFF8E1',
    borderWidth: 1,
    borderColor: '#FFE082',
    padding: Theme.spacing.lg,
    gap: Theme.spacing.sm,
  },
  warningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  warningTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F57C00',
  },
  warningText: {
    fontSize: 14,
    color: '#F57C00',
    lineHeight: 20,
  },
  toggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Theme.spacing.sm,
    paddingVertical: Theme.spacing.sm,
  },
  toggleText: {
    fontSize: 14,
    color: Colors.iconbackground,
    fontWeight: '500',
  },
  noKeysCard: {
    alignItems: 'center',
    padding: Theme.spacing.xl,
    gap: Theme.spacing.md,
  },
  noKeysTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.titlecolor,
  },
  noKeysText: {
    fontSize: 14,
    color: Colors.subtitlecolor,
    textAlign: 'center',
    lineHeight: 20,
  },
  keyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.bordercolor,
  },
  keyItemLast: {
    borderBottomWidth: 0,
  },
  keyIcon: {
    width: 40,
    height: 40,
    borderRadius: Theme.radius.md,
    backgroundColor: Colors.cardbackground,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Theme.spacing.md,
  },
  keyContent: {
    flex: 1,
  },
  keyName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.titlecolor,
  },
  keyValue: {
    fontSize: 14,
    color: Colors.iconbackground,
    fontFamily: 'monospace',
    marginTop: 2,
  },
  keyNotAvailable: {
    color: Colors.subtitlecolor,
    fontStyle: 'italic',
    fontFamily: undefined,
  },
  keyDescription: {
    fontSize: 12,
    color: Colors.subtitlecolor,
    marginTop: 2,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Theme.spacing.sm,
    backgroundColor: Colors.iconbackground,
    paddingVertical: Theme.spacing.md,
    paddingHorizontal: Theme.spacing.lg,
    borderRadius: Theme.radius.pill,
  },
  shareButtonText: {
    color: Colors.textwhite,
    fontSize: 16,
    fontWeight: '600',
  },
});

export default RecoveryKeysScreen;
