import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Colors from '../../constants/Colors';
import Theme from '../../constants/Theme';

const SectionHeader = ({
  title,
  subtitle,
  actionLabel,
  onActionPress,
  rightAccessory,
}) => {
  if (!title && !subtitle && !actionLabel && !rightAccessory) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.textGroup}>
        {title && <Text style={styles.title}>{title}</Text>}
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>
      {rightAccessory}
      {actionLabel && (
        <TouchableOpacity onPress={onActionPress}>
          <Text style={styles.action}>{actionLabel}</Text>
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
});

export default SectionHeader;
