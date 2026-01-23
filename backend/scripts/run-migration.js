import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL || `${process.env.SUPABASE_URL}/db`,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const migrationFile = process.argv[2] || '002_add_ttlock_columns.sql';

    const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', migrationFile);

    if (!fs.existsSync(migrationPath)) {
      console.error(`❌ Migration file not found: ${migrationPath}`);
      process.exit(1);
    }

    console.log(`📄 Reading migration: ${migrationFile}`);
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('🔄 Connecting to database...');
    await client.connect();

    console.log('🔄 Running migration...');
    await client.query(sql);

    console.log('✅ Migration completed successfully!');

  } catch (error) {
    console.error('❌ Error running migration:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();
