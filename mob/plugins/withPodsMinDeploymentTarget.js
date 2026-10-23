/**
 * Cible iOS minimale de toutes les cibles des Pods (2026-10-20).
 *
 * Xcode 27 (image EAS « latest » depuis octobre 2026) refuse une cible iOS
 * inférieure à 15.0 : le build échouait sur les cibles de ressources de
 * certains Pods (`…_Privacy`, `…Bundle` : Stripe, GoogleSignIn, SDWebImage,
 * AsyncStorage…), restées à 9.0–13.4. `react_native_post_install` ne relève
 * que les cibles principales. On ajoute au `post_install` du Podfile un
 * relèvement de toutes les cibles à la cible de l'app (15.1, minimum Expo 55).
 */
const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('expo/config-plugins');

const MIN_IOS = '15.1';
const MARKER = '# AfriGo : cible iOS minimale de toutes les cibles des Pods (Xcode 27)';
const HOOK = /^([ \t]*)post_install do \|installer\|[^\n]*\n/m;

/** Podfile → Podfile avec le relèvement, ajouté une seule fois. */
const addPodsMinDeploymentTarget = (podfile) => {
  if (podfile.includes(MARKER)) return podfile;
  const match = podfile.match(HOOK);
  if (!match) throw new Error('withPodsMinDeploymentTarget : bloc post_install introuvable dans le Podfile');
  const pad = `${match[1]}  `;
  const snippet = [
    MARKER,
    'installer.pods_project.targets.each do |target|',
    '  target.build_configurations.each do |build|',
    `    if build.build_settings['IPHONEOS_DEPLOYMENT_TARGET'].to_f < ${MIN_IOS}`,
    `      build.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '${MIN_IOS}'`,
    '    end',
    '  end',
    'end',
  ]
    .map((line) => pad + line)
    .join('\n');
  return podfile.replace(HOOK, (hook) => `${hook}${snippet}\n`);
};

const withPodsMinDeploymentTarget = (config) =>
  withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const file = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      const contents = await fs.promises.readFile(file, 'utf8');
      await fs.promises.writeFile(file, addPodsMinDeploymentTarget(contents));
      return cfg;
    },
  ]);

module.exports = withPodsMinDeploymentTarget;
module.exports.addPodsMinDeploymentTarget = addPodsMinDeploymentTarget;
module.exports.MIN_IOS = MIN_IOS;
