import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Header from '../../components/Header';
import AppScreen from '../../components/ui/AppScreen';
import Section from '../../components/ui/Section';
import AppCard from '../../components/ui/AppCard';
import QuickActionButton from '../../components/QuickActionButton';
import ActivityItem from '../../components/ActivityItem';
import Theme from '../../constants/Theme';
import { getRecentActivity } from '../../services/api';
import Colors from '../../constants/Colors';

const shortcuts = [
  {
    id: 'liveView',
    title: 'Live view',
    subtitle: "Check who's outside",
    icon: 'videocam-outline',
    target: 'LiveView'
  },
  {
    id: 'sendCode',
    title: 'Share code',
    subtitle: 'Invite a guest',
    icon: 'keypad-outline',
    target: 'SendCode'
  }
];

const FamilyHomeScreen = ({ navigation }) => {
  const [activities, setActivities] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const response = await getRecentActivity();
        setActivities(response.data);
      } catch (err) {
        setError("Failed to load recent activity.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const goToSettings = () => {
    navigation.navigate('FamilySettings');
  };

  return (
    <AppScreen contentContainerStyle={styles.content}>
      <Header
        title="Hi Sarah"
        subtitle="Quick access to your home"
        showMenu={false}
        showNotification={false}
        showProfile={true}
        onProfilePress={goToSettings}
      />

      <Section title="Quick shortcuts">
        <View style={styles.shortcutRow}>
          {shortcuts.map(action => (
            <QuickActionButton
              key={action.id}
              action={action}
              style={styles.shortcutItem}
              onPress={() => navigation.navigate(action.target)}
            />
          ))}
        </View>
      </Section>

      <Section title="Recent activity" subtitle="Your personal history">
        <AppCard padding="none" elevated={false}>
          {isLoading && <Text style={styles.loadingText}>Loading activity...</Text>}
          {error && <Text style={styles.errorText}>{error}</Text>}
          {!isLoading && !error && activities.slice(0, 5).map((activity) => (
            <ActivityItem key={activity.id} activity={activity} />
          ))}
        </AppCard>
      </Section>
    </AppScreen>
  );
};

const styles = StyleSheet.create({
  content: {
    paddingBottom: Theme.spacing.xl,
    gap: Theme.spacing.lg,
  },
  loadingText: {
    textAlign: 'center',
    padding: Theme.spacing.lg,
    color: Colors.subtitlecolor,
  },
  errorText: {
    textAlign: 'center',
    padding: Theme.spacing.lg,
    color: 'red',
  },
  shortcutRow: {
    flexDirection: 'row',
    gap: Theme.spacing.md,
  },
  shortcutItem: {
    flex: 1,
  },
});

export default FamilyHomeScreen;
