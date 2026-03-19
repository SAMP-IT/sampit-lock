import React, { useState, useEffect, useRef } from 'react';
import { Text, TouchableOpacity, StyleSheet, View, Dimensions, ScrollView, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AppScreen from '../../components/ui/AppScreen';
import AppCard from '../../components/ui/AppCard';
import Colors from '../../constants/Colors';
import Theme from '../../constants/Theme';

const { width } = Dimensions.get('window');

const splashFeatures = [
  {
    id: 1,
    icon: 'home-outline',
    title: 'Smart Home Control',
    subtitle: 'Control all your locks from one place',
    description: 'Manage multiple smart locks with ease. View status, control access, and monitor activity from your phone.',
    color: Colors.iconbackground,
  },
  {
    id: 2,
    icon: 'people-outline',
    title: 'User Management',
    subtitle: 'Share access with family and friends',
    description: 'Grant temporary or permanent access to trusted people. Set different permission levels for different users.',
    color: '#4A90E2',
  },
  {
    id: 3,
    icon: 'shield-checkmark-outline',
    title: 'Advanced Security',
    subtitle: 'Bank-level encryption and monitoring',
    description: 'Your security is our priority. Monitor all access attempts with detailed activity logs.',
    color: '#7ED321',
  },
  {
    id: 4,
    icon: 'phone-portrait-outline',
    title: 'Remote Access',
    subtitle: 'Unlock from anywhere in the world',
    description: 'Whether you\'re at work or on vacation, you can control your locks remotely with confidence.',
    color: '#F5A623',
  },
];

const SplashScreen = ({ navigation }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const scrollViewRef = useRef(null);
  const slideWidth = width - (Theme.spacing.lg * 2);
  // Start at full opacity for smooth transition from logo splash (no fade-in reload)
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const scrollToIndex = (index) => {
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollTo({
        x: index * slideWidth,
        animated: true,
      });
    }
  };

  useEffect(() => {
    if (!isAutoPlaying) return;

    const timer = setTimeout(() => {
      if (currentIndex < splashFeatures.length - 1) {
        const nextIndex = currentIndex + 1;
        scrollToIndex(nextIndex);
      } else {
        setIsAutoPlaying(false);
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, [currentIndex, isAutoPlaying, slideWidth]);

  const currentFeature = splashFeatures[currentIndex];

  const handleScroll = (event) => {
    const scrollPosition = event.nativeEvent.contentOffset.x;
    const index = Math.round(scrollPosition / slideWidth);
    if (index !== currentIndex && index >= 0 && index < splashFeatures.length) {
      setCurrentIndex(index);
      setIsAutoPlaying(false);
    }
  };

  const handleNext = () => {
    setIsAutoPlaying(false);
    if (currentIndex < splashFeatures.length - 1) {
      scrollToIndex(currentIndex + 1);
    } else {
      navigation.replace('Welcome');
    }
  };

  const handleSkip = () => {
    navigation.replace('Welcome');
  };

  const handleDotPress = (index) => {
    setIsAutoPlaying(false);
    scrollToIndex(index);
  };

  return (
    <Animated.View style={[styles.wrapper, { opacity: fadeAnim }]}>
      <AppScreen contentContainerStyle={styles.content}>
        <View style={styles.skipContainer}>
          <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          ref={scrollViewRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          decelerationRate="fast"
          snapToInterval={slideWidth}
          snapToAlignment="center"
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          removeClippedSubviews={true}
          initialNumToRender={2}
        >
        {splashFeatures.map((feature, index) => (
          <View key={feature.id} style={[styles.slideContainer, { width: slideWidth }]}>
            <View style={styles.featureContainer}>
              <View style={[styles.iconContainer, { backgroundColor: feature.color }]}>
                <Ionicons name={feature.icon} size={64} color={Colors.textwhite} />
              </View>

              <Text style={styles.featureTitle}>{feature.title}</Text>
              <Text style={styles.featureSubtitle}>{feature.subtitle}</Text>
              <Text style={styles.featureDescription}>{feature.description}</Text>
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={styles.bottomContainer}>
        <View style={styles.dotsContainer}>
          {splashFeatures.map((_, index) => (
            <TouchableOpacity
              key={index}
              onPress={() => handleDotPress(index)}
              style={[
                styles.dot,
                {
                  backgroundColor: index === currentIndex ? currentFeature.color : Colors.subtitlecolor,
                  opacity: index === currentIndex ? 1 : 0.3,
                }
              ]}
            />
          ))}
        </View>

        <TouchableOpacity
          style={[styles.nextButton, { backgroundColor: currentFeature.color }]}
          onPress={handleNext}
          activeOpacity={0.9}
        >
          <Text style={styles.nextButtonText}>
            {currentIndex === splashFeatures.length - 1 ? 'Get Started' : 'Next'}
          </Text>
          <Ionicons
            name="chevron-forward"
            size={18}
            color={Colors.textwhite}
            style={styles.nextButtonIcon}
          />
        </TouchableOpacity>
      </View>
    </AppScreen>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: Colors.backgroundwhite,
  },
  content: {
    flex: 1,
    paddingHorizontal: Theme.spacing.lg,
    paddingTop: 60,
    paddingBottom: Theme.spacing.xl,
  },
  skipContainer: {
    alignItems: 'flex-end',
    marginBottom: Theme.spacing.lg,
  },
  skipButton: {
    padding: Theme.spacing.sm,
  },
  skipText: {
    color: Colors.subtitlecolor,
    fontSize: 16,
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexDirection: 'row',
  },
  slideContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  featureContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Theme.spacing.md,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Theme.spacing.xl,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  featureTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.titlecolor,
    textAlign: 'center',
    marginBottom: Theme.spacing.sm,
  },
  featureSubtitle: {
    fontSize: 18,
    fontWeight: '500',
    color: Colors.subtitlecolor,
    textAlign: 'center',
    marginBottom: Theme.spacing.lg,
  },
  featureDescription: {
    fontSize: 16,
    color: Colors.subtitlecolor,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: Theme.spacing.md,
  },
  bottomContainer: {
    gap: Theme.spacing.xl,
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Theme.spacing.sm,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Theme.spacing.md,
    paddingHorizontal: Theme.spacing.xl,
    borderRadius: Theme.radius.pill,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  nextButtonText: {
    color: Colors.textwhite,
    fontSize: 16,
    fontWeight: '600',
  },
  nextButtonIcon: {
    marginLeft: Theme.spacing.xs,
  },
});

export default SplashScreen;