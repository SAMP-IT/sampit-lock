import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../constants/Colors';
import Theme from '../constants/Theme';
import AppCard from './ui/AppCard';

const QuickActionButton = ({ action, onPress, style }) => {
  return (
    <TouchableOpacity
      style={style}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <AppCard elevated={true} style={styles.card}>
        <View style={styles.content}>
          <View style={styles.iconWrapper}>
            <Ionicons name={action.icon} size={24} color={Colors.textwhite} />
          </View>

          <View style={styles.textBlock}>
            <Text style={styles.title}>{action.title}</Text>
            {action.subtitle && <Text style={styles.subtitle}>{action.subtitle}</Text>}
          </View>
        </View>
      </AppCard>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    minHeight: 140,
    justifyContent: 'center',
    width: '100%',
  },
  content: {
    alignItems: 'center',
  },
  iconWrapper: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.iconbackground,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Theme.spacing.sm,
  },
  textBlock: {
    alignItems: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.titlecolor,
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.endboxText,
    textAlign: 'center',
  },
});

export default QuickActionButton;
