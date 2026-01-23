import { supabase } from './src/services/supabase.js';

async function addTestLock() {
  const userId = 'YOUR_USER_ID'; // We'll get this from the database

  console.log('🔐 Adding test lock to database...');

  try {
    // First, get the user ID for tester@gmail.com
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email')
      .eq('email', 'tester@gmail.com')
      .single();

    if (userError || !user) {
      console.log('❌ User not found:', userError?.message);
      return;
    }

    console.log(`Found user: ${user.email} (ID: ${user.id})`);

    // Create a test lock
    const testLock = {
      owner_id: user.id,
      name: 'Test Smart Lock',
      location: 'Front Door',
      device_id: 'TEST-LOCK-001',
      lock_mac: 'AA:BB:CC:DD:EE:FF',
      battery_level: 85,
      is_locked: true,
      lock_type: 'smart_lock',
      manufacturer: 'TTLock',
      model: 'TT Lock Pro',
      firmware_version: '1.0.0',
      is_active: true,
      auto_lock_enabled: true,
      auto_lock_delay: 30,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data: lock, error: lockError } = await supabase
      .from('locks')
      .insert([testLock])
      .select()
      .single();

    if (lockError) {
      console.log('❌ Failed to create lock:', lockError.message);
      return;
    }

    console.log('✅ Test lock created!');
    console.log(`   Lock ID: ${lock.id}`);
    console.log(`   Name: ${lock.name}`);
    console.log(`   Location: ${lock.location}`);

    // Add user_lock relationship
    const userLock = {
      user_id: user.id,
      lock_id: lock.id,
      role: 'owner',
      is_active: true,
      created_at: new Date().toISOString()
    };

    const { error: userLockError } = await supabase
      .from('user_locks')
      .insert([userLock]);

    if (userLockError) {
      console.log('⚠️ Failed to create user_lock relationship:', userLockError.message);
    } else {
      console.log('✅ User-lock relationship created!');
    }

    console.log('\n🎉 Test lock added successfully!');
    console.log('   You can now see it in the app and test lock/unlock features!');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }

  process.exit(0);
}

addTestLock();
