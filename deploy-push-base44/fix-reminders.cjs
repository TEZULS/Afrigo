#!/usr/bin/env node
/**
 * Rappels de panier : un seul rappel par panier abandonné (2026-10-20).
 *
 *   node deploy-push-base44/fix-reminders.cjs
 *
 * Constat : « Vous avez oublié votre panier » et « Un article de votre panier
 * est bientôt en rupture » étaient recréés toutes les 4 h tant que le panier
 * restait plein (24 + 10 sur les 60 dernières notifications du compte de
 * test). Supprimés, ils « revenaient », et chacun partait en push.
 * Désormais : un rappel par panier abandonné, puis un nouveau seulement si le
 * client modifie son panier et l'abandonne de nouveau. Titres, messages et
 * réglages de l'admin (délai, anti-spam) sont inchangés.
 *
 * 1. vérifie que la fonction n'a pas été modifiée dans l'éditeur base44 ;
 * 2. la déploie ; 3. la recopie dans l'éditeur (point de restauration).
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const APP_ID = '6947869a3a13c81a6fad2204';
const CLI = ['-y', 'base44@0.1.32'];
const KIT = __dirname;
const REPO_B44 = path.join(KIT, '..', 'base44');
const WORK = path.join(KIT, '.work-fix-reminders');
const FN = 'sendCartReminderNotifications';

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
const fail = (msg, detail) => {
  console.error(`\n✖ ${msg}`);
  if (detail) console.error(detail);
  console.error('\nArrêt. Copie ce message à Claude.');
  process.exit(1);
};
const norm = (s) => String(s).replace(/\r\n/g, '\n').trim();

console.log('\n[1/3] Vérification dans l’éditeur base44…');
const who = spawnSync('npx', [...CLI, 'whoami'], { encoding: 'utf8', shell: true });
if (!/Logged in as:/.test(`${who.stdout}\n${who.stderr}`)) fail("Pas connecté au CLI base44. Lance d'abord : npx base44 login");
const rel = `base44/functions/${FN}/entry.ts`;
const read = cli(['sandbox', 'read', rel, '--json']);
let live;
try {
  live = (JSON.parse(read.stdout).files ?? []).find((f) => f.path === rel)?.content;
} catch {
  fail("Lecture de la fonction dans l'éditeur impossible.", read.text);
}
const expected = fs.readFileSync(path.join(KIT, 'expected', `${FN}.entry.ts`), 'utf8');
const mine = fs.readFileSync(path.join(REPO_B44, 'functions', FN, 'entry.ts'), 'utf8');
if (live == null) fail(`${FN} introuvable dans l'éditeur.`);
if (norm(live) !== norm(expected) && norm(live) !== norm(mine)) {
  fail(`${FN} a été modifiée dans l'éditeur base44 depuis ma lecture : rien n'a été écrasé.`);
}
console.log('   ✔ aucune modification entre-temps');

console.log('\n[2/3] Déploiement…');
fs.rmSync(WORK, { recursive: true, force: true });
const dir = path.join(WORK, 'base44', 'functions', FN);
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(WORK, 'base44', 'config.jsonc'), JSON.stringify({ name: 'AfriGo' }, null, 2) + '\n');
for (const file of ['entry.ts', 'function.jsonc']) {
  fs.copyFileSync(path.join(REPO_B44, 'functions', FN, file), path.join(dir, file));
}
const dep = cli(['functions', 'deploy', FN], { cwd: WORK });
if (!dep.ok) fail('Déploiement refusé.', dep.text);
console.log(`   ✔ ${FN} en ligne`);

console.log("\n[3/3] Recopie dans l'éditeur base44…");
const w = cli(['sandbox', 'write', rel, '--overwrite'], { input: mine });
if (!w.ok) fail(`Écriture impossible de ${rel}.`, w.text);
const cp = cli(['sandbox', 'checkpoint', '--name', 'Rappel panier : un seul rappel par panier abandonné']);
console.log(cp.ok ? '   ✔ éditeur à jour, point de restauration créé' : '   ✔ éditeur à jour (point de restauration non créé, sans gravité)');

console.log(`
✅ Terminé : un seul rappel par panier abandonné. Le Workflow « Rappel panier
   abandonné » (toutes les 30 min) n'est pas modifié.`);
