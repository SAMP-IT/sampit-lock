import React, { useMemo, useState, useEffect } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AppScreen from '../../components/ui/AppScreen';
import Section from '../../components/ui/Section';
import AppCard from '../../components/ui/AppCard';
import ActivityItem from '../../components/ActivityItem';
import Colors from '../../constants/Colors';
import Theme from '../../constants/Theme';
import { getAllActivity, getLocks } from '../../services/api';
import { unwrapResponseArray } from '../../utils/apiResponse';
import { getLockDisplayName } from '../../utils/lockDisplayUtils';

const detailMessages = {
  'Door Unlocked': 'Unlocked by authenticated fingerprint at Main Door.',
  'Door Locked': 'Auto-lock engaged after door closed.',
  'Door Failed': 'Failed attempt with incorrect pin code.',
};

const ActivityListScreen = () => {
  const [activities, setActivities] = useState([]);
  const [locks, setLocks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Fetch both activities and locks in parallel
        const [activityResponse, locksResponse] = await Promise.all([
          getAllActivity(),
          getLocks()
        ]);

        // Handle activity response
        const activitiesData = activityResponse?.data?.data || activityResponse?.data || [];
        setActivities(Array.isArray(activitiesData) ? activitiesData : []);

        // Handle locks response
        const normalizedLocks = unwrapResponseArray(locksResponse);
        setLocks(normalizedLocks);
      } catch (err) {
        console.error('[ActivityListScreen] Error loading activities:', err);
        setError("Failed to load activity log.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  // Create lock name map for resolving user-friendly names using shared utility
  const lockNameMap = useMemo(() => {
    const map = {};
    locks.forEach(lock => {
      if (lock.id) {
        map[lock.id] = getLockDisplayName(lock, 'My Lock');
      }
    });
    return map;
  }, [locks]);

  // Enhance activities with resolved lock names
  const enhancedActivities = useMemo(() => {
    return activities.map(activity => ({
      id: activity.id,
      action: activity.action || 'Unknown Action',
      user: activity.user_name || 'Unknown User',
      time: activity.timestamp ? new Date(activity.timestamp).toLocaleString() : 'Unknown',
      lock: activity.lock_name || 'Unknown Lock',
      resolved_lock_name: activity.lock_id ? lockNameMap[activity.lock_id] : null
    }));
  }, [activities, lockNameMap]);

  const handleClose = () => setSelected(null);

  const detailMessage = useMemo(() => {
    if (!selected) return '';
    return detailMessages[selected.action] || 'Standard access event recorded.';
  }, [selected]);

  return (
    <AppScreen contentContainerStyle={styles.content}>
      <Section title="All activity" subtitle="Every interaction across your locks" gapless>
        <AppCard padding="none" elevated={false}>
          {isLoading && <Text style={styles.loadingText}>Loading activity...</Text>}
          {error && <Text style={styles.errorText}>{error}</Text>}
          {!isLoading && !error && enhancedActivities.map((activity) => (
            <TouchableOpacity key={activity.id} onPress={() => setSelected(activity)}>
              <ActivityItem activity={activity} />
            </TouchableOpacity>
          ))}
        </AppCard>
      </Section>

      <Modal visible={!!selected} transparent animationType="fade" onRequestClose={handleClose}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{selected?.action}</Text>
              <TouchableOpacity onPress={handleClose}>
                <Ionicons name="close" size={20} color={Colors.subtitlecolor} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSubtitle}>Triggered by {selected?.user} at {selected?.time}</Text>
            <Text style={styles.modalCopy}>{detailMessage}</Text>
            <TouchableOpacity style={styles.modalButton} onPress={handleClose}>
              <Text style={styles.modalButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </AppScreen>
  );
};

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: Theme.spacing.lg,
    paddingTop: Theme.spacing.lg,
    paddingBottom: Theme.spacing.xl,
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Theme.spacing.lg,
  },
  modalCard: {
    width: '100%',
    backgroundColor: Colors.backgroundwhite,
    borderRadius: Theme.radius.lg,
    padding: Theme.spacing.lg,
    gap: Theme.spacing.md,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.titlecolor,
  },
  modalSubtitle: {
    ...Theme.typography.subtitle,
  },
  modalCopy: {
    ...Theme.typography.body,
    lineHeight: 20,
  },
  modalButton: {
    alignSelf: 'flex-end',
    backgroundColor: Colors.iconbackground,
    borderRadius: Theme.radius.pill,
    paddingVertical: Theme.spacing.sm,
    paddingHorizontal: Theme.spacing.lg,
  },
  modalButtonText: {
    color: Colors.textwhite,
    fontWeight: '600',
  },
});

export default ActivityListScreen;
