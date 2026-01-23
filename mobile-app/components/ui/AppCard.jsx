import React from 'react';
import { View, StyleSheet } from 'react-native';
import Colors from '../../constants/Colors';
import Theme from '../../constants/Theme';

/**
 * AppCard - reusable card component
 *
 * Provides consistent styling for cards throughout the app
 */
const AppCard = ({
  children,
  style,
  variant = 'default', // 'default' | 'tinted' | 'primary'
  padding = 'md', // spacing token from Theme.spacing or 'none'
  elevated = true,
}) => {
  const backgroundByVariant = {
    default: Colors.backgroundwhite,
    tinted: Colors.cardbackground,
    primary: Colors.iconbackground
  };

  const borderByVariant = {
    default: Colors.bordercolor,
    tinted: 'transparent',
    primary: Colors.iconbackground
  };

  // Handle different padding options
  const paddingValue = padding === 'none' ? 0 : Theme.spacing[padding] || Theme.spacing.md;

  return (
    <View
      style={[
        styles.base,
        { backgroundColor: backgroundByVariant[variant] ?? Colors.backgroundwhite },
        { borderColor: borderByVariant[variant] ?? Colors.bordercolor },
        elevated && styles.elevated,
        { padding: paddingValue },
        style,
      ]}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  base: {
    borderRadius: Theme.radius.lg,
    borderWidth: 1,
  },
  elevated: {
    ...Theme.shadow.card,
  },
});

export default AppCard;
