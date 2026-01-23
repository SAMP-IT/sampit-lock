import React from 'react';
import { Text, TouchableOpacity, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AppScreen from '../../components/ui/AppScreen';
import AppCard from '../../components/ui/AppCard';
import Colors from '../../constants/Colors';
import Theme from '../../constants/Theme';

const AuthFlowScreen = ({ navigation }) => {
  return (
    <AppScreen contentContainerStyle={styles.content}>
      <View style={styles.heroBlock}>
        <Text style={styles.heroBadge}>Sign in or create account</Text>
        <Text style={styles.heroTitle}>Choose your preferred method</Text>
        <Text style={styles.heroSubtitle}>
          Sign in to your existing account or create a new one to get started with Awakey smart locks.
        </Text>
      </View>

      <AppCard style={styles.authCard}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => navigation.navigate('SignUp')}
          activeOpacity={0.9}
        >
          <View style={styles.buttonIconWrap}>
            <Ionicons name="person-add-outline" size={20} color={Colors.textwhite} />
          </View>
          <Text style={styles.primaryButtonText}>Create Account</Text>
          <Ionicons
            name="chevron-forward"
            size={18}
            color={Colors.textwhite}
            style={styles.primaryButtonIcon}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => navigation.navigate('Login')}
          activeOpacity={0.9}
        >
          <View style={styles.secondaryButtonIconWrap}>
            <Ionicons name="log-in-outline" size={20} color={Colors.iconbackground} />
          </View>
          <Text style={styles.secondaryButtonText}>Sign In</Text>
          <Ionicons
            name="chevron-forward"
            size={18}
            color={Colors.iconbackground}
            style={styles.secondaryButtonIcon}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.linkButton}
          onPress={() => {
            // TODO: Implement invite code flow
            navigation.navigate('InviteCode');
          }}
          activeOpacity={0.8}
        >
          <Text style={styles.linkButtonText}>Have an invite code?</Text>
        </TouchableOpacity>
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
  authCard: {
    padding: Theme.spacing.xl,
    gap: Theme.spacing.md,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.iconbackground,
    paddingVertical: Theme.spacing.md,
    paddingHorizontal: Theme.spacing.lg,
    borderRadius: Theme.radius.pill,
    gap: Theme.spacing.md,
  },
  buttonIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    flex: 1,
    color: Colors.textwhite,
    fontSize: 16,
    fontWeight: '600',
  },
  primaryButtonIcon: {
    marginLeft: Theme.spacing.xs,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.textwhite,
    borderWidth: 2,
    borderColor: Colors.iconbackground,
    paddingVertical: Theme.spacing.md,
    paddingHorizontal: Theme.spacing.lg,
    borderRadius: Theme.radius.pill,
    gap: Theme.spacing.md,
  },
  secondaryButtonIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    flex: 1,
    color: Colors.iconbackground,
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButtonIcon: {
    marginLeft: Theme.spacing.xs,
  },
  linkButton: {
    alignSelf: 'center',
    marginTop: Theme.spacing.sm,
  },
  linkButtonText: {
    color: Colors.iconbackground,
    fontWeight: '600',
  },
});

export default AuthFlowScreen;