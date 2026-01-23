import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AppScreen from '../components/ui/AppScreen';
import Section from '../components/ui/Section';
import AppCard from '../components/ui/AppCard';
import Colors from '../constants/Colors';
import Theme from '../constants/Theme';
import {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification
} from '../services/api';

const NotificationsScreen = ({ navigation }) => {
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const response = await getNotifications();
        setNotifications(response.data);
      } catch (err) {
        setError("Failed to load notifications.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchNotifications();
  }, []);

  const handlePress = async (notification) => {
    // Mark as read
    if (!notification.read) {
      try {
        await markNotificationAsRead(notification.id);
        setNotifications(notifications.map(n =>
          n.id === notification.id ? { ...n, read: true } : n
        ));
      } catch (error) {
        console.error('Failed to mark notification as read:', error);
      }
    }

    if (!navigation || !notification.target) {
      return;
    }

    try {
      navigation.goBack();

      setTimeout(() => {
        if (notification.target.stack === 'ConsumerTabs') {
          navigation.navigate('ConsumerTabs', { screen: notification.target.screen });
        } else if (notification.target.screen) {
          navigation.navigate(notification.target.screen);
        }
      }, 150);
    } catch (error) {
      console.error('Navigation error:', error);
    }
  };

  const handleDelete = async (notificationId) => {
    Alert.alert(
      'Delete Notification',
      'Are you sure you want to delete this notification?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteNotification(notificationId);
              setNotifications(notifications.filter(n => n.id !== notificationId));
            } catch (error) {
              Alert.alert('Error', 'Failed to delete notification');
            }
          }
        }
      ]
    );
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllNotificationsAsRead();
      setNotifications(notifications.map(n => ({ ...n, read: true })));
      Alert.alert('Success', 'All notifications marked as read');
    } catch (error) {
      Alert.alert('Error', 'Failed to mark all as read');
    }
  };

  const handleOpenPreferences = () => {
    navigation.navigate('NotificationPreferences');
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <AppScreen contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={Colors.titlecolor} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Notifications</Text>
          <Text style={styles.headerSubtitle}>
            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up!'}
          </Text>
        </View>
        <TouchableOpacity onPress={handleOpenPreferences} style={styles.iconButton}>
          <Ionicons name="settings-outline" size={22} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Action Buttons */}
      {notifications.length > 0 && (
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleMarkAllAsRead}
            disabled={unreadCount === 0}
          >
            <Ionicons
              name="checkmark-done-outline"
              size={18}
              color={unreadCount === 0 ? Colors.subtitlecolor : Colors.primary}
            />
            <Text style={[styles.actionButtonText, unreadCount === 0 && styles.actionButtonTextDisabled]}>
              Mark All Read
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <Section gapless>
        <AppCard padding="none" elevated={false}>
          {isLoading && <Text style={styles.loadingText}>Loading notifications...</Text>}
          {error && <Text style={styles.errorText}>{error}</Text>}
          {!isLoading && !error && notifications.length === 0 && (
            <View style={styles.emptyState}>
              <Ionicons name="notifications-off-outline" size={60} color={Colors.subtitlecolor} />
              <Text style={styles.emptyTitle}>No Notifications</Text>
              <Text style={styles.emptySubtitle}>You're all caught up!</Text>
            </View>
          )}
          {!isLoading && !error && notifications.map((item) => (
            <View key={item.id} style={[styles.notificationRow, item.read && styles.notificationRowRead]}>
              <TouchableOpacity
                style={styles.notificationContent}
                onPress={() => handlePress(item)}
              >
                {!item.read && <View style={styles.unreadDot} />}
                <View style={styles.iconWrap}>
                  <Ionicons name="notifications-outline" size={20} color={Colors.iconbackground} />
                </View>
                <View style={styles.textBlock}>
                  <Text style={[styles.title, !item.read && styles.titleUnread]}>{item.title}</Text>
                  <Text style={styles.subtitle}>{item.subtitle}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={Colors.subtitlecolor} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => handleDelete(item.id)}
              >
                <Ionicons name="trash-outline" size={20} color="#FF4444" />
              </TouchableOpacity>
            </View>
          ))}
        </AppCard>
      </Section>
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
  loadingText: {
    textAlign: 'center',
    padding: Theme.spacing.lg,
    color: Colors.subtitlecolor,
  },
  errorText: {
    textAlign: 'center',
    padding: Theme.spacing.lg,
    color: 'red',
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
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.titlecolor,
  },
  headerSubtitle: {
    ...Theme.typography.subtitle,
  },
  notificationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.bordercolor,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.cardbackground,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Theme.spacing.md,
  },
  textBlock: {
    flex: 1,
    gap: Theme.spacing.xs,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.titlecolor,
  },
  subtitle: {
    ...Theme.typography.subtitle,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.cardbackground,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: Theme.spacing.sm,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Theme.spacing.sm,
    paddingHorizontal: Theme.spacing.md,
    backgroundColor: Colors.cardbackground,
    borderRadius: 20,
    gap: Theme.spacing.xs,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.primary,
  },
  actionButtonTextDisabled: {
    color: Colors.subtitlecolor,
  },
  notificationContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  notificationRowRead: {
    opacity: 0.6,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
    marginRight: Theme.spacing.sm,
  },
  titleUnread: {
    fontWeight: '700',
  },
  deleteButton: {
    padding: Theme.spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: Theme.spacing.xl,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    marginTop: Theme.spacing.md,
    marginBottom: Theme.spacing.xs,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.subtitlecolor,
    textAlign: 'center',
  },
});

export default NotificationsScreen;
