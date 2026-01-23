import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import AppScreen from '../components/ui/AppScreen';
import Section from '../components/ui/Section';
import AppCard from '../components/ui/AppCard';
import Colors from '../constants/Colors';
import Theme from '../constants/Theme';
import { getLockSettings, updateSoundSettings } from '../services/api';

const LockSoundSettingsScreen = ({ navigation, route }) => {
  const { lockId } = route.params;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [soundSettings, setSoundSettings] = useState({
    volume: 100,
    unlockSound: true,
    lockSound: true,
    keypressSound: true,
    warningSound: true,
  });

  useEffect(() => {
    loadSoundSettings();
  }, [lockId]);

  const loadSoundSettings = async () => {
    setLoading(true);
    try {
      const response = await getLockSettings(lockId);
      const settings = response.data;

      // Extract sound-related settings from the general settings
      setSoundSettings({
        volume: settings.lockSoundVolume || 100,
        unlockSound: settings.unlockSound ?? true,
        lockSound: settings.lockSound ?? true,
        keypressSound: settings.keypressSound ?? true,
        warningSound: settings.warningSound ?? true,
      });
    } catch (error) {
      console.error('Failed to load sound settings:', error);
      Alert.alert('Error', 'Failed to load sound settings');
    } finally {
      setLoading(false);
    }
  };

  const handleVolumeChange = async (value) => {
    const newVolume = Math.round(value);
    setSoundSettings({ ...soundSettings, volume: newVolume });
  };

  const handleVolumeComplete = async (value) => {
    const newVolume = Math.round(value);
    setSaving(true);
    try {
      await updateSoundSettings(lockId, { volume: newVolume });
    } catch (error) {
      Alert.alert('Error', 'Failed to update volume');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleSetting = async (key) => {
    const newValue = !soundSettings[key];
    const originalSettings = soundSettings;
    setSoundSettings({ ...soundSettings, [key]: newValue });

    try {
      await updateSoundSettings(lockId, { [key]: newValue });
    } catch (error) {
      setSoundSettings(originalSettings);
      Alert.alert('Error', `Failed to update ${key.replace(/([A-Z])/g, ' $1').toLowerCase()}`);
    }
  };

  const getVolumeIcon = () => {
    if (soundSettings.volume === 0) return 'volume-mute-outline';
    if (soundSettings.volume < 50) return 'volume-low-outline';
    return 'volume-high-outline';
  };

  const getVolumeLabel = () => {
    if (soundSettings.volume === 0) return 'Muted';
    if (soundSettings.volume < 30) return 'Low';
    if (soundSettings.volume < 70) return 'Medium';
    return 'High';
  };

  if (loading) {
    return (
      <AppScreen contentContainerStyle={[styles.content, styles.centerContent]}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading sound settings...</Text>
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
          <Text style={styles.headerTitle}>Lock Sound Settings</Text>
          <Text style={styles.headerSubtitle}>Customize audio feedback</Text>
        </View>
      </View>

      <Section title="Volume Control" gapless>
        <AppCard>
          <View style={styles.volumeContainer}>
            <View style={styles.volumeHeader}>
              <Ionicons name={getVolumeIcon()} size={32} color={Colors.iconbackground} />
              <View style={styles.volumeInfo}>
                <Text style={styles.volumeValue}>{soundSettings.volume}%</Text>
                <Text style={styles.volumeLabel}>{getVolumeLabel()}</Text>
              </View>
            </View>

            <Slider
              style={styles.slider}
              minimumValue={0}
              maximumValue={100}
              step={5}
              value={soundSettings.volume}
              onValueChange={handleVolumeChange}
              onSlidingComplete={handleVolumeComplete}
              minimumTrackTintColor={Colors.iconbackground}
              maximumTrackTintColor={Colors.bordercolor}
              thumbTintColor={Colors.iconbackground}
            />

            <View style={styles.volumeMarkers}>
              <Text style={styles.volumeMarker}>0%</Text>
              <Text style={styles.volumeMarker}>50%</Text>
              <Text style={styles.volumeMarker}>100%</Text>
            </View>
          </View>

          {saving && (
            <View style={styles.savingIndicator}>
              <ActivityIndicator size="small" color={Colors.iconbackground} />
              <Text style={styles.savingText}>Saving...</Text>
            </View>
          )}
        </AppCard>
      </Section>

      <Section title="Sound Events" gapless>
        <AppCard padding="none">
          <TouchableOpacity
            style={styles.settingItem}
            onPress={() => handleToggleSetting('unlockSound')}
          >
            <View style={styles.settingIcon}>
              <Ionicons name="lock-open-outline" size={20} color={Colors.iconbackground} />
            </View>
            <View style={styles.settingContent}>
              <Text style={styles.settingTitle}>Unlock Sound</Text>
              <Text style={styles.settingSubtitle}>
                Play sound when lock opens
              </Text>
            </View>
            <Ionicons
              name={soundSettings.unlockSound ? 'checkmark-circle' : 'ellipse-outline'}
              size={24}
              color={soundSettings.unlockSound ? Colors.iconbackground : Colors.subtitlecolor}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.settingItem}
            onPress={() => handleToggleSetting('lockSound')}
          >
            <View style={styles.settingIcon}>
              <Ionicons name="lock-closed-outline" size={20} color={Colors.iconbackground} />
            </View>
            <View style={styles.settingContent}>
              <Text style={styles.settingTitle}>Lock Sound</Text>
              <Text style={styles.settingSubtitle}>
                Play sound when lock closes
              </Text>
            </View>
            <Ionicons
              name={soundSettings.lockSound ? 'checkmark-circle' : 'ellipse-outline'}
              size={24}
              color={soundSettings.lockSound ? Colors.iconbackground : Colors.subtitlecolor}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.settingItem}
            onPress={() => handleToggleSetting('keypressSound')}
          >
            <View style={styles.settingIcon}>
              <Ionicons name="keypad-outline" size={20} color={Colors.iconbackground} />
            </View>
            <View style={styles.settingContent}>
              <Text style={styles.settingTitle}>Keypress Sound</Text>
              <Text style={styles.settingSubtitle}>
                Play sound for keypad presses
              </Text>
            </View>
            <Ionicons
              name={soundSettings.keypressSound ? 'checkmark-circle' : 'ellipse-outline'}
              size={24}
              color={soundSettings.keypressSound ? Colors.iconbackground : Colors.subtitlecolor}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.settingItem, styles.settingItemLast]}
            onPress={() => handleToggleSetting('warningSound')}
          >
            <View style={styles.settingIcon}>
              <Ionicons name="alert-circle-outline" size={20} color={Colors.iconbackground} />
            </View>
            <View style={styles.settingContent}>
              <Text style={styles.settingTitle}>Warning Sound</Text>
              <Text style={styles.settingSubtitle}>
                Play sound for alerts and errors
              </Text>
            </View>
            <Ionicons
              name={soundSettings.warningSound ? 'checkmark-circle' : 'ellipse-outline'}
              size={24}
              color={soundSettings.warningSound ? Colors.iconbackground : Colors.subtitlecolor}
            />
          </TouchableOpacity>
        </AppCard>
      </Section>

      <Section>
        <AppCard>
          <View style={styles.infoBox}>
            <Ionicons name="information-circle-outline" size={20} color={Colors.iconbackground} />
            <Text style={styles.infoText}>
              Sound settings apply to the lock hardware itself. Changes will take effect immediately on the lock.
            </Text>
          </View>
        </AppCard>
      </Section>
    </AppScreen>
  );
};

const styles = StyleSheet.create({
  content: {
    paddingTop: 60,
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
    paddingHorizontal: Theme.spacing.lg,
    marginBottom: Theme.spacing.lg,
  },
  backButton: {
    padding: Theme.spacing.sm,
    marginLeft: -Theme.spacing.sm,
  },
  headerContent: {
    flex: 1,
    marginHorizontal: Theme.spacing.md,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.titlecolor,
  },
  headerSubtitle: {
    fontSize: 14,
    color: Colors.subtitlecolor,
    marginTop: 2,
  },
  volumeContainer: {
    gap: Theme.spacing.md,
  },
  volumeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.md,
  },
  volumeInfo: {
    flex: 1,
  },
  volumeValue: {
    fontSize: 32,
    fontWeight: '700',
    color: Colors.titlecolor,
  },
  volumeLabel: {
    fontSize: 14,
    color: Colors.subtitlecolor,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  volumeMarkers: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Theme.spacing.xs,
  },
  volumeMarker: {
    fontSize: 12,
    color: Colors.subtitlecolor,
  },
  savingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Theme.spacing.sm,
    marginTop: Theme.spacing.md,
    paddingTop: Theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.bordercolor,
  },
  savingText: {
    fontSize: 14,
    color: Colors.subtitlecolor,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.bordercolor,
  },
  settingItemLast: {
    borderBottomWidth: 0,
  },
  settingIcon: {
    backgroundColor: Colors.cardbackground,
    width: 40,
    height: 40,
    borderRadius: Theme.radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Theme.spacing.md,
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.titlecolor,
    marginBottom: 2,
  },
  settingSubtitle: {
    fontSize: 14,
    color: Colors.subtitlecolor,
  },
  infoBox: {
    flexDirection: 'row',
    gap: Theme.spacing.sm,
    alignItems: 'flex-start',
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: Colors.subtitlecolor,
    lineHeight: 20,
  },
});

export default LockSoundSettingsScreen;
