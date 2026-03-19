/**
 * Selects the appropriate logo based on background color
 * @param {string} backgroundColor - The background color (e.g., 'white', 'lightBlue', 'dark')
 * @returns {number} - The require() path for the logo image
 */
export const getLogoForBackground = (backgroundColor) => {
  // Map background colors to logo files
  // awakey-02.png - white/light backgrounds (default)
  // awakey-03.png - light blue/card backgrounds
  // awakey-04.png - dark backgrounds (replaces former logo3.jpeg)
  
  const logoMap = {
    white: require('../assets/logos/awakey-02.png'),
    lightBlue: require('../assets/logos/awakey-03.png'),
    cardBackground: require('../assets/logos/awakey-02.png'),
    dark: require('../assets/logos/awakey-04.png'),
    default: require('../assets/logos/awakey-02.png'),
  };

  return logoMap[backgroundColor] || logoMap.default;
};

/**
 * Gets logo for white/light backgrounds
 */
export const getLogoForWhite = () => require('../assets/logos/awakey-02.png');

/**
 * Gets logo for light blue/card backgrounds
 */
export const getLogoForLightBlue = () => require('../assets/logos/awakey-03.png');

/**
 * Dark backgrounds (former logo3.jpeg) → awakey-04.png
 */
export const getLogoForDark = () => require('../assets/logos/awakey-04.png');

