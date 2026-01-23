import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AppScreen from '../components/ui/AppScreen';
import AppCard from '../components/ui/AppCard';
import Section from '../components/ui/Section';
import Colors from '../constants/Colors';
import Theme from '../constants/Theme';

const AppearanceSettingsScreen = ({ navigation }) => {
  const [theme, setTheme] = useState('light');
  const [fontSize, setFontSize] = useState('normal');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem('appTheme');
      const savedFontSize = await AsyncStorage.getItem('appFontSize');
      if (savedTheme) setTheme(savedTheme);
      if (savedFontSize) setFontSize(savedFontSize);
    } catch (err) {
      console.error('Failed to load appearance settings:', err);
    }
  };

  const saveTheme = async (newTheme) => {
    setTheme(newTheme);
    await AsyncStorage.setItem('appTheme', newTheme);
  };

  const saveFontSize = async (newSize) => {
    setFontSize(newSize);
    await AsyncStorage.setItem('appFontSize', newSize);
  };

  const renderOption = (title, value, currentValue, onPress, icon) => (
    <TouchableOpacity
      style={styles.optionItem}
      onPress={() => onPress(value)}
      activeOpacity={0.7}
    >
      <View style={styles.optionIcon}>
        <Ionicons name={icon} size={20} color={Colors.iconbackground} />
      </View>
      <Text style={styles.optionTitle}>{title}</Text>
      <Ionicons
        name={currentValue === value ? 'radio-button-on' : 'radio-button-off'}
        size={22}
        color={currentValue === value ? Colors.iconbackground : Colors.subtitlecolor}
      />
    </TouchableOpacity>
  );

  return (
    <AppScreen contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={Colors.titlecolor} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Appearance</Text>
          <Text style={styles.headerSubtitle}>Customize your experience</Text>
        </View>
      </View>

      <Section title="Theme" gapless>
        <AppCard padding="none">
          {renderOption('Light Mode', 'light', theme, saveTheme, 'sunny-outline')}
          {renderOption('Dark Mode', 'dark', theme, saveTheme, 'moon-outline')}
          {renderOption('System Default', 'system', theme, saveTheme, 'phone-portrait-outline')}
        </AppCard>
      </Section>

      <Section title="Text Size" gapless>
        <AppCard padding="none">
          {renderOption('Small', 'small', fontSize, saveFontSize, 'text-outline')}
          {renderOption('Normal', 'normal', fontSize, saveFontSize, 'text-outline')}
          {renderOption('Large', 'large', fontSize, saveFontSize, 'text-outline')}
          {renderOption('Extra Large', 'xlarge', fontSize, saveFontSize, 'text-outline')}
        </AppCard>
      </Section>

      <View style={styles.previewCard}>
        <Text style={styles.previewTitle}>Preview</Text>
        <Text style={styles.previewText}>
          This is how your text will appear in the app with the selected settings.
        </Text>
      </View>
    </AppScreen>
  );
};

const styles = StyleSheet.create({
  content: {
    paddingTop: 60,
    paddingBottom: Theme.spacing.xl,
    gap: Theme.spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Theme.spacing.lg,
    marginBottom: Theme.spacing.md,
  },
  backButton: {
    padding: Theme.spacing.sm,
    marginLeft: -Theme.spacing.sm,
  },
  headerContent: {
    flex: 1,
    marginLeft: Theme.spacing.sm,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.titlecolor,
  },
  headerSubtitle: {
    fontSize: 14,
    color: Colors.subtitlecolor,
    marginTop: 2,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.bordercolor,
  },
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: Theme.radius.md,
    backgroundColor: Colors.cardbackground,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Theme.spacing.md,
  },
  optionTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: Colors.titlecolor,
  },
  previewCard: {
    marginHorizontal: Theme.spacing.lg,
    padding: Theme.spacing.lg,
    backgroundColor: Colors.cardbackground,
    borderRadius: Theme.radius.lg,
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.subtitlecolor,
    marginBottom: Theme.spacing.sm,
  },
  previewText: {
    fontSize: 16,
    color: Colors.titlecolor,
    lineHeight: 24,
  },
});

export default AppearanceSettingsScreen;
