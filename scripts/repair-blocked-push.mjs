import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

// Rebuild only unpublished commits over origin/main, retaining the merged files.
// Run locally; never print credentials or upload the private recovery branch.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);
const note = 'New Text Document.txt';
const repairFiles = ['.gitignore', 'scripts/repair-blocked-push.mjs'];
const inspectOnly = process.argv.includes('--inspect');

function git(args, { allowed = [0], input } = {}) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8', input });
  if (result.error || !allowed.includes(result.status)) {
    // Some Git errors can quote file content. Do not echo their output here.
    throw new Error(`Git ${args[0]} failed. Check repository permissions/authentication. No credential values are printed.`);
  }
  return result.stdout.trim();
}

function envValues(file) {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8').split(/\r?\n/).flatMap(line => {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match) return [];
    let value = match[2];
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    return [{ name: match[1], value }];
  });
}

function assertNoSecrets(files, read) {
  const known = [...envValues('.env'), ...envValues('.env.local'), ...envValues(note)]
    .filter(({ name, value }) => /SECRET|PASSWORD|DATABASE_URL|SERVICE_ROLE|RESEND_API_KEY|CREDENTIAL/.test(name) && !name.startsWith('VITE_FIREBASE') && value.length >= 12);
  const format = /\bsb_secret_[A-Za-z0-9_-]{25,}|\bre_[A-Za-z0-9]{24,}\b/g;
  const unsafe = [];
  for (const file of files) {
    const content = read(file);
    const looksReal = Array.from(content.matchAll(format), match => match[0])
      .some(value => !/^sb_secret_(?:your|example|placeholder)_/i.test(value));
    if (looksReal || known.some(({ value }) => content.includes(value))) unsafe.push(file);
  }
  if (unsafe.length) throw new Error(`Private credentials remain in these files: ${unsafe.join(', ')}. Cleanup stopped.`);
}

function run() {
  if (git(['branch', '--show-current']) !== 'main') throw new Error('Switch to main before running this repair.');
  if (git(['diff', '--name-only', '--diff-filter=U'])) throw new Error('Resolve the current merge before running this repair.');
  if (git(['diff', '--cached', '--name-only'])) throw new Error('Unexpected staged changes exist. Commit or unstage them before running this repair.');
  const modified = git(['diff', '--name-only', 'HEAD']).split(/\r?\n/).filter(Boolean);
  if (modified.some(file => !repairFiles.includes(file))) throw new Error('Other tracked files changed. Save those changes separately before repairing history.');
  const before = git(['rev-parse', 'HEAD']);
  const base = git(['rev-parse', 'origin/main']);
  git(['merge-base', '--is-ancestor', base, before]);
  const unpublished = git(['rev-list', `${base}..${before}`]).split(/\r?\n/).filter(Boolean);
  if (unpublished.length !== 2 || !unpublished.includes('2921bc9d0d0009cd36438c7c2b07a524ccbfb18a')) {
    throw new Error('History differs from the reviewed two unpublished commits. Stop and review before rewriting anything.');
  }
  const localEnv = envValues('.env');
  for (const name of ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'RESEND_API_KEY']) {
    if (!localEnv.some(entry => entry.name === name && entry.value)) throw new Error(`The local .env needs ${name}; it has not been changed.`);
  }
  const envHash = crypto.createHash('sha256').update(fs.readFileSync('.env')).digest('hex');
  git(['check-ignore', '--no-index', '--quiet', '.env']);
  git(['check-ignore', '--no-index', '--quiet', note]);
  const tracked = git(['ls-files', '-z']).split('\0').filter(Boolean);
  assertNoSecrets(tracked.filter(file => file !== note), file => fs.readFileSync(file, 'utf8'));
  console.log('Verified: merged code retained; local .env configured; credential note is the only file to untrack.');
  if (inspectOnly) {
    console.log('Inspection complete. No Git history or environment files changed.');
    return;
  }

  // Keep a private local recovery reference before changing unpublished history.
  const recovery = `local-secret-recovery/${Date.now()}`;
  git(['branch', recovery, before]);
  console.log(`Private local recovery branch created: ${recovery}. Do not push this branch.`);
  git(['reset', '--soft', base]);
  git(['rm', '--cached', '--ignore-unmatch', '--', note]);
  git(['add', '--', ...repairFiles]);

  // Compare the staged tree with the previous merge. No application file may change.
  const changes = git(['diff', '--cached', '--name-only', before]).split(/\r?\n/).filter(Boolean);
  if (changes.some(file => file !== note && !repairFiles.includes(file))) throw new Error('Unexpected staged differences found. Recovery branch retained; do not push.');
  const staged = git(['ls-files', '-z']).split('\0').filter(Boolean);
  if (staged.includes(note) || staged.some(file => /(^|\/)\.env(?:\.|$)/.test(file) && file !== '.env.example')) throw new Error('Private environment files are still tracked. Do not push.');
  git(['diff', '--quiet']);
  assertNoSecrets(staged, file => fs.readFileSync(file, 'utf8'));
  if (crypto.createHash('sha256').update(fs.readFileSync('.env')).digest('hex') !== envHash) throw new Error('Local .env changed unexpectedly. Do not push.');
  git(['commit', '-m', 'Preserve merged project improvements and exclude local credentials']);
  if (git(['rev-parse', 'HEAD^']) !== base || git(['rev-list', '--count', `${base}..HEAD`]) !== '1') throw new Error('Unexpected final history; do not push.');
  console.log('Repaired: one clean unpublished commit on top of GabzCah\'s main. All merged application files and local .env are unchanged.');
  console.log('Now run: git push origin main');
}

try { run(); } catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
