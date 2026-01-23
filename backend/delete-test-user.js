import { supabase } from './src/services/supabase.js';

async function deleteTestUser() {
  const email = 'tester@gmail.com';

  console.log(`🗑️  Deleting user: ${email}`);

  try {
    // First, try to get user from Supabase Auth by email
    const { data: authUsers, error: listError } = await supabase.auth.admin.listUsers();

    if (listError) {
      console.log('⚠️  Could not list auth users:', listError.message);
    } else {
      const authUser = authUsers.users.find(u => u.email === email);

      if (authUser) {
        console.log(`Found in Auth: ${authUser.email} (ID: ${authUser.id})`);

        // Delete from auth first
        const { error: authError } = await supabase.auth.admin.deleteUser(authUser.id);
        if (authError) {
          console.log('❌ Auth deletion error:', authError.message);
        } else {
          console.log('✅ Deleted from Supabase Auth');
        }
      } else {
        console.log('⚠️  User not found in Supabase Auth');
      }
    }

    // Then get user from database
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('id, email')
      .eq('email', email)
      .single();

    if (fetchError) {
      console.log('⚠️  User not found in database:', fetchError.message);
    } else {
      console.log(`Found in DB: ${user.email} (ID: ${user.id})`);

      // Delete from database
      const { error: dbError } = await supabase
        .from('users')
        .delete()
        .eq('email', email);

      if (dbError) {
        console.log('❌ Database deletion error:', dbError.message);
      } else {
        console.log('✅ Deleted from database');
      }
    }

    console.log('✅ User cleanup complete!');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }

  process.exit(0);
}

deleteTestUser();
