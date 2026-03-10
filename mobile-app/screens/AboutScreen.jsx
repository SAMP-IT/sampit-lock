import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Image, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AppScreen from '../components/ui/AppScreen';
import AppCard from '../components/ui/AppCard';
import Section from '../components/ui/Section';
import Colors from '../constants/Colors';
import Theme from '../constants/Theme';

const AboutScreen = ({ navigation }) => {
  const appVersion = '1.0.0';
  const buildNumber = '1';
  const currentYear = new Date().getFullYear();

  const handleOpenLink = (url) => {
    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'Unable to open link');
    });
  };

  const renderLinkItem = (icon, title, subtitle, onPress) => (
    <TouchableOpacity style={styles.linkItem} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.linkIcon}>
        <Ionicons name={icon} size={20} color={Colors.iconbackground} />
      </View>
      <View style={styles.linkContent}>
        <Text style={styles.linkTitle}>{title}</Text>
        {subtitle && <Text style={styles.linkSubtitle}>{subtitle}</Text>}
      </View>
      <Ionicons name="open-outline" size={18} color={Colors.subtitlecolor} />
    </TouchableOpacity>
  );

  return (
    <AppScreen contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={Colors.titlecolor} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>About</Text>
          <Text style={styles.headerSubtitle}>App information</Text>
        </View>
      </View>

      {/* App Info Card */}
      <View style={styles.appInfoCard}>
        <Image source={require('../assets/logos/logo2.jpeg')} style={styles.appLogo} resizeMode="contain" />
        <Text style={styles.appName}>Awakey</Text>
        <Text style={styles.appTagline}>Smart Lock Management</Text>
        <Text style={styles.appVersion}>Version {appVersion} (Build {buildNumber})</Text>
      </View>

      <Section title="Legal" gapless>
        <AppCard padding="none">
          {renderLinkItem('document-text-outline', 'Terms of Service', null, () => handleOpenLink('https://www.jainsonlocks.com/terms-conditions/'))}
          {renderLinkItem('shield-outline', 'Privacy Policy', null, () => handleOpenLink('https://www.jainsonlocks.com/privacy-policy/'))}
          {renderLinkItem('cube-outline', 'Shipping Policy', null, () => handleOpenLink('https://www.jainsonlocks.com/shipping-policy/'))}
          {renderLinkItem('swap-horizontal-outline', 'Return & Replacement Policy', null, () => handleOpenLink('https://www.jainsonlocks.com/return-replacement-policy/'))}
        </AppCard>
      </Section>

      <Section title="Connect" gapless>
        <AppCard padding="none">
          {renderLinkItem('globe-outline', 'Website', 'awakey.com', () => handleOpenLink('https://jainsonlocks.com/smart-locks/'))}
          {renderLinkItem('logo-facebook', 'Facebook', null, () => handleOpenLink('https://www.facebook.com/JainsonLocks/'))}
          {renderLinkItem('logo-youtube', 'YouTube', null, () => handleOpenLink('https://www.youtube.com/@awakeytech2539'))}
          {renderLinkItem('logo-instagram', 'Instagram', null, () => handleOpenLink('https://www.instagram.com/jainsonlocks/'))}
        </AppCard>
      </Section>

      <Section title="Developer" gapless>
        <AppCard style={styles.developerCard}>
          <Text style={styles.developerText}>Made with love by Awakey Team</Text>
          <Text style={styles.copyrightText}>{currentYear} Awakey. All rights reserved.</Text>
        </AppCard>
      </Section>

      {/* Rate Us Button */}
      <TouchableOpacity
        style={styles.rateButton}
        onPress={() => Alert.alert('Rate Us', 'Thank you for using Awakey! We appreciate your feedback.')}
        activeOpacity={0.8}
      >
        <Ionicons name="star" size={20} color={Colors.textwhite} />
        <Text style={styles.rateButtonText}>Rate Us on AppStore</Text>
      </TouchableOpacity>
    </AppScreen>
  );
};

const styles = StyleSheet.create({
  content: {
    paddingTop: 60,
    paddingBottom: Theme.spacing.xl,
    gap: Theme.spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Theme.spacing.lg,
    marginBottom: Theme.spacing.md,
  },
  backButton: {
    padding: Theme.spacing.sm,
    marginLeft: -Theme.spacing.sm,
  },
  headerContent: {
    flex: 1,
    marginLeft: Theme.spacing.sm,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.titlecolor,
  },
  headerSubtitle: {
    fontSize: 14,
    color: Colors.subtitlecolor,
    marginTop: 2,
  },
  appInfoCard: {
    alignItems: 'center',
    paddingVertical: Theme.spacing.xl,
    marginHorizontal: Theme.spacing.lg,
    backgroundColor: Colors.cardbackground,
    borderRadius: Theme.radius.lg,
  },
  appLogo: {
    width: 150,
    height: 150,
    marginBottom: Theme.spacing.sm,
  },
  appName: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.titlecolor,
    marginBottom: 4,
  },
  appTagline: {
    fontSize: 14,
    color: Colors.subtitlecolor,
    marginBottom: Theme.spacing.sm,
  },
  appVersion: {
    fontSize: 12,
    color: Colors.subtitlecolor,
    opacity: 0.8,
  },
  linkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.bordercolor,
  },
  linkIcon: {
    width: 40,
    height: 40,
    borderRadius: Theme.radius.md,
    backgroundColor: Colors.cardbackground,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Theme.spacing.md,
  },
  linkContent: {
    flex: 1,
  },
  linkTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.titlecolor,
  },
  linkSubtitle: {
    fontSize: 14,
    color: Colors.subtitlecolor,
    marginTop: 2,
  },
  developerCard: {
    alignItems: 'center',
    padding: Theme.spacing.lg,
  },
  developerText: {
    fontSize: 14,
    color: Colors.titlecolor,
    marginBottom: 4,
  },
  copyrightText: {
    fontSize: 12,
    color: Colors.subtitlecolor,
  },
  rateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Theme.spacing.sm,
    backgroundColor: Colors.iconbackground,
    marginHorizontal: Theme.spacing.lg,
    paddingVertical: Theme.spacing.md,
    borderRadius: Theme.radius.pill,
  },
  rateButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textwhite,
  },
});

export default AboutScreen;
