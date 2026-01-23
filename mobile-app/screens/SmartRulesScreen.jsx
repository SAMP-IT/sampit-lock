import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, RefreshControl, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AppScreen from '../components/ui/AppScreen';
import AppCard from '../components/ui/AppCard';
import Colors from '../constants/Colors';
import Theme from '../constants/Theme';
import { getRuleSuggestions, getActiveRules, createRule, toggleRule, deleteRule } from '../services/api';

const SmartRulesScreen = ({ navigation, route }) => {
  const { lockId, lockName } = route.params || {};
  const [suggestions, setSuggestions] = useState([]);
  const [activeRules, setActiveRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingId, setProcessingId] = useState(null);

  const loadData = useCallback(async () => {
    try {
      const [suggestionsRes, rulesRes] = await Promise.all([
        getRuleSuggestions(lockId),
        getActiveRules(lockId)
      ]);

      setSuggestions(suggestionsRes.data?.data?.suggestions || []);
      setActiveRules(rulesRes.data?.data?.rules || []);
    } catch (error) {
      console.error('Failed to load rules data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [lockId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const handleAcceptSuggestion = async (suggestion) => {
    setProcessingId(suggestion.id || suggestion.type);
    try {
      await createRule(lockId, suggestion);
      Alert.alert('Success', 'Rule has been created and activated.');
      loadData();
    } catch (error) {
      console.error('Failed to create rule:', error);
      Alert.alert('Error', 'Failed to create rule. Please try again.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleToggleRule = async (ruleId, currentStatus) => {
    setProcessingId(ruleId);
    try {
      await toggleRule(ruleId, !currentStatus);
      setActiveRules(prev =>
        prev.map(rule =>
          rule.id === ruleId ? { ...rule, is_active: !currentStatus } : rule
        )
      );
    } catch (error) {
      console.error('Failed to toggle rule:', error);
      Alert.alert('Error', 'Failed to update rule. Please try again.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleDeleteRule = async (ruleId) => {
    Alert.alert(
      'Delete Rule',
      'Are you sure you want to delete this rule?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setProcessingId(ruleId);
            try {
              await deleteRule(ruleId);
              setActiveRules(prev => prev.filter(rule => rule.id !== ruleId));
            } catch (error) {
              console.error('Failed to delete rule:', error);
              Alert.alert('Error', 'Failed to delete rule. Please try again.');
            } finally {
              setProcessingId(null);
            }
          }
        }
      ]
    );
  };

  const getRuleIcon = (type) => {
    switch (type) {
      case 'AUTO_LOCK': return 'timer-outline';
      case 'TIME_RESTRICTION': return 'time-outline';
      case 'AUTO_DISABLE': return 'person-remove-outline';
      case 'SEASONAL_ACCESS': return 'calendar-outline';
      case 'USAGE_BASED': return 'analytics-outline';
      default: return 'settings-outline';
    }
  };

  const getRuleColor = (priority) => {
    switch (priority) {
      case 'high': return Colors.error || '#ef4444';
      case 'medium': return Colors.warning || '#f59e0b';
      default: return Colors.iconbackground;
    }
  };

  if (loading) {
    return (
      <AppScreen contentContainerStyle={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.iconbackground} />
        <Text style={styles.loadingText}>Loading smart rules...</Text>
      </AppScreen>
    );
  }

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
          <Text style={styles.headerTitle}>Smart Rules</Text>
          <View style={styles.headerRight} />
        </View>

        <View style={styles.heroBlock}>
          <View style={styles.heroIcon}>
            <Ionicons name="flash-outline" size={28} color={Colors.textwhite} />
          </View>
          <Text style={styles.heroTitle}>AI-Powered Automation</Text>
          <Text style={styles.heroSubtitle}>
            {lockName || 'Your lock'} can automatically apply smart rules based on usage patterns
          </Text>
        </View>

        {/* AI Suggestions */}
        {suggestions.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Suggested Rules</Text>
            <Text style={styles.sectionSubtitle}>
              Based on your usage patterns, we recommend:
            </Text>
            {suggestions.map((suggestion, index) => (
              <AppCard key={suggestion.id || index} style={styles.suggestionCard}>
                <View style={styles.cardHeader}>
                  <View style={[styles.iconWrap, { backgroundColor: getRuleColor(suggestion.priority) }]}>
                    <Ionicons
                      name={getRuleIcon(suggestion.type)}
                      size={20}
                      color={Colors.textwhite}
                    />
                  </View>
                  <View style={styles.cardTitleWrap}>
                    <Text style={styles.cardTitle}>{suggestion.title}</Text>
                    <Text style={styles.cardSubtitle}>{suggestion.description}</Text>
                  </View>
                </View>
                {suggestion.reason && (
                  <View style={styles.reasonBox}>
                    <Ionicons name="bulb-outline" size={16} color={Colors.iconbackground} />
                    <Text style={styles.reasonText}>{suggestion.reason}</Text>
                  </View>
                )}
                <View style={styles.cardActions}>
                  <TouchableOpacity
                    style={styles.acceptButton}
                    onPress={() => handleAcceptSuggestion(suggestion)}
                    disabled={processingId === (suggestion.id || suggestion.type)}
                  >
                    {processingId === (suggestion.id || suggestion.type) ? (
                      <ActivityIndicator size="small" color={Colors.textwhite} />
                    ) : (
                      <>
                        <Ionicons name="checkmark" size={18} color={Colors.textwhite} />
                        <Text style={styles.acceptButtonText}>Accept</Text>
                      </>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.dismissButton}>
                    <Text style={styles.dismissButtonText}>Dismiss</Text>
                  </TouchableOpacity>
                </View>
              </AppCard>
            ))}
          </View>
        )}

        {/* Active Rules */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Active Rules</Text>
          {activeRules.length === 0 ? (
            <AppCard style={styles.emptyCard}>
              <Ionicons name="layers-outline" size={48} color={Colors.subtitlecolor} />
              <Text style={styles.emptyText}>No active rules</Text>
              <Text style={styles.emptySubtext}>
                Accept suggestions above or wait for AI to learn your patterns
              </Text>
            </AppCard>
          ) : (
            activeRules.map((rule) => (
              <AppCard key={rule.id} style={styles.ruleCard}>
                <View style={styles.cardHeader}>
                  <View style={[styles.iconWrap, { backgroundColor: rule.is_active ? Colors.iconbackground : Colors.subtitlecolor }]}>
                    <Ionicons
                      name={getRuleIcon(rule.rule_type)}
                      size={20}
                      color={Colors.textwhite}
                    />
                  </View>
                  <View style={styles.cardTitleWrap}>
                    <Text style={styles.cardTitle}>{rule.name || rule.rule_type}</Text>
                    <Text style={styles.cardSubtitle}>
                      {rule.is_active ? 'Active' : 'Paused'}
                    </Text>
                  </View>
                  <Switch
                    value={rule.is_active}
                    onValueChange={() => handleToggleRule(rule.id, rule.is_active)}
                    trackColor={{ false: '#e5e5e5', true: Colors.iconbackground }}
                    thumbColor={Colors.textwhite}
                    disabled={processingId === rule.id}
                  />
                </View>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => handleDeleteRule(rule.id)}
                >
                  <Ionicons name="trash-outline" size={16} color={Colors.error || '#ef4444'} />
                  <Text style={styles.deleteButtonText}>Delete Rule</Text>
                </TouchableOpacity>
              </AppCard>
            ))
          )}
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
  heroBlock: {
    backgroundColor: Colors.iconbackground,
    borderRadius: 24,
    padding: Theme.spacing.xl,
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textwhite,
  },
  heroSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    lineHeight: 20,
  },
  section: {
    gap: Theme.spacing.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.titlecolor,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: Colors.subtitlecolor,
    marginTop: -Theme.spacing.sm,
  },
  suggestionCard: {
    padding: Theme.spacing.lg,
    gap: Theme.spacing.md,
  },
  ruleCard: {
    padding: Theme.spacing.lg,
    gap: Theme.spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.md,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitleWrap: {
    flex: 1,
    gap: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.titlecolor,
  },
  cardSubtitle: {
    fontSize: 13,
    color: Colors.subtitlecolor,
  },
  reasonBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Theme.spacing.sm,
    backgroundColor: Colors.cardbackground,
    padding: Theme.spacing.md,
    borderRadius: Theme.radius.md,
  },
  reasonText: {
    flex: 1,
    fontSize: 13,
    color: Colors.subtitlecolor,
    lineHeight: 18,
  },
  cardActions: {
    flexDirection: 'row',
    gap: Theme.spacing.sm,
    marginTop: Theme.spacing.sm,
  },
  acceptButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.iconbackground,
    paddingVertical: Theme.spacing.sm,
    borderRadius: Theme.radius.pill,
    gap: Theme.spacing.xs,
  },
  acceptButtonText: {
    color: Colors.textwhite,
    fontWeight: '600',
  },
  dismissButton: {
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: Theme.spacing.sm,
    borderRadius: Theme.radius.pill,
    borderWidth: 1,
    borderColor: Colors.subtitlecolor,
  },
  dismissButtonText: {
    color: Colors.subtitlecolor,
    fontWeight: '600',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Theme.spacing.xs,
    paddingVertical: Theme.spacing.sm,
  },
  deleteButtonText: {
    color: Colors.error || '#ef4444',
    fontSize: 14,
  },
  emptyCard: {
    padding: Theme.spacing.xl,
    alignItems: 'center',
    gap: Theme.spacing.md,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.titlecolor,
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.subtitlecolor,
    textAlign: 'center',
  },
});

export default SmartRulesScreen;
