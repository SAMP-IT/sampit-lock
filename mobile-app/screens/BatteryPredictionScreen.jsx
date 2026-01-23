import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Alert, ActivityIndicator, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AppScreen from '../components/ui/AppScreen';
import AppCard from '../components/ui/AppCard';
import Colors from '../constants/Colors';
import Theme from '../constants/Theme';
import { getBatteryPrediction, getBatteryHistory, getLocks } from '../services/api';

const { width } = Dimensions.get('window');

const BatteryPredictionScreen = ({ navigation, route }) => {
  const { lockId: initialLockId, lockName: initialLockName } = route.params || {};
  const [locks, setLocks] = useState([]);
  const [selectedLock, setSelectedLock] = useState(initialLockId || null);
  const [prediction, setPrediction] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadLocks = useCallback(async () => {
    try {
      const response = await getLocks();
      const locksList = response.data?.data?.locks || response.data?.locks || [];
      setLocks(locksList);
      if (!selectedLock && locksList.length > 0) {
        setSelectedLock(locksList[0].id);
      }
    } catch (error) {
      console.error('Failed to load locks:', error);
    }
  }, [selectedLock]);

  const loadBatteryData = useCallback(async () => {
    if (!selectedLock) return;

    try {
      const [predictionRes, historyRes] = await Promise.all([
        getBatteryPrediction(selectedLock),
        getBatteryHistory(selectedLock, 30)
      ]);

      setPrediction(predictionRes.data?.data || predictionRes.data);
      setHistory(historyRes.data?.data?.history || historyRes.data?.history || []);
    } catch (error) {
      console.error('Failed to load battery data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedLock]);

  useEffect(() => {
    loadLocks();
  }, [loadLocks]);

  useEffect(() => {
    if (selectedLock) {
      setLoading(true);
      loadBatteryData();
    }
  }, [selectedLock, loadBatteryData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadBatteryData();
  }, [loadBatteryData]);

  const getBatteryColor = (level) => {
    if (level >= 60) return '#10b981';
    if (level >= 30) return '#f59e0b';
    return '#ef4444';
  };

  const getBatteryIcon = (level) => {
    if (level >= 80) return 'battery-full';
    if (level >= 60) return 'battery-three-quarters';
    if (level >= 30) return 'battery-half';
    if (level >= 10) return 'battery-quarter';
    return 'battery-dead';
  };

  const getHealthIcon = (health) => {
    switch (health?.toLowerCase()) {
      case 'good':
      case 'excellent':
        return { icon: 'checkmark-circle', color: '#10b981' };
      case 'fair':
        return { icon: 'alert-circle', color: '#f59e0b' };
      case 'poor':
        return { icon: 'close-circle', color: '#ef4444' };
      default:
        return { icon: 'help-circle', color: Colors.subtitlecolor };
    }
  };

  const formatDaysRemaining = (days) => {
    if (days < 1) return 'Less than a day';
    if (days === 1) return '1 day';
    if (days < 7) return `${Math.round(days)} days`;
    if (days < 30) return `${Math.round(days / 7)} weeks`;
    return `${Math.round(days / 30)} months`;
  };

  const currentLock = locks.find(l => l.id === selectedLock);

  if (loading && !prediction) {
    return (
      <AppScreen contentContainerStyle={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.iconbackground} />
        <Text style={styles.loadingText}>Loading battery data...</Text>
      </AppScreen>
    );
  }

  const currentLevel = prediction?.currentLevel ?? 0;
  const daysRemaining = prediction?.daysRemaining ?? 0;
  const health = prediction?.health || 'Unknown';
  const healthConfig = getHealthIcon(health);

  return (
    <AppScreen>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="chevron-back" size={24} color={Colors.titlecolor} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Battery Status</Text>
          <View style={styles.headerRight} />
        </View>

        {/* Lock Selector */}
        {locks.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.lockSelector}
          >
            {locks.map((lock) => (
              <TouchableOpacity
                key={lock.id}
                style={[
                  styles.lockChip,
                  selectedLock === lock.id && styles.lockChipActive
                ]}
                onPress={() => setSelectedLock(lock.id)}
              >
                <Ionicons
                  name="lock-closed"
                  size={14}
                  color={selectedLock === lock.id ? Colors.textwhite : Colors.subtitlecolor}
                />
                <Text style={[
                  styles.lockChipText,
                  selectedLock === lock.id && styles.lockChipTextActive
                ]}>
                  {lock.name || 'Lock'}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Battery Level Hero */}
        <View style={[styles.heroBlock, { backgroundColor: getBatteryColor(currentLevel) }]}>
          <View style={styles.batteryContainer}>
            <View style={styles.batteryOuter}>
              <View style={[styles.batteryInner, { width: `${currentLevel}%` }]} />
            </View>
            <View style={styles.batteryTip} />
          </View>
          <Text style={styles.batteryLevel}>{currentLevel}%</Text>
          <Text style={styles.heroSubtitle}>
            {currentLock?.name || initialLockName || 'Lock'} Battery
          </Text>
        </View>

        {/* Prediction Card */}
        <AppCard style={styles.predictionCard}>
          <View style={styles.predictionHeader}>
            <Ionicons name="analytics-outline" size={24} color={Colors.iconbackground} />
            <Text style={styles.predictionTitle}>AI Prediction</Text>
          </View>

          <View style={styles.predictionContent}>
            <View style={styles.predictionItem}>
              <Text style={styles.predictionLabel}>Estimated Battery Life</Text>
              <Text style={styles.predictionValue}>{formatDaysRemaining(daysRemaining)}</Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.predictionItem}>
              <Text style={styles.predictionLabel}>Recommended Replacement</Text>
              <Text style={styles.predictionValue}>
                {prediction?.recommendedDate
                  ? new Date(prediction.recommendedDate).toLocaleDateString()
                  : 'Not needed yet'}
              </Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.predictionItem}>
              <Text style={styles.predictionLabel}>Battery Health</Text>
              <View style={styles.healthBadge}>
                <Ionicons name={healthConfig.icon} size={18} color={healthConfig.color} />
                <Text style={[styles.healthText, { color: healthConfig.color }]}>{health}</Text>
              </View>
            </View>
          </View>

          {prediction?.confidence && (
            <View style={styles.confidenceRow}>
              <Text style={styles.confidenceLabel}>Prediction confidence:</Text>
              <Text style={styles.confidenceValue}>{Math.round(prediction.confidence * 100)}%</Text>
            </View>
          )}
        </AppCard>

        {/* Usage Stats */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Usage Statistics</Text>

          <View style={styles.statsGrid}>
            <AppCard style={styles.statCard}>
              <Ionicons name="repeat-outline" size={24} color="#8b5cf6" />
              <Text style={styles.statValue}>{prediction?.usageStats?.dailyOperations ?? 0}</Text>
              <Text style={styles.statLabel}>Daily Operations</Text>
            </AppCard>

            <AppCard style={styles.statCard}>
              <Ionicons name="trending-down-outline" size={24} color="#ef4444" />
              <Text style={styles.statValue}>{prediction?.usageStats?.drainRate ?? '0'}%</Text>
              <Text style={styles.statLabel}>Daily Drain</Text>
            </AppCard>
          </View>
        </View>

        {/* Battery History */}
        {history.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Battery History</Text>
            <AppCard style={styles.historyCard}>
              <View style={styles.historyChart}>
                {history.slice(-7).map((entry, index) => {
                  const height = (entry.level / 100) * 80;
                  return (
                    <View key={index} style={styles.historyBar}>
                      <View
                        style={[
                          styles.historyBarFill,
                          {
                            height,
                            backgroundColor: getBatteryColor(entry.level)
                          }
                        ]}
                      />
                      <Text style={styles.historyBarLabel}>
                        {new Date(entry.date).toLocaleDateString('en', { weekday: 'short' }).charAt(0)}
                      </Text>
                    </View>
                  );
                })}
              </View>
              <Text style={styles.historyNote}>Last 7 days battery level</Text>
            </AppCard>
          </View>
        )}

        {/* Tips */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Battery Tips</Text>

          <AppCard style={styles.tipCard}>
            <View style={styles.tipRow}>
              <View style={[styles.tipIcon, { backgroundColor: '#10b98120' }]}>
                <Ionicons name="bulb-outline" size={20} color="#10b981" />
              </View>
              <View style={styles.tipContent}>
                <Text style={styles.tipTitle}>Extend Battery Life</Text>
                <Text style={styles.tipText}>
                  Reduce auto-lock frequency to minimize motor operations and save battery.
                </Text>
              </View>
            </View>
          </AppCard>

          <AppCard style={styles.tipCard}>
            <View style={styles.tipRow}>
              <View style={[styles.tipIcon, { backgroundColor: '#f59e0b20' }]}>
                <Ionicons name="alert-outline" size={20} color="#f59e0b" />
              </View>
              <View style={styles.tipContent}>
                <Text style={styles.tipTitle}>Low Battery Alert</Text>
                <Text style={styles.tipText}>
                  You'll receive a notification when battery drops below 20%.
                </Text>
              </View>
            </View>
          </AppCard>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => navigation.navigate('NotificationPreferences')}
          >
            <Ionicons name="notifications-outline" size={20} color={Colors.textwhite} />
            <Text style={styles.primaryButtonText}>Battery Alert Settings</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => Alert.alert('Order Batteries', 'This feature will be available soon.')}
          >
            <Ionicons name="cart-outline" size={20} color={Colors.iconbackground} />
            <Text style={styles.secondaryButtonText}>Order Replacement</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </AppScreen>
  );
};

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: Theme.spacing.lg,
    paddingTop: 60,
    paddingBottom: Theme.spacing.xl,
    gap: Theme.spacing.lg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Theme.spacing.md,
  },
  loadingText: {
    color: Colors.subtitlecolor,
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: Theme.spacing.sm,
    marginLeft: -Theme.spacing.sm,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.titlecolor,
  },
  headerRight: {
    width: 40,
  },
  lockSelector: {
    flexDirection: 'row',
    gap: Theme.spacing.sm,
    paddingVertical: Theme.spacing.xs,
  },
  lockChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
    backgroundColor: Colors.cardbackground,
    borderRadius: Theme.radius.pill,
    borderWidth: 1,
    borderColor: Colors.cardbackground,
  },
  lockChipActive: {
    backgroundColor: Colors.iconbackground,
    borderColor: Colors.iconbackground,
  },
  lockChipText: {
    fontSize: 14,
    color: Colors.subtitlecolor,
  },
  lockChipTextActive: {
    color: Colors.textwhite,
    fontWeight: '500',
  },
  heroBlock: {
    borderRadius: 24,
    padding: Theme.spacing.xl,
    alignItems: 'center',
    gap: Theme.spacing.md,
  },
  batteryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  batteryOuter: {
    width: 120,
    height: 48,
    borderRadius: 8,
    borderWidth: 3,
    borderColor: Colors.textwhite,
    padding: 4,
    overflow: 'hidden',
  },
  batteryInner: {
    height: '100%',
    backgroundColor: Colors.textwhite,
    borderRadius: 4,
  },
  batteryTip: {
    width: 6,
    height: 20,
    backgroundColor: Colors.textwhite,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },
  batteryLevel: {
    fontSize: 36,
    fontWeight: '700',
    color: Colors.textwhite,
  },
  heroSubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
  },
  predictionCard: {
    padding: Theme.spacing.lg,
    gap: Theme.spacing.md,
  },
  predictionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  predictionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.titlecolor,
  },
  predictionContent: {
    gap: Theme.spacing.md,
  },
  predictionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  predictionLabel: {
    fontSize: 14,
    color: Colors.subtitlecolor,
  },
  predictionValue: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.titlecolor,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.cardbackground,
  },
  healthBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  healthText: {
    fontSize: 14,
    fontWeight: '600',
  },
  confidenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingTop: Theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.cardbackground,
  },
  confidenceLabel: {
    fontSize: 12,
    color: Colors.subtitlecolor,
  },
  confidenceValue: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.iconbackground,
  },
  section: {
    gap: Theme.spacing.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.titlecolor,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: Theme.spacing.md,
  },
  statCard: {
    flex: 1,
    padding: Theme.spacing.lg,
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.titlecolor,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.subtitlecolor,
    textAlign: 'center',
  },
  historyCard: {
    padding: Theme.spacing.lg,
    alignItems: 'center',
  },
  historyChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    width: '100%',
    height: 100,
    gap: Theme.spacing.sm,
  },
  historyBar: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  historyBarFill: {
    width: '80%',
    borderRadius: 4,
    minHeight: 4,
  },
  historyBarLabel: {
    marginTop: 4,
    fontSize: 11,
    color: Colors.subtitlecolor,
  },
  historyNote: {
    marginTop: Theme.spacing.md,
    fontSize: 12,
    color: Colors.subtitlecolor,
  },
  tipCard: {
    padding: Theme.spacing.lg,
  },
  tipRow: {
    flexDirection: 'row',
    gap: Theme.spacing.md,
  },
  tipIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipContent: {
    flex: 1,
    gap: 4,
  },
  tipTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.titlecolor,
  },
  tipText: {
    fontSize: 13,
    color: Colors.subtitlecolor,
    lineHeight: 18,
  },
  actions: {
    gap: Theme.spacing.md,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.iconbackground,
    paddingVertical: Theme.spacing.md,
    borderRadius: Theme.radius.pill,
    gap: Theme.spacing.sm,
  },
  primaryButtonText: {
    color: Colors.textwhite,
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: Colors.iconbackground,
    paddingVertical: Theme.spacing.md,
    borderRadius: Theme.radius.pill,
    gap: Theme.spacing.sm,
  },
  secondaryButtonText: {
    color: Colors.iconbackground,
    fontSize: 16,
    fontWeight: '600',
  },
});

export default BatteryPredictionScreen;
