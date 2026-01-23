import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AppScreen from '../components/ui/AppScreen';
import Section from '../components/ui/Section';
import AppCard from '../components/ui/AppCard';
import Colors from '../constants/Colors';
import Theme from '../constants/Theme';
import { getGuestAccessHistory, revokeGuestAccess } from '../services/api';

const GuestAccessHistoryScreen = ({ navigation, route }) => {
  const { lockId, lockName } = route.params || {};

  const [loading, setLoading] = useState(true);
  const [guestHistory, setGuestHistory] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (lockId) {
      loadGuestHistory();
    }
  }, [lockId]);

  const loadGuestHistory = async () => {
    setLoading(true);
    try {
      const response = await getGuestAccessHistory(lockId);
      setGuestHistory(response.data || []);
    } catch (error) {
      console.error('Failed to load guest access history:', error);
      Alert.alert('Error', 'Failed to load guest access history');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadGuestHistory();
  };

  const handleRevokeAccess = (accessItem) => {
    Alert.alert(
      'Revoke Guest Access',
      `Revoke access for ${accessItem.guestName || 'this guest'}?\n\nThey will no longer be able to access this lock.`,
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Revoke',
          style: 'destructive',
          onPress: () => performRevoke(accessItem.id)
        }
      ]
    );
  };

  const performRevoke = async (accessId) => {
    try {
      await revokeGuestAccess(accessId);
      Alert.alert('Success', 'Guest access revoked successfully');
      loadGuestHistory();
    } catch (error) {
      console.error('Failed to revoke access:', error);
      Alert.alert('Error', error.response?.data?.error?.message || 'Failed to revoke guest access');
    }
  };

  const getAccessStatusColor = (status) => {
    switch (status) {
      case 'active':
        return Colors.success;
      case 'expired':
        return Colors.subtitlecolor;
      case 'revoked':
        return Colors.red;
      default:
        return Colors.subtitlecolor;
    }
  };

  const getAccessStatusIcon = (status) => {
    switch (status) {
      case 'active':
        return 'checkmark-circle';
      case 'expired':
        return 'time-outline';
      case 'revoked':
        return 'close-circle';
      default:
        return 'help-circle-outline';
    }
  };

  const renderGuestAccessItem = ({ item }) => {
    const isActive = item.status === 'active';
    const statusColor = getAccessStatusColor(item.status);
    const statusIcon = getAccessStatusIcon(item.status);

    return (
      <View style={styles.accessItem}>
        <View style={styles.accessHeader}>
          <View style={[styles.statusIcon, { backgroundColor: `${statusColor}20` }]}>
            <Ionicons name={statusIcon} size={24} color={statusColor} />
          </View>
          <View style={styles.accessInfo}>
            <Text style={styles.guestName}>{item.guestName || item.guestEmail || 'Unknown Guest'}</Text>
            {item.guestEmail && <Text style={styles.guestEmail}>{item.guestEmail}</Text>}
          </View>
          <View style={[styles.statusBadge, { backgroundColor: `${statusColor}20` }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>
              {item.status?.toUpperCase()}
            </Text>
          </View>
        </View>

        <View style={styles.accessDetails}>
          <View style={styles.detailRow}>
            <Ionicons name="calendar-outline" size={16} color={Colors.subtitlecolor} />
            <Text style={styles.detailText}>
              Granted: {new Date(item.createdAt).toLocaleDateString()}
            </Text>
          </View>

          {item.expiresAt && (
            <View style={styles.detailRow}>
              <Ionicons name="time-outline" size={16} color={Colors.subtitlecolor} />
              <Text style={styles.detailText}>
                {item.status === 'expired' ? 'Expired' : 'Expires'}: {new Date(item.expiresAt).toLocaleDateString()}
              </Text>
            </View>
          )}

          {item.accessMethod && (
            <View style={styles.detailRow}>
              <Ionicons name="key-outline" size={16} color={Colors.subtitlecolor} />
              <Text style={styles.detailText}>
                Method: {item.accessMethod}
              </Text>
            </View>
          )}

          {item.accessCount !== undefined && (
            <View style={styles.detailRow}>
              <Ionicons name="log-in-outline" size={16} color={Colors.subtitlecolor} />
              <Text style={styles.detailText}>
                Used: {item.accessCount} {item.accessCount === 1 ? 'time' : 'times'}
              </Text>
            </View>
          )}

          {item.lastAccessedAt && (
            <View style={styles.detailRow}>
              <Ionicons name="time-outline" size={16} color={Colors.subtitlecolor} />
              <Text style={styles.detailText}>
                Last accessed: {new Date(item.lastAccessedAt).toLocaleString()}
              </Text>
            </View>
          )}
        </View>

        {isActive && (
          <TouchableOpacity
            style={styles.revokeButton}
            onPress={() => handleRevokeAccess(item)}
          >
            <Ionicons name="close-circle-outline" size={18} color={Colors.red} />
            <Text style={styles.revokeButtonText}>Revoke Access</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  if (loading && !refreshing) {
    return (
      <AppScreen contentContainerStyle={[styles.content, styles.centerContent]}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading guest access history...</Text>
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
          <Text style={styles.headerTitle}>Guest Access History</Text>
          {lockName && <Text style={styles.headerSubtitle}>{lockName}</Text>}
        </View>

        <TouchableOpacity style={styles.refreshButton} onPress={handleRefresh}>
          <Ionicons name="refresh" size={22} color={Colors.iconbackground} />
        </TouchableOpacity>
      </View>

      {guestHistory.length === 0 ? (
        <Section>
          <AppCard style={styles.emptyCard}>
            <Ionicons name="people-outline" size={64} color={Colors.subtitlecolor} />
            <Text style={styles.emptyTitle}>No Guest Access History</Text>
            <Text style={styles.emptySubtitle}>
              Guest access records will appear here when you grant access to guests.
            </Text>
          </AppCard>
        </Section>
      ) : (
        <Section>
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{guestHistory.length}</Text>
              <Text style={styles.statLabel}>Total Guests</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statValue, { color: Colors.success }]}>
                {guestHistory.filter(g => g.status === 'active').length}
              </Text>
              <Text style={styles.statLabel}>Active</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statValue, { color: Colors.subtitlecolor }]}>
                {guestHistory.filter(g => g.status === 'expired').length}
              </Text>
              <Text style={styles.statLabel}>Expired</Text>
            </View>
          </View>

          <FlatList
            data={guestHistory}
            renderItem={renderGuestAccessItem}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.listContent}
            refreshing={refreshing}
            onRefresh={handleRefresh}
            ListHeaderComponent={() => (
              <Text style={styles.listHeader}>
                {guestHistory.filter(g => g.status === 'active').length > 0
                  ? 'Active and Past Guest Access'
                  : 'Past Guest Access'}
              </Text>
            )}
          />
        </Section>
      )}
    </AppScreen>
  );
};

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: Theme.spacing.lg,
    paddingTop: Theme.spacing.xl,
    paddingBottom: Theme.spacing.xl,
    gap: Theme.spacing.lg,
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
    gap: Theme.spacing.md,
    marginBottom: Theme.spacing.md,
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
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.titlecolor,
  },
  headerSubtitle: {
    fontSize: 14,
    color: Colors.subtitlecolor,
    marginTop: 2,
  },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.bordercolor,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    gap: Theme.spacing.md,
    marginBottom: Theme.spacing.lg,
  },
  statBox: {
    flex: 1,
    backgroundColor: Colors.cardbackground,
    borderRadius: Theme.radius.md,
    padding: Theme.spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.bordercolor,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.titlecolor,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.subtitlecolor,
    textAlign: 'center',
  },
  listHeader: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.titlecolor,
    marginBottom: Theme.spacing.md,
  },
  listContent: {
    gap: Theme.spacing.md,
  },
  accessItem: {
    backgroundColor: Colors.cardbackground,
    borderRadius: Theme.radius.md,
    padding: Theme.spacing.md,
    borderWidth: 1,
    borderColor: Colors.bordercolor,
  },
  accessHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
    marginBottom: Theme.spacing.sm,
  },
  statusIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accessInfo: {
    flex: 1,
  },
  guestName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.titlecolor,
    marginBottom: 2,
  },
  guestEmail: {
    fontSize: 13,
    color: Colors.subtitlecolor,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  accessDetails: {
    gap: 8,
    marginTop: Theme.spacing.sm,
    paddingTop: Theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.bordercolor,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 14,
    color: Colors.subtitlecolor,
    flex: 1,
  },
  revokeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: Theme.spacing.sm,
    paddingVertical: Theme.spacing.sm,
    backgroundColor: `${Colors.red}10`,
    borderRadius: Theme.radius.sm,
  },
  revokeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.red,
  },
  emptyCard: {
    alignItems: 'center',
    gap: Theme.spacing.md,
    paddingVertical: Theme.spacing.xl * 2,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.titlecolor,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.subtitlecolor,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: Theme.spacing.lg,
  },
});

export default GuestAccessHistoryScreen;
