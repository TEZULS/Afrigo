/**
 * Supprime les caches natifs / Gradle utiles après erreur Ninja ou renommage du dossier projet
 * (chemins absolus obsolètes dans android/.gradle → « No variants exist »).
 * Usage : npm run android:clean-native
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');

const dirs = [
  path.join(root, 'android', '.gradle'),
  path.join(root, 'android', 'build'),
  path.join(root, 'android', 'app', 'build'),
  path.join(root, 'android', 'app', '.cxx'),
  path.join(root, 'node_modules', 'react-native-reanimated', 'android', '.cxx'),
];

for (const d of dirs) {
  if (!fs.existsSync(d)) continue;
  try {
    fs.rmSync(d, { recursive: true, force: true });
    console.log('[clean-android-native]', 'supprimé :', d);
  } catch (e) {
    console.warn('[clean-android-native]', 'échec :', d, e.message);
  }
}

const gradlew = path.join(root, 'android', process.platform === 'win32' ? 'gradlew.bat' : 'gradlew');
if (fs.existsSync(gradlew)) {
  const r = spawnSync(gradlew, ['--stop'], {
    cwd: path.join(root, 'android'),
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (r.status !== 0 && r.status !== null) {
    console.warn('[clean-android-native]', 'gradlew --stop a retourné', r.status);
  }
}

console.log('[clean-android-native]', 'terminé.');
