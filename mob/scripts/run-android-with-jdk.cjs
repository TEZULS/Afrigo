/**
 * Lance `expo run:android` avec un environnement Gradle fiable sous Windows :
 * - JAVA_HOME → Temurin JDK 17 si JAVA_HOME absent ou JRE sans `javac`
 * - ANDROID_HOME / ANDROID_SDK_ROOT + `android/local.properties` → SDK Android Studio
 * - SUBST facultatif (`AFRI_ANDROID_SUBST=1`) : Gradle peut tourner depuis `Z:\`,
 *   mais CMake utilisé par react-native-reanimated prend en général le chemin canonique
 *   (`C:\Users\…`) — ne résout pas l’erreur Ninja MAX_PATH sans chemins longs ou repo court.
 *
 * Usage : npm run android:winjdk
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..');
const androidDir = path.join(projectRoot, 'android');

/** Normalise sans slash terminal (pour SUBST / comparaisons). */
function normalizeRealPath(abs) {
  return path.resolve(abs).replace(/[/\\]+$/, '');
}

/** Chemin projet absolu résolu pour SUBST / Gradle (réel si disponible — OneDrive/cloud). */
function resolveProjectAbs(dir) {
  const base = normalizeRealPath(dir);
  try {
    return fs.realpathSync.native(base);
  } catch {
    try {
      return fs.realpathSync(base);
    } catch {
      return base;
    }
  }
}

function getCmdExe() {
  const sr = process.env.SystemRoot || process.env.windir || 'C:\\Windows';
  return path.join(sr, 'System32', 'cmd.exe');
}

function getSubstExe() {
  const sr = process.env.SystemRoot || process.env.windir || 'C:\\Windows';
  const substPath = path.join(sr, 'System32', 'subst.exe');
  return fs.existsSync(substPath) ? substPath : null;
}

/**
 * Lecture du registre : chemins longs Win32 (> MAX_PATH pour les applis compatibles).
 * @returns {boolean | null} true/false ou null si indéterminé
 */
function readWindowsLongPathsEnabled() {
  if (process.platform !== 'win32') return null;
  const sr = process.env.SystemRoot || process.env.windir || 'C:\\Windows';
  const regExe = path.join(sr, 'System32', 'reg.exe');
  const r = spawnSync(
    regExe,
    ['query', 'HKLM\\SYSTEM\\CurrentControlSet\\Control\\FileSystem', '/v', 'LongPathsEnabled'],
    { encoding: 'utf8', windowsHide: true },
  );
  if (r.status !== 0 || !r.stdout) return null;
  const hit = r.stdout.split(/\r?\n/).find((ln) => /LongPathsEnabled/i.test(ln));
  if (!hit) return null;
  const m = hit.match(/REG_DWORD\s+(0x[0-9a-f]+|\d+)/i);
  if (m) {
    const raw = m[1].startsWith('0x') ? parseInt(m[1], 16) : parseInt(m[1], 10);
    if (!Number.isNaN(raw)) return raw !== 0;
  }
  return null;
}

/**
 * Mappe une lettre de lecteur (Z: …) vers le dossier du projet pour raccourcir les chemins CMake/Ninja.
 * @returns {string | null} Lettre utilisée avec « : » (ex. « Z: ») ou null si échec
 */
function substAlloc(targetDir, { debug } = {}) {
  const resolved = resolveProjectAbs(targetDir);
  const sysDrive = /^([A-Za-z]):?$/.exec((process.env.SystemDrive || 'C:').trim());
  const systemLetter = (sysDrive?.[1] ?? 'C').toUpperCase();
  const letters = 'ZYXWVUTSRQPOMNLKJHGFEDCBA'.split('').filter((ch) => ch !== systemLetter);
  const substExe = getSubstExe();
  let firstErr = '';

  /** @returns {import('child_process').SpawnSyncReturns<string>} */
  function trySubst(letter) {
    if (substExe) {
      return spawnSync(substExe, [`${letter}:`, resolved], {
        encoding: 'utf8',
        windowsHide: true,
      });
    }
    return spawnSync(getCmdExe(), ['/c', 'subst', `${letter}:`, resolved], {
      encoding: 'utf8',
      windowsHide: true,
    });
  }

  for (const L of letters) {
    const r = trySubst(L);
    if (r.status === 0) return `${L}:`;
    const msg = (r.stderr || r.stdout || '').trim();
    if (msg && !firstErr) firstErr = `[${L}] ${msg}`;
    if (debug) process.stderr.write(`[ANDROID] SUBST essayé ${L}: status=${r.status} msg=${msg}\n`);
  }

  if (!firstErr) firstErr = 'toutes les lettres ont retourné un code non-zéro (lecteurs déjà pris?)';
  console.warn('[ANDROID] SUBST impossible :', firstErr);

  const list = substExe ? spawnSync(substExe, [], { encoding: 'utf8', windowsHide: true }) : null;
  if (list && (list.stdout || list.stderr))
    console.warn('[ANDROID] subst (liste actuelle):\n', (list.stdout || list.stderr).trim() || '(vide)');
  else {
    const l2 = spawnSync(getCmdExe(), ['/c', 'subst'], { encoding: 'utf8', windowsHide: true });
    console.warn('[ANDROID] subst (liste via cmd):\n', (l2.stdout || l2.stderr || '').trim() || '(vide)');
  }

  return null;
}

/** Libère la lettre créée par substAlloc. */
function substFree(drive) {
  if (!drive || drive.length < 2) return;
  const L = drive[0];
  const substExe = getSubstExe();
  if (substExe) {
    spawnSync(substExe, ['/d', `${L}:`], { stdio: 'ignore', windowsHide: true });
  } else {
    spawnSync(getCmdExe(), ['/c', 'subst', '/d', `${L}:`], {
      stdio: 'ignore',
      windowsHide: true,
    });
  }
}

/** @returns {string | null} Chemin JDK détecté */
function findTemurin17Windows() {
  const pf =
    process.env['ProgramFiles'] ||
    process.env['ProgramFiles(x86)'] ||
    'C:\\Program Files';
  const base = path.join(pf, 'Eclipse Adoptium');
  if (!fs.existsSync(base)) return null;
  let dirs = fs.readdirSync(base).filter((d) => /^jdk-17(?:\.|$)/i.test(d) || /^jdk17/i.test(d));
  dirs = dirs.filter((d) => fs.statSync(path.join(base, d)).isDirectory());
  dirs.sort();
  if (dirs.length === 0) return null;
  return path.join(base, dirs[dirs.length - 1]);
}

/** @returns {boolean} JDK valide avec javac */
function isValidJdk(jdkHome) {
  if (!jdkHome || !fs.existsSync(jdkHome)) return false;
  const javac = path.join(jdkHome, 'bin', process.platform === 'win32' ? 'javac.exe' : 'javac');
  return fs.existsSync(javac);
}

/** Dossier doit ressembler à un Android SDK (platform-tools, platforms, etc.). */
function isLikelyAndroidSdk(dir) {
  if (!dir || !fs.existsSync(dir)) return false;
  const markers = ['platform-tools', 'platforms', 'build-tools'];
  return markers.some((m) => fs.existsSync(path.join(dir, m)));
}

/**
 * Cherche le SDK Android (variable d’env ou emplacement par défaut Android Studio Windows).
 * @returns {string | null}
 */
function findAndroidSdk() {
  const fromEnv = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
  if (isLikelyAndroidSdk(fromEnv)) return path.resolve(fromEnv);

  const la = process.env.LOCALAPPDATA;
  if (la) {
    const def = path.join(la, 'Android', 'Sdk');
    if (isLikelyAndroidSdk(def)) return def;
  }

  const profile = process.env.USERPROFILE || process.env.HOME;
  if (profile) {
    const def = path.join(profile, 'AppData', 'Local', 'Android', 'Sdk');
    if (isLikelyAndroidSdk(def)) return def;
  }

  return null;
}

/** Écrit `sdk.dir=...` dans android/local.properties (recommandé par Gradle sur Windows). */
function writeLocalProperties(sdkRoot) {
  if (!fs.existsSync(androidDir)) {
    console.error(
      '\n[ANDROID] Le dossier native `android/` est introuvable.',
      '\n         Depuis la racine mobile : npx expo prebuild --platform android\n',
    );
    process.exit(1);
  }
  const propsPath = path.join(androidDir, 'local.properties');
  // Gradle accepte les slashes normaux sous Windows
  const normalized = sdkRoot.replace(/\\/g, '/');
  const content = `# Généré automatiquement par scripts/run-android-with-jdk.cjs — ne pas committer si sensible\nsdk.dir=${normalized}\n`;
  fs.writeFileSync(propsPath, content, 'utf8');
  console.log('[ANDROID]', 'local.properties ← sdk.dir =', normalized);
}

let jdkHome = process.env.JAVA_HOME;
if (!isValidJdk(jdkHome)) {
  jdkHome =
    process.platform === 'win32'
      ? findTemurin17Windows()
      : jdkHome ?? process.env.JDK_HOME;
}

if (!isValidJdk(jdkHome)) {
  console.error(
    '\n[JAVA] Erreur : aucun JDK valide avec `javac` trouvé.',
    '\n       Définissez JAVA_HOME ou installez Temurin 17.',
    '\n       Voir : docs/ANDROID_WINDOWS.md\n',
  );
  process.exit(1);
}

const sdkRoot = findAndroidSdk();
if (!sdkRoot) {
  console.error(
    '\n[ANDROID] SDK Android introuvable.',
    '\n         Installe Android Studio, ouvre SDK Manager et installe au moins une plateforme + build-tools.',
    '\n         Définis ANDROID_HOME = chemin vers le SDK (souvent)',
    '\n         %LOCALAPPDATA%\\Android\\Sdk',
    '\n         Puis relance : npm run android:winjdk',
    '\n         Détails : docs/ANDROID_WINDOWS.md\n',
  );
  process.exit(1);
}

writeLocalProperties(sdkRoot);

/**
 * Sur émulateur Android, le packager doit être joignable via l’alias hôte `10.0.2.2`,
 * pas l’IP LAN — sinon chargement JS / surface native peut rester bloqués (écran noir).
 * Si seuls des émulateurs sont connectés (`adb devices`), on force cette annonce Metro.
 */
function shouldAnnounceMetroOnEmulatorLoopback(sdkRoot) {
  if (process.env.AFRI_ANDROID_USE_LAN_METRO === '1') return false;
  if (process.env.AFRI_ANDROID_EMULATOR_METRO === '1') return true;
  const adbName = process.platform === 'win32' ? 'adb.exe' : 'adb';
  const adb = path.join(sdkRoot, 'platform-tools', adbName);
  if (!fs.existsSync(adb)) return false;
  const r = spawnSync(adb, ['devices'], { encoding: 'utf8', windowsHide: true });
  if (r.status !== 0 || !r.stdout) return false;
  const lines = r.stdout
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => /\tdevice$/.test(l));
  if (lines.length === 0) return false;
  return lines.every((l) => /^emulator-\d+\t/.test(l));
}

/**
 * Fait pointer 127.0.0.1:8081 sur l’appareil/émulateur vers Metro sur le PC.
 * Nécessaire si l’URL du dev client est http://127.0.0.1:8081 (ex. expo start --localhost).
 */
function tryAdbReverseMetro8081(sdkRootPath) {
  if (process.env.AFRI_SKIP_ADB_REVERSE === '1') return;
  const adbName = process.platform === 'win32' ? 'adb.exe' : 'adb';
  const adb = path.join(sdkRootPath, 'platform-tools', adbName);
  if (!fs.existsSync(adb)) return;
  const devs = spawnSync(adb, ['devices'], { encoding: 'utf8', windowsHide: true });
  if (devs.status !== 0 || !devs.stdout) return;
  const connected = devs.stdout
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => /\tdevice$/.test(l));
  if (connected.length === 0) return;
  const rev = spawnSync(adb, ['reverse', 'tcp:8081', 'tcp:8081'], {
    encoding: 'utf8',
    windowsHide: true,
  });
  if (rev.status === 0) {
    console.log('[ANDROID] adb reverse tcp:8081 OK (appareil ↔ Metro sur le PC).\n');
  } else {
    console.warn('[ANDROID] adb reverse tcp:8081 a échoué — mode --localhost peut rester noir sur émulateur.\n');
  }
}

const jdkBin = path.join(jdkHome, 'bin');
const pathSep = path.delimiter;
const newPath = `${jdkBin}${pathSep}${process.env.PATH ?? ''}`;

const env = {
  ...process.env,
  JAVA_HOME: jdkHome,
  JDK_HOME: jdkHome,
  ANDROID_HOME: sdkRoot,
  ANDROID_SDK_ROOT: sdkRoot,
  PATH: newPath,
};

if (shouldAnnounceMetroOnEmulatorLoopback(sdkRoot)) {
  env.REACT_NATIVE_PACKAGER_HOSTNAME = '10.0.2.2';
  console.log(
    '[ANDROID] Émulateur(s) uniquement → REACT_NATIVE_PACKAGER_HOSTNAME=10.0.2.2 pour Metro.\n' +
      '          (Appareil USB sur le réseau : définir AFRI_ANDROID_USE_LAN_METRO=1 si besoin.)\n',
  );
}

console.log('[JAVA]', 'JAVA_HOME =', jdkHome);
console.log('[ANDROID]', 'ANDROID_HOME =', sdkRoot);

const normRoot = resolveProjectAbs(projectRoot);
const longPathRisk =
  process.platform === 'win32' &&
  (normRoot.length > 50 || /(\\|\/)Desktop(\\|\/)/i.test(normRoot));
/** Opt-in seulement : SUBST ne raccourcit en pratique pas les chemins que CMake impose à Ninja pour Reanimated. */
const optInSubst = process.env.AFRI_ANDROID_SUBST === '1';

let substDrive = null;
let cwd = projectRoot;

if (process.platform === 'win32' && optInSubst) {
  substDrive = substAlloc(projectRoot, {
    debug: process.env.AFRI_ANDROID_SUBST_DEBUG === '1',
  });
  if (substDrive) {
    cwd = `${substDrive}\\`;
    console.log(
      '[ANDROID] SUBST',
      substDrive,
      '←',
      normRoot,
      '\n          (opt-in experimental ; CMake utilise souvent le chemin réel sous C:\\Users\\. Voir docs.)\n',
    );
  } else {
    console.warn(
      '\n[ANDROID] AFRI_ANDROID_SUBST=1 mais aucune lettre SUBST libre.',
      '\n          Voir docs/ANDROID_WINDOWS.md ou AFRI_ANDROID_SUBST_DEBUG=1.',
    );
  }
}

const longPathsReg = process.platform === 'win32' ? readWindowsLongPathsEnabled() : null;

if (longPathRisk && longPathsReg === false && process.env.AFRI_ANDROID_IGNORE_LONGPATH_HINT !== '1') {
  console.error(
    '\n[ANDROID] LongPathsEnabled = 0 dans le registre Windows (chemins longs désactivés).',
    '\n          Avec ce chemin projet, CMake/Ninja (react-native-reanimated) dépassent presque toujours la limite classique (~260 ou ~250 selon CMake).',
    '\n\n          Obligatoire : PowerShell Administrateur puis :',
    '\n          New-ItemProperty -Path "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\FileSystem"',
    '\n            -Name "LongPathsEnabled" -Value 1 -PropertyType DWORD -Force',
    '\n          Puis redémarrage du PC.',
    '\n\n          Alternative : dossier projet court physique type C:\\dev\\mob (voir docs).',
    '\n          Vérification : reg query HKLM\\SYSTEM\\CurrentControlSet\\Control\\FileSystem /v LongPathsEnabled\n',
    '\n          Pour lancer quand même (perte de temps habituelle) : AFRI_ANDROID_IGNORE_LONGPATH_HINT=1',
    '\n',
  );
} else if (longPathRisk && longPathsReg === null) {
  console.warn(
    '\n[ANDROID] Lecture du registre LongPaths impossible (droits?).',
    '\n          Si le build Ninja échoue sur mkdir… : activer chemins longs ou voir docs/ANDROID_WINDOWS.md\n',
  );
}

if (longPathRisk) {
  console.warn(
    '\n[ANDROID] Chemin projet assez long pour risquer Ninja / react-native-reanimated (> MAX_PATH ou ~250 car.).',
    '\n          Gradle peut voir SUBST/Z:\\… mais CMake enregistre en général le chemin canonique (ex.: ' +
      (normRoot.length > 56 ? `${normRoot.substring(0, 56)}…` : normRoot) +
      ').',
    '\n\n          Corrections qui marchent à coup sûr :',
    '\n          • Registre LongPathsEnabled + redémarrage PC (voir docs/ANDROID_WINDOWS.md), puis npm run android:clean-native;',
    '\n          • Ou copier / cloner le dossier `mob` tout près de `C:\\` (ex. `C:\\dev\\mob`) ou activer LongPaths.',
    '\n\n          Détails complets : docs/ANDROID_WINDOWS.md\n',
  );
}

const cleanupSubst = () => {
  if (substDrive) {
    substFree(substDrive);
    substDrive = null;
  }
};

let exitCodeFromRun = 1;
try {
  tryAdbReverseMetro8081(sdkRoot);
  const child = spawnSync('npx', ['expo', 'run:android'], {
    env,
    cwd,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  exitCodeFromRun = child.status === null ? 1 : child.status;
} finally {
  cleanupSubst();
}

process.exit(exitCodeFromRun);
