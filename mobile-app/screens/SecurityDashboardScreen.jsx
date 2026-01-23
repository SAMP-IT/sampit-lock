import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../constants/Colors';
import Theme from '../constants/Theme';
import { getSecurityDashboard, acknowledgeSecurityAlert, getFailedAttempts } from '../services/api';

const SecurityDashboardScreen = ({ navigation }) => {
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState(null);
  const [failedAttempts, setFailedAttempts] = useState([]);
  const [loadingAttempts, setLoadingAttempts] = useState(false);
  const [selectedLockFilter, setSelectedLockFilter] = useState(null);

  useEffect(() => {
    loadDashboard();
    loadFailedAttempts();
  }, []);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const response = await getSecurityDashboard();
      setDashboardData(response.data);
    } catch (error) {
      console.error('Failed to load security dashboard:', error);
      Alert.alert('Error', 'Failed to load security dashboard');
    } finally {
      setLoading(false);
    }
  };

  const loadFailedAttempts = async (lockId = null) => {
    setLoadingAttempts(true);
    try {
      // If lockId is provided, fetch for specific lock, otherwise fetch all
      const params = lockId ? {} : {};
      const response = lockId
        ? await getFailedAttempts(lockId, params)
        : await getFailedAttempts(null, { limit: 20 });

      setFailedAttempts(response.data || []);
      setSelectedLockFilter(lockId);
    } catch (error) {
      console.error('Failed to load failed attempts:', error);
      // Don't show alert for this, just log it
    } finally {
      setLoadingAttempts(false);
    }
  };

  const handleAcknowledgeAlert = async (alertId) => {
    try {
      await acknowledgeSecurityAlert(alertId);
      loadDashboard();
    } catch (error) {
      Alert.alert('Error', 'Failed to acknowledge alert');
    }
  };

  const getSecurityScoreColor = (score) => {
    if (score >= 80) return '#4CAF50';
    if (score >= 60) return '#FF9800';
    return '#FF4444';
  };

  const getAlertSeverityColor = (severity) => {
    switch (severity) {
      case 'critical':
        return '#FF4444';
      case 'high':
        return '#FF9800';
      case 'medium':
        return '#FFC107';
      case 'low':
        return '#2196F3';
      default:
        return Colors.subtitlecolor;
    }
  };

  const getAlertIcon = (type) => {
    switch (type) {
      case 'failed_attempt':
        return 'warning-outline';
      case 'unauthorized_access':
        return 'ban-outline';
      case 'tamper':
        return 'shield-outline';
      case 'battery_low':
        return 'battery-dead-outline';
      case 'offline':
        return 'cloud-offline-outline';
      default:
        return 'alert-circle-outline';
    }
  };

  const renderSecurityScore = () => {
    const score = dashboardData?.securityScore || 0;
    const scoreColor = getSecurityScoreColor(score);

    return (
      <View style={styles.scoreCard}>
        <View style={styles.scoreHeader}>
          <Text style={styles.scoreTitle}>Security Score</Text>
          <Ionicons name="shield-checkmark" size={24} color={scoreColor} />
        </View>
        <View style={styles.scoreContent}>
          <View style={styles.scoreCircle}>
            <Text style={[styles.scoreValue, { color: scoreColor }]}>{score}</Text>
            <Text style={styles.scoreOutOf}>/100</Text>
          </View>
          <View style={styles.scoreInfo}>
            <Text style={styles.scoreStatus}>
              {score >= 80 ? 'Excellent' : score >= 60 ? 'Good' : 'Needs Attention'}
            </Text>
            <Text style={styles.scoreDescription}>
              {score >= 80
                ? 'Your security is strong'
                : score >= 60
                ? 'Some improvements needed'
                : 'Security vulnerabilities detected'}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const renderAlertCard = (alert) => (
    <View
      key={alert.id}
      style={[
        styles.alertCard,
        { borderLeftColor: getAlertSeverityColor(alert.severity), borderLeftWidth: 4 },
      ]}
    >
      <View style={styles.alertHeader}>
        <View style={styles.alertTitleRow}>
          <View
            style={[
              styles.alertIcon,
              { backgroundColor: `${getAlertSeverityColor(alert.severity)}20` },
            ]}
          >
            <Ionicons
              name={getAlertIcon(alert.type)}
              size={20}
              color={getAlertSeverityColor(alert.severity)}
            />
          </View>
          <View style={styles.alertTitleContainer}>
            <Text style={styles.alertTitle}>{alert.title}</Text>
            <Text style={styles.alertTime}>
              {new Date(alert.timestamp).toLocaleString()}
            </Text>
          </View>
          <View
            style={[
              styles.severityBadge,
              { backgroundColor: `${getAlertSeverityColor(alert.severity)}20` },
            ]}
          >
            <Text
              style={[
                styles.severityText,
                { color: getAlertSeverityColor(alert.severity) },
              ]}
            >
              {alert.severity.toUpperCase()}
            </Text>
          </View>
        </View>
      </View>
      <Text style={styles.alertDescription}>{alert.description}</Text>
      {alert.location && (
        <View style={styles.alertMeta}>
          <Ionicons name="location-outline" size={14} color={Colors.subtitlecolor} />
          <Text style={styles.alertMetaText}>{alert.location}</Text>
        </View>
      )}
      {!alert.acknowledged && (
        <TouchableOpacity
          style={styles.acknowledgeButton}
          onPress={() => handleAcknowledgeAlert(alert.id)}
        >
          <Ionicons name="checkmark-circle-outline" size={18} color={Colors.primary} />
          <Text style={styles.acknowledgeText}>Acknowledge</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderRecommendationCard = (recommendation) => (
    <View key={recommendation.id} style={styles.recommendationCard}>
      <View style={styles.recommendationHeader}>
        <Ionicons name="bulb-outline" size={20} color="#FF9800" />
        <Text style={styles.recommendationTitle}>{recommendation.title}</Text>
      </View>
      <Text style={styles.recommendationDescription}>{recommendation.description}</Text>
      {recommendation.action && (
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => {
            if (recommendation.actionType === 'navigate') {
              navigation.navigate(recommendation.actionTarget);
            }
          }}
        >
          <Text style={styles.actionButtonText}>{recommendation.action}</Text>
          <Ionicons name="arrow-forward" size={16} color={Colors.primary} />
        </TouchableOpacity>
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading security dashboard...</Text>
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
          <Text style={styles.headerTitle}>Security Dashboard</Text>
          <Text style={styles.headerSubtitle}>Monitor and improve security</Text>
        </View>
        <TouchableOpacity style={styles.refreshButton} onPress={loadDashboard}>
          <Ionicons name="refresh" size={22} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Security Score */}
        {renderSecurityScore()}

        {/* Quick Stats */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Security Overview</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <View style={[styles.statIcon, { backgroundColor: '#FFEBEE' }]}>
                <Ionicons name="warning-outline" size={24} color="#FF4444" />
              </View>
              <Text style={styles.statValue}>
                {dashboardData?.failedAttempts24h || 0}
              </Text>
              <Text style={styles.statLabel}>Failed Attempts (24h)</Text>
            </View>
            <View style={styles.statBox}>
              <View style={[styles.statIcon, { backgroundColor: '#E3F2FD' }]}>
                <Ionicons name="shield-checkmark-outline" size={24} color="#2196F3" />
              </View>
              <Text style={styles.statValue}>
                {dashboardData?.activeAlerts || 0}
              </Text>
              <Text style={styles.statLabel}>Active Alerts</Text>
            </View>
            <View style={styles.statBox}>
              <View style={[styles.statIcon, { backgroundColor: '#F3E5F5' }]}>
                <Ionicons name="lock-closed-outline" size={24} color="#9C27B0" />
              </View>
              <Text style={styles.statValue}>
                {dashboardData?.secureLocksCount || 0}
              </Text>
              <Text style={styles.statLabel}>Secure Locks</Text>
            </View>
          </View>
        </View>

        {/* Recent Alerts */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Alerts</Text>
            {dashboardData?.alerts && dashboardData.alerts.length > 0 && (
              <Text style={styles.alertCount}>
                {dashboardData.alerts.filter((a) => !a.acknowledged).length} unacknowledged
              </Text>
            )}
          </View>
          {!dashboardData?.alerts || dashboardData.alerts.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="shield-checkmark-outline" size={48} color="#4CAF50" />
              <Text style={styles.emptyTitle}>All Clear!</Text>
              <Text style={styles.emptySubtitle}>No security alerts at this time</Text>
            </View>
          ) : (
            <View style={styles.alertsList}>
              {dashboardData.alerts.slice(0, 5).map((alert) => renderAlertCard(alert))}
            </View>
          )}
        </View>

        {/* Security Recommendations */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Security Recommendations</Text>
          {!dashboardData?.recommendations || dashboardData.recommendations.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="checkmark-circle-outline" size={48} color="#4CAF50" />
              <Text style={styles.emptyTitle}>Great Job!</Text>
              <Text style={styles.emptySubtitle}>
                No security recommendations at this time
              </Text>
            </View>
          ) : (
            <View style={styles.recommendationsList}>
              {dashboardData.recommendations.map((rec) => renderRecommendationCard(rec))}
            </View>
          )}
        </View>

        {/* Enhanced Failed Attempts Timeline */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Failed Access Attempts</Text>
            {failedAttempts.length > 0 && (
              <TouchableOpacity onPress={() => loadFailedAttempts()}>
                <Text style={styles.viewAllText}>View All</Text>
              </TouchableOpacity>
            )}
          </View>

          {loadingAttempts ? (
            <View style={styles.loadingAttemptsContainer}>
              <ActivityIndicator size="small" color={Colors.primary} />
              <Text style={styles.loadingAttemptsText}>Loading attempts...</Text>
            </View>
          ) : failedAttempts.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="shield-checkmark-outline" size={48} color="#4CAF50" />
              <Text style={styles.emptyTitle}>All Good!</Text>
              <Text style={styles.emptySubtitle}>No failed access attempts detected</Text>
            </View>
          ) : (
            <>
              <View style={styles.attemptsStats}>
                <View style={styles.attemptsStatItem}>
                  <Text style={styles.attemptsStatValue}>{failedAttempts.length}</Text>
                  <Text style={styles.attemptsStatLabel}>Total Attempts</Text>
                </View>
                <View style={styles.attemptsStatItem}>
                  <Text style={styles.attemptsStatValue}>
                    {failedAttempts.filter(a => {
                      const now = new Date();
                      const attemptTime = new Date(a.timestamp);
                      return (now - attemptTime) < 24 * 60 * 60 * 1000;
                    }).length}
                  </Text>
                  <Text style={styles.attemptsStatLabel}>Last 24 Hours</Text>
                </View>
                <View style={styles.attemptsStatItem}>
                  <Text style={styles.attemptsStatValue}>
                    {new Set(failedAttempts.map(a => a.lockId)).size}
                  </Text>
                  <Text style={styles.attemptsStatLabel}>Affected Locks</Text>
                </View>
              </View>

              <View style={styles.attemptsList}>
                {failedAttempts.slice(0, 10).map((attempt, index) => (
                  <View key={attempt.id || index} style={styles.attemptCard}>
                    <View style={styles.attemptHeader}>
                      <View style={styles.attemptIconContainer}>
                        <Ionicons name="close-circle" size={20} color="#FF4444" />
                      </View>
                      <View style={styles.attemptInfo}>
                        <Text style={styles.attemptLock}>
                          {attempt.lockName || 'Unknown Lock'}
                        </Text>
                        <Text style={styles.attemptTime}>
                          {new Date(attempt.timestamp).toLocaleString()}
                        </Text>
                      </View>
                      <View style={styles.attemptBadge}>
                        <Text style={styles.attemptBadgeText}>
                          {attempt.attemptType || 'FAILED'}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.attemptDetails}>
                      <View style={styles.attemptDetailRow}>
                        <Ionicons name="keypad-outline" size={14} color={Colors.subtitlecolor} />
                        <Text style={styles.attemptDetailText}>
                          Method: {attempt.method || attempt.accessMethod || 'Unknown'}
                        </Text>
                      </View>
                      {attempt.user && (
                        <View style={styles.attemptDetailRow}>
                          <Ionicons name="person-outline" size={14} color={Colors.subtitlecolor} />
                          <Text style={styles.attemptDetailText}>User: {attempt.user}</Text>
                        </View>
                      )}
                      {attempt.ipAddress && (
                        <View style={styles.attemptDetailRow}>
                          <Ionicons name="globe-outline" size={14} color={Colors.subtitlecolor} />
                          <Text style={styles.attemptDetailText}>IP: {attempt.ipAddress}</Text>
                        </View>
                      )}
                      {attempt.reason && (
                        <View style={styles.attemptDetailRow}>
                          <Ionicons name="information-circle-outline" size={14} color={Colors.subtitlecolor} />
                          <Text style={styles.attemptDetailText}>Reason: {attempt.reason}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                ))}
              </View>

              {failedAttempts.length > 10 && (
                <TouchableOpacity
                  style={styles.loadMoreButton}
                  onPress={() => Alert.alert('Feature Coming Soon', 'View all failed attempts in detail')}
                >
                  <Text style={styles.loadMoreText}>
                    View {failedAttempts.length - 10} More Attempts
                  </Text>
                  <Ionicons name="chevron-down" size={16} color={Colors.primary} />
                </TouchableOpacity>
              )}
            </>
          )}
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
  refreshButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  scoreCard: {
    backgroundColor: Colors.cardbackground,
    borderRadius: 16,
    padding: 20,
    marginTop: 20,
    borderWidth: 1,
    borderColor: Colors.bordercolor,
  },
  scoreHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  scoreTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.titlecolor,
  },
  scoreContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  scoreCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 6,
    borderColor: Colors.bordercolor,
  },
  scoreValue: {
    fontSize: 36,
    fontWeight: '700',
  },
  scoreOutOf: {
    fontSize: 14,
    color: Colors.subtitlecolor,
    marginTop: -4,
  },
  scoreInfo: {
    flex: 1,
  },
  scoreStatus: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.titlecolor,
    marginBottom: 4,
  },
  scoreDescription: {
    fontSize: 14,
    color: Colors.subtitlecolor,
    lineHeight: 20,
  },
  section: {
    marginTop: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.titlecolor,
  },
  alertCount: {
    fontSize: 14,
    color: '#FF4444',
    fontWeight: '600',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  statBox: {
    flex: 1,
    backgroundColor: Colors.cardbackground,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.bordercolor,
  },
  statIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
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
  alertsList: {
    gap: 12,
  },
  alertCard: {
    backgroundColor: Colors.cardbackground,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.bordercolor,
  },
  alertHeader: {
    marginBottom: 12,
  },
  alertTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  alertIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertTitleContainer: {
    flex: 1,
  },
  alertTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.titlecolor,
    marginBottom: 2,
  },
  alertTime: {
    fontSize: 12,
    color: Colors.subtitlecolor,
  },
  severityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  severityText: {
    fontSize: 10,
    fontWeight: '700',
  },
  alertDescription: {
    fontSize: 14,
    color: Colors.subtitlecolor,
    lineHeight: 20,
    marginBottom: 8,
  },
  alertMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  alertMetaText: {
    fontSize: 13,
    color: Colors.subtitlecolor,
  },
  acknowledgeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${Colors.primary}10`,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  acknowledgeText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  recommendationsList: {
    gap: 12,
  },
  recommendationCard: {
    backgroundColor: Colors.cardbackground,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.bordercolor,
  },
  recommendationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  recommendationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.titlecolor,
    flex: 1,
  },
  recommendationDescription: {
    fontSize: 14,
    color: Colors.subtitlecolor,
    lineHeight: 20,
    marginBottom: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    backgroundColor: Colors.cardbackground,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.bordercolor,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.titlecolor,
    marginTop: 12,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.subtitlecolor,
    textAlign: 'center',
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  loadingAttemptsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 10,
  },
  loadingAttemptsText: {
    fontSize: 14,
    color: Colors.subtitlecolor,
  },
  attemptsStats: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  attemptsStatItem: {
    flex: 1,
    backgroundColor: '#FFEBEE',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FFCDD2',
  },
  attemptsStatValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FF4444',
    marginBottom: 4,
  },
  attemptsStatLabel: {
    fontSize: 11,
    color: Colors.subtitlecolor,
    textAlign: 'center',
  },
  attemptsList: {
    gap: 10,
  },
  attemptCard: {
    backgroundColor: Colors.cardbackground,
    borderRadius: 10,
    padding: 14,
    borderLeftWidth: 4,
    borderLeftColor: '#FF4444',
    borderWidth: 1,
    borderColor: Colors.bordercolor,
  },
  attemptHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  attemptIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFEBEE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  attemptInfo: {
    flex: 1,
  },
  attemptLock: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.titlecolor,
    marginBottom: 2,
  },
  attemptTime: {
    fontSize: 12,
    color: Colors.subtitlecolor,
  },
  attemptBadge: {
    backgroundColor: '#FFEBEE',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  attemptBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FF4444',
  },
  attemptDetails: {
    gap: 6,
  },
  attemptDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  attemptDetailText: {
    fontSize: 13,
    color: Colors.subtitlecolor,
    flex: 1,
  },
  loadMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.cardbackground,
    paddingVertical: 14,
    borderRadius: 10,
    marginTop: 10,
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.bordercolor,
  },
  loadMoreText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
});

export default SecurityDashboardScreen;
