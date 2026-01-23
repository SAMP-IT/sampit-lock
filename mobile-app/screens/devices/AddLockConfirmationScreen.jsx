import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AppScreen from '../../components/ui/AppScreen';
import Section from '../../components/ui/Section';
import AppCard from '../../components/ui/AppCard';
import Colors from '../../constants/Colors';
import Theme from '../../constants/Theme';
import { useRole } from '../../context/RoleContext';

const AddLockConfirmationScreen = ({ navigation, route }) => {
  const { lockId } = route.params;
  const { inferRole } = useRole();

  useEffect(() => {
    // Infer owner role when lock is successfully added
    inferRole({ type: 'lock_added', lockId });
  }, [inferRole, lockId]);

  const handleContinueToHome = () => {
    // Trigger role change
    inferRole({ type: 'lock_added', lockId });

    // Reset navigation stack and go to Home screen
    navigation.reset({
      index: 0,
      routes: [{ name: 'ConsumerTabs' }],
    });
  };

  return (
    <AppScreen contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={Colors.titlecolor} />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Your door is ready.</Text>
          <Text style={styles.headerSubtitle}>Lock paired successfully</Text>
        </View>
      </View>

      <Section gapless>
        <AppCard style={styles.card}>
          <View style={styles.iconWrap}>
            <Ionicons name="checkmark-circle" size={36} color={Colors.iconbackground} />
          </View>
          <Text style={styles.description}>
            Your lock is now connected and ready to use. Try the big Lock/Unlock button below to test it out.
          </Text>
          <TouchableOpacity style={styles.primaryButton} onPress={handleContinueToHome}>
            <Text style={styles.primaryText}>Continue to Home</Text>
          </TouchableOpacity>
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
  card: {
    alignItems: 'center',
    gap: Theme.spacing.md,
  },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.cardbackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  description: {
    ...Theme.typography.subtitle,
    lineHeight: 20,
    textAlign: 'center',
  },
  primaryButton: {
    backgroundColor: Colors.iconbackground,
    borderRadius: Theme.radius.pill,
    paddingVertical: Theme.spacing.sm,
    paddingHorizontal: Theme.spacing.xl,
  },
  primaryText: {
    color: Colors.textwhite,
    fontWeight: '600',
  },
  secondaryButton: {
    borderRadius: Theme.radius.pill,
    borderWidth: 1,
    borderColor: Colors.iconbackground,
    paddingVertical: Theme.spacing.sm,
    paddingHorizontal: Theme.spacing.xl,
  },
  secondaryText: {
    color: Colors.iconbackground,
    fontWeight: '600',
  },
});

export default AddLockConfirmationScreen;
