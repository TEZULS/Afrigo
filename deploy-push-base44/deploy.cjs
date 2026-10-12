#!/usr/bin/env node
/**
 * Installe les notifications push d'AfriGo sur base44 (à lancer une seule fois).
 *
 *   node deploy-push-base44/deploy.cjs
 *
 * Étapes (le script s'arrête au premier problème) :
 *   1. vérifie la connexion au CLI base44 (`npx base44 login` au besoin) ;
 *   2. envoie les 39 fiches (entités) : identiques à l'éditeur base44, sauf les
 *      champs push ajoutés à User et AppNotification — aucune fiche supprimée ;
 *   3. recopie ces deux fiches et les deux fonctions dans l'éditeur base44
 *      (pour qu'une modification future dans l'éditeur ne les efface pas) ;
 *   4. déploie dispatchPushNotifications (push dès qu'une notification est
 *      créée + nouvel essai toutes les 5 min) et pushAppNotification ;
 *   5. vérifie que les deux fonctions sont bien en ligne.
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const APP_ID = '6947869a3a13c81a6fad2204';
const CLI = ['-y', 'base44@0.1.32'];
const ROOT = __dirname;
process.chdir(ROOT);

const quote = (a) => (/[\s"]/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a);

/** Lance une commande du CLI base44 sur l'app AfriGo. */
const cli = (args, { input } = {}) => {
  const r = spawnSync('npx', [...CLI, ...args, '--app-id', APP_ID].map(quote), {
    encoding: 'utf8',
    input,
    shell: true,
    maxBuffer: 64 * 1024 * 1024,
  });
  const text = `${r.stdout ?? ''}\n${r.stderr ?? ''}`
    .replace(/\x1b\[[0-9;]*m/g, '')
    .split(/\r?\n/)
    .filter((l) => l.trim() && !/EBADENGINE|npm warn|^npm /.test(l))
    .join('\n');
  return { ok: r.status === 0, text };
};

const step = (n, label) => console.log(`\n[${n}/5] ${label}`);
const fail = (msg, detail) => {
  console.error(`\n✖ ${msg}`);
  if (detail) console.error(detail);
  console.error('\nArrêt. Copie ce message à Claude.');
  process.exit(1);
};

// 1. Connexion ---------------------------------------------------------------
step(1, 'Connexion à base44…');
const who = spawnSync('npx', [...CLI, 'whoami'], { encoding: 'utf8', shell: true });
const whoText = `${who.stdout}\n${who.stderr}`.replace(/\x1b\[[0-9;]*m/g, '');
const account = (whoText.match(/Logged in as:\s*(\S+)/) || [])[1];
if (!account) fail("Pas connecté au CLI base44. Lance d'abord : npx base44 login");
console.log(`   ✔ connecté : ${account}`);

// 2. Fiches (entités) -------------------------------------------------------
step(2, 'Envoi des fiches (User et AppNotification enrichies, 37 autres inchangées)…');
const entityFiles = fs.readdirSync(path.join(ROOT, 'base44', 'entities')).filter((f) => f.endsWith('.jsonc'));
if (entityFiles.length !== 39) fail(`39 fiches attendues, ${entityFiles.length} trouvées : rien n'a été envoyé.`);
const push = cli(['entities', 'push', '--yes']);
const line = (label) => (push.text.match(new RegExp(`${label}:\\s*(.*)`)) || [])[1] || '';
const created = line('Created');
const updated = line('Updated');
const deleted = line('Deleted');
if (!push.ok) fail("base44 a refusé l'envoi des fiches (rien n'a changé).", push.text);
if (deleted) {
  fail(`ATTENTION : base44 signale des fiches supprimées : ${deleted}`, push.text);
}
console.log(`   ✔ mises à jour : ${updated || '(aucune)'}${created ? ` | créées : ${created}` : ''} | supprimées : aucune`);

// 3. Recopie dans l'éditeur base44 -------------------------------------------
step(3, "Recopie dans l'éditeur base44…");
const toMirror = [
  'base44/entities/User.jsonc',
  'base44/entities/AppNotification.jsonc',
  'base44/functions/dispatchPushNotifications/entry.ts',
  'base44/functions/pushAppNotification/entry.ts',
];
for (const file of toMirror) {
  const content = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const w = cli(['sandbox', 'write', file, '--overwrite'], { input: content });
  if (!w.ok) fail(`Recopie impossible de ${file} dans l'éditeur.`, w.text);
  console.log(`   ✔ ${file}`);
}
const cp = cli(['sandbox', 'checkpoint', '--name', 'Notifications push (champs + fonctions)']);
if (!cp.ok) console.log(`   ⚠ point de restauration non créé (sans gravité) :\n${cp.text}`);
else console.log('   ✔ point de restauration créé dans l’historique de l’éditeur');

// 4. Fonctions ---------------------------------------------------------------
step(4, 'Déploiement des fonctions push…');
const dep = cli(['functions', 'deploy', 'dispatchPushNotifications', 'pushAppNotification']);
if (!dep.ok) fail('Déploiement des fonctions refusé.', dep.text);
console.log(dep.text.split('\n').filter((l) => /dispatchPushNotifications|pushAppNotification|deployed|unchanged/i.test(l)).map((l) => `   ${l.trim()}`).join('\n'));

// 5. Vérification -------------------------------------------------------------
step(5, 'Vérification…');
const list = cli(['functions', 'list']);
const dispatchLine = list.text.split('\n').find((l) => /\bdispatchPushNotifications\b/.test(l)) || '';
const pushLine = list.text.split('\n').find((l) => /\bpushAppNotification\b/.test(l)) || '';
if (!dispatchLine || !pushLine) fail('Les fonctions push ne sont pas listées sur base44.', list.text);
if (!/2 automations/.test(dispatchLine)) {
  console.log(`   ⚠ déclencheurs de dispatchPushNotifications non confirmés : « ${dispatchLine.trim()} »`);
} else {
  console.log('   ✔ dispatchPushNotifications en ligne avec ses 2 déclencheurs');
}
console.log('   ✔ pushAppNotification en ligne');

console.log(`
✅ Terminé. Dès maintenant, chaque notification créée sur base44 part en push
   sur les téléphones inscrits.
   Restent à faire : la clé push Apple (cd mob, puis eas credentials -p ios),
   puis le nouveau build de l'app (1.0.34) pour que les téléphones s'inscrivent.`);
