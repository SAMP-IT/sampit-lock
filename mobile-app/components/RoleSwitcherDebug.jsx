import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../constants/Colors';
import Theme from '../constants/Theme';
import { useRole } from '../context/RoleContext';

const roles = [
  { key: 'owner', label: '👑 Owner', description: 'Full access to all features' },
  { key: 'family', label: '👨‍👩‍👧‍👦 Family', description: 'Limited management access' },
  { key: 'guest', label: '👤 Guest', description: 'View-only access' },
  { key: 'service', label: '🔧 Service', description: 'Technical/installer access' },
  { key: 'enterprise', label: '🏢 Enterprise', description: 'Property manager access' },
  { key: 'auth', label: '🔐 Auth Flow', description: 'Authentication screens' },
];

const RoleSwitcherDebug = () => {
  const { role, switchRole } = useRole();
  const [isVisible, setIsVisible] = useState(false);

  const handleRoleChange = (newRole) => {
    switchRole(newRole);
    setIsVisible(false);
  };

  const currentRole = roles.find(r => r.key === role);

  return (
    <>
      <TouchableOpacity
        style={styles.trigger}
        onPress={() => setIsVisible(true)}
      >
        <View style={styles.triggerContent}>
          <Text style={styles.triggerText}>🎭 {currentRole?.label || 'Unknown'}</Text>
          <Ionicons name="chevron-down" size={16} color={Colors.titlecolor} />
        </View>
      </TouchableOpacity>

      <Modal
        visible={isVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsVisible(false)}
      >
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => setIsVisible(false)}
        >
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>🎭 Exploration Mode - Switch Roles</Text>
            <Text style={styles.modalSubtitle}>
              Tap any role to explore the app from that perspective
            </Text>

            {roles.map((roleOption) => (
              <TouchableOpacity
                key={roleOption.key}
                style={[
                  styles.roleOption,
                  role === roleOption.key && styles.roleOptionActive
                ]}
                onPress={() => handleRoleChange(roleOption.key)}
              >
                <View style={styles.roleContent}>
                  <Text style={[
                    styles.roleLabel,
                    role === roleOption.key && styles.roleLabelActive
                  ]}>
                    {roleOption.label}
                  </Text>
                  <Text style={[
                    styles.roleDescription,
                    role === roleOption.key && styles.roleDescriptionActive
                  ]}>
                    {roleOption.description}
                  </Text>
                </View>
                {role === roleOption.key && (
                  <Ionicons name="checkmark-circle" size={20} color={Colors.textwhite} />
                )}
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setIsVisible(false)}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  trigger: {
    backgroundColor: Colors.cardbackground,
    borderRadius: Theme.radius.md,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
    borderWidth: 2,
    borderColor: Colors.iconbackground,
  },
  triggerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  triggerText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.titlecolor,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Theme.spacing.lg,
  },
  modal: {
    backgroundColor: Colors.textwhite,
    borderRadius: Theme.radius.lg,
    padding: Theme.spacing.xl,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.titlecolor,
    textAlign: 'center',
    marginBottom: Theme.spacing.sm,
  },
  modalSubtitle: {
    fontSize: 14,
    color: Colors.subtitlecolor,
    textAlign: 'center',
    marginBottom: Theme.spacing.xl,
    lineHeight: 20,
  },
  roleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Theme.spacing.md,
    borderRadius: Theme.radius.md,
    marginBottom: Theme.spacing.sm,
    backgroundColor: Colors.cardbackground,
  },
  roleOptionActive: {
    backgroundColor: Colors.iconbackground,
  },
  roleContent: {
    flex: 1,
  },
  roleLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.titlecolor,
    marginBottom: 4,
  },
  roleLabelActive: {
    color: Colors.textwhite,
  },
  roleDescription: {
    fontSize: 13,
    color: Colors.subtitlecolor,
  },
  roleDescriptionActive: {
    color: Colors.textwhite,
    opacity: 0.9,
  },
  closeButton: {
    backgroundColor: Colors.cardbackground,
    borderRadius: Theme.radius.md,
    paddingVertical: Theme.spacing.md,
    alignItems: 'center',
    marginTop: Theme.spacing.lg,
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.titlecolor,
  },
});

export default RoleSwitcherDebug;