import { supabase } from '../src/services/supabase.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function addColumns() {
  try {
    console.log('📄 Running migration: Add TTLock columns to locks table');

    const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '002_add_ttlock_columns.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('🔄 Executing SQL...\n');
    console.log(sql);
    console.log('\n');

    // Split by semicolons and execute each statement
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const statement of statements) {
      if (statement.trim()) {
        console.log(`\n🔄 Executing: ${statement.substring(0, 60)}...`);
        const { error } = await supabase.rpc('exec', { sql: statement + ';' });

        if (error) {
          console.error('❌ Error:', error);
        } else {
          console.log('✅ Success');
        }
      }
    }

    console.log('\n✅ Migration completed!');
    console.log('\nℹ️  Note: If you see errors about columns already existing, that\'s okay - they already exist!');

  } catch (error) {
    console.error('❌ Error running migration:', error.message);
    process.exit(1);
  }
}

addColumns();
