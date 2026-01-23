import React, { useState } from 'react';
import { Text, TouchableOpacity, StyleSheet, View, TextInput, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AppScreen from '../../components/ui/AppScreen';
import AppCard from '../../components/ui/AppCard';
import Colors from '../../constants/Colors';
import Theme from '../../constants/Theme';
import { useRole } from '../../context/RoleContext';
import { acceptInvite } from '../../services/api';

const InviteCodeScreen = ({ navigation }) => {
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const { inferRole } = useRole();

  const handleSubmitCode = async () => {
    if (!inviteCode.trim()) return;

    setLoading(true);
    try {
      const response = await acceptInvite(inviteCode.trim());
      const inviteData = response.data;

      // Infer role based on invite response
      const inviteScope = inviteData.role === 'guest' ? 'limited' : 'family';

      inferRole({
        type: 'invite_accepted',
        inviteScope,
        inviteCode: inviteCode.trim(),
        lockId: inviteData.lock_id
      });

      Alert.alert(
        'Invite Accepted!',
        `You now have access to ${inviteData.lock?.name || 'the lock'}`,
        [
          {
            text: 'Continue',
            onPress: () => navigation.navigate('Consumer')
          }
        ]
      );
    } catch (error) {
      console.error('Failed to accept invite:', error);
      Alert.alert(
        'Invalid Invite Code',
        error.response?.data?.error?.message || 'The invite code is invalid or has expired. Please check the code and try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handlePasteLink = () => {
    // TODO: Implement paste from clipboard and parse magic link
    setInviteCode('AWAKEY-DEMO-INVITE-123');
  };

  return (
    <AppScreen contentContainerStyle={styles.content}>
      <View style={styles.heroBlock}>
        <Text style={styles.heroBadge}>Access invitation</Text>
        <Text style={styles.heroTitle}>Enter your invite code</Text>
        <Text style={styles.heroSubtitle}>
          Your code comes from a family member or your building.
        </Text>
      </View>

      <AppCard style={styles.formCard}>
        <View style={styles.inputSection}>
          <Text style={styles.inputLabel}>Invite code or link</Text>
          <TextInput
            style={styles.textInput}
            value={inviteCode}
            onChangeText={setInviteCode}
            placeholder="Enter code or paste link here"
            placeholderTextColor={Colors.subtitlecolor}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View style={styles.buttonGroup}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleSubmitCode}
            activeOpacity={0.9}
            disabled={!inviteCode.trim() || loading}
          >
            {loading ? (
              <ActivityIndicator color={Colors.textwhite} />
            ) : (
              <>
                <Text style={[
                  styles.primaryButtonText,
                  !inviteCode.trim() && styles.disabledText
                ]}>
                  Continue
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={!inviteCode.trim() ? Colors.subtitlecolor : Colors.textwhite}
                  style={styles.primaryButtonIcon}
                />
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={handlePasteLink}
            activeOpacity={0.9}
          >
            <Ionicons name="clipboard-outline" size={18} color={Colors.iconbackground} />
            <Text style={styles.secondaryButtonText}>Paste link</Text>
          </TouchableOpacity>
        </View>
      </AppCard>

      <AppCard style={styles.helpCard}>
        <View style={styles.helpHeader}>
          <View style={styles.helpIconWrap}>
            <Ionicons name="information-circle-outline" size={20} color={Colors.iconbackground} />
          </View>
          <Text style={styles.helpTitle}>Need help?</Text>
        </View>
        <Text style={styles.helpText}>
          • Codes are usually 6-12 characters long{'\n'}
          • Links start with "awakey.com/invite/"{'\n'}
          • Contact the person who invited you if the code doesn't work
        </Text>
      </AppCard>
    </AppScreen>
  );
};

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: Theme.spacing.lg,
    paddingTop: 64,
    paddingBottom: Theme.spacing.xl,
    gap: Theme.spacing.lg,
  },
  heroBlock: {
    backgroundColor: Colors.cardbackground,
    borderRadius: 24,
    padding: Theme.spacing.xl,
    gap: Theme.spacing.sm,
  },
  heroBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.textwhite,
    color: Colors.iconbackground,
    fontWeight: '700',
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.xs,
    borderRadius: Theme.radius.pill,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.titlecolor,
  },
  heroSubtitle: {
    ...Theme.typography.subtitle,
    lineHeight: 22,
  },
  formCard: {
    padding: Theme.spacing.xl,
    gap: Theme.spacing.lg,
  },
  inputSection: {
    gap: Theme.spacing.sm,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.titlecolor,
  },
  textInput: {
    backgroundColor: Colors.background,
    borderRadius: Theme.radius.md,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
    fontSize: 16,
    color: Colors.titlecolor,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  buttonGroup: {
    gap: Theme.spacing.md,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.iconbackground,
    paddingVertical: Theme.spacing.sm,
    borderRadius: Theme.radius.pill,
  },
  primaryButtonText: {
    color: Colors.textwhite,
    fontSize: 16,
    fontWeight: '600',
  },
  disabledText: {
    color: Colors.subtitlecolor,
  },
  primaryButtonIcon: {
    marginLeft: Theme.spacing.xs,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: Colors.iconbackground,
    paddingVertical: Theme.spacing.sm,
    borderRadius: Theme.radius.pill,
    gap: Theme.spacing.xs,
  },
  secondaryButtonText: {
    color: Colors.iconbackground,
    fontSize: 16,
    fontWeight: '600',
  },
  helpCard: {
    padding: Theme.spacing.lg,
    gap: Theme.spacing.md,
  },
  helpHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  helpIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  helpTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.titlecolor,
  },
  helpText: {
    ...Theme.typography.subtitle,
    fontSize: 14,
    lineHeight: 20,
  },
});

export default InviteCodeScreen;