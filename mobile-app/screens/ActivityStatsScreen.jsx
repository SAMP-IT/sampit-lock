import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../constants/Colors';
import Theme from '../constants/Theme';
import { getActivityStats } from '../services/api';

const { width } = Dimensions.get('window');

const ActivityStatsScreen = ({ navigation }) => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [timeframe, setTimeframe] = useState('week');

  useEffect(() => {
    loadStats();
  }, [timeframe]);

  const loadStats = async () => {
    setLoading(true);
    try {
      const response = await getActivityStats(timeframe);
      setStats(response.data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderStatCard = (icon, label, value, color = Colors.primary, trend) => (
    <View style={[styles.statCard, { borderLeftColor: color, borderLeftWidth: 4 }]}>
      <View style={[styles.statIcon, { backgroundColor: `${color}20` }]}>
        <Ionicons name={icon} size={24} color={color} />
      </View>
      <View style={styles.statContent}>
        <Text style={styles.statLabel}>{label}</Text>
        <Text style={styles.statValue}>{value}</Text>
        {trend && (
          <View style={styles.trendContainer}>
            <Ionicons
              name={trend > 0 ? 'trending-up' : trend < 0 ? 'trending-down' : 'remove'}
              size={14}
              color={trend > 0 ? '#4CAF50' : trend < 0 ? '#FF4444' : Colors.subtitlecolor}
            />
            <Text
              style={[
                styles.trendText,
                {
                  color: trend > 0 ? '#4CAF50' : trend < 0 ? '#FF4444' : Colors.subtitlecolor,
                },
              ]}
            >
              {Math.abs(trend)}% vs last {timeframe}
            </Text>
          </View>
        )}
      </View>
    </View>
  );

  const renderBarChart = (data) => {
    if (!data || data.length === 0) return null;

    const maxValue = Math.max(...data.map((d) => d.value));

    return (
      <View style={styles.chartContainer}>
        <View style={styles.barsContainer}>
          {data.map((item, index) => {
            const barHeight = maxValue > 0 ? (item.value / maxValue) * 150 : 0;
            return (
              <View key={index} style={styles.barColumn}>
                <View style={styles.barWrapper}>
                  <View
                    style={[
                      styles.bar,
                      {
                        height: barHeight,
                        backgroundColor: Colors.primary,
                      },
                    ]}
                  >
                    {item.value > 0 && (
                      <Text style={styles.barValue}>{item.value}</Text>
                    )}
                  </View>
                </View>
                <Text style={styles.barLabel}>{item.label}</Text>
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  const renderPieChartLegend = (data) => {
    if (!data || data.length === 0) return null;

    const total = data.reduce((sum, item) => sum + item.value, 0);

    return (
      <View style={styles.pieChartLegend}>
        {data.map((item, index) => {
          const percentage = total > 0 ? ((item.value / total) * 100).toFixed(1) : 0;
          return (
            <View key={index} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: item.color }]} />
              <Text style={styles.legendLabel}>{item.label}</Text>
              <Text style={styles.legendValue}>
                {item.value} ({percentage}%)
              </Text>
            </View>
          );
        })}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading statistics...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.headerTextContainer}>
          <Text style={styles.headerTitle}>Activity Statistics</Text>
          <Text style={styles.headerSubtitle}>Analytics and insights</Text>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Timeframe Selector */}
        <View style={styles.timeframeSelector}>
          {['day', 'week', 'month', 'year'].map((tf) => (
            <TouchableOpacity
              key={tf}
              style={[styles.timeframeButton, timeframe === tf && styles.timeframeButtonActive]}
              onPress={() => setTimeframe(tf)}
            >
              <Text
                style={[
                  styles.timeframeText,
                  timeframe === tf && styles.timeframeTextActive,
                ]}
              >
                {tf.charAt(0).toUpperCase() + tf.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Overview Stats */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Overview</Text>
          <View style={styles.statsGrid}>
            {renderStatCard(
              'log-in-outline',
              'Total Access Events',
              stats?.totalEvents || 0,
              Colors.primary,
              stats?.eventsTrend
            )}
            {renderStatCard(
              'checkmark-circle-outline',
              'Successful Unlocks',
              stats?.successfulUnlocks || 0,
              '#4CAF50',
              stats?.unlocksTrend
            )}
            {renderStatCard(
              'close-circle-outline',
              'Failed Attempts',
              stats?.failedAttempts || 0,
              '#FF4444',
              stats?.failedTrend
            )}
            {renderStatCard(
              'people-outline',
              'Unique Users',
              stats?.uniqueUsers || 0,
              '#9C27B0'
            )}
          </View>
        </View>

        {/* Activity by Day */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Activity Timeline</Text>
          <View style={styles.chartCard}>
            {renderBarChart(
              stats?.activityByDay || [
                { label: 'Mon', value: 0 },
                { label: 'Tue', value: 0 },
                { label: 'Wed', value: 0 },
                { label: 'Thu', value: 0 },
                { label: 'Fri', value: 0 },
                { label: 'Sat', value: 0 },
                { label: 'Sun', value: 0 },
              ]
            )}
          </View>
        </View>

        {/* Access Method Distribution */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Access Methods</Text>
          <View style={styles.chartCard}>
            {renderPieChartLegend(
              stats?.accessMethods || [
                { label: 'PIN Code', value: 0, color: Colors.primary },
                { label: 'Fingerprint', value: 0, color: '#9C27B0' },
                { label: 'Bluetooth', value: 0, color: '#2196F3' },
                { label: 'Card', value: 0, color: '#FF9800' },
              ]
            )}
          </View>
        </View>

        {/* Peak Hours */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Peak Activity Hours</Text>
          <View style={styles.chartCard}>
            {renderBarChart(
              stats?.peakHours || [
                { label: '6AM', value: 0 },
                { label: '9AM', value: 0 },
                { label: '12PM', value: 0 },
                { label: '3PM', value: 0 },
                { label: '6PM', value: 0 },
                { label: '9PM', value: 0 },
              ]
            )}
          </View>
        </View>

        {/* Top Users */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Most Active Users</Text>
          <View style={styles.listCard}>
            {(stats?.topUsers || []).length === 0 ? (
              <Text style={styles.emptyText}>No activity data available</Text>
            ) : (
              stats.topUsers.map((user, index) => (
                <View key={user.id || index} style={styles.userRow}>
                  <View style={styles.userRank}>
                    <Text style={styles.rankText}>#{index + 1}</Text>
                  </View>
                  <View style={styles.userInfo}>
                    <Text style={styles.userName}>{user.name}</Text>
                    <Text style={styles.userStats}>{user.accessCount} accesses</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={Colors.subtitlecolor} />
                </View>
              ))
            )}
          </View>
        </View>

        {/* Most Used Locks */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Most Used Locks</Text>
          <View style={styles.listCard}>
            {(stats?.topLocks || []).length === 0 ? (
              <Text style={styles.emptyText}>No activity data available</Text>
            ) : (
              stats.topLocks.map((lock, index) => (
                <View key={lock.id || index} style={styles.lockRow}>
                  <View style={styles.lockIcon}>
                    <Ionicons name="lock-closed" size={20} color={Colors.primary} />
                  </View>
                  <View style={styles.lockInfo}>
                    <Text style={styles.lockName}>{lock.name}</Text>
                    <Text style={styles.lockStats}>{lock.accessCount} accesses</Text>
                  </View>
                  <View style={styles.lockProgress}>
                    <View
                      style={[
                        styles.progressBar,
                        {
                          width: `${
                            (lock.accessCount / (stats.topLocks[0]?.accessCount || 1)) * 100
                          }%`,
                        },
                      ]}
                    />
                  </View>
                </View>
              ))
            )}
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  loadingText: {
    marginTop: Theme.spacing.md,
    fontSize: 16,
    color: Colors.subtitlecolor,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.bordercolor,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  headerTextContainer: {
    flex: 1,
    marginLeft: 12,
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
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  timeframeSelector: {
    flexDirection: 'row',
    marginTop: 20,
    marginBottom: 10,
    backgroundColor: Colors.cardbackground,
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  timeframeButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  timeframeButtonActive: {
    backgroundColor: Colors.primary,
  },
  timeframeText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.subtitlecolor,
  },
  timeframeTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.titlecolor,
    marginBottom: 12,
  },
  statsGrid: {
    gap: 12,
  },
  statCard: {
    flexDirection: 'row',
    backgroundColor: Colors.cardbackground,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    gap: 12,
  },
  statIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statContent: {
    flex: 1,
  },
  statLabel: {
    fontSize: 13,
    color: Colors.subtitlecolor,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.titlecolor,
  },
  trendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  trendText: {
    fontSize: 12,
    fontWeight: '500',
  },
  chartCard: {
    backgroundColor: Colors.cardbackground,
    borderRadius: 12,
    padding: 16,
  },
  chartContainer: {
    height: 200,
  },
  barsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    height: 180,
    paddingBottom: 20,
  },
  barColumn: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  barWrapper: {
    flex: 1,
    width: '100%',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  bar: {
    width: '70%',
    borderRadius: 6,
    minHeight: 4,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 4,
  },
  barValue: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
  },
  barLabel: {
    fontSize: 11,
    color: Colors.subtitlecolor,
    fontWeight: '500',
  },
  pieChartLegend: {
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendLabel: {
    flex: 1,
    fontSize: 14,
    color: Colors.titlecolor,
    fontWeight: '500',
  },
  legendValue: {
    fontSize: 14,
    color: Colors.subtitlecolor,
    fontWeight: '600',
  },
  listCard: {
    backgroundColor: Colors.cardbackground,
    borderRadius: 12,
    overflow: 'hidden',
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.bordercolor,
  },
  userRank: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: `${Colors.primary}20`,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rankText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primary,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.titlecolor,
    marginBottom: 2,
  },
  userStats: {
    fontSize: 13,
    color: Colors.subtitlecolor,
  },
  lockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.bordercolor,
    gap: 12,
  },
  lockIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: `${Colors.primary}20`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockInfo: {
    flex: 1,
  },
  lockName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.titlecolor,
    marginBottom: 2,
  },
  lockStats: {
    fontSize: 13,
    color: Colors.subtitlecolor,
  },
  lockProgress: {
    width: 80,
    height: 6,
    backgroundColor: Colors.bordercolor,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 3,
  },
  emptyText: {
    padding: 24,
    textAlign: 'center',
    fontSize: 14,
    color: Colors.subtitlecolor,
  },
});

export default ActivityStatsScreen;
