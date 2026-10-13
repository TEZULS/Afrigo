#!/usr/bin/env node
/**
 * Corrige les notifications de réclamation et de remboursement (2026-10-13).
 *
 *   node deploy-push-base44/fix-returns.cjs
 *
 * Constat : les Workflows « Notification statut réclamation » et
 * « Notification remboursement effectué » tournaient, mais la fonction ne
 * recevait pas la fiche modifiée (format des nouveaux Workflows) : aucune
 * notification n'était créée. Désormais le Workflow transmet l'identifiant de
 * la fiche (comme « Bonus parrainage ») et la fonction la relit elle-même.
 *
 * 1. vérifie que les deux fonctions n'ont pas été modifiées dans l'éditeur
 *    base44 depuis leur lecture (sinon : arrêt, rien n'est écrasé) ;
 * 2. déploie les deux fonctions corrigées ;
 * 3. met à jour les deux fonctions et les deux Workflows dans l'éditeur ;
 * 4. vérifie que les Workflows sont actifs.
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const APP_ID = '6947869a3a13c81a6fad2204';
const CLI = ['-y', 'base44@0.1.32'];
const KIT = __dirname;
const REPO_B44 = path.join(KIT, '..', 'base44');
const WORK = path.join(KIT, '.work-fix-returns');

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
const step = (n, label) => console.log(`\n[${n}/4] ${label}`);
const fail = (msg, detail) => {
  console.error(`\n✖ ${msg}`);
  if (detail) console.error(detail);
  console.error('\nArrêt. Copie ce message à Claude.');
  process.exit(1);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const norm = (s) => String(s).replace(/\r\n/g, '\n').trim();

const FUNCTIONS = ['createReturnStatusNotification', 'createRefundNotification'];
const WORKFLOWS = [
  { file: 'Notification statut reclamation.jsonc', name: 'Notification statut réclamation' },
  { file: 'Notification remboursement effectue.jsonc', name: 'Notification remboursement effectué' },
];

(async () => {
  // 1. Rien n'a bougé dans l'éditeur ? ------------------------------------------
  step(1, "Vérification des fonctions dans l'éditeur base44…");
  const who = spawnSync('npx', [...CLI, 'whoami'], { encoding: 'utf8', shell: true });
  if (!/Logged in as:/.test(`${who.stdout}\n${who.stderr}`)) fail("Pas connecté au CLI base44. Lance d'abord : npx base44 login");
  const paths = FUNCTIONS.map((fn) => `base44/functions/${fn}/entry.ts`);
  const read = cli(['sandbox', 'read', ...paths, '--json']);
  let files;
  try {
    files = JSON.parse(read.stdout).files ?? [];
  } catch {
    fail("Lecture des fonctions dans l'éditeur impossible.", read.text);
  }
  for (const fn of FUNCTIONS) {
    const live = files.find((f) => f.path === `base44/functions/${fn}/entry.ts`)?.content;
    const expected = fs.readFileSync(path.join(KIT, 'expected', `${fn}.entry.ts`), 'utf8');
    const mine = fs.readFileSync(path.join(REPO_B44, 'functions', fn, 'entry.ts'), 'utf8');
    if (live == null) fail(`${fn} introuvable dans l'éditeur.`);
    if (norm(live) !== norm(expected) && norm(live) !== norm(mine)) {
      fail(`${fn} a été modifiée dans l'éditeur base44 depuis ma lecture : rien n'a été écrasé.`);
    }
  }
  console.log('   ✔ aucune modification entre-temps');

  // 2. Déploiement ------------------------------------------------------------------
  step(2, 'Déploiement des deux fonctions corrigées…');
  fs.rmSync(WORK, { recursive: true, force: true });
  fs.mkdirSync(path.join(WORK, 'base44'), { recursive: true });
  fs.writeFileSync(path.join(WORK, 'base44', 'config.jsonc'), JSON.stringify({ name: 'AfriGo' }, null, 2) + '\n');
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

  // 3. Éditeur ------------------------------------------------------------------------
  step(3, "Mise à jour dans l'éditeur base44 (fonctions et Workflows)…");
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
  const cp = cli(['sandbox', 'checkpoint', '--name', 'Notifications réclamations : transmission de la fiche']);
  console.log(cp.ok ? '   ✔ point de restauration créé' : '   ⚠ point de restauration non créé (sans gravité)');

  // 4. Vérification --------------------------------------------------------------------
  step(4, 'Vérification des Workflows…');
  let found = [];
  for (let i = 0; i < 6; i += 1) {
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
  if (found.length !== WORKFLOWS.length) fail(`Workflows introuvables côté base44 (trouvés : ${found.length}/2).`);
  found.forEach((n) => console.log(`   ✔ ${n}`));
  console.log(`
✅ Terminé. Pour tester : dans l'admin, passe une réclamation à « Approuvé »,
   puis vérifie la cloche (et la push) du client. Dis-le à Claude : il
   vérifiera de son côté que la notification a bien été créée et envoyée.`);
})();
