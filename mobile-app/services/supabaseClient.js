import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@env';

// Log configuration for debugging
console.log('📡 Supabase Client Config:');
console.log('   URL:', SUPABASE_URL);
console.log('   Key:', SUPABASE_ANON_KEY ? '✅ Loaded' : '❌ Missing');

// Create Supabase client with AsyncStorage for session persistence
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export default supabase;
