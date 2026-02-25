import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import {
  markInsightRead,
  dismissInsight
} from '../services/api';
import { useAIInsights, useRiskScore, useDailySummary } from '../hooks/useQueryHooks';

const { width } = Dimensions.get('window');

const AIInsightsScreen = ({ route, navigation }) => {
  const { lockId, lockName } = route.params;
  const queryClient = useQueryClient();

  const { data: insights = [], isLoading: loading, error: queryError, refetch: refetchInsights } = useAIInsights(lockId, { limit: 10 });
  const { data: riskScore = null, refetch: refetchRisk } = useRiskScore(lockId);
  const { data: dailySummary = null, refetch: refetchSummary } = useDailySummary(lockId);

  const error = queryError ? 'Failed to load AI insights' : null;

  const onRefresh = useCallback(() => {
    refetchInsights();
    refetchRisk();
    refetchSummary();
  }, [refetchInsights, refetchRisk, refetchSummary]);

  const handleInsightPress = async (insight) => {
    if (!insight.is_read) {
      try {
        await markInsightRead(insight.id);
        queryClient.setQueryData(['aiInsights', lockId, { limit: 10 }], (old) =>
          (old || []).map(i => i.id === insight.id ? { ...i, is_read: true } : i)
        );
      } catch (err) {
        console.error('Error marking insight read:', err);
      }
    }
  };

  const handleDismissInsight = async (insightId) => {
    try {
      await dismissInsight(insightId);
      queryClient.setQueryData(['aiInsights', lockId, { limit: 10 }], (old) =>
        (old || []).filter(i => i.id !== insightId)
      );
    } catch (err) {
      console.error('Error dismissing insight:', err);
    }
  };

  const getRiskColor = (level) => {
    switch (level) {
      case 'low': return '#22c55e';
      case 'medium': return '#f59e0b';
      case 'high': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getSeverityIcon = (severity) => {
    switch (severity) {
      case 'critical': return { name: 'alert-circle', color: '#ef4444' };
      case 'warning': return { name: 'warning', color: '#f59e0b' };
      default: return { name: 'information-circle', color: '#3b82f6' };
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Analyzing lock activity...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={onRefresh} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>AI Insights</Text>
        <Text style={styles.headerSubtitle}>{lockName}</Text>
      </View>

      {error && (
        <View style={styles.errorCard}>
          <Ionicons name="alert-circle" size={20} color="#ef4444" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Risk Score Card */}
      {riskScore && (
        <View style={styles.riskCard}>
          <View style={styles.riskHeader}>
            <Text style={styles.riskTitle}>Security Risk Score</Text>
            <View style={[styles.riskBadge, { backgroundColor: getRiskColor(riskScore.risk_level) + '20' }]}>
              <Text style={[styles.riskBadgeText, { color: getRiskColor(riskScore.risk_level) }]}>
                {riskScore.risk_level?.toUpperCase()}
              </Text>
            </View>
          </View>

          <View style={styles.riskScoreContainer}>
            <Text style={[styles.riskScoreNumber, { color: getRiskColor(riskScore.risk_level) }]}>
              {riskScore.overall_score}
            </Text>
            <Text style={styles.riskScoreLabel}>/100</Text>
          </View>

          {/* Progress bar */}
          <View style={styles.riskProgressBar}>
            <View
              style={[
                styles.riskProgressFill,
                {
                  width: `${riskScore.overall_score}%`,
                  backgroundColor: getRiskColor(riskScore.risk_level)
                }
              ]}
            />
          </View>

          {/* Recommendations */}
          {riskScore.recommendations?.length > 0 && (
            <View style={styles.recommendationsContainer}>
              {riskScore.recommendations.slice(0, 2).map((rec, index) => (
                <View key={index} style={styles.recommendationItem}>
                  <Ionicons name="bulb-outline" size={16} color="#6b7280" />
                  <Text style={styles.recommendationText}>{rec.message || rec}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* Daily Summary Card */}
      {dailySummary && (
        <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <Ionicons name="calendar-outline" size={20} color="#007AFF" />
            <Text style={styles.summaryTitle}>Today's Summary</Text>
          </View>

          {dailySummary.natural_language_summary && (
            <Text style={styles.summaryText}>
              {dailySummary.natural_language_summary}
            </Text>
          )}

          <View style={styles.summaryStats}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{dailySummary.total_accesses || 0}</Text>
              <Text style={styles.statLabel}>Events</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{dailySummary.unique_users || 0}</Text>
              <Text style={styles.statLabel}>Users</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[
                styles.statNumber,
                dailySummary.failed_attempts > 0 && { color: '#ef4444' }
              ]}>
                {dailySummary.failed_attempts || 0}
              </Text>
              <Text style={styles.statLabel}>Failed</Text>
            </View>
          </View>
        </View>
      )}

      {/* Insights List */}
      <View style={styles.insightsSection}>
        <Text style={styles.sectionTitle}>Recent Insights</Text>

        {insights.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="checkmark-circle" size={48} color="#22c55e" />
            <Text style={styles.emptyTitle}>All Clear!</Text>
            <Text style={styles.emptyText}>
              No security concerns detected. Your lock activity looks normal.
            </Text>
          </View>
        ) : (
          insights.map((insight) => {
            const icon = getSeverityIcon(insight.severity);
            return (
              <TouchableOpacity
                key={insight.id}
                style={[
                  styles.insightCard,
                  !insight.is_read && styles.insightCardUnread
                ]}
                onPress={() => handleInsightPress(insight)}
              >
                <View style={styles.insightHeader}>
                  <Ionicons name={icon.name} size={24} color={icon.color} />
                  <View style={styles.insightTitleContainer}>
                    <Text style={styles.insightTitle} numberOfLines={1}>
                      {insight.title}
                    </Text>
                    <Text style={styles.insightTime}>
                      {new Date(insight.created_at).toLocaleString()}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.dismissButton}
                    onPress={() => handleDismissInsight(insight.id)}
                  >
                    <Ionicons name="close" size={20} color="#9ca3af" />
                  </TouchableOpacity>
                </View>
                <Text style={styles.insightDescription} numberOfLines={2}>
                  {insight.description}
                </Text>
              </TouchableOpacity>
            );
          })
        )}
      </View>

      {/* Chat Assistant CTA */}
      <TouchableOpacity
        style={styles.chatCTA}
        onPress={() => navigation.navigate('ChatAssistant', { lockId, lockName })}
      >
        <View style={styles.chatCTAContent}>
          <View style={styles.chatCTAIcon}>
            <Ionicons name="chatbubbles" size={24} color="#fff" />
          </View>
          <View style={styles.chatCTAText}>
            <Text style={styles.chatCTATitle}>Ask AI Assistant</Text>
            <Text style={styles.chatCTASubtitle}>
              Get answers about your lock activity
            </Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={24} color="#007AFF" />
      </TouchableOpacity>

      <View style={styles.bottomPadding} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5'
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5'
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6b7280'
  },
  header: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb'
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1f2937'
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#6b7280',
    marginTop: 4
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    margin: 16,
    padding: 12,
    borderRadius: 8,
    gap: 8
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14
  },
  riskCard: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3
  },
  riskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16
  },
  riskTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937'
  },
  riskBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12
  },
  riskBadgeText: {
    fontSize: 12,
    fontWeight: '600'
  },
  riskScoreContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    marginBottom: 16
  },
  riskScoreNumber: {
    fontSize: 56,
    fontWeight: 'bold'
  },
  riskScoreLabel: {
    fontSize: 20,
    color: '#9ca3af',
    marginLeft: 4
  },
  riskProgressBar: {
    height: 8,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    overflow: 'hidden'
  },
  riskProgressFill: {
    height: '100%',
    borderRadius: 4
  },
  recommendationsContainer: {
    marginTop: 16,
    gap: 8
  },
  recommendationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  recommendationText: {
    flex: 1,
    fontSize: 14,
    color: '#6b7280'
  },
  summaryCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937'
  },
  summaryText: {
    fontSize: 15,
    color: '#4b5563',
    lineHeight: 22,
    marginBottom: 16
  },
  summaryStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb'
  },
  statItem: {
    alignItems: 'center'
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937'
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4
  },
  insightsSection: {
    padding: 16
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12
  },
  emptyCard: {
    backgroundColor: '#fff',
    padding: 32,
    borderRadius: 16,
    alignItems: 'center'
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1f2937',
    marginTop: 12
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 8
  },
  insightCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2
  },
  insightCardUnread: {
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF'
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8
  },
  insightTitleContainer: {
    flex: 1,
    marginLeft: 12
  },
  insightTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937'
  },
  insightTime: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 2
  },
  dismissButton: {
    padding: 4
  },
  insightDescription: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
    marginLeft: 36
  },
  chatCTA: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3
  },
  chatCTAContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center'
  },
  chatCTAIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center'
  },
  chatCTAText: {
    marginLeft: 12
  },
  chatCTATitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937'
  },
  chatCTASubtitle: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2
  },
  bottomPadding: {
    height: 32
  }
});

export default AIInsightsScreen;
