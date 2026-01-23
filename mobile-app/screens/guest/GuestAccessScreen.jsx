import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AppScreen from "../../components/ui/AppScreen";
import { useRole } from "../../context/RoleContext";
import Section from "../../components/ui/Section";
import AppCard from "../../components/ui/AppCard";
import Colors from "../../constants/Colors";
import Theme from "../../constants/Theme";
import { getAccessCodes } from "../../services/api";

const GuestAccessScreen = ({ route, navigation }) => {
  const { setRole } = useRole();
  const { lockId } = route.params || {};

  const [loading, setLoading] = useState(true);
  const [guestCode, setGuestCode] = useState(null);
  const [unlocking, setUnlocking] = useState(false);

  useEffect(() => {
    if (lockId) {
      loadGuestCode();
    } else {
      Alert.alert('Error', 'No lock ID provided');
      setLoading(false);
    }
  }, [lockId]);

  const loadGuestCode = async () => {
    setLoading(true);
    try {
      const response = await getAccessCodes(lockId);
      const codes = response.data || [];

      // Find active guest code (temporary code that hasn't expired)
      const now = new Date();
      const activeCode = codes.find(code => {
        if (!code.expires_at) return false;
        const expiry = new Date(code.expires_at);
        return expiry > now && code.type === 'temporary';
      });

      if (activeCode) {
        setGuestCode(activeCode);
      } else {
        Alert.alert(
          'No Active Code',
          'You don\'t have an active guest code. Please contact the property owner.'
        );
      }
    } catch (error) {
      console.error('Failed to load guest code:', error);
      Alert.alert('Error', 'Failed to load your guest access code');
    } finally {
      setLoading(false);
    }
  };

  const handleUnlock = async () => {
    if (!guestCode) {
      Alert.alert('Error', 'No active guest code available');
      return;
    }

    setUnlocking(true);
    try {
      // In a real implementation, this would trigger the unlock via the guest code
      // For now, show a message
      Alert.alert(
        'Code Ready',
        `Enter code ${guestCode.code} on the lock keypad to unlock.`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to use guest code');
    } finally {
      setUnlocking(false);
    }
  };

  const getTimeRemaining = () => {
    if (!guestCode || !guestCode.expires_at) return 'N/A';

    const now = new Date();
    const expiry = new Date(guestCode.expires_at);
    const diff = expiry - now;

    if (diff <= 0) return 'Expired';

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    return `${hours}h ${minutes}m`;
  };

  if (loading) {
    return (
      <AppScreen contentContainerStyle={[styles.content, styles.centerContent]}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading your guest code...</Text>
      </AppScreen>
    );
  }

  if (!guestCode) {
    return (
      <AppScreen contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() => setRole("auth")}
            style={styles.backButton}
          >
            <Ionicons name="chevron-back" size={24} color={Colors.titlecolor} />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>Guest pass</Text>
            <Text style={styles.headerSubtitle}>No active code</Text>
          </View>
        </View>

        <Section gapless>
          <AppCard style={styles.emptyCard}>
            <Ionicons name="alert-circle-outline" size={60} color={Colors.subtitlecolor} />
            <Text style={styles.emptyTitle}>No Active Guest Code</Text>
            <Text style={styles.emptySubtitle}>
              You don't have an active guest access code at this time. Please contact the property owner to request access.
            </Text>
          </AppCard>
        </Section>
      </AppScreen>
    );
  }

  return (
    <AppScreen contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <TouchableOpacity
          onPress={() => setRole("auth")}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={24} color={Colors.titlecolor} />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Guest pass</Text>
          <Text style={styles.headerSubtitle}>
            Welcome! Use the code below for entry
          </Text>
        </View>
      </View>

      <Section gapless>
        <AppCard style={styles.card}>
          <Text style={styles.codeLabel}>Your access code</Text>
          <Text style={styles.codeValue}>{guestCode.code}</Text>
          <Text style={styles.codeExpiry}>Expires in {getTimeRemaining()}</Text>
          <TouchableOpacity
            style={[styles.primaryButton, unlocking && styles.primaryButtonDisabled]}
            onPress={handleUnlock}
            disabled={unlocking}
          >
            {unlocking ? (
              <ActivityIndicator color={Colors.textwhite} />
            ) : (
              <Text style={styles.primaryButtonText}>Use code to unlock</Text>
            )}
          </TouchableOpacity>
        </AppCard>
      </Section>

      <Section title="Need help?">
        <AppCard>
          <Text style={styles.helpText}>
            • Stand close to the door before using the code.{"\n"}
            • Enter the code on the lock keypad.{"\n"}
            • If the lock is offline, contact your host via the app.{"\n"}
            • Require assistance? Tap below for full troubleshooting.
          </Text>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => navigation.navigate("GuestHelp")}
          >
            <Text style={styles.secondaryText}>View instructions</Text>
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
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: Theme.spacing.md,
    fontSize: 16,
    color: Colors.subtitlecolor,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Theme.spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.bordercolor,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: Colors.titlecolor,
  },
  headerSubtitle: {
    ...Theme.typography.subtitle,
  },
  card: {
    alignItems: "center",
    gap: Theme.spacing.md,
  },
  emptyCard: {
    alignItems: "center",
    gap: Theme.spacing.md,
    paddingVertical: Theme.spacing.xl * 2,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: Colors.titlecolor,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.subtitlecolor,
    textAlign: "center",
    lineHeight: 20,
  },
  codeLabel: {
    ...Theme.typography.subtitle,
  },
  codeValue: {
    fontSize: 42,
    fontWeight: "700",
    color: Colors.iconbackground,
    letterSpacing: 8,
    fontFamily: 'monospace',
  },
  codeExpiry: {
    ...Theme.typography.caption,
    color: Colors.subtitlecolor,
  },
  primaryButton: {
    backgroundColor: Colors.iconbackground,
    borderRadius: Theme.radius.pill,
    paddingVertical: Theme.spacing.sm,
    paddingHorizontal: Theme.spacing.xl,
    minWidth: 200,
    alignItems: 'center',
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: Colors.textwhite,
    fontWeight: "600",
  },
  helpText: {
    ...Theme.typography.subtitle,
    lineHeight: 20,
  },
  secondaryButton: {
    marginTop: Theme.spacing.md,
    borderRadius: Theme.radius.pill,
    borderWidth: 1,
    borderColor: Colors.iconbackground,
    paddingVertical: Theme.spacing.sm,
    alignItems: "center",
  },
  secondaryText: {
    color: Colors.iconbackground,
    fontWeight: "600",
  },
});

export default GuestAccessScreen;
