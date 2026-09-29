// Disposable localhost PostgreSQL only. Never loads .env or a live database URL.
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:net';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const pgBin = process.env.EFLOW_TEST_PG_BIN || (process.platform === 'win32' ? 'C:/Program Files/PostgreSQL/17/bin' : '');
const binary = name => pgBin ? join(pgBin, name + (process.platform === 'win32' ? '.exe' : '')) : name;
const scratch = mkdtempSync(join(tmpdir(), 'eflow-defense-pg-'));
const dataDir = join(scratch, 'data');
let started = false;
function command(name, args, input) {
  const result = spawnSync(binary(name), args, { input, encoding: 'utf8', windowsHide: true, timeout: 60000, ...(name === 'pg_ctl' ? { stdio: 'ignore' } : {}) });
  if (result.error || result.status !== 0) throw new Error(result.error?.message || result.stderr || result.stdout);
  return result.stdout;
}
const listener = createServer();
await new Promise((res, rej) => { listener.once('error', rej); listener.listen(0, '127.0.0.1', res); });
const port = listener.address().port;
await new Promise(res => listener.close(res));
const args = ['-X', '-q', '-v', 'ON_ERROR_STOP=1', '-h', '127.0.0.1', '-p', String(port), '-U', 'postgres', '-d', 'postgres'];
const sql = input => command('psql', args, input);

try {
  command('initdb', ['-D', dataDir, '-U', 'postgres', '--auth-local=trust', '--auth-host=trust', '--encoding=UTF8', '--no-locale']);
  started = true;
  command('pg_ctl', ['-D', dataDir, '-l', join(scratch, 'postgres.log'), '-o', `-h 127.0.0.1 -p ${port}`, '-w', 'start']);
  sql(readFileSync(join(root, 'tests/sql/defense-revisions-fixture.sql'), 'utf8'));
  const migration = readFileSync(join(root, 'supabase/migrations/20260930000001_defense_revision_approval_and_duration.sql'), 'utf8');
  sql(migration); sql(migration);
  console.log('PASS: defense function changes compile and are repeatable.');
  sql(readFileSync(join(root, 'tests/sql/defense-revisions.sql'), 'utf8'));
  console.log('PASS: approval resend after edits, current-version invalidation, rapid-repeat suppression, permissions, terminal guards, and duration publication.');

} finally {
  let stopped = !started;
  if (started) { try { command('pg_ctl', ['-D', dataDir, '-m', 'fast', '-w', 'stop']); stopped = true; } catch (error) { console.warn(`Test cluster retained at ${scratch}: ${error.message}`); } }
  const actual = realpathSync(scratch);
  if (stopped && actual.startsWith(realpathSync(tmpdir()) + sep) && basename(actual).startsWith('eflow-defense-pg-')) {
    try { rmSync(actual, { recursive: true, maxRetries: 3, retryDelay: 200 }); } catch { console.warn(`Stopped test files retained at ${actual}`); }
  }
}
