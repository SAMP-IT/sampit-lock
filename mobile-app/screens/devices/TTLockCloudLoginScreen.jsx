import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../../constants/Colors';
import Theme from '../../constants/Theme';
import { connectTTLockAccount } from '../../services/api';

const TTLockCloudLoginScreen = ({ navigation, route }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    if (!username.trim()) {
      Alert.alert('Required', 'Please enter your username or email');
      return;
    }

    if (!password.trim()) {
      Alert.alert('Required', 'Please enter your password');
      return;
    }

    setIsLoading(true);

    try {
      console.log('🔐 Connecting to TTLock Cloud account...');

      const response = await connectTTLockAccount({
        username: username.trim(),
        password: password.trim()
      });

      if (response.data.success) {
        console.log('✅ TTLock account connected successfully');

        Alert.alert(
          'Connected!',
          `Successfully connected to Cloud.\n\n${response.data.locks_found || 0} locks found.`,
          [
            {
              text: 'OK',
              onPress: () => {
                // Navigate back or to a specific screen
                if (route.params?.onSuccess) {
                  route.params.onSuccess();
                }
                navigation.goBack();
              }
            }
          ]
        );
      } else {
        Alert.alert('Login Failed', response.data.message || 'Failed to connect to cloud account');
      }
    } catch (error) {
      console.error('🔴 TTLock login failed:', error);
      Alert.alert(
        'Connection Failed',
        error.response?.data?.error?.message || 'Failed to connect to Cloud. Please check your credentials.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color={Colors.textcolor} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Connect Cloud</Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Icon */}
        <View style={styles.iconContainer}>
          <View style={styles.iconCircle}>
            <Ionicons name="cloud-outline" size={60} color={Colors.iconbackground} />
          </View>
        </View>

        {/* Description */}
        <View style={styles.descriptionContainer}>
          <Text style={styles.title}>Remote Control</Text>
          <Text style={styles.description}>
            Connect your cloud account to enable remote control of your locks from anywhere in the world.
          </Text>

          <View style={styles.featuresList}>
            <View style={styles.featureItem}>
              <Ionicons name="checkmark-circle" size={20} color={Colors.iconbackground} />
              <Text style={styles.featureText}>Control locks remotely via Cloud API</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="checkmark-circle" size={20} color={Colors.iconbackground} />
              <Text style={styles.featureText}>Sync locks from lock app</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="checkmark-circle" size={20} color={Colors.iconbackground} />
              <Text style={styles.featureText}>Auto-detect Gateway availability</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="checkmark-circle" size={20} color={Colors.iconbackground} />
              <Text style={styles.featureText}>Automatic Bluetooth fallback</Text>
            </View>
          </View>

          <View style={styles.noteContainer}>
            <Ionicons name="information-circle-outline" size={20} color="#FF9500" />
            <Text style={styles.noteText}>
              For remote control, your locks must have Gateway connected (~$30-50)
            </Text>
          </View>
        </View>

        {/* Login Form */}
        <View style={styles.formContainer}>
          <View style={styles.inputContainer}>
            <Ionicons name="person-outline" size={20} color={Colors.subtitlecolor} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Username or Email"
              placeholderTextColor={Colors.subtitlecolor}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isLoading}
            />
          </View>

          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed-outline" size={20} color={Colors.subtitlecolor} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor={Colors.subtitlecolor}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isLoading}
            />
            <TouchableOpacity
              style={styles.eyeIcon}
              onPress={() => setShowPassword(!showPassword)}
            >
              <Ionicons
                name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                size={20}
                color={Colors.subtitlecolor}
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
            onPress={handleLogin}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.loginButtonText}>Connect Account</Text>
            )}
          </TouchableOpacity>

          <Text style={styles.helpText}>
            Don't have a cloud account? Download the lock app to create one.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 30
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.cardbackground,
    justifyContent: 'center',
    alignItems: 'center'
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textcolor
  },
  iconContainer: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 30
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.cardbackground,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: Colors.iconbackground + '20'
  },
  descriptionContainer: {
    paddingHorizontal: 30,
    marginBottom: 30
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.textcolor,
    textAlign: 'center',
    marginBottom: 12
  },
  description: {
    fontSize: 15,
    color: Colors.subtitlecolor,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24
  },
  featuresList: {
    marginBottom: 20
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12
  },
  featureText: {
    fontSize: 14,
    color: Colors.textcolor,
    marginLeft: 10,
    flex: 1
  },
  noteContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFF9E6',
    padding: 12,
    borderRadius: 8,
    alignItems: 'flex-start'
  },
  noteText: {
    fontSize: 13,
    color: '#8B6914',
    marginLeft: 8,
    flex: 1,
    lineHeight: 18
  },
  formContainer: {
    paddingHorizontal: 30
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardbackground,
    borderRadius: 12,
    marginBottom: 16,
    paddingHorizontal: 16,
    height: 56
  },
  inputIcon: {
    marginRight: 12
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: Colors.textcolor
  },
  eyeIcon: {
    padding: 4
  },
  loginButton: {
    backgroundColor: Colors.iconbackground,
    height: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16
  },
  loginButtonDisabled: {
    opacity: 0.6
  },
  loginButtonText: {
    color: 'white',
    fontSize: 17,
    fontWeight: '600'
  },
  helpText: {
    fontSize: 13,
    color: Colors.subtitlecolor,
    textAlign: 'center',
    lineHeight: 18
  }
});

export default TTLockCloudLoginScreen;
