/**
 * Lance Metro pour le dev client avec une config réseau adaptée à l’émulateur Android.
 *
 * Usage :
 *   node scripts/expo-start-dev.cjs emu       → annonce 10.0.2.2 (recommandé émulateur)
 *   node scripts/expo-start-dev.cjs localhost → adb reverse + --localhost (émulateur ou USB)
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..');
const mode = (process.argv[2] || 'default').toLowerCase();

function sdkRoot() {
  const fromEnv = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
  if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;
  if (process.platform === 'win32') {
    const guess = path.join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk');
    if (fs.existsSync(guess)) return guess;
  }
  return null;
}

function adbPath(root) {
  const name = process.platform === 'win32' ? 'adb.exe' : 'adb';
  return path.join(root, 'platform-tools', name);
}

if (mode === 'localhost') {
  const sdk = sdkRoot();
  if (sdk) {
    const adb = adbPath(sdk);
    if (fs.existsSync(adb)) {
      const rev = spawnSync(adb, ['reverse', 'tcp:8081', 'tcp:8081'], {
        stdio: 'inherit',
        windowsHide: true,
        shell: process.platform === 'win32',
      });
      if (rev.status === 0) {
        console.log(
          '[metro] adb reverse tcp:8081 OK → l’app peut joindre Metro via http://127.0.0.1:8081 (émulateur ou USB).\n',
        );
      } else {
        console.warn(
          '[metro] adb reverse a échoué. Sur émulateur, préférez : npm run start:emu\n',
        );
      }
    }
  } else {
    console.warn('[metro] ANDROID_HOME introuvable — adb reverse ignoré.\n');
  }
  const r = spawnSync('npx', ['expo', 'start', '--dev-client', '--localhost'], {
    cwd: projectRoot,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: process.env,
  });
  process.exit(r.status === null ? 1 : r.status);
}

if (mode === 'emu') {
  const env = { ...process.env, REACT_NATIVE_PACKAGER_HOSTNAME: '10.0.2.2' };
  console.log(
    '[metro] REACT_NATIVE_PACKAGER_HOSTNAME=10.0.2.2 (émulateur → PC). Pas besoin de --localhost.\n',
  );
  const r = spawnSync('npx', ['expo', 'start', '--dev-client'], {
    cwd: projectRoot,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env,
  });
  process.exit(r.status === null ? 1 : r.status);
}

const r = spawnSync('npx', ['expo', 'start', '--dev-client'], {
  cwd: projectRoot,
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: process.env,
});
process.exit(r.status === null ? 1 : r.status);
