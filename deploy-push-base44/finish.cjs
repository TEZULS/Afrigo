#!/usr/bin/env node
/**
 * Fin de l'installation des push sur base44 (après deploy.cjs).
 *
 *   node deploy-push-base44/finish.cjs
 *
 * Cette app utilise les Workflows base44 : les déclencheurs attachés aux
 * fonctions y sont refusés. On déploie donc la fonction seule, puis on ajoute
 * dans l'éditeur base44 deux Workflows au même format que les vôtres :
 *   - « Push – envoi immédiat » : à chaque AppNotification créée ;
 *   - « Push – nouvel essai »   : toutes les 15 minutes, rattrapage des échecs.
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const APP_ID = '6947869a3a13c81a6fad2204';
const CLI = ['-y', 'base44@0.1.32'];
const ROOT = __dirname;
process.chdir(ROOT);

const quote = (a) => (/[\s"]/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a);
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
  return { ok: r.status === 0, text, stdout: r.stdout ?? '' };
};
const step = (n, label) => console.log(`\n[${n}/4] ${label}`);
const fail = (msg, detail) => {
  console.error(`\n✖ ${msg}`);
  if (detail) console.error(detail);
  console.error('\nArrêt. Copie ce message à Claude.');
  process.exit(1);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const WORKFLOWS = [
  { file: 'Push notifications - envoi immediat.jsonc', name: 'Push – envoi immédiat' },
  { file: 'Push notifications - nouvel essai.jsonc', name: 'Push – nouvel essai' },
];

(async () => {
  // 1. Fonction ---------------------------------------------------------------
  step(1, 'Déploiement de dispatchPushNotifications (sans déclencheur attaché)…');
  const dep = cli(['functions', 'deploy', 'dispatchPushNotifications']);
  if (!dep.ok) fail('Déploiement de la fonction refusé.', dep.text);
  console.log('   ✔ dispatchPushNotifications en ligne');

  // 2. Workflows dans l'éditeur --------------------------------------------------
  step(2, "Ajout des deux Workflows dans l'éditeur base44…");
  for (const wf of WORKFLOWS) {
    const rel = `base44/workflows/${wf.file}`;
    const content = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    const w = cli(['sandbox', 'write', rel, '--overwrite'], { input: content });
    if (!w.ok) fail(`Écriture impossible de ${rel}.`, w.text);
    console.log(`   ✔ ${wf.name}`);
  }

  // 3. Point de restauration (applique aussi les changements en attente) -------
  step(3, "Point de restauration dans l'historique de l'éditeur…");
  const cp = cli(['sandbox', 'checkpoint', '--name', 'Workflows notifications push']);
  console.log(cp.ok ? '   ✔ créé' : `   ⚠ non créé (sans gravité) :\n${cp.text}`);

  // 4. Vérification : les Workflows apparaissent-ils côté base44 ? -------------
  step(4, 'Vérification des Workflows (jusqu’à 2 minutes)…');
  let found = [];
  for (let i = 0; i < 12; i += 1) {
    const list = cli(['workflows', 'list', '--json']);
    try {
      const json = JSON.parse(list.stdout);
      const names = (json.workflows ?? []).map((w) => `${w.name} [${w.status}]`);
      found = WORKFLOWS.map((wf) => names.find((n) => n.startsWith(wf.name))).filter(Boolean);
    } catch {
      found = [];
    }
    if (found.length === WORKFLOWS.length) break;
    await sleep(10_000);
  }
  if (found.length === WORKFLOWS.length) {
    found.forEach((n) => console.log(`   ✔ ${n}`));
    console.log(`
✅ Terminé : chaque notification créée sur base44 part maintenant en push.
   Restent : la clé push Apple dans EAS, puis le build 1.0.35.`);
  } else {
    console.log(`
⚠ Les fichiers sont dans l'éditeur base44, mais base44 ne les a pas encore
  activés comme Workflows (trouvés : ${found.length}/2).
  Copie ce message à Claude : il te donnera la marche à suivre (une phrase à
  dire à l'assistant de l'éditeur base44, ou 2 minutes de clics).`);
  }
})();
