import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, Linking, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AppScreen from '../components/ui/AppScreen';
import { SimpleModeCard, SimpleModeText, SimpleModeButton, VoiceHelperButton } from '../components/ui/SimpleMode';
import Colors from '../constants/Colors';
import Theme from '../constants/Theme';
import {
  getTrustedContacts,
  addTrustedContact,
  updateTrustedContact,
  deleteTrustedContact
} from '../services/api';

const TrustedContactsScreen = ({ navigation }) => {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newContact, setNewContact] = useState({
    name: '',
    phone: '',
    relationship: 'Family',
  });

  const relationshipOptions = ['Family', 'Friend', 'Neighbor', 'Caregiver', 'Building Manager'];

  useEffect(() => {
    loadContacts();
  }, []);

  const loadContacts = async () => {
    setLoading(true);
    try {
      const response = await getTrustedContacts();
      setContacts(response.data || []);
    } catch (error) {
      console.error('Failed to load trusted contacts:', error);
      Alert.alert('Error', 'Failed to load trusted contacts');
    } finally {
      setLoading(false);
    }
  };

  const handleAddContact = async () => {
    if (!newContact.name.trim() || !newContact.phone.trim()) {
      Alert.alert('Missing Information', 'Please enter both name and phone number.');
      return;
    }

    setSaving(true);
    try {
      const contactData = {
        name: newContact.name.trim(),
        phone: newContact.phone.trim(),
        relationship: newContact.relationship,
        is_primary: contacts.length === 0, // First contact becomes primary
      };

      await addTrustedContact(contactData);

      setNewContact({ name: '', phone: '', relationship: 'Family' });
      setShowAddForm(false);

      Alert.alert(
        'Contact Added',
        `${contactData.name} will be notified if you're locked out twice in 10 minutes.`
      );

      // Reload contacts from backend
      await loadContacts();
    } catch (error) {
      console.error('Failed to add contact:', error);
      Alert.alert('Error', error.response?.data?.error?.message || 'Failed to add trusted contact');
    } finally {
      setSaving(false);
    }
  };

  const handleCallContact = (contact) => {
    Alert.alert(
      `Call ${contact.name}?`,
      `This will call ${contact.phone}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Call',
          onPress: () => {
            const phoneUrl = `tel:${contact.phone.replace(/[^\d+]/g, '')}`;
            Linking.openURL(phoneUrl).catch(() => {
              Alert.alert('Error', 'Unable to make phone call');
            });
          }
        }
      ]
    );
  };

  const handleRemoveContact = (contact) => {
    Alert.alert(
      'Remove Contact?',
      `Remove ${contact.name} from your trusted contacts?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => confirmRemoveContact(contact.id)
        }
      ]
    );
  };

  const confirmRemoveContact = async (contactId) => {
    try {
      await deleteTrustedContact(contactId);
      Alert.alert('Success', 'Contact removed successfully');
      await loadContacts();
    } catch (error) {
      console.error('Failed to remove contact:', error);
      Alert.alert('Error', 'Failed to remove contact');
    }
  };

  const handleSetPrimary = async (contact) => {
    try {
      // Update this contact to be primary
      await updateTrustedContact(contact.id, { is_primary: true });
      Alert.alert('Primary Contact Set', 'This contact will be called first in emergencies.');
      await loadContacts();
    } catch (error) {
      console.error('Failed to set primary contact:', error);
      Alert.alert('Error', 'Failed to set primary contact');
    }
  };

  const ContactCard = ({ contact }) => (
    <SimpleModeCard style={[styles.contactCard, contact.is_primary && styles.primaryContactCard]}>
      <View style={styles.contactHeader}>
        <View style={styles.contactInfo}>
          <View style={[styles.contactIconWrap, contact.is_primary && styles.primaryIconWrap]}>
            <Ionicons
              name={contact.is_primary ? "star" : "person-outline"}
              size={20}
              color={contact.is_primary ? "#FFD700" : Colors.iconbackground}
            />
          </View>
          <View style={styles.contactDetails}>
            <SimpleModeText variant="title" style={styles.contactName}>
              {contact.name}
              {contact.is_primary && <Text style={styles.primaryBadge}> (Primary)</Text>}
            </SimpleModeText>
            <SimpleModeText style={styles.contactPhone}>
              {contact.phone}
            </SimpleModeText>
            <SimpleModeText style={styles.contactRelationship}>
              {contact.relationship}
            </SimpleModeText>
          </View>
        </View>

        <View style={styles.contactActions}>
          <TouchableOpacity
            style={styles.callButton}
            onPress={() => handleCallContact(contact)}
          >
            <Ionicons name="call" size={18} color={Colors.textwhite} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.moreButton}
            onPress={() => {
              Alert.alert(
                contact.name,
                'Choose an action:',
                [
                  { text: 'Cancel', style: 'cancel' },
                  !contact.is_primary && {
                    text: 'Set as Primary',
                    onPress: () => handleSetPrimary(contact)
                  },
                  {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: () => handleRemoveContact(contact)
                  }
                ].filter(Boolean)
              );
            }}
          >
            <Ionicons name="ellipsis-vertical" size={18} color={Colors.subtitlecolor} />
          </TouchableOpacity>
        </View>
      </View>
    </SimpleModeCard>
  );

  if (loading) {
    return (
      <AppScreen contentContainerStyle={[styles.content, styles.centerContent]}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading trusted contacts...</Text>
      </AppScreen>
    );
  }

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
          Trusted Contacts
        </SimpleModeText>
      </View>

      <VoiceHelperButton text="Manage family members who will be notified if you need emergency help." />

      {/* Explanation */}
      <SimpleModeCard style={styles.explanationCard}>
        <View style={styles.explanationHeader}>
          <View style={styles.explanationIconWrap}>
            <Ionicons name="shield-checkmark-outline" size={24} color={Colors.iconbackground} />
          </View>
          <SimpleModeText variant="title" style={styles.explanationTitle}>
            Emergency Safety Feature
          </SimpleModeText>
        </View>
        <SimpleModeText style={styles.explanationText}>
          If you're locked out twice in 10 minutes, we'll automatically send a text message to your trusted contacts asking them to help you.
        </SimpleModeText>
      </SimpleModeCard>

      {/* Existing Contacts */}
      {contacts.length > 0 && (
        <View style={styles.contactsList}>
          <SimpleModeText variant="title" style={styles.sectionTitle}>
            Your trusted contacts ({contacts.length})
          </SimpleModeText>
          {contacts.map(contact => (
            <ContactCard key={contact.id} contact={contact} />
          ))}
        </View>
      )}

      {/* Add Contact Form or Button */}
      {showAddForm ? (
        <SimpleModeCard style={styles.addForm}>
          <SimpleModeText variant="title" style={styles.formTitle}>
            Add New Contact
          </SimpleModeText>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Name</Text>
            <TextInput
              style={styles.textInput}
              value={newContact.name}
              onChangeText={(text) => setNewContact({ ...newContact, name: text })}
              placeholder="e.g., Sarah (Daughter)"
              placeholderTextColor={Colors.subtitlecolor}
              autoCapitalize="words"
              editable={!saving}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Phone Number</Text>
            <TextInput
              style={styles.textInput}
              value={newContact.phone}
              onChangeText={(text) => setNewContact({ ...newContact, phone: text })}
              placeholder="e.g., (555) 123-4567"
              placeholderTextColor={Colors.subtitlecolor}
              keyboardType="phone-pad"
              editable={!saving}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Relationship</Text>
            <View style={styles.relationshipOptions}>
              {relationshipOptions.map(option => (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.relationshipButton,
                    newContact.relationship === option && styles.selectedRelationship
                  ]}
                  onPress={() => setNewContact({ ...newContact, relationship: option })}
                  disabled={saving}
                >
                  <Text style={[
                    styles.relationshipText,
                    newContact.relationship === option && styles.selectedRelationshipText
                  ]}>
                    {option}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.formActions}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => {
                setShowAddForm(false);
                setNewContact({ name: '', phone: '', relationship: 'Family' });
              }}
              disabled={saving}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveButtonTouchable, saving && styles.saveButtonDisabled]}
              onPress={handleAddContact}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color={Colors.textwhite} />
              ) : (
                <Text style={styles.saveButtonText}>Add Contact</Text>
              )}
            </TouchableOpacity>
          </View>
        </SimpleModeCard>
      ) : (
        <SimpleModeButton
          onPress={() => setShowAddForm(true)}
          icon="person-add-outline"
          style={styles.addButton}
        >
          Add Trusted Contact
        </SimpleModeButton>
      )}

      {/* Help Information */}
      <SimpleModeCard style={styles.helpCard}>
        <View style={styles.helpHeader}>
          <View style={styles.helpIconWrap}>
            <Ionicons name="information-circle-outline" size={20} color={Colors.iconbackground} />
          </View>
          <SimpleModeText variant="title" style={styles.helpTitle}>
            How it works
          </SimpleModeText>
        </View>
        <View style={styles.helpList}>
          <SimpleModeText style={styles.helpItem}>
            • We only contact them in real emergencies
          </SimpleModeText>
          <SimpleModeText style={styles.helpItem}>
            • They'll get a text message with your location
          </SimpleModeText>
          <SimpleModeText style={styles.helpItem}>
            • You can call them anytime from this screen
          </SimpleModeText>
          <SimpleModeText style={styles.helpItem}>
            • Primary contact is called first
          </SimpleModeText>
        </View>
      </SimpleModeCard>

      {contacts.length === 0 && !showAddForm && (
        <SimpleModeCard style={styles.emptyState}>
          <View style={styles.emptyIconWrap}>
            <Ionicons name="people-outline" size={32} color={Colors.subtitlecolor} />
          </View>
          <SimpleModeText variant="title" style={styles.emptyTitle}>
            No trusted contacts yet
          </SimpleModeText>
          <SimpleModeText style={styles.emptyDescription}>
            Add family members or friends who can help you in an emergency.
          </SimpleModeText>
        </SimpleModeCard>
      )}
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
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: Theme.spacing.md,
    fontSize: 16,
    color: Colors.subtitlecolor,
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
  explanationCard: {
    padding: Theme.spacing.lg,
    gap: Theme.spacing.md,
    backgroundColor: '#E8F5E8',
  },
  explanationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.md,
  },
  explanationIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.textwhite,
    alignItems: 'center',
    justifyContent: 'center',
  },
  explanationTitle: {
    flex: 1,
  },
  explanationText: {
    fontSize: 14,
    lineHeight: 20,
  },
  contactsList: {
    gap: Theme.spacing.md,
  },
  sectionTitle: {
    fontSize: 18,
  },
  contactCard: {
    padding: Theme.spacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: 'transparent',
  },
  primaryContactCard: {
    borderLeftColor: '#FFD700',
    backgroundColor: '#FFFAF0',
  },
  contactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  contactInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.md,
    flex: 1,
  },
  contactIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryIconWrap: {
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
  },
  contactDetails: {
    flex: 1,
    gap: 2,
  },
  contactName: {
    fontSize: 16,
  },
  primaryBadge: {
    fontSize: 12,
    color: '#FF8F00',
    fontWeight: '600',
  },
  contactPhone: {
    fontSize: 14,
    color: Colors.iconbackground,
    fontWeight: '500',
  },
  contactRelationship: {
    fontSize: 13,
    opacity: 0.7,
  },
  contactActions: {
    flexDirection: 'row',
    gap: Theme.spacing.sm,
  },
  callButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#4CAF50',
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addForm: {
    padding: Theme.spacing.xl,
    gap: Theme.spacing.lg,
  },
  formTitle: {
    fontSize: 18,
  },
  inputGroup: {
    gap: Theme.spacing.sm,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.titlecolor,
  },
  textInput: {
    backgroundColor: Colors.background,
    borderRadius: Theme.radius.md,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
    fontSize: 16,
    color: Colors.titlecolor,
    borderWidth: 2,
    borderColor: 'transparent',
    minHeight: Theme.accessibility.minTouchTarget,
  },
  relationshipOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Theme.spacing.sm,
  },
  relationshipButton: {
    backgroundColor: Colors.background,
    borderRadius: Theme.radius.md,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
    borderWidth: 1,
    borderColor: Colors.bordercolor,
    minHeight: 40,
    justifyContent: 'center',
  },
  selectedRelationship: {
    backgroundColor: Colors.iconbackground,
    borderColor: Colors.iconbackground,
  },
  relationshipText: {
    fontSize: 14,
    color: Colors.titlecolor,
    fontWeight: '500',
  },
  selectedRelationshipText: {
    color: Colors.textwhite,
  },
  formActions: {
    flexDirection: 'row',
    gap: Theme.spacing.md,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: Theme.radius.pill,
    paddingVertical: Theme.spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.bordercolor,
    minHeight: Theme.accessibility.minTouchTarget,
  },
  cancelButtonText: {
    color: Colors.subtitlecolor,
    fontSize: 16,
    fontWeight: '600',
  },
  saveButtonTouchable: {
    flex: 1,
    backgroundColor: Colors.iconbackground,
    borderRadius: Theme.radius.pill,
    paddingVertical: Theme.spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: Theme.accessibility.minTouchTarget,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: Colors.textwhite,
    fontSize: 16,
    fontWeight: '600',
  },
  addButton: {
    marginTop: Theme.spacing.md,
  },
  helpCard: {
    padding: Theme.spacing.lg,
    gap: Theme.spacing.md,
  },
  helpHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  helpIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  helpTitle: {
    fontSize: 16,
  },
  helpList: {
    gap: Theme.spacing.xs,
  },
  helpItem: {
    fontSize: 14,
    lineHeight: 20,
  },
  emptyState: {
    padding: Theme.spacing.xl,
    alignItems: 'center',
    gap: Theme.spacing.md,
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Theme.spacing.sm,
  },
  emptyTitle: {
    textAlign: 'center',
  },
  emptyDescription: {
    textAlign: 'center',
    opacity: 0.7,
  },
});

export default TrustedContactsScreen;
