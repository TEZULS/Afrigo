/**
 * AAB release pour le Play Store : `bundleRelease` depuis android/.
 * Prérequis : android/keystore.properties + android/app/<storeFile>
 *
 * Usage : npm run android:bundle:release
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..');
const androidDir = path.join(projectRoot, 'android');
const gradlew = path.join(androidDir, process.platform === 'win32' ? 'gradlew.bat' : 'gradlew');

if (!fs.existsSync(androidDir)) {
  console.error('Dossier android/ absent. Lance : npx expo prebuild --platform android');
  process.exit(1);
}

if (!fs.existsSync(gradlew)) {
  console.error('Gradle wrapper introuvable :', gradlew);
  process.exit(1);
}

const props = path.join(androidDir, 'keystore.properties');
if (!fs.existsSync(props)) {
  console.error(
    'Fichier manquant : android/keystore.properties\n' +
      'Copie mob/docs/keystore.properties.example vers android/keystore.properties et renseigne les valeurs.'
  );
  process.exit(1);
}

const r = spawnSync(gradlew, ['bundleRelease'], {
  cwd: androidDir,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

process.exit(r.status === null ? 1 : r.status);
