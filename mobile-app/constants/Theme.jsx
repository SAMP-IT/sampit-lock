import Colors from './Colors';

const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 20,
  xl: 32,
};

const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
};

const typography = {
  heading: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.titlecolor,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.subtitlecolor,
  },
  body: {
    fontSize: 14,
    color: Colors.titlecolor,
  },
  caption: {
    fontSize: 12,
    color: Colors.subtitlecolor,
  },
};

// Elder-friendly accessibility constants
const accessibility = {
  minTouchTarget: 48, // Minimum 48x48 dp touch targets
  elderFriendly: {
    fontSize: {
      body: 18, // 18-20sp body text
      heading: 28, // 24-28sp headings
      button: 16, // Clear button text
    },
    spacing: {
      xl: 40, // Larger gaps for elder UI
      xxl: 48,
    },
    touchTarget: {
      button: 56, // Larger touch targets
      icon: 52,
    },
  },
};

const shadow = {
  card: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 4,
  },
};

const shadows = {
  small: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  medium: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 4,
  },
  large: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
  },
};

export default {
  spacing,
  radius,
  typography,
  accessibility,
  shadow,
  shadows,
};
