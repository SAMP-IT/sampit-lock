import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Image, Animated, Dimensions, InteractionManager } from 'react-native';
import Colors from '../../constants/Colors';
import { getLogoForLightBlue } from '../../utils/logoUtils';

const { width } = Dimensions.get('window');

const LogoSplashScreen = ({ navigation }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const containerOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Pre-load the next screen to avoid lag
    const prepareNextScreen = InteractionManager.runAfterInteractions(() => {
      // This ensures the next screen is ready before navigation
    });

    // Animation sequence: Fade in + Scale up, Hold, Fade out
    const animationSequence = Animated.sequence([
      // Phase 1: Fade in and scale up (0.7s - faster)
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 8,
          useNativeDriver: true,
        }),
      ]),
      // Phase 2: Hold for 1 second (reduced from 1.2s)
      Animated.delay(1000),
      // Phase 3: Fade out (0.4s - faster)
      Animated.timing(containerOpacity, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
    ]);

    // Start the animation
    animationSequence.start(() => {
      // Use InteractionManager to ensure smooth transition
      InteractionManager.runAfterInteractions(() => {
        // Navigate to the feature screens splash after animation completes
        navigation.replace('Splash');
      });
    });

    // Fallback timeout in case animation doesn't complete
    const fallbackTimer = setTimeout(() => {
      InteractionManager.runAfterInteractions(() => {
        navigation.replace('Splash');
      });
    }, 2500);

    return () => {
      clearTimeout(fallbackTimer);
      prepareNextScreen.cancel();
    };
  }, [navigation]);

  return (
    <Animated.View style={[styles.container, { opacity: containerOpacity }]}>
      <Animated.View
        style={[
          styles.logoContainer,
          {
            opacity: fadeAnim,
            transform: [
              { scale: scaleAnim },
            ],
          },
        ]}
      >
        <Image
          source={getLogoForLightBlue()}
          style={styles.logo}
          resizeMode="contain"
        />
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundwhite,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: width * 0.6,
    height: width * 0.3,
  },
});

export default LogoSplashScreen;

