import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AppScreen from '../components/ui/AppScreen';
import { SimpleModeCard, SimpleModeText, VoiceHelperButton } from '../components/ui/SimpleMode';
import Colors from '../constants/Colors';
import Theme from '../constants/Theme';

const glossaryTerms = [
  {
    term: 'Passcode',
    icon: 'keypad-outline',
    simple: 'A secret number you type to unlock your door',
    detailed: 'Usually 4-6 numbers that only you and people you trust should know. Like a PIN for your bank card.',
    example: 'Example: 1234 or 567890'
  },
  {
    term: 'Invite',
    icon: 'mail-outline',
    simple: 'A message that lets someone else use your lock',
    detailed: 'When you want to give someone access to your door, you send them an invite. It can be temporary or permanent.',
    example: 'Like giving someone a spare key, but digital'
  },
  {
    term: 'Recovery Key',
    icon: 'key-outline',
    simple: 'A backup way to get into your home if you lose your phone',
    detailed: 'A special code that lets you regain access if your phone is lost, stolen, or broken. Keep it safe and secret.',
    example: 'Write it down and keep it in a safe place'
  },
  {
    term: 'Bluetooth',
    icon: 'bluetooth-outline',
    simple: 'How your phone talks to your lock when you\'re nearby',
    detailed: 'A wireless connection that works when you\'re close to your door (usually within 10 feet).',
    example: 'Like how wireless headphones connect to your phone'
  },
  {
    term: 'Guest Access',
    icon: 'person-outline',
    simple: 'Letting someone use your lock for a short time',
    detailed: 'You can give visitors temporary access to your door. You control when it works and for how long.',
    example: 'Like giving a babysitter access just for tonight'
  },
  {
    term: 'Remote Unlock',
    icon: 'phone-portrait-outline',
    simple: 'Opening your door from anywhere using your phone',
    detailed: 'Even when you\'re not at home, you can unlock your door through the internet. Useful for deliveries or emergencies.',
    example: 'Unlock for a delivery person while you\'re at work'
  },
  {
    term: 'Battery Level',
    icon: 'battery-half-outline',
    simple: 'How much power is left in your lock',
    detailed: 'Your smart lock runs on batteries. The app tells you when they\'re getting low so you can replace them.',
    example: 'Like your phone battery, but lasts much longer'
  },
  {
    term: 'Schedule',
    icon: 'time-outline',
    simple: 'Setting when someone can use the lock',
    detailed: 'You can limit when guest access works - like only on weekdays, or only during business hours.',
    example: 'Housekeeper can enter Monday-Friday, 9 AM to 5 PM'
  },
  {
    term: 'Notification',
    icon: 'notifications-outline',
    simple: 'A message on your phone about your lock',
    detailed: 'The app can send you alerts when someone unlocks your door, when the battery is low, or if there\'s a problem.',
    example: 'Get a message when your kids get home from school'
  },
  {
    term: 'Backup Method',
    icon: 'shield-outline',
    simple: 'Another way to unlock your door if the main way doesn\'t work',
    detailed: 'Always have a second option like a physical key, passcode, or recovery key in case your phone doesn\'t work.',
    example: 'Keep a regular key as backup'
  }
];

const GlossaryScreen = ({ navigation }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedTerm, setExpandedTerm] = useState(null);

  const filteredTerms = glossaryTerms.filter(item =>
    item.term.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.simple.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleTerm = (index) => {
    setExpandedTerm(expandedTerm === index ? null : index);
  };

  const handleVoiceRead = (term) => {
    // TODO: Implement text-to-speech
    const textToRead = `${term.term}. ${term.simple}. ${term.detailed}`;
    console.log('Reading aloud:', textToRead);
  };

  return (
    <AppScreen contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={24} color={Colors.titlecolor} />
        </TouchableOpacity>
        <SimpleModeText variant="heading" style={styles.headerTitle}>
          What do these words mean?
        </SimpleModeText>
      </View>

      <VoiceHelperButton text="Glossary of common smart lock terms with simple explanations." />

      {/* Search */}
      <SimpleModeCard style={styles.searchCard}>
        <View style={styles.searchContainer}>
          <Ionicons name="search-outline" size={20} color={Colors.subtitlecolor} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search for a word..."
            placeholderTextColor={Colors.subtitlecolor}
            value={searchTerm}
            onChangeText={setSearchTerm}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchTerm.length > 0 && (
            <TouchableOpacity onPress={() => setSearchTerm('')}>
              <Ionicons name="close-circle" size={20} color={Colors.subtitlecolor} />
            </TouchableOpacity>
          )}
        </View>
      </SimpleModeCard>

      {/* Introduction */}
      <SimpleModeCard style={styles.introCard}>
        <View style={styles.introHeader}>
          <View style={styles.introIconWrap}>
            <Ionicons name="book-outline" size={24} color={Colors.iconbackground} />
          </View>
          <SimpleModeText variant="title" style={styles.introTitle}>
            Simple explanations
          </SimpleModeText>
        </View>
        <SimpleModeText style={styles.introText}>
          Tap any word below to learn what it means in simple language. Each explanation includes examples to help you understand.
        </SimpleModeText>
      </SimpleModeCard>

      {/* Terms List */}
      <ScrollView style={styles.termsList} showsVerticalScrollIndicator={false}>
        {filteredTerms.map((item, index) => (
          <SimpleModeCard key={index} style={styles.termCard}>
            <TouchableOpacity
              onPress={() => toggleTerm(index)}
              style={styles.termHeader}
              activeOpacity={0.7}
            >
              <View style={styles.termInfo}>
                <View style={styles.termIconWrap}>
                  <Ionicons name={item.icon} size={20} color={Colors.iconbackground} />
                </View>
                <View style={styles.termContent}>
                  <SimpleModeText variant="title" style={styles.termName}>
                    {item.term}
                  </SimpleModeText>
                  <SimpleModeText style={styles.termSimple}>
                    {item.simple}
                  </SimpleModeText>
                </View>
              </View>
              <View style={styles.termControls}>
                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation();
                    handleVoiceRead(item);
                  }}
                  style={styles.voiceButton}
                >
                  <Ionicons name="volume-high-outline" size={16} color={Colors.iconbackground} />
                </TouchableOpacity>
                <Ionicons
                  name={expandedTerm === index ? "chevron-up" : "chevron-down"}
                  size={20}
                  color={Colors.subtitlecolor}
                />
              </View>
            </TouchableOpacity>

            {expandedTerm === index && (
              <View style={styles.termExpanded}>
                <SimpleModeText style={styles.termDetailed}>
                  {item.detailed}
                </SimpleModeText>
                {item.example && (
                  <View style={styles.exampleContainer}>
                    <View style={styles.exampleIconWrap}>
                      <Ionicons name="bulb-outline" size={16} color={Colors.iconbackground} />
                    </View>
                    <SimpleModeText style={styles.exampleText}>
                      {item.example}
                    </SimpleModeText>
                  </View>
                )}
              </View>
            )}
          </SimpleModeCard>
        ))}
      </ScrollView>

      {filteredTerms.length === 0 && (
        <SimpleModeCard style={styles.noResultsCard}>
          <View style={styles.noResultsIconWrap}>
            <Ionicons name="search-outline" size={32} color={Colors.subtitlecolor} />
          </View>
          <SimpleModeText variant="title" style={styles.noResultsTitle}>
            No matches found
          </SimpleModeText>
          <SimpleModeText style={styles.noResultsText}>
            Try searching for a different word or browse all terms below.
          </SimpleModeText>
        </SimpleModeCard>
      )}

      {/* Footer Help */}
      <SimpleModeCard style={styles.helpCard}>
        <SimpleModeText variant="title" style={styles.helpTitle}>
          Still confused?
        </SimpleModeText>
        <SimpleModeText style={styles.helpText}>
          Don't worry! Tap "Get Help" from the main screen to call someone who can explain things in person.
        </SimpleModeText>
      </SimpleModeCard>
    </AppScreen>
  );
};

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: Theme.spacing.lg,
    paddingTop: Theme.spacing.lg,
    paddingBottom: Theme.spacing.xl,
    gap: Theme.spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.bordercolor,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
  },
  searchCard: {
    padding: Theme.spacing.md,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
    backgroundColor: Colors.background,
    borderRadius: Theme.radius.md,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
    borderWidth: 1,
    borderColor: Colors.bordercolor,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: Colors.titlecolor,
    minHeight: Theme.accessibility.minTouchTarget - 16,
  },
  introCard: {
    padding: Theme.spacing.lg,
    gap: Theme.spacing.md,
    backgroundColor: '#E8F5E8',
  },
  introHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.md,
  },
  introIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.textwhite,
    alignItems: 'center',
    justifyContent: 'center',
  },
  introTitle: {
    flex: 1,
  },
  introText: {
    fontSize: 14,
    lineHeight: 20,
  },
  termsList: {
    flex: 1,
  },
  termCard: {
    marginBottom: Theme.spacing.md,
    overflow: 'hidden',
  },
  termHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Theme.spacing.lg,
    minHeight: Theme.accessibility.minTouchTarget + 20,
  },
  termInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.md,
    flex: 1,
  },
  termIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  termContent: {
    flex: 1,
    gap: 2,
  },
  termName: {
    fontSize: 17,
  },
  termSimple: {
    fontSize: 14,
    opacity: 0.8,
  },
  termControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  voiceButton: {
    padding: Theme.spacing.xs,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: Theme.radius.sm,
  },
  termExpanded: {
    paddingHorizontal: Theme.spacing.lg,
    paddingBottom: Theme.spacing.lg,
    gap: Theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.bordercolor,
  },
  termDetailed: {
    fontSize: 15,
    lineHeight: 22,
  },
  exampleContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Theme.spacing.sm,
    backgroundColor: Colors.background,
    padding: Theme.spacing.md,
    borderRadius: Theme.radius.md,
  },
  exampleIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  exampleText: {
    flex: 1,
    fontSize: 14,
    fontStyle: 'italic',
    opacity: 0.8,
  },
  noResultsCard: {
    padding: Theme.spacing.xl,
    alignItems: 'center',
    gap: Theme.spacing.md,
  },
  noResultsIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Theme.spacing.sm,
  },
  noResultsTitle: {
    textAlign: 'center',
  },
  noResultsText: {
    textAlign: 'center',
    opacity: 0.7,
  },
  helpCard: {
    padding: Theme.spacing.lg,
    gap: Theme.spacing.sm,
    backgroundColor: '#FFF8E1',
    borderWidth: 1,
    borderColor: '#FFE082',
  },
  helpTitle: {
    fontSize: 16,
    color: '#F57C00',
  },
  helpText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#F57C00',
  },
});

export default GlossaryScreen;