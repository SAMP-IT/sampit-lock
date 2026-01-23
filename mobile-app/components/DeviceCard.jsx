import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../constants/Colors';
import Theme from '../constants/Theme';
import AppCard from './ui/AppCard';

const DeviceCard = ({ device, onToggleLock, onTapToUnlock, showConnection = false, isConnected }) => {
  const tapLabel = device.isLocked ? 'Tap To Unlock' : 'Tap To Lock';
  const tapIcon = device.isLocked ? 'lock-closed' : 'lock-open';
  const tapTextColor = device.isLocked ? Colors.textwhite : Colors.iconbackground;
  const tapBackground = device.isLocked ? Colors.iconbackground : Colors.cardbackground;
  const tapBorder = device.isLocked ? 0 : 1;

  return (
    <AppCard variant="tinted" padding="lg">
      <View style={styles.statusRow}>
        <View style={styles.statusLeft}>
          <View style={styles.batteryIndicator}>
            <Ionicons name="battery-half" size={16} color={Colors.textwhite} />
            <Text style={styles.batteryText}>{device.battery}%</Text>
          </View>

          <View
            style={[
              styles.connectionIndicator,
              { backgroundColor: device.isConnected ? Colors.titlecolor : Colors.subtitlecolor },
            ]}
          >
            <Ionicons name="wifi" size={16} color={Colors.textwhite} />
            <Text style={styles.connectionText}>
              {device.isConnected ? 'Connected' : 'Disconnected'}
            </Text>
          </View>
        </View>
        {showConnection && (
          <View style={styles.connectedBadge}>
            <View style={[styles.connectedDot, { backgroundColor: isConnected ? '#4CAF50' : '#f44336' }]} />
            <Text style={[styles.connectedText, { color: isConnected ? '#4CAF50' : '#f44336' }]}>
              {isConnected ? 'Connected' : 'Disconnected'}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.contentRow}>
        <View style={styles.leftContent}>
          <Text style={styles.deviceName}>{device.name}</Text>
          <Text style={styles.deviceLocation}>{device.location}</Text>

          <TouchableOpacity
            style={[
              styles.unlockButton,
              {
                backgroundColor: tapBackground,
                borderWidth: tapBorder,
                borderColor: Colors.iconbackground,
              },
            ]}
            onPress={onTapToUnlock}
            activeOpacity={0.9}
          >
            <Ionicons
              name={tapIcon}
              size={20}
              color={tapTextColor}
            />
            <Text
              style={[styles.unlockButtonText, { color: tapTextColor }]}
            >
              {tapLabel}
            </Text>
          </TouchableOpacity>

          <View style={styles.lockStatus}>
            <TouchableOpacity style={styles.lockButton} onPress={onToggleLock}>
              <Ionicons
                name={device.isLocked ? 'lock-closed' : 'lock-open'}
                size={24}
                color={Colors.textwhite}
              />
            </TouchableOpacity>

            <View style={styles.arrows}>
              <Text style={styles.arrowText}>{'>'}</Text>
              <Text style={styles.arrowText}>{'>'}</Text>
              <Text style={styles.arrowText}>{'>'}</Text>
            </View>

            <TouchableOpacity style={styles.lockButton} onPress={onToggleLock}>
              <Ionicons
                name={!device.isLocked ? 'lock-closed' : 'lock-open'}
                size={24}
                color={Colors.textwhite}
              />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.rightContent}>
          <View style={styles.mockLockDevice}>
            <Text style={styles.brandText}>AWAYKEY</Text>
            <View style={styles.keypad}>
              {[...'1234567890'].map((digit) => (
                <View key={digit} style={styles.keypadButton}>
                  <Text style={styles.keypadText}>{digit}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </View>
    </AppCard>
  );
};

const styles = StyleSheet.create({
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Theme.spacing.lg,
  },
  statusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  batteryIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.iconbackground,
    paddingHorizontal: Theme.spacing.sm,
    paddingVertical: 6,
    borderRadius: Theme.radius.pill,
    marginRight: Theme.spacing.sm,
  },
  batteryText: {
    color: Colors.textwhite,
    fontSize: 12,
    marginLeft: 6,
  },
  connectionIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Theme.spacing.sm,
    paddingVertical: 6,
    borderRadius: Theme.radius.pill,
  },
  connectionText: {
    color: Colors.textwhite,
    fontSize: 12,
    marginLeft: 6,
  },
  connectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: Theme.spacing.sm,
    paddingVertical: 6,
    borderRadius: Theme.radius.pill,
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  connectedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  connectedText: {
    fontSize: 12,
    fontWeight: '500',
  },
  contentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  leftContent: {
    flex: 1,
    paddingRight: Theme.spacing.lg,
  },
  deviceName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.titlecolor,
    marginBottom: Theme.spacing.sm,
  },
  deviceLocation: {
    fontSize: 16,
    color: Colors.subtitlecolor,
    marginBottom: Theme.spacing.lg,
  },
  unlockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Theme.spacing.sm,
    paddingHorizontal: Theme.spacing.lg,
    borderRadius: Theme.radius.pill,
    marginBottom: Theme.spacing.lg,
  },
  unlockButtonText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: Theme.spacing.sm,
  },
  lockStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Theme.spacing.md,
  },
  lockButton: {
    backgroundColor: Colors.iconbackground,
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  arrows: {
    flexDirection: 'row',
    marginHorizontal: Theme.spacing.md,
  },
  arrowText: {
    fontSize: 18,
    color: Colors.iconbackground,
    marginHorizontal: 2,
  },
  rightContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  mockLockDevice: {
    backgroundColor: Colors.titlecolor,
    borderRadius: Theme.radius.md,
    padding: Theme.spacing.md,
    height: 200,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  keypad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    width: 80,
  },
  keypadButton: {
    width: 20,
    height: 20,
    margin: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  keypadText: {
    color: Colors.textwhite,
    fontSize: 8,
  },
  brandText: {
    color: Colors.textwhite,
    fontSize: 10,
    fontWeight: 'bold',
  },
});

export default DeviceCard;


