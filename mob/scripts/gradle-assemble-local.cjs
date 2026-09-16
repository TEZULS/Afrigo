/**
 * APK local (test sur téléphone/émulateur) — pas de keystore release requis.
 * Utilise la signature debug déjà présente dans android/app/debug.keystore.
 *
 * Usage : npm run android:apk:local
 * Sortie : android/app/build/outputs/apk/debug/app-debug.apk
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..');
const androidDir = path.join(projectRoot, 'android');
const gradlew = path.join(androidDir, process.platform === 'win32' ? 'gradlew.bat' : 'gradlew');
const apkPath = path.join(androidDir, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');

if (!fs.existsSync(androidDir)) {
  console.error('Dossier android/ absent. Lance : npx expo prebuild --platform android');
  process.exit(1);
}

if (!fs.existsSync(gradlew)) {
  console.error('Gradle wrapper introuvable :', gradlew);
  process.exit(1);
}

console.log('Build APK debug local (sans envoi Play Store)…\n');

const r = spawnSync(gradlew, ['assembleDebug'], {
  cwd: androidDir,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

if (r.status === 0 && fs.existsSync(apkPath)) {
  console.log('\n✓ APK prêt :\n' + apkPath + '\n');
}

process.exit(r.status === null ? 1 : r.status);
