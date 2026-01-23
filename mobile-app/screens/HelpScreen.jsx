import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AppScreen from '../components/ui/AppScreen';
import { SimpleModeCard, SimpleModeText, SimpleModeButton, VoiceHelperButton } from '../components/ui/SimpleMode';
import Colors from '../constants/Colors';
import Theme from '../constants/Theme';
import { useRole } from '../context/RoleContext';

const HelpScreen = ({ navigation }) => {
  const { role, isSimpleMode } = useRole();
  const isGuest = role === 'guest';

  const handleCallFamily = () => {
    Alert.alert(
      'Call Family Member',
      'Would you like to call your emergency contact?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Call',
          onPress: () => {
            // TODO: Get actual emergency contact number
            const phoneNumber = 'tel:+1234567890';
            Linking.openURL(phoneNumber).catch(() => {
              Alert.alert('Error', 'Unable to make phone call');
            });
          }
        }
      ]
    );
  };

  const handleCallSupport = () => {
    Alert.alert(
      'Call Support',
      'Would you like to call Awakey Support?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Call',
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

  const handleOpenGlossary = () => {
    navigation.navigate('Glossary');
  };

  const handleTroubleshooting = () => {
    // TODO: Create dedicated troubleshooting screen
    Alert.alert('Troubleshooting', 'Common fixes:\n\n• Move closer to the door\n• Check battery level\n• Restart the app\n• Call support if problems persist');
  };

  const handleEmergencyHelp = () => {
    Alert.alert(
      'Emergency Help',
      'Are you locked out or experiencing an emergency?',
      [
        { text: 'No, just need help', style: 'cancel' },
        { text: 'Yes, I need emergency help', onPress: handleCallFamily }
      ]
    );
  };

  return (
    <AppScreen contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={24} color={Colors.titlecolor} />
        </TouchableOpacity>
        <SimpleModeText variant="heading" style={styles.headerTitle}>
          Get Help
        </SimpleModeText>
      </View>

      <VoiceHelperButton text="Help screen with options to call family, get support, or learn about features." />

      {/* Emergency Actions for Guests */}
      {isGuest && (
        <SimpleModeCard style={styles.emergencyCard}>
          <View style={styles.emergencyHeader}>
            <View style={styles.emergencyIconWrap}>
              <Ionicons name="alert-circle-outline" size={24} color="#FF5722" />
            </View>
            <SimpleModeText variant="title" style={styles.emergencyTitle}>
              Need immediate help?
            </SimpleModeText>
          </View>

          <SimpleModeButton
            onPress={handleEmergencyHelp}
            style={styles.emergencyButton}
            icon="call-outline"
          >
            I'm locked out or need emergency help
          </SimpleModeButton>
        </SimpleModeCard>
      )}

      {/* Primary Help Actions */}
      <View style={styles.actionsGrid}>
        <TouchableOpacity onPress={handleCallFamily} activeOpacity={0.9}>
          <SimpleModeCard style={styles.actionCard}>
            <View style={[styles.actionIconWrap, { backgroundColor: '#4CAF50' }]}>
              <Ionicons name="people-outline" size={28} color={Colors.textwhite} />
            </View>
            <SimpleModeText variant="title" style={styles.actionTitle}>
              Call a family member
            </SimpleModeText>
            <SimpleModeText style={styles.actionDescription}>
              {isGuest ? 'Contact your host' : 'Call your emergency contact'}
            </SimpleModeText>
          </SimpleModeCard>
        </TouchableOpacity>

        <TouchableOpacity onPress={handleCallSupport} activeOpacity={0.9}>
          <SimpleModeCard style={styles.actionCard}>
            <View style={[styles.actionIconWrap, { backgroundColor: '#2196F3' }]}>
              <Ionicons name="headset-outline" size={28} color={Colors.textwhite} />
            </View>
            <SimpleModeText variant="title" style={styles.actionTitle}>
              Call Support
            </SimpleModeText>
            <SimpleModeText style={styles.actionDescription}>
              Technical help from Awakey
            </SimpleModeText>
          </SimpleModeCard>
        </TouchableOpacity>
      </View>

      {/* Learning Resources */}
      <SimpleModeCard style={styles.resourcesCard}>
        <SimpleModeText variant="title" style={styles.resourcesTitle}>
          Learn more
        </SimpleModeText>

        <View style={styles.resourcesList}>
          <TouchableOpacity
            style={styles.resourceItem}
            onPress={handleOpenGlossary}
            activeOpacity={0.7}
          >
            <View style={styles.resourceIconWrap}>
              <Ionicons name="book-outline" size={20} color={Colors.iconbackground} />
            </View>
            <View style={styles.resourceContent}>
              <SimpleModeText style={styles.resourceItemTitle}>
                What do these words mean?
              </SimpleModeText>
              <SimpleModeText style={styles.resourceItemDescription}>
                Simple explanations with pictures
              </SimpleModeText>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.subtitlecolor} />
          </TouchableOpacity>

          {!isGuest && (
            <TouchableOpacity
              style={styles.resourceItem}
              onPress={handleTroubleshooting}
              activeOpacity={0.7}
            >
              <View style={styles.resourceIconWrap}>
                <Ionicons name="build-outline" size={20} color={Colors.iconbackground} />
              </View>
              <View style={styles.resourceContent}>
                <SimpleModeText style={styles.resourceItemTitle}>
                  Fix common problems
                </SimpleModeText>
                <SimpleModeText style={styles.resourceItemDescription}>
                  Step-by-step guides
                </SimpleModeText>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.subtitlecolor} />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.resourceItem}
            onPress={() => {
              // TODO: Implement voice tutorial
              Alert.alert('Voice Tutorial', 'This feature will guide you through using the app with spoken instructions.');
            }}
            activeOpacity={0.7}
          >
            <View style={styles.resourceIconWrap}>
              <Ionicons name="volume-high-outline" size={20} color={Colors.iconbackground} />
            </View>
            <View style={styles.resourceContent}>
              <SimpleModeText style={styles.resourceItemTitle}>
                Voice tutorial
              </SimpleModeText>
              <SimpleModeText style={styles.resourceItemDescription}>
                Listen to instructions
              </SimpleModeText>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.subtitlecolor} />
          </TouchableOpacity>
        </View>
      </SimpleModeCard>

      {/* Quick Tips */}
      <SimpleModeCard style={styles.tipsCard}>
        <View style={styles.tipsHeader}>
          <View style={styles.tipsIconWrap}>
            <Ionicons name="bulb-outline" size={20} color={Colors.iconbackground} />
          </View>
          <SimpleModeText variant="title" style={styles.tipsTitle}>
            Quick tips
          </SimpleModeText>
        </View>

        <View style={styles.tipsList}>
          <SimpleModeText style={styles.tipItem}>
            💡 {isGuest
              ? 'Your access code works during your scheduled hours'
              : 'Tap and hold buttons for extra options'
            }
          </SimpleModeText>
          <SimpleModeText style={styles.tipItem}>
            🔋 {isGuest
              ? 'If the door won\'t open, the batteries might be low'
              : 'Check battery status in the door card'
            }
          </SimpleModeText>
          <SimpleModeText style={styles.tipItem}>
            📱 {isGuest
              ? 'Keep your phone close to the door when unlocking'
              : 'You can use the app even without internet'
            }
          </SimpleModeText>
        </View>
      </SimpleModeCard>

      {/* Contact Information */}
      <SimpleModeCard style={styles.contactCard}>
        <SimpleModeText variant="title" style={styles.contactTitle}>
          Contact Information
        </SimpleModeText>
        <View style={styles.contactInfo}>
          <SimpleModeText style={styles.contactItem}>
            📞 Support: 1-800-AWAKEY
          </SimpleModeText>
          <SimpleModeText style={styles.contactItem}>
            🌐 Website: awakey.com/help
          </SimpleModeText>
          {isGuest && (
            <SimpleModeText style={styles.contactItem}>
              👥 Your host: Tap "Call family member" above
            </SimpleModeText>
          )}
        </View>
      </SimpleModeCard>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
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
    flex: 1,
  },
  emergencyCard: {
    padding: Theme.spacing.xl,
    gap: Theme.spacing.lg,
    backgroundColor: '#FFEBEE',
    borderWidth: 2,
    borderColor: '#FF5722',
  },
  emergencyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.md,
  },
  emergencyIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 87, 34, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emergencyTitle: {
    color: '#FF5722',
    flex: 1,
  },
  emergencyButton: {
    backgroundColor: '#FF5722',
  },
  actionsGrid: {
    flexDirection: 'row',
    gap: Theme.spacing.md,
  },
  actionCard: {
    flex: 1,
    padding: Theme.spacing.lg,
    gap: Theme.spacing.sm,
    alignItems: 'center',
  },
  actionIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Theme.spacing.xs,
  },
  actionTitle: {
    textAlign: 'center',
    fontSize: 16,
  },
  actionDescription: {
    textAlign: 'center',
    fontSize: 13,
    opacity: 0.8,
  },
  resourcesCard: {
    padding: Theme.spacing.lg,
    gap: Theme.spacing.md,
  },
  resourcesTitle: {
    fontSize: 18,
  },
  resourcesList: {
    gap: Theme.spacing.sm,
  },
  resourceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
    paddingHorizontal: Theme.spacing.sm,
    borderRadius: Theme.radius.md,
    backgroundColor: Colors.background,
    minHeight: Theme.accessibility.minTouchTarget,
  },
  resourceIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resourceContent: {
    flex: 1,
    gap: 2,
  },
  resourceItemTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  resourceItemDescription: {
    fontSize: 13,
    opacity: 0.7,
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
    gap: Theme.spacing.sm,
  },
  tipItem: {
    fontSize: 14,
    lineHeight: 20,
  },
  contactCard: {
    padding: Theme.spacing.lg,
    gap: Theme.spacing.md,
    backgroundColor: Colors.background,
  },
  contactTitle: {
    fontSize: 16,
  },
  contactInfo: {
    gap: Theme.spacing.xs,
  },
  contactItem: {
    fontSize: 14,
    lineHeight: 20,
  },
});

export default HelpScreen;