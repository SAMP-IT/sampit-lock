import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AppScreen from '../../components/ui/AppScreen';
import Section from '../../components/ui/Section';
import AppCard from '../../components/ui/AppCard';
import Colors from '../../constants/Colors';
import Theme from '../../constants/Theme';
import { getSnapshots } from '../../services/api';

const LiveViewScreen = ({ navigation, route }) => {
  const { lockId } = route.params;
  const [snapshots, setSnapshots] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchSnapshots = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const response = await getSnapshots(lockId);
        setSnapshots(response.data);
      } catch (err) {
        setError("Failed to load snapshots.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchSnapshots();
  }, [lockId]);

  return (
    <AppScreen contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={Colors.titlecolor} />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Live view</Text>
          <Text style={styles.headerSubtitle}>See who is at your door right now</Text>
        </View>
      </View>

      <Section gapless>
        <AppCard style={styles.cameraCard}>
          <View style={styles.cameraFeedPlaceholder}>
            <Text style={styles.feedStatus}>Camera Feed</Text>
            <Text style={styles.feedSub}>Streaming from Main Door</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Resolution</Text>
            <Text style={styles.metaValue}>1080p</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Last motion</Text>
            <Text style={styles.metaValue}>2 min ago</Text>
          </View>
        </AppCard>
      </Section>

      <Section title="Snapshot history" subtitle="Auto-captured moments">
        <AppCard>
          {isLoading && <Text style={styles.loadingText}>Loading snapshots...</Text>}
          {error && <Text style={styles.errorText}>{error}</Text>}
          {!isLoading && !error && (
            <View style={styles.snapshotRow}>
              {snapshots.map((item) => (
                <Image key={item.id} source={{ uri: item.url }} style={styles.snapshotImage} />
              ))}
            </View>
          )}
        </AppCard>
      </Section>
    </AppScreen>
  );
};

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: Theme.spacing.lg,
    paddingTop: Theme.spacing.lg,
    paddingBottom: Theme.spacing.xl,
    gap: Theme.spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.bordercolor,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.titlecolor,
  },
  headerSubtitle: {
    ...Theme.typography.subtitle,
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
  cameraCard: {
    gap: Theme.spacing.md,
  },
  cameraFeedPlaceholder: {
    backgroundColor: Colors.cardbackground,
    borderRadius: Theme.radius.md,
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedStatus: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.titlecolor,
  },
  feedSub: {
    ...Theme.typography.subtitle,
    marginTop: Theme.spacing.xs,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metaLabel: {
    ...Theme.typography.subtitle,
  },
  metaValue: {
    fontWeight: '600',
    color: Colors.titlecolor,
  },
  snapshotRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  snapshotImage: {
    width: '30%',
    height: 80,
    borderRadius: Theme.radius.md,
  },
  snapshotPlaceholder: {
    width: '30%',
    height: 80,
    backgroundColor: Colors.cardbackground,
    borderRadius: Theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  snapshotText: {
    ...Theme.typography.caption,
  },
});

export default LiveViewScreen;
