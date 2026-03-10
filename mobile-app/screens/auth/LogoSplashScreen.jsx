import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Image, Animated, Dimensions } from 'react-native';
import Colors from '../../constants/Colors';
import { getLogoForLightBlue } from '../../utils/logoUtils';

const { width } = Dimensions.get('window');

const LogoSplashScreen = ({ navigation }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const containerOpacity = useRef(new Animated.Value(1)).current;
  const hasNavigated = useRef(false);

  const navigateToSplash = () => {
    if (hasNavigated.current) return;
    hasNavigated.current = true;
    navigation.replace('Splash');
  };

  useEffect(() => {
    // Animation sequence: Fade in + Scale up, Hold, Fade out
    const animationSequence = Animated.sequence([
      // Phase 1: Fade in and scale up
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
      // Phase 2: Hold
      Animated.delay(1000),
      // Phase 3: Fade out
      Animated.timing(containerOpacity, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
    ]);

    const fallbackTimer = setTimeout(() => navigateToSplash(), 2500);

    animationSequence.start(() => {
      clearTimeout(fallbackTimer);
      navigateToSplash();
    });

    return () => clearTimeout(fallbackTimer);
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

