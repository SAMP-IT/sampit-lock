import React from 'react';
import { View, StyleSheet } from 'react-native';
import Theme from '../../constants/Theme';
import SectionHeader from './SectionHeader';

/**
 * Section component - wraps content with consistent spacing
 */
const Section = ({
  children,
  style,
  contentStyle,
  title,
  subtitle,
  actionLabel,
  onActionPress,
  rightAccessory,
  gapless = false,
}) => {
  return (
    <View style={[styles.section, style]}>
      {(title || subtitle || actionLabel || rightAccessory) && (
        <SectionHeader
          title={title}
          subtitle={subtitle}
          actionLabel={actionLabel}
          onActionPress={onActionPress}
          rightAccessory={rightAccessory}
        />
      )}
      <View style={[!gapless && styles.content, contentStyle]}>
        {children}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  section: {
    marginHorizontal: Theme.spacing.lg,
    marginBottom: Theme.spacing.xl,
  },
  content: {
    marginTop: Theme.spacing.md,
  },
});

export default Section;
