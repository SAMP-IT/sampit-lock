import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../constants/Colors';
import Theme from '../constants/Theme';
import { updateProfile, logout, deleteAccount } from '../services/api';
import { supabase } from '../services/supabaseClient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRole } from '../context/RoleContext';

const ProfileScreen = ({ navigation }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { setRole } = useRole();
  const [userData, setUserData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
  });

  useEffect(() => {
    loadUserData();
  }, []);

  const handleLogout = async () => {
    await logout();
    setRole(null);
  };

  const loadUserData = async () => {
    setLoading(true);
    try {
      // Try to get session from Supabase
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error || !session?.user) {
        // No valid session - try AsyncStorage
        const storedUser = await AsyncStorage.getItem('user');
        if (storedUser) {
          const user = JSON.parse(storedUser);
          setUserData({
            first_name: user.user_metadata?.first_name || user.first_name || '',
            last_name: user.user_metadata?.last_name || user.last_name || '',
            email: user.email || '',
            phone: user.user_metadata?.phone || user.phone || '',
          });
        } else {
          // No user data anywhere - force logout
          console.log('No user data found - logging out');
          Alert.alert(
            'Session Expired',
            'Your session has expired. Please log in again.',
            [{ text: 'OK', onPress: handleLogout }]
          );
          return;
        }
      } else {
        // Got session from Supabase
        const user = session.user;
        setUserData({
          first_name: user.user_metadata?.first_name || '',
          last_name: user.user_metadata?.last_name || '',
          email: user.email || '',
          phone: user.user_metadata?.phone || '',
        });
      }
    } catch (error) {
      console.error('Error loading user data:', error);
      // Error loading data - show what we can
      const storedUser = await AsyncStorage.getItem('user');
      if (storedUser) {
        const user = JSON.parse(storedUser);
        setUserData({
          first_name: user.user_metadata?.first_name || user.first_name || '',
          last_name: user.user_metadata?.last_name || user.last_name || '',
          email: user.email || '',
          phone: user.user_metadata?.phone || user.phone || '',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!userData.first_name.trim() || !userData.last_name.trim()) {
      Alert.alert('Error', 'First name and last name are required');
      return;
    }

    setSaving(true);
    try {
      // Prepare profile data - only include phone if it has a value (phone is optional)
      const profileData = {
        first_name: userData.first_name,
        last_name: userData.last_name,
      };
      
      // Only include phone field if it has a value (don't send empty phone)
      const phoneValue = userData.phone?.trim();
      if (phoneValue && phoneValue.length > 0) {
        profileData.phone = phoneValue;
      }
      
      await updateProfile(profileData);

      // Update local storage
      const storedUser = await AsyncStorage.getItem('user');
      if (storedUser) {
        const user = JSON.parse(storedUser);
        await AsyncStorage.setItem('user', JSON.stringify({
          ...user,
          user_metadata: {
            ...user.user_metadata,
            first_name: userData.first_name,
            last_name: userData.last_name,
            phone: userData.phone,
          }
        }));
      }

      Alert.alert('Success', 'Profile updated successfully');
    } catch (error) {
      console.error('Save profile error:', error);
      Alert.alert(
        'Error',
        error.response?.data?.error?.message || 'Failed to update profile. Please try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This action cannot be undone.\n\nAll your data, locks, and access will be permanently removed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => confirmDeleteAccount()
        }
      ]
    );
  };

  const confirmDeleteAccount = async () => {
    setDeleting(true);
    try {
      await deleteAccount();
      Alert.alert(
        'Account Deleted',
        'Your account has been successfully deleted.',
        [{ text: 'OK', onPress: () => handleLogout() }]
      );
    } catch (error) {
      console.error('Delete account error:', error);
      Alert.alert(
        'Error',
        error.response?.data?.error?.message || 'Failed to delete account. Please try again.'
      );
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.iconbackground} />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={Colors.titlecolor} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* User info display */}
        <View style={styles.userInfoCard}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>
              {(userData.first_name?.[0] || '').toUpperCase()}
              {(userData.last_name?.[0] || '').toUpperCase()}
            </Text>
          </View>
          <Text style={styles.userName}>
            {userData.first_name || userData.last_name
              ? `${userData.first_name} ${userData.last_name}`.trim()
              : 'User'}
          </Text>
          <Text style={styles.userEmail}>{userData.email || 'No email'}</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <Text style={styles.sectionTitle}>Personal Information</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>First Name</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="person-outline" size={20} color={Colors.subtitlecolor} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="First Name"
                placeholderTextColor={Colors.subtitlecolor}
                value={userData.first_name}
                onChangeText={(text) => setUserData({ ...userData, first_name: text })}
                autoCapitalize="words"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Last Name</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="person-outline" size={20} color={Colors.subtitlecolor} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Last Name"
                placeholderTextColor={Colors.subtitlecolor}
                value={userData.last_name}
                onChangeText={(text) => setUserData({ ...userData, last_name: text })}
                autoCapitalize="words"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <View style={[styles.inputContainer, styles.inputDisabled]}>
              <Ionicons name="mail-outline" size={20} color={Colors.subtitlecolor} style={styles.inputIcon} />
              <Text style={styles.inputText}>{userData.email || 'No email'}</Text>
              <Ionicons name="lock-closed-outline" size={16} color={Colors.subtitlecolor} />
            </View>
            <Text style={styles.helperText}>Email cannot be changed</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Phone Number</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="call-outline" size={20} color={Colors.subtitlecolor} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="+1 (555) 123-4567"
                placeholderTextColor={Colors.subtitlecolor}
                value={userData.phone}
                onChangeText={(text) => setUserData({ ...userData, phone: text })}
                keyboardType="phone-pad"
              />
            </View>
          </View>
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSaveProfile}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>Save Changes</Text>
          )}
        </TouchableOpacity>

        {/* Danger Zone */}
        <View style={styles.dangerZone}>
          <Text style={styles.dangerZoneTitle}>Danger Zone</Text>
          <TouchableOpacity
            style={[styles.deleteButton, deleting && styles.deleteButtonDisabled]}
            onPress={handleDeleteAccount}
            disabled={deleting}
          >
            {deleting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="trash-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.deleteButtonText}>Delete Account</Text>
              </>
            )}
          </TouchableOpacity>
          <Text style={styles.dangerZoneWarning}>
            This will permanently delete your account and all associated data.
          </Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: Colors.subtitlecolor,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: Colors.background,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.titlecolor,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  userInfoCard: {
    alignItems: 'center',
    paddingVertical: Theme.spacing.xl,
    backgroundColor: Colors.cardbackground,
    borderRadius: Theme.radius.lg,
    marginBottom: Theme.spacing.lg,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.iconbackground,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Theme.spacing.md,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.textwhite,
  },
  userName: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.titlecolor,
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: Colors.subtitlecolor,
  },
  form: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.titlecolor,
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.titlecolor,
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardbackground,
    borderRadius: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: Colors.bordercolor,
    minHeight: 52,
  },
  inputDisabled: {
    backgroundColor: '#F5F5F5',
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    height: 52,
    fontSize: 16,
    color: Colors.titlecolor,
  },
  inputText: {
    flex: 1,
    fontSize: 16,
    color: Colors.subtitlecolor,
  },
  helperText: {
    fontSize: 12,
    color: Colors.subtitlecolor,
    marginTop: 4,
    marginLeft: 4,
  },
  saveButton: {
    backgroundColor: Colors.iconbackground,
    borderRadius: 12,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonDisabled: {
    backgroundColor: Colors.subtitlecolor,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  dangerZone: {
    marginTop: 32,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: Colors.bordercolor,
  },
  dangerZoneTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#DC2626',
    marginBottom: 12,
  },
  deleteButton: {
    backgroundColor: '#DC2626',
    borderRadius: 12,
    height: 56,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButtonDisabled: {
    backgroundColor: '#F87171',
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  dangerZoneWarning: {
    fontSize: 12,
    color: Colors.subtitlecolor,
    textAlign: 'center',
    marginTop: 8,
  },
});

export default ProfileScreen;
