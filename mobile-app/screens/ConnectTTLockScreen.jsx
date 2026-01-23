import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import AppScreen from '../components/ui/AppScreen';
import AppCard from '../components/ui/AppCard';
import Colors from '../constants/Colors';
import Theme from '../constants/Theme';
import { getTTLockStatus, importTTLockLocks } from '../services/api';
import { useToast } from '../context/ToastContext';

/**
 * TTLock Connection Status Screen
 * Since TTLock is now the main authentication method, this screen just shows
 * the connection status and provides a sync option for importing locks.
 */
const ConnectTTLockScreen = ({ navigation }) => {
  const [isCheckingStatus, setIsCheckingStatus] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [syncProgress, setSyncProgress] = useState('');
  const { showSuccess, showError, showInfo } = useToast();

  // Re-check connection status whenever screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      checkConnectionStatus();
    }, [])
  );

  const checkConnectionStatus = async () => {
    setIsCheckingStatus(true);
    try {
      const response = await getTTLockStatus();
      console.log('TTLock Status Response:', response.data);

      // Backend returns { success: true, data: { connected, ttlock_username, ... } }
      const statusData = response.data?.data || response.data;
      console.log('Parsed TTLock status:', statusData);
      setConnectionStatus(statusData);
    } catch (error) {
      console.warn('TTLock status check: Not connected');
      // If we get a 404 or error, TTLock is NOT connected
      setConnectionStatus({ connected: false, tokenValid: false });
    } finally {
      setIsCheckingStatus(false);
    }
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    setSyncProgress('Syncing locks from TTLock cloud...');
    showInfo('Syncing your locks from TTLock cloud...');

    try {
      const result = await importTTLockLocks();
      const imported = result?.data?.data?.imported ?? result?.data?.imported ?? 0;
      const skipped = result?.data?.data?.skipped ?? result?.data?.skipped ?? 0;

      if (imported > 0) {
        showSuccess(`Imported ${imported} new lock${imported > 1 ? 's' : ''}!`);
      } else if (skipped > 0) {
        showInfo(`All ${skipped} lock${skipped > 1 ? 's are' : ' is'} already synced`);
      } else {
        showInfo('No locks found in your TTLock cloud account');
      }

      await checkConnectionStatus();
    } catch (err) {
      console.warn('Failed to sync TTLock locks:', err?.message);
      showError(err.response?.data?.error?.message || 'Unable to sync locks. Please try again.');
    } finally {
      setIsSyncing(false);
      setSyncProgress('');
    }
  };

  if (isCheckingStatus) {
    return (
      <AppScreen contentContainerStyle={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Checking connection status...</Text>
      </AppScreen>
    );
  }

  // Check if TTLock is actually connected
  const isConnected = connectionStatus?.connected && connectionStatus?.tokenValid;

  return (
    <AppScreen contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={24} color={Colors.titlecolor} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>TTLock Connection</Text>
      </View>

      <AppCard style={styles.card}>
        {isConnected ? (
          <>
            <View style={styles.statusIconContainer}>
              <Ionicons name="checkmark-circle" size={64} color="#4CAF50" />
            </View>

            <Text style={styles.title}>Account Connected</Text>
            <Text style={styles.subtitle}>
              Your TTLock account is connected and ready to use
            </Text>
          </>
        ) : (
          <>
            <View style={styles.statusIconContainer}>
              <Ionicons name="cloud-offline-outline" size={64} color={Colors.subtitlecolor} />
            </View>

            <Text style={styles.title}>Not Connected</Text>
            <Text style={styles.subtitle}>
              Connect your TTLock account to enable remote control and sync your locks
            </Text>
          </>
        )}

        {isConnected && (
          <View style={styles.statusInfoContainer}>
            <View style={styles.statusInfoRow}>
              <Ionicons name="mail-outline" size={20} color={Colors.subtitlecolor} />
              <View style={styles.statusInfoText}>
                <Text style={styles.statusLabel}>Connected Account</Text>
                <Text style={styles.statusValue}>
                  {connectionStatus?.ttlock_username || connectionStatus?.email || 'Your TTLock Account'}
                </Text>
              </View>
            </View>

            <View style={styles.statusInfoRow}>
              <Ionicons name="shield-checkmark-outline" size={20} color={Colors.subtitlecolor} />
              <View style={styles.statusInfoText}>
                <Text style={styles.statusLabel}>Connection Status</Text>
                <Text style={[styles.statusValue, { color: '#4CAF50' }]}>
                  Active
                </Text>
              </View>
            </View>
          </View>
        )}

        {isConnected ? (
          <TouchableOpacity
            style={[styles.syncButton, isSyncing && styles.syncButtonDisabled]}
            onPress={handleManualSync}
            disabled={isSyncing}
          >
            {isSyncing ? (
              <>
                <ActivityIndicator color="#fff" />
                <Text style={styles.syncButtonText}>{syncProgress || 'Syncing...'}</Text>
              </>
            ) : (
              <>
                <Ionicons name="cloud-download-outline" size={20} color="#fff" />
                <Text style={styles.syncButtonText}>Sync Locks from Cloud</Text>
              </>
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.connectButton}
            onPress={() => navigation.navigate('TTLockCloudLogin', {
              onSuccess: () => checkConnectionStatus()
            })}
          >
            <Ionicons name="link-outline" size={20} color="#fff" />
            <Text style={styles.connectButtonText}>Connect TTLock Account</Text>
          </TouchableOpacity>
        )}

        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={18} color={Colors.iconbackground} />
          <Text style={styles.infoText}>
            {isConnected
              ? 'Use "Sync Locks from Cloud" to import any locks registered in your TTLock app.'
              : 'Connect your TTLock account to enable remote control and sync your smart locks from the TTLock cloud.'}
          </Text>
        </View>
      </AppCard>
    </AppScreen>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Theme.spacing.lg,
    paddingTop: 60,
    paddingBottom: Theme.spacing.xl,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: Theme.spacing.md,
    fontSize: 16,
    color: Colors.subtitlecolor,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Theme.spacing.lg,
  },
  backButton: {
    padding: Theme.spacing.sm,
    marginLeft: -Theme.spacing.sm,
    marginRight: Theme.spacing.sm,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.titlecolor,
  },
  card: {
    padding: Theme.spacing.xl,
  },
  statusIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
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
    fontSize: 14,
    color: Colors.subtitlecolor,
    textAlign: 'center',
    marginBottom: Theme.spacing.xl,
    lineHeight: 20,
  },
  statusInfoContainer: {
    marginVertical: Theme.spacing.lg,
    gap: Theme.spacing.md,
  },
  statusInfoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: Theme.spacing.md,
    backgroundColor: Colors.cardbackground,
    borderRadius: Theme.radius.md,
    gap: Theme.spacing.md,
  },
  statusInfoText: {
    flex: 1,
  },
  statusLabel: {
    fontSize: 13,
    color: Colors.subtitlecolor,
    marginBottom: 4,
  },
  statusValue: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.titlecolor,
  },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.iconbackground,
    paddingVertical: Theme.spacing.md,
    borderRadius: Theme.radius.pill,
    gap: Theme.spacing.sm,
    marginBottom: Theme.spacing.lg,
  },
  syncButtonDisabled: {
    opacity: 0.6,
  },
  syncButtonText: {
    color: Colors.textwhite,
    fontSize: 16,
    fontWeight: '600',
  },
  connectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#8B5CF6',
    paddingVertical: Theme.spacing.md,
    borderRadius: Theme.radius.pill,
    gap: Theme.spacing.sm,
    marginBottom: Theme.spacing.lg,
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  connectButtonText: {
    color: Colors.textwhite,
    fontSize: 16,
    fontWeight: '600',
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: Colors.cardbackground,
    padding: Theme.spacing.md,
    borderRadius: Theme.radius.md,
    gap: Theme.spacing.sm,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: Colors.subtitlecolor,
    lineHeight: 18,
  },
});

export default ConnectTTLockScreen;
