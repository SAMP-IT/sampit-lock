import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../../constants/Colors';
import Theme from '../../constants/Theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const Toast = ({
  visible,
  message,
  type = 'info', // 'success', 'error', 'warning', 'info'
  duration = 3000,
  onDismiss,
  action,
  actionLabel
}) => {
  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Slide in
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 50,
          friction: 8,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto dismiss
      if (duration > 0) {
        const timer = setTimeout(() => {
          handleDismiss();
        }, duration);
        return () => clearTimeout(timer);
      }
    }
  }, [visible]);

  const handleDismiss = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -100,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDismiss?.();
    });
  };

  const getTypeStyles = () => {
    switch (type) {
      case 'success':
        return {
          backgroundColor: '#E8F5E9',
          borderColor: '#4CAF50',
          iconName: 'checkmark-circle',
          iconColor: '#4CAF50',
          textColor: '#2E7D32',
        };
      case 'error':
        return {
          backgroundColor: '#FFEBEE',
          borderColor: '#F44336',
          iconName: 'alert-circle',
          iconColor: '#F44336',
          textColor: '#C62828',
        };
      case 'warning':
        return {
          backgroundColor: '#FFF3E0',
          borderColor: '#FF9800',
          iconName: 'warning',
          iconColor: '#FF9800',
          textColor: '#E65100',
        };
      case 'info':
      default:
        return {
          backgroundColor: '#E3F2FD',
          borderColor: '#2196F3',
          iconName: 'information-circle',
          iconColor: '#2196F3',
          textColor: '#1565C0',
        };
    }
  };

  if (!visible) return null;

  const typeStyles = getTypeStyles();

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY }],
          opacity,
          backgroundColor: typeStyles.backgroundColor,
          borderLeftColor: typeStyles.borderColor,
        },
      ]}
    >
      <View style={styles.content}>
        <Ionicons
          name={typeStyles.iconName}
          size={24}
          color={typeStyles.iconColor}
          style={styles.icon}
        />
        <Text style={[styles.message, { color: typeStyles.textColor }]} numberOfLines={3}>
          {message}
        </Text>
        {action && actionLabel && (
          <TouchableOpacity onPress={action} style={styles.actionButton}>
            <Text style={[styles.actionText, { color: typeStyles.iconColor }]}>
              {actionLabel}
            </Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={handleDismiss} style={styles.closeButton}>
          <Ionicons name="close" size={20} color={typeStyles.textColor} />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 50,
    left: Theme.spacing.md,
    right: Theme.spacing.md,
    borderRadius: Theme.radius.md,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
    zIndex: 9999,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Theme.spacing.md,
  },
  icon: {
    marginRight: Theme.spacing.sm,
  },
  message: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  actionButton: {
    marginLeft: Theme.spacing.sm,
    paddingHorizontal: Theme.spacing.sm,
    paddingVertical: Theme.spacing.xs,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  closeButton: {
    marginLeft: Theme.spacing.sm,
    padding: Theme.spacing.xs,
  },
});

export default Toast;
