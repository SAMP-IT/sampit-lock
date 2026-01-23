import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  Animated,
  Easing,
  Dimensions,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../../constants/Colors';
import Theme from '../../constants/Theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/**
 * LockResultModal - Animated modal for lock/unlock operation results
 *
 * @param {boolean} visible - Whether modal is visible
 * @param {string} type - 'lock' | 'unlock'
 * @param {boolean} success - Whether operation was successful
 * @param {string} message - Message to display
 * @param {string} lockName - Name of the lock
 * @param {function} onClose - Callback when modal should close
 * @param {number} autoCloseDuration - Auto close after ms (default 2500)
 */
const LockResultModal = ({
  visible,
  type = 'unlock',
  success = true,
  message,
  lockName,
  onClose,
  autoCloseDuration = 2500,
}) => {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const iconScaleAnim = useRef(new Animated.Value(0)).current;
  const iconRotateAnim = useRef(new Animated.Value(0)).current;
  const checkmarkAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (visible) {
      // Reset animations
      scaleAnim.setValue(0);
      opacityAnim.setValue(0);
      iconScaleAnim.setValue(0);
      iconRotateAnim.setValue(0);
      checkmarkAnim.setValue(0);
      pulseAnim.setValue(1);

      // Start entrance animation sequence
      Animated.sequence([
        // Fade in backdrop
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        // Scale up modal with bounce
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 6,
          tension: 100,
          useNativeDriver: true,
        }),
      ]).start();

      // Animate icon with delay
      Animated.sequence([
        Animated.delay(300),
        Animated.parallel([
          // Scale up icon
          Animated.spring(iconScaleAnim, {
            toValue: 1,
            friction: 5,
            tension: 80,
            useNativeDriver: true,
          }),
          // Rotate lock icon for lock/unlock effect
          Animated.timing(iconRotateAnim, {
            toValue: 1,
            duration: 400,
            easing: Easing.out(Easing.back(1.5)),
            useNativeDriver: true,
          }),
        ]),
      ]).start();

      // Animate checkmark/X mark
      Animated.sequence([
        Animated.delay(500),
        Animated.spring(checkmarkAnim, {
          toValue: 1,
          friction: 5,
          tension: 100,
          useNativeDriver: true,
        }),
      ]).start();

      // Pulse animation for success
      if (success) {
        Animated.loop(
          Animated.sequence([
            Animated.timing(pulseAnim, {
              toValue: 1.05,
              duration: 800,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(pulseAnim, {
              toValue: 1,
              duration: 800,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
          ])
        ).start();
      }

      // Auto close
      const timer = setTimeout(() => {
        handleClose();
      }, autoCloseDuration);

      return () => clearTimeout(timer);
    }
  }, [visible]);

  const handleClose = () => {
    // Exit animation
    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: 0,
        duration: 200,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose?.();
    });
  };

  const iconRotation = iconRotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: type === 'lock' ? ['0deg', '0deg'] : ['-15deg', '0deg'],
  });

  // Colors based on success/failure
  const primaryColor = success
    ? (type === 'lock' ? Colors.iconbackground : '#FF9500')
    : '#FF3B30';

  const iconName = success
    ? (type === 'lock' ? 'lock-closed' : 'lock-open')
    : 'warning';

  const statusIcon = success ? 'checkmark-circle' : 'close-circle';
  const statusColor = success ? '#34C759' : '#FF3B30';

  const defaultMessage = success
    ? (type === 'lock' ? 'Lock secured successfully' : 'Lock opened successfully')
    : 'Operation failed';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
    >
      <Animated.View style={[styles.backdrop, { opacity: opacityAnim }]}>
        <TouchableOpacity
          style={styles.backdropTouchable}
          activeOpacity={1}
          onPress={handleClose}
        >
          <Animated.View
            style={[
              styles.modalContainer,
              {
                transform: [
                  { scale: scaleAnim },
                ],
              },
            ]}
          >
            <TouchableOpacity activeOpacity={1} onPress={() => {}}>
              {/* Animated Lock Icon */}
              <Animated.View
                style={[
                  styles.iconContainer,
                  {
                    backgroundColor: primaryColor,
                    transform: [
                      { scale: Animated.multiply(iconScaleAnim, pulseAnim) },
                      { rotate: iconRotation },
                    ],
                  },
                ]}
              >
                <Ionicons name={iconName} size={48} color="#FFFFFF" />
              </Animated.View>

              {/* Status Badge */}
              <Animated.View
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor: statusColor,
                    transform: [{ scale: checkmarkAnim }],
                  },
                ]}
              >
                <Ionicons name={statusIcon} size={24} color="#FFFFFF" />
              </Animated.View>

              {/* Title */}
              <Text style={styles.title}>
                {success
                  ? (type === 'lock' ? 'Locked!' : 'Unlocked!')
                  : 'Failed'}
              </Text>

              {/* Lock Name */}
              {lockName && (
                <Text style={styles.lockName}>{lockName}</Text>
              )}

              {/* Message */}
              <Text style={[styles.message, !success && styles.errorMessage]}>
                {message || defaultMessage}
              </Text>

              {/* Method indicator */}
              {success && (
                <View style={styles.methodContainer}>
                  <Ionicons
                    name={type === 'lock' ? 'shield-checkmark' : 'shield'}
                    size={14}
                    color={Colors.subtitlecolor}
                  />
                  <Text style={styles.methodText}>
                    {type === 'lock' ? 'Security engaged' : 'Access granted'}
                  </Text>
                </View>
              )}

              {/* Tap to dismiss hint */}
              <Text style={styles.dismissHint}>Tap anywhere to dismiss</Text>
            </TouchableOpacity>
          </Animated.View>
        </TouchableOpacity>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdropTouchable: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: Colors.backgroundwhite,
    borderRadius: 24,
    padding: 32,
    width: SCREEN_WIDTH * 0.85,
    maxWidth: 340,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 20,
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  statusBadge: {
    position: 'absolute',
    top: 70,
    right: SCREEN_WIDTH * 0.85 / 2 - 80,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: Colors.backgroundwhite,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.titlecolor,
    marginTop: 16,
    marginBottom: 4,
  },
  lockName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.subtitlecolor,
    marginBottom: 8,
  },
  message: {
    fontSize: 15,
    color: Colors.subtitlecolor,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 16,
  },
  errorMessage: {
    color: '#FF3B30',
  },
  methodContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.cardbackground,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 16,
  },
  methodText: {
    fontSize: 13,
    color: Colors.subtitlecolor,
    fontWeight: '500',
  },
  dismissHint: {
    fontSize: 12,
    color: Colors.subtitlecolor,
    opacity: 0.6,
  },
});

export default LockResultModal;
