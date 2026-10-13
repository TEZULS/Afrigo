#!/usr/bin/env node
/**
 * Push pour les réclamations et les remboursements (à lancer une seule fois).
 *
 *   node deploy-push-base44/returns.cjs
 *
 * 1. retélécharge depuis l'éditeur base44 TOUTES les fiches (entités) à jour ;
 * 2. ajoute « return » et « refund » aux liens possibles d'une AppNotification
 *    (rien d'autre ne change), puis renvoie l'ensemble — aucune fiche supprimée ;
 * 3. déploie createReturnStatusNotification et createRefundNotification ;
 * 4. ajoute leurs deux Workflows dans l'éditeur (mêmes réglages que
 *    « Notification statut commande ») et vérifie qu'ils sont actifs.
 * S'arrête au premier problème.
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const APP_ID = '6947869a3a13c81a6fad2204';
const CLI = ['-y', 'base44@0.1.32'];
const KIT = __dirname;
const REPO_B44 = path.join(KIT, '..', 'base44');
const WORK = path.join(KIT, '.work-returns');

const quote = (a) => (/[\s"]/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a);
const cli = (args, { input, cwd = KIT } = {}) => {
  const r = spawnSync('npx', [...CLI, ...args, '--app-id', APP_ID].map(quote), {
    encoding: 'utf8',
    input,
    cwd,
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
const json = (res, what) => {
  try {
    const j = JSON.parse(res.stdout);
    if (j.error) throw new Error(j.error);
    return j;
  } catch (e) {
    fail(`Lecture impossible (${what}).`, res.text || String(e));
  }
};
const step = (n, label) => console.log(`\n[${n}/6] ${label}`);
const fail = (msg, detail) => {
  console.error(`\n✖ ${msg}`);
  if (detail) console.error(detail);
  console.error('\nArrêt. Copie ce message à Claude.');
  process.exit(1);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const FUNCTIONS = ['createReturnStatusNotification', 'createRefundNotification'];
const WORKFLOWS = [
  { file: 'Notification statut reclamation.jsonc', name: 'Notification statut réclamation' },
  { file: 'Notification remboursement effectue.jsonc', name: 'Notification remboursement effectué' },
];

(async () => {
  // 1. Connexion ----------------------------------------------------------------
  step(1, 'Connexion à base44…');
  const who = spawnSync('npx', [...CLI, 'whoami'], { encoding: 'utf8', shell: true });
  const account = (`${who.stdout}\n${who.stderr}`.match(/Logged in as:\s*(\S+)/) || [])[1];
  if (!account) fail("Pas connecté au CLI base44. Lance d'abord : npx base44 login");
  console.log(`   ✔ connecté : ${account}`);

  // 2. Fiches à jour depuis l'éditeur -------------------------------------------
  step(2, "Téléchargement des fiches à jour depuis l'éditeur base44…");
  const listing = json(cli(['sandbox', 'ls', 'base44/entities', '--json']), 'liste des fiches');
  if (listing.truncated) fail('Liste des fiches incomplète : rien n’a été envoyé.');
  const paths = (listing.entries || []).filter((e) => e.type === 'file' && e.path.endsWith('.jsonc')).map((e) => e.path);
  const must = ['User', 'AppNotification', 'Order', 'Product', 'Return', 'Refund'];
  for (const name of must) {
    if (!paths.includes(`base44/entities/${name}.jsonc`)) fail(`Fiche ${name} introuvable dans l'éditeur : rien n'a été envoyé.`);
  }
  const read = json(cli(['sandbox', 'read', ...paths, 'base44/config.jsonc', '--json']), 'contenu des fiches');
  fs.rmSync(WORK, { recursive: true, force: true });
  fs.mkdirSync(path.join(WORK, 'base44', 'entities'), { recursive: true });
  fs.mkdirSync(path.join(WORK, 'backup'), { recursive: true });
  let count = 0;
  for (const f of read.files || []) {
    if (typeof f.content !== 'string') fail(`Contenu vide pour ${f.path} : rien n'a été envoyé.`);
    if (f.path === 'base44/config.jsonc') {
      const cfg = JSON.parse(f.content);
      delete cfg.site; // aucune opération de site possible
      fs.writeFileSync(path.join(WORK, 'base44', 'config.jsonc'), JSON.stringify(cfg, null, 2) + '\n');
      continue;
    }
    const base = path.basename(f.path);
    fs.writeFileSync(path.join(WORK, 'backup', base), f.content);
    fs.writeFileSync(path.join(WORK, 'base44', 'entities', base), f.content);
    count += 1;
  }
  if (count !== paths.length) fail(`${paths.length} fiches listées mais ${count} lues : rien n'a été envoyé.`);
  const anPath = path.join(WORK, 'base44', 'entities', 'AppNotification.jsonc');
  const an = JSON.parse(fs.readFileSync(anPath, 'utf8'));
  if (!an.properties?.push_sent) fail("AppNotification n'a pas les champs push : lance d'abord deploy.cjs.");
  const values = an.properties.related_type?.enum;
  if (!Array.isArray(values)) fail('Champ related_type inattendu dans AppNotification.');
  for (const v of ['return', 'refund']) if (!values.includes(v)) values.push(v);
  fs.writeFileSync(anPath, JSON.stringify(an, null, 2) + '\n');
  console.log(`   ✔ ${count} fiches à jour (copie de sauvegarde dans deploy-push-base44/.work-returns/backup)`);

  // 3. Envoi des fiches ------------------------------------------------------------
  step(3, 'Envoi des fiches (AppNotification : liens « return » et « refund » ajoutés)…');
  const push = cli(['entities', 'push', '--yes'], { cwd: WORK });
  const deleted = (push.text.match(/Deleted:\s*(.*)/) || [])[1];
  if (!push.ok) fail("base44 a refusé l'envoi des fiches (rien n'a changé).", push.text);
  if (deleted) fail(`ATTENTION : base44 signale des fiches supprimées : ${deleted}`, push.text);
  const w1 = cli(['sandbox', 'write', 'base44/entities/AppNotification.jsonc', '--overwrite'], {
    input: fs.readFileSync(anPath, 'utf8'),
  });
  if (!w1.ok) fail("Recopie d'AppNotification dans l'éditeur impossible.", w1.text);
  console.log('   ✔ fiches envoyées, aucune supprimée ; éditeur à jour');

  // 4. Fonctions ---------------------------------------------------------------------
  step(4, 'Déploiement des deux fonctions…');
  for (const fn of FUNCTIONS) {
    const dir = path.join(WORK, 'base44', 'functions', fn);
    fs.mkdirSync(dir, { recursive: true });
    for (const file of ['entry.ts', 'function.jsonc']) {
      fs.copyFileSync(path.join(REPO_B44, 'functions', fn, file), path.join(dir, file));
    }
  }
  const dep = cli(['functions', 'deploy', ...FUNCTIONS], { cwd: WORK });
  if (!dep.ok) fail('Déploiement des fonctions refusé.', dep.text);
  FUNCTIONS.forEach((fn) => console.log(`   ✔ ${fn} en ligne`));

  // 5. Éditeur : fonctions + Workflows -------------------------------------------------
  step(5, "Ajout dans l'éditeur base44 (fonctions et Workflows)…");
  for (const fn of FUNCTIONS) {
    const rel = `base44/functions/${fn}/entry.ts`;
    const w = cli(['sandbox', 'write', rel, '--overwrite'], { input: fs.readFileSync(path.join(REPO_B44, 'functions', fn, 'entry.ts'), 'utf8') });
    if (!w.ok) fail(`Écriture impossible de ${rel}.`, w.text);
  }
  for (const wf of WORKFLOWS) {
    const rel = `base44/workflows/${wf.file}`;
    const w = cli(['sandbox', 'write', rel, '--overwrite'], { input: fs.readFileSync(path.join(REPO_B44, 'workflows', wf.file), 'utf8') });
    if (!w.ok) fail(`Écriture impossible de ${rel}.`, w.text);
    console.log(`   ✔ ${wf.name}`);
  }
  const cp = cli(['sandbox', 'checkpoint', '--name', 'Notifications réclamations et remboursements']);
  console.log(cp.ok ? '   ✔ point de restauration créé' : `   ⚠ point de restauration non créé (sans gravité)`);

  // 6. Vérification ------------------------------------------------------------------------
  step(6, 'Vérification des Workflows (jusqu’à 2 minutes)…');
  let found = [];
  for (let i = 0; i < 12; i += 1) {
    const list = cli(['workflows', 'list', '--json']);
    try {
      const names = (JSON.parse(list.stdout).workflows ?? []).map((w) => `${w.name} [${w.status}]`);
      found = WORKFLOWS.map((wf) => names.find((n) => n.startsWith(wf.name))).filter(Boolean);
    } catch {
      found = [];
    }
    if (found.length === WORKFLOWS.length) break;
    await sleep(10_000);
  }
  if (found.length !== WORKFLOWS.length) {
    fail(`Workflows pas encore actifs côté base44 (trouvés : ${found.length}/2).`);
  }
  found.forEach((n) => console.log(`   ✔ ${n}`));
  console.log(`
✅ Terminé : un changement de statut de réclamation et un remboursement effectué
   envoient maintenant une notification (cloche + push) au client.`);
})();
