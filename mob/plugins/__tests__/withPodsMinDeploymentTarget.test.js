const fs = require('fs');
const path = require('path');
const { addPodsMinDeploymentTarget, MIN_IOS } = require('../withPodsMinDeploymentTarget');

// Podfile généré par `expo prebuild` (modèle Expo SDK 55).
const template = fs.readFileSync(path.join(__dirname, 'Podfile.expo55.fixture'), 'utf8');

describe('withPodsMinDeploymentTarget — build iPhone avec Xcode 27', () => {
  it('relève toutes les cibles des Pods à iOS 15.1 dans le post_install existant', () => {
    const out = addPodsMinDeploymentTarget(template);
    const hook = out.indexOf('post_install do |installer|');
    const fix = out.indexOf("build.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '15.1'");
    const rn = out.indexOf('react_native_post_install(');
    expect(MIN_IOS).toBe('15.1');
    expect(hook).toBeGreaterThan(-1);
    expect(fix).toBeGreaterThan(hook);
    expect(fix).toBeLessThan(rn);
    expect(out).toContain('installer.pods_project.targets.each do |target|');
    // Un seul post_install (CocoaPods refuse d'en avoir deux).
    expect(out.match(/post_install do/g)).toHaveLength(1);
  });

  it('ajoute exactement 8 lignes, indentées dans le bloc, Ruby équilibré', () => {
    const before = template.split('\n');
    const after = addPodsMinDeploymentTarget(template).split('\n');
    expect(after).toHaveLength(before.length + 8);
    const start = after.findIndex((l) => l.includes('post_install do |installer|')) + 1;
    const inserted = after.slice(start, start + 8);
    expect(inserted.every((l) => l.startsWith('    '))).toBe(true);
    expect(inserted.filter((l) => /\bdo\b|^\s*if\b/.test(l))).toHaveLength(3);
    expect(inserted.filter((l) => /^\s*end\s*$/.test(l))).toHaveLength(3);
  });

  it('appliqué une seule fois, même si le build relance la configuration', () => {
    const once = addPodsMinDeploymentTarget(template);
    expect(addPodsMinDeploymentTarget(once)).toBe(once);
  });

  it('Podfile sans post_install : erreur claire plutôt qu’un build cassé en silence', () => {
    expect(() => addPodsMinDeploymentTarget("platform :ios, '15.1'\n")).toThrow(/post_install/);
  });
});
