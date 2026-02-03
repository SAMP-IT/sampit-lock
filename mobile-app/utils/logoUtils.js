/**
 * Selects the appropriate logo based on background color
 * @param {string} backgroundColor - The background color (e.g., 'white', 'lightBlue', 'dark')
 * @returns {number} - The require() path for the logo image
 */
export const getLogoForBackground = (backgroundColor) => {
  // Map background colors to logo files
  // logo1.jpeg - for white/light backgrounds (default)
  // logo2.jpeg - for light blue/card backgrounds
  // logo3.jpeg - for dark backgrounds
  
  const logoMap = {
    white: require('../assets/logos/logo1.jpeg'),
    lightBlue: require('../assets/logos/logo2.jpeg'),
    cardBackground: require('../assets/logos/logo2.jpeg'),
    dark: require('../assets/logos/logo3.jpeg'),
    default: require('../assets/logos/logo1.jpeg'),
  };

  return logoMap[backgroundColor] || logoMap.default;
};

/**
 * Gets logo for white/light backgrounds
 */
export const getLogoForWhite = () => require('../assets/logos/logo1.jpeg');

/**
 * Gets logo for light blue/card backgrounds
 */
export const getLogoForLightBlue = () => require('../assets/logos/logo2.jpeg');

/**
 * Gets logo for dark backgrounds
 */
export const getLogoForDark = () => require('../assets/logos/logo3.jpeg');

