import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import Colors from '../constants/Colors';
import Theme from '../constants/Theme';
import { useRole } from '../context/RoleContext';

const RoleSwitcher = ({ label = 'Switch role', style }) => {
  const { setRole } = useRole();

  return (
    <TouchableOpacity
      style={[styles.button, style]}
      onPress={() => setRole('auth')}
      activeOpacity={0.85}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    marginTop: Theme.spacing.lg,
    alignSelf: 'flex-start',
    paddingVertical: Theme.spacing.sm,
    paddingHorizontal: Theme.spacing.md,
    borderRadius: Theme.radius.pill,
    backgroundColor: Colors.cardbackground,
    borderWidth: 1,
    borderColor: Colors.iconbackground,
  },
  buttonText: {
    color: Colors.iconbackground,
    fontWeight: '600',
  },
});

export default RoleSwitcher;
