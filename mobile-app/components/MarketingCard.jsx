import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../constants/Colors';
import Theme from '../constants/Theme';

const MarketingCard = ({ item, onPress }) => {
  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: item.color }]}
      onPress={() => onPress(item)}
      activeOpacity={0.9}
    >
      <View style={styles.cardContent}>
        <View style={styles.iconContainer}>
          <Ionicons name={item.image} size={32} color={Colors.textwhite} />
        </View>

        <View style={styles.textContainer}>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.subtitle}>{item.subtitle}</Text>
          <Text style={styles.description} numberOfLines={2}>{item.description}</Text>

          <View style={styles.footer}>
            <Text style={styles.price}>{item.price}</Text>
            <View style={styles.actionButton}>
              <Text style={styles.actionText}>{item.action}</Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.textwhite} />
            </View>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: Theme.radius.lg,
    padding: Theme.spacing.lg,
    marginHorizontal: Theme.spacing.md,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
    minHeight: 160, // Set minimum height
    width: 280, // Set fixed width to prevent overflow
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Theme.spacing.md,
    flex: 1,
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    flex: 1,
    gap: Theme.spacing.xs,
    justifyContent: 'space-between',
    minHeight: 100,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textwhite,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textwhite,
    opacity: 0.9,
  },
  description: {
    fontSize: 13,
    color: Colors.textwhite,
    opacity: 0.8,
    lineHeight: 18,
    marginTop: Theme.spacing.xs,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Theme.spacing.sm,
  },
  price: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textwhite,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: Theme.spacing.sm,
    paddingVertical: Theme.spacing.xs,
    borderRadius: Theme.radius.pill,
    gap: 4,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textwhite,
  },
});

export default MarketingCard;