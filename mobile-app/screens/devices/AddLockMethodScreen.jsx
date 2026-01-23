import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../../constants/Colors';
import Theme from '../../constants/Theme';
import { getTTLockStatus } from '../../services/api';

const AddLockMethodScreen = ({ navigation }) => {
  const [ttlockStatus, setTTLockStatus] = useState(null);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);

  // Check TTLock status when screen loads
  useEffect(() => {
    checkTTLockStatus();
  }, []);

  const checkTTLockStatus = async () => {
    try {
      setIsCheckingStatus(true);
      const response = await getTTLockStatus();
      const statusPayload = response?.data ?? response;
      const normalizedStatus = statusPayload?.data ?? statusPayload;
      setTTLockStatus(normalizedStatus);
      console.log('[AddLockMethod] TTLock status:', normalizedStatus);
    } catch (error) {
      console.log('[AddLockMethod] TTLock status check failed:', error.message);
      setTTLockStatus(null);
    } finally {
      setIsCheckingStatus(false);
    }
  };

  const handleBluetoothPairing = async () => {
    // Check if TTLock account is connected
    if (!ttlockStatus?.connected) {
      Alert.alert(
        'TTLock Account Required',
        'To pair a lock via Bluetooth, you need to connect your TTLock account first. This ensures your lock data is synced to the cloud for remote access.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Connect TTLock',
            onPress: () => navigation.navigate('ConnectTTLock')
          }
        ]
      );
      return;
    }

    navigation.navigate('BluetoothLockPairing');
  };

  const handleCloudLogin = () => {
    navigation.navigate('TTLockCloudLogin');
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color={Colors.textcolor} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Add Lock</Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Title */}
        <View style={styles.titleContainer}>
          <Text style={styles.title}>Choose How to Add Your Lock</Text>
          <Text style={styles.subtitle}>
            Select the method that works best for you
          </Text>
        </View>

        {/* Option 1: Bluetooth Pairing */}
        <TouchableOpacity
          style={styles.optionCard}
          onPress={handleBluetoothPairing}
          activeOpacity={0.7}
        >
          <View style={[styles.iconCircle, { backgroundColor: Colors.iconbackground + '15' }]}>
            <Ionicons name="bluetooth" size={32} color={Colors.iconbackground} />
          </View>

          <View style={styles.optionContent}>
            <Text style={styles.optionTitle}>Bluetooth Pairing</Text>
            <Text style={styles.optionDescription}>
              Pair a new lock directly via Bluetooth
            </Text>

            <View style={styles.featuresList}>
              <View style={styles.featureItem}>
                <Ionicons name="checkmark-circle-outline" size={16} color="#34C759" />
                <Text style={styles.featureText}>Local control (10m range)</Text>
              </View>
              <View style={styles.featureItem}>
                <Ionicons name="checkmark-circle-outline" size={16} color="#34C759" />
                <Text style={styles.featureText}>No internet required</Text>
              </View>
              <View style={styles.featureItem}>
                <Ionicons name="checkmark-circle-outline" size={16} color="#34C759" />
                <Text style={styles.featureText}>Fast response (~200ms)</Text>
              </View>
            </View>

            {/* TTLock Account Status */}
            {isCheckingStatus ? (
              <View style={styles.statusContainer}>
                <ActivityIndicator size="small" color={Colors.subtitlecolor} />
                <Text style={styles.statusText}>Checking account status...</Text>
              </View>
            ) : ttlockStatus?.connected ? (
              <View style={[styles.statusContainer, styles.statusConnected]}>
                <Ionicons name="checkmark-circle" size={16} color="#34C759" />
                <Text style={[styles.statusText, { color: '#34C759' }]}>TTLock account connected</Text>
              </View>
            ) : (
              <View style={[styles.statusContainer, styles.statusNotConnected]}>
                <Ionicons name="alert-circle" size={16} color="#FF9500" />
                <Text style={[styles.statusText, { color: '#FF9500' }]}>TTLock account required</Text>
              </View>
            )}

            <View style={styles.bestForContainer}>
              <Text style={styles.bestForLabel}>Best for:</Text>
              <Text style={styles.bestForText}>New locks, local control</Text>
            </View>
          </View>

          <Ionicons name="chevron-forward" size={24} color={Colors.subtitlecolor} />
        </TouchableOpacity>

        {/* Option 2: Cloud Login */}
        <TouchableOpacity
          style={styles.optionCard}
          onPress={handleCloudLogin}
          activeOpacity={0.7}
        >
          <View style={[styles.iconCircle, { backgroundColor: '#007AFF15' }]}>
            <Ionicons name="cloud" size={32} color="#007AFF" />
          </View>

          <View style={styles.optionContent}>
            <Text style={styles.optionTitle}>Connect TTLock Cloud</Text>
            <Text style={styles.optionDescription}>
              Sync locks from your TTLock account
            </Text>

            <View style={styles.featuresList}>
              <View style={styles.featureItem}>
                <Ionicons name="checkmark-circle-outline" size={16} color="#34C759" />
                <Text style={styles.featureText}>Remote control (anywhere)</Text>
              </View>
              <View style={styles.featureItem}>
                <Ionicons name="checkmark-circle-outline" size={16} color="#34C759" />
                <Text style={styles.featureText}>Auto-sync existing locks</Text>
              </View>
              <View style={styles.featureItem}>
                <Ionicons name="checkmark-circle-outline" size={16} color="#34C759" />
                <Text style={styles.featureText}>Bluetooth fallback</Text>
              </View>
            </View>

            <View style={styles.requiresContainer}>
              <Ionicons name="information-circle-outline" size={16} color="#FF9500" />
              <Text style={styles.requiresText}>Requires TTLock Gateway for remote control</Text>
            </View>

            <View style={styles.bestForContainer}>
              <Text style={styles.bestForLabel}>Best for:</Text>
              <Text style={styles.bestForText}>Existing TTLock users, remote control</Text>
            </View>
          </View>

          <Ionicons name="chevron-forward" size={24} color={Colors.subtitlecolor} />
        </TouchableOpacity>

        {/* Info Box */}
        <View style={styles.infoBox}>
          <Ionicons name="bulb-outline" size={20} color={Colors.iconbackground} />
          <Text style={styles.infoText}>
            <Text style={styles.infoTextBold}>Hybrid Control: </Text>
            You can use both methods! Pair via Bluetooth first, then connect Cloud account for remote control.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 30
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.cardbackground,
    justifyContent: 'center',
    alignItems: 'center'
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textcolor
  },
  titleContainer: {
    paddingHorizontal: 30,
    marginBottom: 30
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.textcolor,
    marginBottom: 8
  },
  subtitle: {
    fontSize: 16,
    color: Colors.subtitlecolor,
    lineHeight: 22
  },
  optionCard: {
    flexDirection: 'row',
    backgroundColor: Colors.cardbackground,
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 20,
    borderRadius: 16,
    alignItems: 'flex-start',
    ...Theme.shadows.medium
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16
  },
  optionContent: {
    flex: 1
  },
  optionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textcolor,
    marginBottom: 4
  },
  optionDescription: {
    fontSize: 14,
    color: Colors.subtitlecolor,
    marginBottom: 12
  },
  featuresList: {
    marginBottom: 12
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6
  },
  featureText: {
    fontSize: 13,
    color: Colors.textcolor,
    marginLeft: 6
  },
  requiresContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF9E6',
    padding: 8,
    borderRadius: 6,
    marginBottom: 12
  },
  requiresText: {
    fontSize: 12,
    color: '#8B6914',
    marginLeft: 6,
    flex: 1
  },
  bestForContainer: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  bestForLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textcolor,
    marginRight: 6
  },
  bestForText: {
    fontSize: 13,
    color: Colors.subtitlecolor
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 6,
    marginBottom: 12
  },
  statusConnected: {
    backgroundColor: '#E8F5E9'
  },
  statusNotConnected: {
    backgroundColor: '#FFF3E0'
  },
  statusText: {
    fontSize: 12,
    marginLeft: 6,
    color: Colors.subtitlecolor
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: Colors.iconbackground + '10',
    marginHorizontal: 20,
    marginTop: 8,
    padding: 16,
    borderRadius: 12,
    alignItems: 'flex-start'
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: Colors.textcolor,
    marginLeft: 12,
    lineHeight: 20
  },
  infoTextBold: {
    fontWeight: '600'
  }
});

export default AddLockMethodScreen;
