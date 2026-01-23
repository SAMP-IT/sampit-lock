/**
 * Environment Variable Verification Script
 * Run this before deployment to ensure all required variables are set
 */

import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

const checks = {
  required: [],
  optional: [],
  warnings: [],
  errors: []
};

console.log('\n==============================================');
console.log('🔍 Environment Variables Verification');
console.log('==============================================\n');

// Required Variables
const required = [
  { name: 'SUPABASE_URL', desc: 'Supabase project URL', validate: (v) => v.startsWith('https://') },
  { name: 'SUPABASE_SERVICE_ROLE_KEY', desc: 'Supabase service role key', minLength: 20 },
  { name: 'SUPABASE_ANON_KEY', desc: 'Supabase anon key', minLength: 20 },
  { name: 'TTLOCK_ENCRYPTION_KEY', desc: 'TTLock token encryption key', validate: (v) => v.length === 64 && /^[a-f0-9]+$/i.test(v) },
  { name: 'PORT', desc: 'Server port', validate: (v) => !isNaN(v) && v > 0 && v < 65536 }
];

// Optional but Recommended
const optional = [
  { name: 'OPENAI_API_KEY', desc: 'OpenAI API key for AI features', required: false },
  { name: 'OPENAI_MODEL', desc: 'OpenAI model (gpt-4o, gpt-3.5-turbo)', required: false },
  { name: 'CORS_ORIGIN', desc: 'CORS allowed origins', required: false },
  { name: 'TTLOCK_CLIENT_ID', desc: 'TTLock API client ID', required: false },
  { name: 'TTLOCK_CLIENT_SECRET', desc: 'TTLock API client secret', required: false }
];

// Check Required Variables
console.log('📋 Required Variables:\n');
for (const varDef of required) {
  const value = process.env[varDef.name];

  if (!value) {
    checks.errors.push(`❌ ${varDef.name}: MISSING - ${varDef.desc}`);
    console.log(`❌ ${varDef.name}: MISSING`);
    console.log(`   ${varDef.desc}\n`);
  } else {
    // Validate
    let valid = true;
    let reason = '';

    if (varDef.minLength && value.length < varDef.minLength) {
      valid = false;
      reason = `too short (min ${varDef.minLength} chars)`;
    }

    if (varDef.validate && !varDef.validate(value)) {
      valid = false;
      reason = 'invalid format';
    }

    if (!valid) {
      checks.errors.push(`❌ ${varDef.name}: INVALID - ${reason}`);
      console.log(`❌ ${varDef.name}: INVALID (${reason})`);
      console.log(`   Current: ${value.substring(0, 20)}...`);
      console.log(`   ${varDef.desc}\n`);
    } else {
      checks.required.push(`✅ ${varDef.name}`);
      console.log(`✅ ${varDef.name}: OK`);
      console.log(`   ${varDef.desc}\n`);
    }
  }
}

// Check Optional Variables
console.log('\n📋 Optional Variables (Recommended):\n');
for (const varDef of optional) {
  const value = process.env[varDef.name];

  if (!value) {
    checks.warnings.push(`⚠️  ${varDef.name}: NOT SET - ${varDef.desc}`);
    console.log(`⚠️  ${varDef.name}: NOT SET`);
    console.log(`   ${varDef.desc}\n`);
  } else {
    checks.optional.push(`✅ ${varDef.name}`);
    console.log(`✅ ${varDef.name}: SET`);
    console.log(`   ${varDef.desc}\n`);
  }
}

// Summary
console.log('\n==============================================');
console.log('📊 Summary');
console.log('==============================================\n');

console.log(`✅ Required variables: ${checks.required.length}/${required.length}`);
console.log(`✅ Optional variables: ${checks.optional.length}/${optional.length}`);
console.log(`⚠️  Warnings: ${checks.warnings.length}`);
console.log(`❌ Errors: ${checks.errors.length}\n`);

// AI Features Status
console.log('==============================================');
console.log('🤖 AI Features Status');
console.log('==============================================\n');

const aiFeatures = {
  'Natural Language Logs': !!process.env.OPENAI_API_KEY,
  'Chat Assistant': !!process.env.OPENAI_API_KEY,
  'Smart Insights': true,
  'Risk Scores': true,
  'Predictive Battery': true,
  'Fraud Detection': true,
  'Auto Rules': true,
  'Smart Scheduling': true,
  'Background Worker': true
};

for (const [feature, enabled] of Object.entries(aiFeatures)) {
  console.log(`${enabled ? '✅' : '⚠️ '} ${feature}: ${enabled ? 'ENABLED' : 'DISABLED (needs OPENAI_API_KEY)'}`);
}

// Security Recommendations
console.log('\n==============================================');
console.log('🔒 Security Recommendations');
console.log('==============================================\n');

if (process.env.TTLOCK_ENCRYPTION_KEY) {
  const key = process.env.TTLOCK_ENCRYPTION_KEY;
  if (key.length !== 64) {
    console.log('❌ TTLOCK_ENCRYPTION_KEY must be exactly 64 hex characters');
    console.log('   Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
  } else if (!/^[a-f0-9]+$/i.test(key)) {
    console.log('❌ TTLOCK_ENCRYPTION_KEY must contain only hexadecimal characters (0-9, a-f)');
  } else {
    console.log('✅ TTLOCK_ENCRYPTION_KEY format is valid');
  }
} else {
  console.log('❌ CRITICAL: TTLOCK_ENCRYPTION_KEY is required!');
  console.log('   Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
}

console.log('✅ Never commit .env file to version control');
console.log('✅ Use a secret manager in production (AWS Secrets, Azure Key Vault, etc.)');
console.log('✅ Enable HTTPS in production');
console.log('✅ Configure CORS_ORIGIN with specific domains (not *)');

// Final Verdict
console.log('\n==============================================');
console.log('🎯 Final Verdict');
console.log('==============================================\n');

if (checks.errors.length === 0) {
  console.log('✅ All required environment variables are properly configured!');
  console.log('🚀 You are ready to deploy to production.\n');

  if (checks.warnings.length > 0) {
    console.log('⚠️  Note: Some optional features are disabled. Check warnings above.\n');
  }

  process.exit(0);
} else {
  console.log('❌ Environment configuration is incomplete or invalid!\n');
  console.log('Please fix the following errors:\n');
  checks.errors.forEach(err => console.log(`  ${err}`));
  console.log('\n');
  process.exit(1);
}
