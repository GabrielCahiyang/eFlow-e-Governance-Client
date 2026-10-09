import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
async function inventory(root, directory, accept = () => true) {
  const files = [];
  async function visit(path) {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      if (['.venv', '__pycache__', 'node_modules'].includes(entry.name)) continue;
      const target = resolve(path, entry.name);
      if (entry.isSymbolicLink()) throw new Error('Artifact inventory rejects symlinks.');
      if (entry.isDirectory()) await visit(target);
      else if (accept(target)) {
        const bytes = await readFile(target);
        files.push({ path: relative(root, target).replaceAll('\\', '/'), bytes: bytes.length, sha256: sha(bytes) });
      }
    }
  }
  await visit(resolve(root, directory));
  return files.sort((a, b) => a.path.localeCompare(b.path));
}
export async function snapshotCandidate(root) {
  const frontend = await inventory(root, 'dist');
  for (const path of ['dist/index.html', 'dist/eflow-view-modules.json'])
    if (!frontend.some(file => file.path === path)) throw new Error('A complete production build is required.');
  const gateway = await inventory(root, 'server', path => /\.py$|requirements[^/\\]*\.txt$/.test(path));
  const migrations = await inventory(root, 'supabase/migrations', path => path.endsWith('.sql'));
  const source = await inventory(root, 'src');
  source.push(...await inventory(root, '.github/workflows', path => /\.ya?ml$/.test(path)));
  for (const directory of ['scripts', 'tests']) source.push(...await inventory(root, directory, path => /\.(?:ts|tsx|mjs|py|sql|json|html|css)$/.test(path)));
  for (const path of ['package.json', 'package-lock.json', 'vite.config.ts', 'playwright.config.ts', 'playwright.release.config.ts', 'playwright.refinement.config.ts']) {
    const bytes = await readFile(resolve(root, path));
    source.push({ path, bytes: bytes.length, sha256: sha(bytes) });
  }
  source.sort((a, b) => a.path.localeCompare(b.path));
  const identity = { source, frontend, gateway, migrations };
  return { id: sha(JSON.stringify(identity)), ...identity };
}
export async function verifyFrozenCandidate(root, candidate) {
  if (!/^[a-f0-9]{64}$/.test(candidate.id)) throw new Error('Invalid candidate identity.');
  const prefix = `.refinement/artifacts/${candidate.id}/`;
  for (const [directory, original, expected] of [['frontend', 'dist', candidate.frontend], ['gateway', 'server', candidate.gateway]]) {
    const actual = (await inventory(root, prefix + directory)).map(file => ({ ...file, path: original + '/' + file.path.slice((prefix + directory + '/').length) }));
    if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`Frozen ${directory} bytes do not match the candidate.`);
  }
}
export async function verifyServedFrontend(baseURL, candidate) {
  for (const file of candidate.frontend) {
    const response = await fetch(new URL(file.path.slice('dist/'.length), baseURL.endsWith('/') ? baseURL : baseURL + '/'), { signal: AbortSignal.timeout(15_000) });
    if (!response.ok || sha(new Uint8Array(await response.arrayBuffer())) !== file.sha256) throw new Error('Preview does not serve the frozen frontend bytes.');
  }
}
export async function freezeCandidate(root) {
  const candidate = await snapshotCandidate(root);
  const destination = resolve(root, '.refinement/artifacts', candidate.id);
  await mkdir(destination, { recursive: true });
  await cp(resolve(root, 'dist'), resolve(destination, 'frontend'), { recursive: true, force: false, errorOnExist: false });
  for (const file of candidate.gateway) {
    const target = resolve(destination, 'gateway', file.path.slice('server/'.length));
    await mkdir(resolve(target, '..'), { recursive: true });
    await cp(resolve(root, file.path), target, { force: false });
  }
  await verifyFrozenCandidate(root, candidate);
  const record = { ...candidate, createdAt: new Date().toISOString(), gitHead: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), hostedTarget: 'ixnfphgjyelhckjwjkdv', deployed: false };
  await writeFile(resolve(destination, 'candidate.json'), JSON.stringify(record, null, 2)+'\n');
  await writeFile(resolve(root, '.refinement/candidate.json'), JSON.stringify(record, null, 2)+'\n');
  return record;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const candidate = await freezeCandidate(process.cwd());
  console.log(`Frozen frontend/gateway candidate ${candidate.id}; no deployment performed.`);
}
