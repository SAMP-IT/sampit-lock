import React from 'react';
import { Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../../constants/Colors';
import Theme from '../../constants/Theme';
import { useRole } from '../../context/RoleContext';

// HOC to apply Simple Mode styling
export const withSimpleMode = (WrappedComponent) => {
  return (props) => {
    const { isSimpleMode } = useRole();
    return <WrappedComponent {...props} isSimpleMode={isSimpleMode} />;
  };
};

// Simple Mode Button Component
export const SimpleModeButton = ({ onPress, children, icon, style, ...props }) => {
  const { isSimpleMode } = useRole();

  const buttonStyle = isSimpleMode ? styles.simpleModeButton : styles.normalButton;
  const textStyle = isSimpleMode ? styles.simpleModeButtonText : styles.normalButtonText;

  return (
    <TouchableOpacity
      style={[buttonStyle, style]}
      onPress={onPress}
      activeOpacity={0.9}
      {...props}
    >
      {icon && (
        <View style={isSimpleMode ? styles.simpleModeIconWrap : styles.normalIconWrap}>
          <Ionicons
            name={icon}
            size={isSimpleMode ? 28 : 20}
            color={Colors.textwhite}
          />
        </View>
      )}
      <Text style={textStyle}>{children}</Text>
      {!icon && (
        <Ionicons
          name="chevron-forward"
          size={isSimpleMode ? 24 : 18}
          color={Colors.textwhite}
        />
      )}
    </TouchableOpacity>
  );
};

// Simple Mode Card Component
export const SimpleModeCard = ({ children, style, ...props }) => {
  const { isSimpleMode } = useRole();

  const cardStyle = isSimpleMode ? styles.simpleModeCard : styles.normalCard;

  return (
    <View style={[cardStyle, style]} {...props}>
      {children}
    </View>
  );
};

// Simple Mode Text Component
export const SimpleModeText = ({ children, variant = 'body', style, ...props }) => {
  const { isSimpleMode } = useRole();

  let textStyle;
  if (isSimpleMode) {
    switch (variant) {
      case 'heading':
        textStyle = styles.simpleModeHeading;
        break;
      case 'title':
        textStyle = styles.simpleModeTitle;
        break;
      case 'body':
      default:
        textStyle = styles.simpleModeBody;
        break;
    }
  } else {
    switch (variant) {
      case 'heading':
        textStyle = Theme.typography.heading;
        break;
      case 'title':
        textStyle = styles.normalTitle;
        break;
      case 'body':
      default:
        textStyle = Theme.typography.body;
        break;
    }
  }

  return (
    <Text style={[textStyle, style]} {...props}>
      {children}
    </Text>
  );
};

// Voice Helper Button (for elder accessibility)
export const VoiceHelperButton = ({ text, style }) => {
  const { isSimpleMode } = useRole();

  if (!isSimpleMode) return null;

  const handleVoiceRead = () => {
    // TODO: Implement text-to-speech using system TTS
    console.log('Reading aloud:', text);
  };

  return (
    <TouchableOpacity
      style={[styles.voiceButton, style]}
      onPress={handleVoiceRead}
      accessibilityLabel="Read this aloud"
    >
      <Ionicons name="volume-high-outline" size={16} color={Colors.iconbackground} />
      <Text style={styles.voiceButtonText}>🔊 Read this aloud</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  // Normal mode styles
  normalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.iconbackground,
    paddingVertical: Theme.spacing.sm,
    paddingHorizontal: Theme.spacing.lg,
    borderRadius: Theme.radius.pill,
    minHeight: Theme.accessibility.minTouchTarget,
    gap: Theme.spacing.sm,
  },
  normalButtonText: {
    color: Colors.textwhite,
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  normalIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  normalCard: {
    backgroundColor: Colors.cardbackground,
    borderRadius: 16,
    padding: Theme.spacing.lg,
  },
  normalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.titlecolor,
  },

  // Simple mode styles (elder-friendly)
  simpleModeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.iconbackground,
    paddingVertical: Theme.accessibility.elderFriendly.spacing.xl,
    paddingHorizontal: Theme.spacing.xl,
    borderRadius: Theme.radius.lg,
    minHeight: Theme.accessibility.elderFriendly.touchTarget.button,
    gap: Theme.spacing.lg,
  },
  simpleModeButtonText: {
    color: Colors.textwhite,
    fontSize: Theme.accessibility.elderFriendly.fontSize.body,
    fontWeight: '600',
    flex: 1,
  },
  simpleModeIconWrap: {
    width: Theme.accessibility.elderFriendly.touchTarget.icon,
    height: Theme.accessibility.elderFriendly.touchTarget.icon,
    borderRadius: 26,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  simpleModeCard: {
    backgroundColor: Colors.cardbackground,
    borderRadius: Theme.radius.lg,
    padding: Theme.accessibility.elderFriendly.spacing.xl,
    gap: Theme.spacing.lg,
  },
  simpleModeHeading: {
    fontSize: Theme.accessibility.elderFriendly.fontSize.heading,
    fontWeight: '700',
    color: Colors.titlecolor,
    lineHeight: 34,
  },
  simpleModeTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.titlecolor,
    lineHeight: 30,
  },
  simpleModeBody: {
    fontSize: Theme.accessibility.elderFriendly.fontSize.body,
    color: Colors.titlecolor,
    lineHeight: 24,
  },

  // Voice helper
  voiceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    paddingVertical: Theme.spacing.xs,
    paddingHorizontal: Theme.spacing.sm,
    borderRadius: Theme.radius.sm,
    gap: Theme.spacing.xs,
    alignSelf: 'flex-start',
  },
  voiceButtonText: {
    fontSize: 12,
    color: Colors.iconbackground,
    fontWeight: '500',
  },
});

export default {
  withSimpleMode,
  SimpleModeButton,
  SimpleModeCard,
  SimpleModeText,
  VoiceHelperButton,
};