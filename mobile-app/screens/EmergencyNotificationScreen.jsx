import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Linking, Vibration, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AppScreen from '../components/ui/AppScreen';
import { SimpleModeCard, SimpleModeText, SimpleModeButton, VoiceHelperButton } from '../components/ui/SimpleMode';
import Colors from '../constants/Colors';
import Theme from '../constants/Theme';
import { getTrustedContacts, sendEmergencyAlert } from '../services/api';

const EmergencyNotificationScreen = ({ navigation, route }) => {
  const { lockoutCount = 2, doorName = 'Front Door', lockId } = route.params || {};
  const [isCallingContact, setIsCallingContact] = useState(false);
  const [contactCalled, setContactCalled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [emergencyContact, setEmergencyContact] = useState(null);
  const [alertSent, setAlertSent] = useState(false);

  useEffect(() => {
    // Vibrate phone to get attention
    Vibration.vibrate([0, 500, 200, 500]);

    // Load trusted contacts and send alert
    loadEmergencyContact();
  }, []);

  const loadEmergencyContact = async () => {
    try {
      const response = await getTrustedContacts();
      const contacts = response.data || [];

      // Find primary contact or first contact
      const primaryContact = contacts.find(c => c.is_primary) || contacts[0];
      setEmergencyContact(primaryContact);

      // Automatically send emergency alert to all trusted contacts
      if (lockId && contacts.length > 0) {
        await sendEmergencyAlert(lockId, {
          reason: 'lockout',
          lockout_count: lockoutCount,
          door_name: doorName,
        });
        setAlertSent(true);
      }
    } catch (error) {
      console.error('Failed to load trusted contacts or send alert:', error);
      Alert.alert('Warning', 'Could not notify your trusted contacts. You can still call them manually.');
    } finally {
      setLoading(false);
    }
  };

  const handleCallEmergencyContact = () => {
    setIsCallingContact(true);

    Alert.alert(
      `Call ${emergencyContact.name}?`,
      `This will call ${emergencyContact.phone} for emergency help.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => setIsCallingContact(false)
        },
        {
          text: 'Call Now',
          onPress: () => {
            const phoneUrl = `tel:${emergencyContact.phone.replace(/[^\d+]/g, '')}`;
            Linking.openURL(phoneUrl)
              .then(() => {
                setContactCalled(true);
                setIsCallingContact(false);
              })
              .catch(() => {
                Alert.alert('Error', 'Unable to make phone call');
                setIsCallingContact(false);
              });
          }
        }
      ]
    );
  };

  const handleCallSupport = () => {
    Alert.alert(
      'Call Awakey Support?',
      'This will call technical support for immediate help.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Call Support',
          onPress: () => {
            const supportNumber = 'tel:+1800AWAKEY';
            Linking.openURL(supportNumber).catch(() => {
              Alert.alert('Error', 'Unable to make phone call');
            });
          }
        }
      ]
    );
  };

  const handleTryAgain = () => {
    navigation.goBack();
  };

  const handleDismiss = () => {
    Alert.alert(
      'Dismiss Alert?',
      'Are you sure you no longer need emergency help?',
      [
        { text: 'Keep Alert', style: 'cancel' },
        {
          text: 'Dismiss',
          onPress: () => navigation.goBack()
        }
      ]
    );
  };

  if (loading) {
    return (
      <AppScreen contentContainerStyle={[styles.content, styles.centerContent]}>
        <ActivityIndicator size="large" color="#FF5722" />
        <SimpleModeText style={styles.loadingText}>Loading emergency contacts...</SimpleModeText>
      </AppScreen>
    );
  }

  if (!emergencyContact) {
    return (
      <AppScreen contentContainerStyle={styles.content}>
        <SimpleModeCard style={styles.emergencyHeader}>
          <View style={styles.emergencyIconWrap}>
            <Ionicons name="alert-circle" size={48} color="#FF5722" />
          </View>
          <SimpleModeText variant="heading" style={styles.emergencyTitle}>
            No Emergency Contacts
          </SimpleModeText>
          <SimpleModeText style={styles.emergencyDescription}>
            You haven't set up any trusted contacts yet.
          </SimpleModeText>
        </SimpleModeCard>

        <SimpleModeButton
          onPress={() => navigation.navigate('TrustedContacts')}
          icon="person-add-outline"
        >
          Add Trusted Contact
        </SimpleModeButton>

        <SimpleModeButton
          onPress={handleCallSupport}
          icon="headset-outline"
          style={{ backgroundColor: Colors.iconbackground }}
        >
          Call Awakey Support
        </SimpleModeButton>
      </AppScreen>
    );
  }

  return (
    <AppScreen contentContainerStyle={styles.content}>
      {/* Emergency Header */}
      {alertSent && (
        <SimpleModeCard style={styles.alertSentCard}>
          <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
          <SimpleModeText style={styles.alertSentText}>
            Emergency alert sent to your trusted contacts
          </SimpleModeText>
        </SimpleModeCard>
      )}

      <SimpleModeCard style={styles.emergencyHeader}>
        <View style={styles.emergencyIconWrap}>
          <Ionicons name="alert-circle" size={48} color="#FF5722" />
        </View>
        <SimpleModeText variant="heading" style={styles.emergencyTitle}>
          You've been locked out
        </SimpleModeText>
        <SimpleModeText style={styles.emergencyDescription}>
          You've tried to unlock {doorName} {lockoutCount} times without success.
          We're here to help you get back inside safely.
        </SimpleModeText>
      </SimpleModeCard>

      <VoiceHelperButton text="You've been locked out. We can call your family member or support for help." />

      {/* Emergency Actions */}
      <View style={styles.actionsContainer}>
        <SimpleModeText variant="title" style={styles.actionsTitle}>
          Get help immediately
        </SimpleModeText>

        {/* Call Emergency Contact */}
        <TouchableOpacity
          onPress={handleCallEmergencyContact}
          disabled={isCallingContact}
          activeOpacity={0.9}
        >
          <SimpleModeCard style={[styles.emergencyActionCard, styles.primaryAction]}>
            <View style={styles.actionHeader}>
              <View style={styles.primaryIconWrap}>
                <Ionicons name="call" size={32} color={Colors.textwhite} />
              </View>
              <View style={styles.actionContent}>
                <SimpleModeText variant="title" style={styles.primaryActionTitle}>
                  Call {emergencyContact.name}
                </SimpleModeText>
                <SimpleModeText style={styles.primaryActionDescription}>
                  {emergencyContact.phone} • {emergencyContact.relationship}
                </SimpleModeText>
                {contactCalled && (
                  <View style={styles.calledIndicator}>
                    <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
                    <Text style={styles.calledText}>Called ✓</Text>
                  </View>
                )}
              </View>
            </View>
          </SimpleModeCard>
        </TouchableOpacity>

        {/* Call Support */}
        <TouchableOpacity onPress={handleCallSupport} activeOpacity={0.9}>
          <SimpleModeCard style={styles.emergencyActionCard}>
            <View style={styles.actionHeader}>
              <View style={styles.actionIconWrap}>
                <Ionicons name="headset-outline" size={28} color={Colors.textwhite} />
              </View>
              <View style={styles.actionContent}>
                <SimpleModeText variant="title" style={styles.actionTitle}>
                  Call Awakey Support
                </SimpleModeText>
                <SimpleModeText style={styles.actionDescription}>
                  Technical help • 1-800-AWAKEY
                </SimpleModeText>
              </View>
            </View>
          </SimpleModeCard>
        </TouchableOpacity>
      </View>

      {/* Try Again Option */}
      <SimpleModeCard style={styles.tryAgainCard}>
        <SimpleModeText variant="title" style={styles.tryAgainTitle}>
          Want to try unlocking again?
        </SimpleModeText>
        <SimpleModeText style={styles.tryAgainDescription}>
          Sometimes moving closer to the door or checking your passcode can help.
        </SimpleModeText>
        <SimpleModeButton
          onPress={handleTryAgain}
          style={styles.tryAgainButton}
          icon="refresh-outline"
        >
          Try Again
        </SimpleModeButton>
      </SimpleModeCard>

      {/* Helpful Tips */}
      <SimpleModeCard style={styles.tipsCard}>
        <View style={styles.tipsHeader}>
          <View style={styles.tipsIconWrap}>
            <Ionicons name="bulb-outline" size={20} color={Colors.iconbackground} />
          </View>
          <SimpleModeText variant="title" style={styles.tipsTitle}>
            Common solutions
          </SimpleModeText>
        </View>
        <View style={styles.tipsList}>
          <SimpleModeText style={styles.tipItem}>
            • Check if the lock battery is low (red LED)
          </SimpleModeText>
          <SimpleModeText style={styles.tipItem}>
            • Make sure you're within 10 feet of the door
          </SimpleModeText>
          <SimpleModeText style={styles.tipItem}>
            • Verify you're using the correct passcode
          </SimpleModeText>
          <SimpleModeText style={styles.tipItem}>
            • Try restarting the Awakey app
          </SimpleModeText>
        </View>
      </SimpleModeCard>

      {/* Dismiss Button */}
      <TouchableOpacity
        style={styles.dismissButton}
        onPress={handleDismiss}
        activeOpacity={0.7}
      >
        <Text style={styles.dismissButtonText}>I don't need help anymore</Text>
      </TouchableOpacity>
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
    color: '#FF5722',
    fontSize: 16,
  },
  alertSentCard: {
    padding: Theme.spacing.md,
    backgroundColor: '#E8F5E8',
    borderWidth: 1,
    borderColor: '#4CAF50',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  alertSentText: {
    color: '#4CAF50',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  emergencyHeader: {
    padding: Theme.spacing.xl,
    alignItems: 'center',
    gap: Theme.spacing.md,
    backgroundColor: '#FFEBEE',
    borderWidth: 2,
    borderColor: '#FF5722',
  },
  emergencyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 87, 34, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Theme.spacing.sm,
  },
  emergencyTitle: {
    textAlign: 'center',
    color: '#FF5722',
  },
  emergencyDescription: {
    textAlign: 'center',
    color: '#FF5722',
    fontSize: 16,
    lineHeight: 22,
  },
  actionsContainer: {
    gap: Theme.spacing.md,
  },
  actionsTitle: {
    fontSize: 20,
    textAlign: 'center',
  },
  emergencyActionCard: {
    padding: Theme.spacing.lg,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  primaryAction: {
    backgroundColor: '#FF5722',
    borderColor: '#FF5722',
  },
  actionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.md,
  },
  primaryIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.iconbackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionContent: {
    flex: 1,
    gap: 4,
  },
  primaryActionTitle: {
    color: Colors.textwhite,
    fontSize: 18,
  },
  primaryActionDescription: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 14,
  },
  actionTitle: {
    fontSize: 18,
  },
  actionDescription: {
    fontSize: 14,
    opacity: 0.8,
  },
  calledIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.xs,
    marginTop: 4,
  },
  calledText: {
    color: '#4CAF50',
    fontSize: 12,
    fontWeight: '600',
  },
  tryAgainCard: {
    padding: Theme.spacing.lg,
    gap: Theme.spacing.md,
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    borderWidth: 1,
    borderColor: '#2196F3',
  },
  tryAgainTitle: {
    textAlign: 'center',
    color: '#1976D2',
  },
  tryAgainDescription: {
    textAlign: 'center',
    color: '#1976D2',
    fontSize: 14,
  },
  tryAgainButton: {
    backgroundColor: '#2196F3',
    minWidth: 140,
  },
  tipsCard: {
    padding: Theme.spacing.lg,
    gap: Theme.spacing.md,
  },
  tipsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  tipsIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipsTitle: {
    fontSize: 16,
  },
  tipsList: {
    gap: Theme.spacing.xs,
  },
  tipItem: {
    fontSize: 14,
    lineHeight: 20,
  },
  dismissButton: {
    alignSelf: 'center',
    paddingVertical: Theme.spacing.sm,
    paddingHorizontal: Theme.spacing.lg,
    marginTop: Theme.spacing.md,
  },
  dismissButtonText: {
    color: Colors.subtitlecolor,
    fontSize: 14,
    fontWeight: '500',
  },
});

export default EmergencyNotificationScreen;