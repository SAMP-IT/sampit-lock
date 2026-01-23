import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../constants/Colors';
import Theme from '../constants/Theme';

/**
 * Header Component
 *
 * Reusable top header bar that contains:
 * - Left section — Menu button (optional), title, and optional subtitle
 * - Right section — Location badge (optional), notifications button with badge (optional), CTA button (optional)
 */
const Header = ({
  title,
  subtitle,
  showMenu = true,
  showLogo = false,
  logoSource = null,
  onMenuPress,
  showNotification = true,
  onNotificationPress,
  notificationCount = 1,
  showButton = false,
  onHandleAddUser,
  showLocation = false,
  location = 'Ground',
  showProfile = false,
  onProfilePress,
  showLockCount = false,
  lockCount = 0,
}) => {
  return (
    <View style={styles.header}>
      <View style={styles.leftSection}>
        {showMenu && (
          <View style={styles.menu}>
            <TouchableOpacity onPress={onMenuPress}>
              <Ionicons name="menu" size={24} color={Colors.iconbackground} />
            </TouchableOpacity>
          </View>
        )}
        {showLogo && logoSource ? (
          <Image source={logoSource} style={styles.logo} resizeMode="contain" />
        ) : (
          <View style={styles.titleSection}>
            {title && <Text style={styles.title}>{title}</Text>}
            {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
          </View>
        )}
      </View>

      <View style={styles.rightSection}>
        {showLockCount && (
          <View style={styles.lockCountBadge}>
            <Ionicons name="lock-closed" size={18} color={Colors.iconbackground} />
            <Text style={styles.lockCountText}>{lockCount}</Text>
          </View>
        )}

        {showLocation && (
          <View style={styles.locationBadge}>
            <Ionicons name="location-outline" size={16} color={Colors.iconbackground} style={styles.locationIcon} />
            <Text style={styles.locationText}>{location}</Text>
          </View>
        )}

        {showNotification && (
          <TouchableOpacity onPress={onNotificationPress} style={styles.notificationButton}>
            <Ionicons name="notifications-outline" size={24} color={Colors.textwhite} />
            {notificationCount > 0 && (
              <View style={styles.notificationBadge}>
                <Text style={styles.badgeText}>
                  {notificationCount > 99 ? '99+' : notificationCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        )}

        {showButton && (
          <TouchableOpacity style={styles.addButton} onPress={onHandleAddUser}>
            <Ionicons name="add" size={20} color={Colors.textwhite} />
            <Text style={styles.addButtonText}>Add</Text>
          </TouchableOpacity>
        )}

        {showProfile && (
          <TouchableOpacity style={styles.profileButton} onPress={onProfilePress}>
            <Ionicons name="person-outline" size={24} color={Colors.textwhite} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Theme.spacing.lg,
    paddingTop: Theme.spacing.lg,
    paddingBottom: Theme.spacing.lg,
    backgroundColor: Colors.backgroundwhite,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  menu: {
    marginRight: Theme.spacing.md,
  },
  titleSection: {
    flexShrink: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.titlecolor,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.subtitlecolor,
    marginTop: 2,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  lockCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardbackground,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
    borderRadius: Theme.radius.pill,
    gap: 6,
  },
  lockCountText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.titlecolor,
  },
  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundwhite,
    paddingHorizontal: Theme.spacing.sm,
    paddingVertical: 6,
    borderRadius: Theme.radius.pill,
    borderWidth: 1,
    borderColor: Colors.bordercolor,
    marginRight: Theme.spacing.md,
  },
  locationIcon: {
    marginRight: 4,
  },
  locationText: {
    fontSize: 14,
    color: Colors.subtitlecolor,
  },
  notificationButton: {
    backgroundColor: Colors.iconbackground,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: Colors.indicatorcolor,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: Colors.textwhite,
    fontSize: 12,
    fontWeight: 'bold',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Theme.spacing.sm,
    paddingHorizontal: Theme.spacing.md + 2,
    borderRadius: Theme.radius.pill,
    backgroundColor: Colors.iconbackground,
    marginLeft: Theme.spacing.md,
  },
  addButtonText: {
    color: Colors.textwhite,
    fontSize: 16,
    fontWeight: '500',
    marginLeft: Theme.spacing.sm,
  },
  logo: {
    width: 100,
    height: 40,
  },
  profileButton: {
    backgroundColor: Colors.iconbackground,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: Theme.spacing.md,
  },
});

export default Header;

