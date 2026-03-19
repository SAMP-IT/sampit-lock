#!/usr/bin/env node
/**
 * Build debug APK (cross-platform).
 * Run from mobile-app: node scripts/assemble-debug.js
 * Cleans native caches first to avoid "Permission denied" from ninja/CMake on Windows.
 */
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const rootDir = path.join(__dirname, '..');
const androidDir = path.join(rootDir, 'android');
const isWin = process.platform === 'win32';
const gradleCmd = isWin ? 'gradlew.bat' : './gradlew';

// Clean native build caches that often cause "ninja: failed recompaction: Permission denied" on Windows
const nativeCacheDirs = [
  path.join(rootDir, 'node_modules', 'react-native-reanimated', 'android', '.cxx'),
  path.join(rootDir, 'node_modules', 'react-native-reanimated', 'android', 'build'),
  path.join(rootDir, 'node_modules', 'expo-modules-core', 'android', '.cxx'),
  path.join(rootDir, 'node_modules', 'expo-modules-core', 'android', 'build'),
];
for (const dir of nativeCacheDirs) {
  if (fs.existsSync(dir)) {
    try {
      fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
      console.log('Cleaned:', path.relative(rootDir, dir));
    } catch (e) {
      console.warn('Could not clean', dir, '(run terminal as Administrator or close Android Studio):', e.message);
    }
  }
}

console.log('\nRunning Gradle clean then assembleDebug...\n');
execSync(`${gradleCmd} clean`, { cwd: androidDir, stdio: 'inherit' });
execSync(`${gradleCmd} assembleDebug`, {
  cwd: androidDir,
  stdio: 'inherit',
});

console.log('\n✅ Debug APK built at: android/app/build/outputs/apk/debug/app-debug.apk');
