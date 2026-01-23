import AsyncStorage from '@react-native-async-storage/async-storage';

async function clearAuth() {
  console.log('🧹 Clearing authentication data...');
  
  try {
    await AsyncStorage.removeItem('authToken');
    await AsyncStorage.removeItem('user');
    await AsyncStorage.removeItem('userRole');
    console.log('✅ Auth data cleared successfully!');
    console.log('🔄 Please reload the app');
  } catch (error) {
    console.error('❌ Error clearing auth data:', error);
  }
}

clearAuth();
