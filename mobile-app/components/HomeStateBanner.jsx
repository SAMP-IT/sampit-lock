import React from 'react';
import { Text, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AppCard from './ui/AppCard';
import Colors from '../constants/Colors';
import Theme from '../constants/Theme';

const messageByState = {
  normal: {
    title: 'Home secured',
    subtitle: 'All doors locked, sensors healthy, and cameras online.',
    icon: 'shield-checkmark-outline',
    tone: Colors.iconbackground,
  },
  unlocked: {
    title: 'Front door is unlocked',
    subtitle: 'Tap the controls below to secure your space when you head out.',
    icon: 'lock-open-outline',
    tone: Colors.indicatorcolor,
  },
  emergency: {
    title: 'Emergency mode active',
    subtitle: 'Stay calm. Authorities are on the way and local sirens triggered.',
    icon: 'alert-circle-outline',
    tone: Colors.indicatorcolor,
  },
  offline: {
    title: "You're viewing offline data",
    subtitle: 'Connection lost. Interactions are paused while we retry.',
    icon: 'cloud-offline-outline',
    tone: Colors.subtitlecolor,
  },
};

const HomeStateBanner = ({ state = 'normal' }) => {
  const message = messageByState[state] ?? messageByState.normal;

  return (
    <AppCard
      variant="tinted"
      style={[styles.banner, { borderColor: message.tone }]}
    >
      <View style={[styles.iconWrap, { backgroundColor: message.tone }]}>
        <Ionicons name={message.icon} size={24} color={Colors.textwhite} />
      </View>
      <View style={styles.copy}>
        <Text style={styles.title}>{message.title}</Text>
        <Text style={styles.subtitle}>{message.subtitle}</Text>
      </View>
    </AppCard>
  );
};

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.md,
    borderWidth: 1,
  },
  iconWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.titlecolor,
    marginBottom: Theme.spacing.xs,
  },
  subtitle: {
    ...Theme.typography.subtitle,
    lineHeight: 20,
  },
});

export default HomeStateBanner;
