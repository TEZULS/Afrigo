/**
 * AAB local (signature debug) — pas de keystore release ni envoi Play Store.
 *
 * Usage : npm run android:aab:local
 * Sortie : android/app/build/outputs/bundle/release/app-release.aab
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..');
const androidDir = path.join(projectRoot, 'android');
const gradlew = path.join(androidDir, process.platform === 'win32' ? 'gradlew.bat' : 'gradlew');
const aabPath = path.join(
  androidDir,
  'app',
  'build',
  'outputs',
  'bundle',
  'release',
  'app-release.aab',
);

if (!fs.existsSync(androidDir)) {
  console.error('Dossier android/ absent. Lance : npx expo prebuild --platform android');
  process.exit(1);
}

if (!fs.existsSync(gradlew)) {
  console.error('Gradle wrapper introuvable :', gradlew);
  process.exit(1);
}

console.log('Build AAB local (signature debug, sans Play Store)…\n');

const r = spawnSync(gradlew, ['bundleRelease'], {
  cwd: androidDir,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

if (r.status === 0 && fs.existsSync(aabPath)) {
  console.log('\n✓ AAB prêt :\n' + aabPath + '\n');
}

process.exit(r.status === null ? 1 : r.status);
