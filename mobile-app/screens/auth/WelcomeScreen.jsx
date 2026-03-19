import React, { useState } from 'react';
import { Text, TouchableOpacity, StyleSheet, View, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AppScreen from '../../components/ui/AppScreen';
import AppCard from '../../components/ui/AppCard';
import Colors from '../../constants/Colors';
import Theme from '../../constants/Theme';
import { useRole } from '../../context/RoleContext';
import { getLogoForLightBlue } from '../../utils/logoUtils';

const features = [
  {
    icon: 'shield-outline',
    text: 'Awakey works even without internet',
  },
  {
    icon: 'lock-closed-outline',
    text: 'We protect your privacy',
  },
];

const WelcomeScreen = ({ navigation }) => {
  const [longPressCount, setLongPressCount] = useState(0);
  const { inferRole } = useRole();

  const handleInstallerActivation = () => {
    const newCount = longPressCount + 1;
    setLongPressCount(newCount);

    // Activate installer mode after 5 long presses
    if (newCount >= 5) {
      inferRole({ type: 'installer_activated' });
      // The RootNavigator will automatically switch to ServiceNavigator
      // due to role change
    }
  };

  return (
    <AppScreen contentContainerStyle={styles.content}>
      <View style={styles.heroBlock}>
        <View style={styles.heroGlow} />
        <TouchableOpacity
          onLongPress={handleInstallerActivation}
          activeOpacity={1}
          delayLongPress={1000}
          style={styles.logoContainer}
        >
          <Image source={getLogoForLightBlue()} style={styles.logo} resizeMode="contain" />
        </TouchableOpacity>
        <Text style={styles.heroTitle}>Welcome to Awakey</Text>
        <Text style={styles.heroSubtitle}>
          Access that feels effortless.
        </Text>
      </View>

      <AppCard style={styles.featureCard}>
        <Text style={styles.featureHeading}>Why you’ll love it</Text>
        <View style={styles.featureList}>
          {features.map((feature) => (
            <View key={feature.text} style={styles.featureItem}>
              <View style={styles.featureIconWrap}>
                <Ionicons name={feature.icon} size={18} color={Colors.textwhite} />
              </View>
              <Text style={styles.featureText}>{feature.text}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => navigation.navigate('AuthFlow')}
          activeOpacity={0.9}
        >
          <Text style={styles.primaryButtonText}>Continue</Text>
          <Ionicons
            name="chevron-forward"
            size={18}
            color={Colors.textwhite}
            style={styles.primaryButtonIcon}
          />
        </TouchableOpacity>
      </AppCard>
    </AppScreen>
  );
};

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: Theme.spacing.lg,
    paddingTop: 72,
    paddingBottom: Theme.spacing.xl,
    gap: Theme.spacing.lg,
  },
  heroBlock: {
    backgroundColor: Colors.cardbackground,
    borderRadius: 24,
    padding: Theme.spacing.xl,
    position: 'relative',
    overflow: 'hidden',
  },
  heroGlow: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: Colors.iconbackground,
    opacity: 0.2,
    top: -40,
    right: -60,
  },
  logoContainer: {
    alignSelf: 'flex-start',
    marginBottom: Theme.spacing.md,
  },
  logo: {
    width: 140,
    height: 50,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.titlecolor,
    marginBottom: Theme.spacing.sm,
  },
  heroSubtitle: {
    ...Theme.typography.subtitle,
    fontSize: 16,
    lineHeight: 22,
  },
  featureCard: {
    padding: Theme.spacing.xl,
    gap: Theme.spacing.lg,
  },
  featureHeading: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.titlecolor,
  },
  featureList: {
    gap: Theme.spacing.md,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.md,
  },
  featureIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.iconbackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: {
    flex: 1,
    ...Theme.typography.body,
    fontSize: 15,
    lineHeight: 20,
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
  primaryButtonIcon: {
    marginLeft: Theme.spacing.xs,
  },
  linkButton: {
    alignSelf: 'center',
  },
  linkButtonText: {
    color: Colors.iconbackground,
    fontWeight: '600',
  },
});

export default WelcomeScreen;
