import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AppScreen from '../components/ui/AppScreen';
import AppCard from '../components/ui/AppCard';
import Section from '../components/ui/Section';
import Colors from '../constants/Colors';
import Theme from '../constants/Theme';

const HelpSupportScreen = ({ navigation }) => {
  const handleContactSupport = () => {
    Linking.openURL('mailto:sales@jainsonlocks.com?subject=Awakey App Support Request');
  };

  const handleOpenChat = () => {
    // Open WhatsApp chat with support number (+91 90010 77861)
    Linking.openURL('https://wa.me/919001077861').catch(() => {
      Alert.alert('Error', 'Unable to open WhatsApp. Please ensure WhatsApp is installed.');
    });
  };

  const faqItems = [
    {
      question: 'How do I add a new lock?',
      answer: 'Go to Home screen, tap the + button, and follow the pairing instructions. Make sure Bluetooth is enabled.'
    },
    {
      question: 'Why is my lock showing offline?',
      answer: 'The lock may be out of Bluetooth range. Move closer to the lock or check if it needs new batteries.'
    },
    {
      question: 'How do I share access with guests?',
      answer: 'Open a lock, tap "Send eKey" or "Send Code", and enter the guest\'s details.'
    },
    {
      question: 'What happens if I lose my phone?',
      answer: 'Use your recovery keys to regain access. You can also log in from another device.'
    },
  ];

  const renderMenuItem = (icon, title, subtitle, onPress) => (
    <TouchableOpacity style={styles.menuItem} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.menuIcon}>
        <Ionicons name={icon} size={20} color={Colors.iconbackground} />
      </View>
      <View style={styles.menuContent}>
        <Text style={styles.menuTitle}>{title}</Text>
        {subtitle && <Text style={styles.menuSubtitle}>{subtitle}</Text>}
      </View>
      <Ionicons name="chevron-forward" size={20} color={Colors.subtitlecolor} />
    </TouchableOpacity>
  );

  return (
    <AppScreen contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={Colors.titlecolor} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Help & Support</Text>
          <Text style={styles.headerSubtitle}>Get assistance</Text>
        </View>
      </View>

      <Section title="Contact Us" gapless>
        <AppCard padding="none">
          {renderMenuItem('mail-outline', 'Email Support', 'sales@jainsonlocks.com', handleContactSupport)}
          {renderMenuItem('chatbubble-outline', 'Live Chat', 'Available Mon-Sat, 10am-7pm', handleOpenChat)}
          {renderMenuItem('call-outline', 'Phone Support', '1800 270 0274 (toll free)', () => Linking.openURL('tel:18002700274'))}
        </AppCard>
      </Section>

      <Section title="Resources" gapless>
        <AppCard padding="none">
          {renderMenuItem('videocam-outline', 'Video Tutorials', 'Learn How To Set & use Awakey App', () => Linking.openURL('https://youtu.be/11EPZtXfCCs?si=6vanLD-td1N5LaCH').catch(() => Alert.alert('Error', 'Unable to open video.')))}
          {renderMenuItem('document-text-outline', 'User Guide', 'Complete documentation', () => Linking.openURL('https://awakey.bettermode.io/current-feature-set-dcxpgzts').catch(() => Alert.alert('Error', 'Unable to open page.')))}
        </AppCard>
      </Section>

      <Section title="Quick Answers" gapless>
        <AppCard style={styles.faqCard}>
          {faqItems.map((item, index) => (
            <View key={index} style={[styles.faqItem, index < faqItems.length - 1 && styles.faqItemBorder]}>
              <Text style={styles.faqQuestion}>{item.question}</Text>
              <Text style={styles.faqAnswer}>{item.answer}</Text>
            </View>
          ))}
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
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.bordercolor,
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: Theme.radius.md,
    backgroundColor: Colors.cardbackground,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Theme.spacing.md,
  },
  menuContent: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.titlecolor,
  },
  menuSubtitle: {
    fontSize: 14,
    color: Colors.subtitlecolor,
    marginTop: 2,
  },
  faqCard: {
    padding: Theme.spacing.md,
  },
  faqItem: {
    paddingVertical: Theme.spacing.md,
  },
  faqItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.bordercolor,
  },
  faqQuestion: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.titlecolor,
    marginBottom: Theme.spacing.xs,
  },
  faqAnswer: {
    fontSize: 14,
    color: Colors.subtitlecolor,
    lineHeight: 20,
  },
});

export default HelpSupportScreen;
