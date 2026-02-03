import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../../constants/Colors';
import Theme from '../../constants/Theme';

const SectionHeader = ({
  title,
  subtitle,
  actionLabel,
  onActionPress,
  rightAccessory,
  actionAsButton = false,
}) => {
  if (!title && !subtitle && !actionLabel && !rightAccessory) {
    return null;
  }

  // Check if action should be styled as button (for "Add Lock" or explicitly set)
  const shouldStyleAsButton = actionAsButton || actionLabel === 'Add Lock';

  return (
    <View style={styles.container}>
      <View style={styles.textGroup}>
        {title && <Text style={styles.title}>{title}</Text>}
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>
      {rightAccessory}
      {actionLabel && (
        <TouchableOpacity 
          onPress={onActionPress}
          style={shouldStyleAsButton ? styles.actionButton : null}
          activeOpacity={0.7}
        >
          {shouldStyleAsButton && (
            <Ionicons name="add" size={16} color={Colors.textwhite} style={styles.actionButtonIcon} />
          )}
          <Text style={shouldStyleAsButton ? styles.actionButtonText : styles.action}>
            {actionLabel}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  textGroup: {
    flex: 1,
  },
  title: {
    ...Theme.typography.heading,
  },
  subtitle: {
    ...Theme.typography.subtitle,
    marginTop: 4,
  },
  action: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.iconbackground,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.iconbackground,
    paddingVertical: Theme.spacing.xs,
    paddingHorizontal: Theme.spacing.md,
    borderRadius: Theme.radius.pill,
    gap: Theme.spacing.xs,
    ...Theme.shadows.small,
  },
  actionButtonIcon: {
    marginRight: -2,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textwhite,
  },
});

export default SectionHeader;
