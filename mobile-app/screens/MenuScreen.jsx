import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../constants/Colors';
import Theme from '../constants/Theme';
import { useRole } from '../context/RoleContext';
import { logout, getTTLockStatus } from '../services/api';

const menuItems = [
  // Main Navigation
  { label: 'Home', icon: 'home-outline', navigateTo: { stack: 'ConsumerTabs', screen: 'Home' } },
  { label: 'Devices', icon: 'hardware-chip-outline', navigateTo: { stack: 'ConsumerTabs', screen: 'Devices' } },
  { label: 'Users', icon: 'people-outline', navigateTo: { stack: 'ConsumerTabs', screen: 'UserManagement' } },
  { label: 'History', icon: 'time-outline', navigateTo: { stack: 'ConsumerTabs', screen: 'History' } },
  { label: 'Settings', icon: 'settings-outline', navigateTo: { stack: 'ConsumerTabs', screen: 'Settings' } },
  { label: 'Add new lock', icon: 'add-circle-outline', navigateTo: { stack: 'PairLock' }, requiresTTLock: true },
];

const MenuScreen = ({ navigation }) => {
  const { setRole } = useRole();
  const [ttlockStatus, setTTLockStatus] = useState(null);

  useEffect(() => {
    checkTTLockStatus();
  }, []);

  const checkTTLockStatus = async () => {
    try {
      const response = await getTTLockStatus();
      const statusPayload = response?.data ?? response;
      const normalizedStatus = statusPayload?.data ?? statusPayload;
      setTTLockStatus(normalizedStatus);
    } catch (error) {
      setTTLockStatus(null);
    }
  };

  const handleLogout = async () => {
    await logout();
    setRole(null);
    // Navigation should be handled by the RootNavigator now
  };

  const closeMenu = () => {
    // Check if we can go back, if not just do nothing
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  };

  const handleNavigate = (item) => {
    // Check if this item requires TTLock connection
    if (item.requiresTTLock && !ttlockStatus?.connected) {
      Alert.alert(
        'Cloud Account Required',
        'To add a lock, you need to connect your cloud account first.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Connect Cloud',
            onPress: () => {
              closeMenu();
              setTimeout(() => {
                navigation.navigate('ConnectTTLock');
              }, 100);
            }
          }
        ]
      );
      return;
    }

    // Close the menu first, then navigate
    closeMenu();

    // Small delay to allow menu to close before navigating
    setTimeout(() => {
      if (item.navigateTo.screen) {
        // For tab navigation, reset to the specific tab
        navigation.reset({
          index: 0,
          routes: [
            {
              name: item.navigateTo.stack,
              state: {
                routes: [{ name: item.navigateTo.screen }],
              },
            },
          ],
        });
      } else if (item.navigateTo.stack) {
        // For stack screens, just navigate
        navigation.navigate(item.navigateTo.stack);
      }
    }, 100);
  };

  return (
    <View style={styles.overlay}>
      <View style={styles.drawer}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <Text style={styles.menuTitle}>Awakey</Text>
          <Text style={styles.menuSubtitle}>Navigate</Text>

          {/* Main Navigation */}
          <View style={styles.menuList}>
            {menuItems.map((item) => (
              <TouchableOpacity key={item.label} style={styles.menuItem} onPress={() => handleNavigate(item)}>
                <Ionicons name={item.icon} size={20} color={Colors.iconbackground} style={styles.itemIcon} />
                <Text style={styles.itemLabel}>{item.label}</Text>
                <Ionicons name="chevron-forward" size={18} color={Colors.subtitlecolor} />
              </TouchableOpacity>
            ))}
          </View>

          {/* Logout */}
          <View style={[styles.menuList, { marginTop: Theme.spacing.xl }]}>
            <TouchableOpacity style={styles.menuItem} onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={20} color={Colors.red} style={styles.itemIcon} />
              <Text style={[styles.itemLabel, { color: Colors.red }]}>Logout</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
      <TouchableOpacity style={styles.backdrop} onPress={closeMenu} />
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '70%',
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  drawer: {
    width: '70%',
    backgroundColor: Colors.backgroundwhite,
    paddingTop: Theme.spacing.xl + 40,
    paddingHorizontal: Theme.spacing.lg,
    paddingBottom: Theme.spacing.xl,
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    shadowColor: '#000',
    shadowOffset: {
      width: 2,
      height: 0,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  menuTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.titlecolor,
  },
  menuSubtitle: {
    ...Theme.typography.subtitle,
    marginTop: Theme.spacing.xs,
    marginBottom: Theme.spacing.xl,
  },
  menuList: {
    gap: Theme.spacing.sm,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Theme.spacing.md,
  },
  itemIcon: {
    marginRight: Theme.spacing.md,
  },
  itemLabel: {
    flex: 1,
    fontSize: 16,
    color: Colors.titlecolor,
  },
});

export default MenuScreen;
