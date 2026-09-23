/**
 * Garde-fou : chaque icône importée de `lucide-react-native` doit exister dans
 * la version installée.
 *
 * En test, `jest.setup.js` remplace le paquet par un Proxy qui renvoie une
 * icône pour n'importe quel nom : une icône inexistante passe donc les tests
 * mais fait planter l'écran sur l'appareil (composant `undefined`).
 */
import fs from 'fs';
import path from 'path';

const SRC = path.resolve(__dirname, '..');
const DECLARATIONS = path.resolve(
  __dirname,
  '../../node_modules/lucide-react-native/dist/lucide-react-native.d.ts',
);

const sourceFiles = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : sourceFiles(full);
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });

/** Noms importés dans `import { A, B as C, type D } from 'lucide-react-native'`. */
const importedIcons = (code: string): string[] => {
  const names: string[] = [];
  const re = /import\s*\{([^}]*)\}\s*from\s*['"]lucide-react-native['"]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code))) {
    for (const raw of m[1]!.split(',')) {
      const spec = raw.trim();
      if (!spec || spec.startsWith('type ')) continue;
      names.push(spec.split(/\s+as\s+/)[0]!.trim());
    }
  }
  return names;
};

describe('icônes lucide-react-native', () => {
  it('toutes les icônes importées existent dans le paquet installé', () => {
    const dts = fs.readFileSync(DECLARATIONS, 'utf8');
    // Icônes (`declare const House: LucideIcon`) et alias (`export { House as Home }`).
    const declared = new Set([
      ...[...dts.matchAll(/declare const (\w+)\s*:/g)].map((m) => m[1]),
      ...[...dts.matchAll(/\b\w+ as (\w+)\b/g)].map((m) => m[1]),
    ]);
    // Types exportés (non-composants) utilisés dans le code.
    const typeNames = new Set(['LucideIcon', 'LucideProps']);

    const missing = sourceFiles(SRC).flatMap((file) =>
      importedIcons(fs.readFileSync(file, 'utf8'))
        .filter((name) => !declared.has(name) && !typeNames.has(name))
        .map((name) => `${path.relative(SRC, file)} → ${name}`),
    );
    expect(missing).toEqual([]);
  });
});
