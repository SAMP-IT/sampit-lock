import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, RefreshControl, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AppScreen from '../components/ui/AppScreen';
import AppCard from '../components/ui/AppCard';
import Colors from '../constants/Colors';
import Theme from '../constants/Theme';
import { getHomeMode, setHomeMode, enableVacationMode, getScheduleSuggestions, activateSchedule, setAutoPilot, saveHomeLocation, getHomeLocation, getUserAISettings } from '../services/api';
import { requestLocationPermissions, startGeofencing, stopGeofencing, getCurrentPosition } from '../services/geofencingService';

const HomeModeScreen = ({ navigation }) => {
  const [currentMode, setCurrentMode] = useState('home');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [modeData, setModeData] = useState(null);
  const [scheduleSuggestions, setScheduleSuggestions] = useState([]);
  const [showSchedulePanel, setShowSchedulePanel] = useState(false);
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [autoPilotEnabled, setAutoPilotEnabled] = useState(false);
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [featureProcessing, setFeatureProcessing] = useState(null);

  const modes = [
    {
      id: 'home',
      name: 'Home',
      icon: 'home-outline',
      description: 'Normal access rules apply',
      color: Colors.iconbackground,
    },
    {
      id: 'away',
      name: 'Away',
      icon: 'walk-outline',
      description: 'Auto-lock enabled, guests can still access',
      color: '#f59e0b',
    },
    {
      id: 'vacation',
      name: 'Vacation',
      icon: 'airplane-outline',
      description: 'Restricted access, only trusted users allowed',
      color: '#8b5cf6',
    },
    {
      id: 'do_not_disturb',
      name: 'Do Not Disturb',
      icon: 'moon-outline',
      description: 'No notifications, auto-lock after 30s',
      color: '#6366f1',
    },
  ];

  const loadData = useCallback(async () => {
    try {
      const [modeRes, settingsRes] = await Promise.all([
        getHomeMode(),
        getUserAISettings().catch(() => ({ data: { data: {} } }))
      ]);

      const data = modeRes.data?.data || modeRes.data;
      setModeData(data);
      setCurrentMode(data?.mode || 'home');

      const settings = settingsRes.data?.data || {};
      setAutoPilotEnabled(settings.auto_pilot_enabled || false);
      setLocationEnabled(settings.location_detection_enabled || false);
    } catch (error) {
      console.error('Failed to load home mode:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const handleModeChange = async (modeId) => {
    if (modeId === currentMode || processing) return;

    setProcessing(true);
    try {
      if (modeId === 'vacation') {
        await enableVacationMode({ duration: 7 }); // Default 7 days
      } else {
        await setHomeMode(modeId);
      }
      setCurrentMode(modeId);
      Alert.alert('Success', `Mode changed to ${modes.find(m => m.id === modeId)?.name}`);
    } catch (error) {
      console.error('Failed to change mode:', error);
      Alert.alert('Error', 'Failed to change mode. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const handleLocationToggle = async (value) => {
    setFeatureProcessing('location');
    try {
      if (value) {
        const perms = await requestLocationPermissions();
        if (!perms.granted) {
          Alert.alert('Permission Required', perms.reason);
          return;
        }

        const position = await getCurrentPosition();
        const { latitude, longitude } = position.coords;

        Alert.alert(
          'Set Home Location',
          `Use your current location as home?\n(${latitude.toFixed(4)}, ${longitude.toFixed(4)})`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Confirm',
              onPress: async () => {
                try {
                  const location = { latitude, longitude, radius: 100 };
                  await saveHomeLocation(location);
                  await startGeofencing(location);
                  setLocationEnabled(true);
                  Alert.alert('Success', 'Location detection is now active. Your lock will automatically switch modes when you leave or arrive home.');
                } catch (err) {
                  console.error('Failed to save location:', err);
                  Alert.alert('Error', 'Failed to set up location detection.');
                }
              }
            }
          ]
        );
      } else {
        await stopGeofencing();
        await saveHomeLocation({ latitude: 0, longitude: 0, radius: 0, enabled: false });
        setLocationEnabled(false);
      }
    } catch (error) {
      console.error('Location toggle error:', error);
      Alert.alert('Error', 'Failed to update location detection.');
    } finally {
      setFeatureProcessing(null);
    }
  };

  const handleScheduleToggle = async (value) => {
    if (value) {
      setFeatureProcessing('schedule');
      try {
        const res = await getScheduleSuggestions();
        const suggestions = res.data?.data?.suggestions || [];
        setScheduleSuggestions(suggestions);
        setShowSchedulePanel(true);
        setScheduleEnabled(true);
      } catch (error) {
        console.error('Failed to load schedule suggestions:', error);
        Alert.alert('Error', 'Failed to load schedule suggestions.');
      } finally {
        setFeatureProcessing(null);
      }
    } else {
      setShowSchedulePanel(false);
      setScheduleEnabled(false);
      setScheduleSuggestions([]);
    }
  };

  const handleAcceptSchedule = async (schedule) => {
    setFeatureProcessing('schedule');
    try {
      await activateSchedule(schedule);
      Alert.alert('Success', `Schedule "${schedule.name || schedule.mode}" has been activated.`);
      setScheduleSuggestions(prev => prev.filter(s => s !== schedule));
    } catch (error) {
      console.error('Failed to activate schedule:', error);
      Alert.alert('Error', 'Failed to activate schedule.');
    } finally {
      setFeatureProcessing(null);
    }
  };

  const handleAutoPilotToggle = async (value) => {
    setFeatureProcessing('autopilot');
    try {
      await setAutoPilot(value);
      setAutoPilotEnabled(value);
      if (value) {
        Alert.alert(
          'AI Auto-Pilot Enabled',
          'The AI will now learn your usage patterns and automatically switch modes based on your schedule and behavior. It checks every 30 minutes.'
        );
      }
    } catch (error) {
      console.error('Failed to toggle auto-pilot:', error);
      Alert.alert('Error', 'Failed to update auto-pilot setting.');
    } finally {
      setFeatureProcessing(null);
    }
  };

  const getModeIcon = (mode) => {
    const modeConfig = modes.find(m => m.id === mode);
    return modeConfig?.icon || 'help-outline';
  };

  const getModeColor = (mode) => {
    const modeConfig = modes.find(m => m.id === mode);
    return modeConfig?.color || Colors.iconbackground;
  };

  if (loading) {
    return (
      <AppScreen contentContainerStyle={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.iconbackground} />
        <Text style={styles.loadingText}>Loading home mode...</Text>
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
          <Text style={styles.headerTitle}>Home Mode</Text>
          <View style={styles.headerRight} />
        </View>

        <View style={[styles.heroBlock, { backgroundColor: getModeColor(currentMode) }]}>
          <View style={styles.heroIcon}>
            <Ionicons name={getModeIcon(currentMode)} size={32} color={Colors.textwhite} />
          </View>
          <Text style={styles.heroTitle}>
            {modes.find(m => m.id === currentMode)?.name || 'Home'} Mode
          </Text>
          <Text style={styles.heroSubtitle}>
            {modes.find(m => m.id === currentMode)?.description}
          </Text>
        </View>

        {/* Mode Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Mode</Text>
          <Text style={styles.sectionSubtitle}>
            Choose how your locks should behave
          </Text>

          {modes.map((mode) => (
            <TouchableOpacity
              key={mode.id}
              onPress={() => handleModeChange(mode.id)}
              disabled={processing}
              activeOpacity={0.8}
            >
              <AppCard style={[
                styles.modeCard,
                currentMode === mode.id && styles.modeCardActive
              ]}>
                <View style={styles.cardHeader}>
                  <View style={[styles.iconWrap, { backgroundColor: mode.color }]}>
                    <Ionicons name={mode.icon} size={22} color={Colors.textwhite} />
                  </View>
                  <View style={styles.cardTitleWrap}>
                    <Text style={styles.cardTitle}>{mode.name}</Text>
                    <Text style={styles.cardSubtitle}>{mode.description}</Text>
                  </View>
                  {currentMode === mode.id ? (
                    <View style={styles.activeIndicator}>
                      <Ionicons name="checkmark-circle" size={24} color={Colors.iconbackground} />
                    </View>
                  ) : (
                    <Ionicons name="chevron-forward" size={20} color={Colors.subtitlecolor} />
                  )}
                </View>
              </AppCard>
            </TouchableOpacity>
          ))}
        </View>

        {/* Smart Features */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Smart Features</Text>

          <AppCard style={styles.featureCard}>
            <View style={styles.featureRow}>
              <View style={styles.featureInfo}>
                <View style={[styles.featureIcon, { backgroundColor: '#10b98120' }]}>
                  <Ionicons name="location-outline" size={20} color="#10b981" />
                </View>
                <View>
                  <Text style={styles.featureTitle}>Auto-detect Location</Text>
                  <Text style={styles.featureSubtitle}>
                    {locationEnabled ? 'Monitoring your home area' : 'Switch mode based on your location'}
                  </Text>
                </View>
              </View>
              {featureProcessing === 'location' ? (
                <ActivityIndicator size="small" color={Colors.iconbackground} />
              ) : (
                <Switch
                  value={locationEnabled}
                  onValueChange={handleLocationToggle}
                  trackColor={{ false: '#e5e5e5', true: '#10b981' }}
                  thumbColor={Colors.textwhite}
                />
              )}
            </View>
          </AppCard>

          <AppCard style={styles.featureCard}>
            <View style={styles.featureRow}>
              <View style={styles.featureInfo}>
                <View style={[styles.featureIcon, { backgroundColor: '#6366f120' }]}>
                  <Ionicons name="time-outline" size={20} color="#6366f1" />
                </View>
                <View>
                  <Text style={styles.featureTitle}>Schedule Modes</Text>
                  <Text style={styles.featureSubtitle}>
                    {scheduleEnabled ? 'Viewing suggested schedules' : 'Set modes for specific times'}
                  </Text>
                </View>
              </View>
              {featureProcessing === 'schedule' ? (
                <ActivityIndicator size="small" color={Colors.iconbackground} />
              ) : (
                <Switch
                  value={scheduleEnabled}
                  onValueChange={handleScheduleToggle}
                  trackColor={{ false: '#e5e5e5', true: '#6366f1' }}
                  thumbColor={Colors.textwhite}
                />
              )}
            </View>
          </AppCard>

          {showSchedulePanel && (
            <View style={styles.schedulePanel}>
              {scheduleSuggestions.length === 0 ? (
                <AppCard style={styles.emptyScheduleCard}>
                  <Ionicons name="calendar-outline" size={32} color={Colors.subtitlecolor} />
                  <Text style={styles.emptyScheduleText}>
                    No schedule suggestions yet. The AI needs more usage data to recommend schedules.
                  </Text>
                </AppCard>
              ) : (
                scheduleSuggestions.map((schedule, index) => (
                  <AppCard key={index} style={styles.scheduleCard}>
                    <View style={styles.scheduleHeader}>
                      <Ionicons name="time-outline" size={18} color="#6366f1" />
                      <Text style={styles.scheduleTitle}>
                        {schedule.name || `${schedule.mode} mode`}
                      </Text>
                    </View>
                    <Text style={styles.scheduleDesc}>
                      {schedule.days?.join(', ')} · {schedule.start_hour || '?'}:00 – {schedule.end_hour || '?'}:00
                    </Text>
                    {schedule.reason && (
                      <Text style={styles.scheduleReason}>{schedule.reason}</Text>
                    )}
                    <TouchableOpacity
                      style={styles.scheduleAcceptBtn}
                      onPress={() => handleAcceptSchedule(schedule)}
                      disabled={featureProcessing === 'schedule'}
                    >
                      <Ionicons name="checkmark" size={16} color={Colors.textwhite} />
                      <Text style={styles.scheduleAcceptText}>Activate</Text>
                    </TouchableOpacity>
                  </AppCard>
                ))
              )}
            </View>
          )}

          <AppCard style={styles.featureCard}>
            <View style={styles.featureRow}>
              <View style={styles.featureInfo}>
                <View style={[styles.featureIcon, { backgroundColor: '#f59e0b20' }]}>
                  <Ionicons name="flash-outline" size={20} color="#f59e0b" />
                </View>
                <View>
                  <Text style={styles.featureTitle}>AI Auto-Pilot</Text>
                  <Text style={styles.featureSubtitle}>
                    {autoPilotEnabled ? 'AI is managing your modes' : 'Let AI learn and manage modes'}
                  </Text>
                </View>
              </View>
              {featureProcessing === 'autopilot' ? (
                <ActivityIndicator size="small" color={Colors.iconbackground} />
              ) : (
                <Switch
                  value={autoPilotEnabled}
                  onValueChange={handleAutoPilotToggle}
                  trackColor={{ false: '#e5e5e5', true: '#f59e0b' }}
                  thumbColor={Colors.textwhite}
                />
              )}
            </View>
          </AppCard>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>

          <View style={styles.quickActions}>
            <TouchableOpacity
              style={styles.quickAction}
              onPress={() => navigation.navigate('SmartRules')}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: '#8b5cf620' }]}>
                <Ionicons name="layers-outline" size={24} color="#8b5cf6" />
              </View>
              <Text style={styles.quickActionText}>Smart Rules</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickAction}
              onPress={() => navigation.navigate('SecurityDashboard')}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: '#ef444420' }]}>
                <Ionicons name="shield-outline" size={24} color="#ef4444" />
              </View>
              <Text style={styles.quickActionText}>Security</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickAction}
              onPress={() => navigation.navigate('AIInsights')}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: '#10b98120' }]}>
                <Ionicons name="analytics-outline" size={24} color="#10b981" />
              </View>
              <Text style={styles.quickActionText}>Insights</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {processing && (
        <View style={styles.processingOverlay}>
          <ActivityIndicator size="large" color={Colors.textwhite} />
          <Text style={styles.processingText}>Changing mode...</Text>
        </View>
      )}
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
    borderRadius: 24,
    padding: Theme.spacing.xl,
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    fontSize: 22,
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
  modeCard: {
    padding: Theme.spacing.lg,
  },
  modeCardActive: {
    borderWidth: 2,
    borderColor: Colors.iconbackground,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.md,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
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
  activeIndicator: {
    padding: 4,
  },
  featureCard: {
    padding: Theme.spacing.lg,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  featureInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.md,
    flex: 1,
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.titlecolor,
  },
  featureSubtitle: {
    fontSize: 12,
    color: Colors.subtitlecolor,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Theme.spacing.md,
  },
  quickAction: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: Colors.cardbackground,
    borderRadius: Theme.radius.lg,
    paddingVertical: Theme.spacing.lg,
    gap: Theme.spacing.sm,
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionText: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.titlecolor,
  },
  processingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Theme.spacing.md,
  },
  processingText: {
    color: Colors.textwhite,
    fontSize: 16,
    fontWeight: '500',
  },
  schedulePanel: {
    gap: Theme.spacing.sm,
  },
  scheduleCard: {
    padding: Theme.spacing.md,
    gap: Theme.spacing.sm,
  },
  scheduleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  scheduleTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.titlecolor,
  },
  scheduleDesc: {
    fontSize: 13,
    color: Colors.subtitlecolor,
  },
  scheduleReason: {
    fontSize: 12,
    color: Colors.subtitlecolor,
    fontStyle: 'italic',
  },
  scheduleAcceptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6366f1',
    paddingVertical: Theme.spacing.sm,
    borderRadius: Theme.radius.pill,
    gap: Theme.spacing.xs,
    marginTop: Theme.spacing.xs,
  },
  scheduleAcceptText: {
    color: Colors.textwhite,
    fontWeight: '600',
    fontSize: 14,
  },
  emptyScheduleCard: {
    padding: Theme.spacing.lg,
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  emptyScheduleText: {
    fontSize: 13,
    color: Colors.subtitlecolor,
    textAlign: 'center',
    lineHeight: 18,
  },
});

export default HomeModeScreen;
