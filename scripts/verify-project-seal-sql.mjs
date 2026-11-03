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
const scratch = mkdtempSync(join(tmpdir(), 'eflow-project-pg-'));
const dataDir = join(scratch, 'data');
let started = false;
function command(name, args, input) {
  const result = spawnSync(binary(name), args, { input, encoding: 'utf8', windowsHide: true, timeout: name==='initdb'?180000:60000, ...(name === 'pg_ctl' ? { stdio: 'ignore' } : {}) });
  if (result.error || result.status !== 0) throw new Error(result.error?.message || result.stderr || result.stdout);
  return result.stdout;
}
const listener = createServer();
await new Promise((res, rej) => { listener.once('error', rej); listener.listen(0, '127.0.0.1', res); });
const port = listener.address().port;
await new Promise(res => listener.close(res));
const args = ['-X', '-q', '-v', 'ON_ERROR_STOP=1', '-h', '127.0.0.1', '-p', String(port), '-U', 'postgres', '-d', 'postgres'];
const sql = input => command('psql', args, input);
const sourceFunction = (file, name) => {
  const text = readFileSync(join(root, file), 'utf8');
  const start = text.indexOf(`create or replace function public.${name}(`);
  const end = text.indexOf('\n$$;', start);
  if (start < 0 || end < 0) throw new Error(`Missing ${name}`);
  return text.slice(start, end + 4);
};
try {
  command('initdb', ['-D', dataDir, '-U', 'postgres', '--auth-local=trust', '--auth-host=trust', '--encoding=UTF8', '--no-locale']);
  started = true;
  command('pg_ctl', ['-D', dataDir, '-l', join(scratch, 'postgres.log'), '-o', `-h 127.0.0.1 -p ${port}`, '-w', 'start']);
  sql(`create role anon; create role authenticated; create role service_role;
    create schema auth; create schema storage; create schema eflow_project; create schema cron;
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create table storage.buckets(id text primary key,name text,public boolean);
    create table storage.objects(id uuid,bucket_id text,name text);alter table storage.objects enable row level security;
    create function cron.schedule(text,text,text) returns bigint language sql as $$ select 1::bigint $$;`);
  sql(readFileSync(join(root, 'tests/sql/project-seal-schema.sql'), 'utf8'));
  sql(`alter table audit_events alter column id set default gen_random_uuid();
    alter table audit_events alter column created_at set default now();
    alter table notifications alter column id set default gen_random_uuid();
    alter table notifications alter column created_at set default now();
    create table test_closeout(project_id uuid primary key,blockers jsonb default '[]');
    create function public.project_completion_readiness_internal(p_id uuid) returns jsonb language sql as $$
      select jsonb_build_object('blockers',coalesce((select blockers from public.test_closeout where project_id=p_id),'[]'::jsonb)) $$;`);
  const migration = readFileSync(join(root, 'supabase/migrations/20261103070206_project_archive_publication_lifecycle.sql'), 'utf8')
    .replace('create extension if not exists pg_cron with schema pg_catalog;', '-- pg_cron mocked only in disposable local cluster');
  sql(migration);
  console.log('PASS: publication migration compiles on PostgreSQL 17.');
  sql(readFileSync(join(root, 'tests/sql/project-seal.sql'), 'utf8'));
  console.log('PASS: archive dates, blockers, authority, exact-byte review, immutable writes and safe retries.');
} finally {
  let stopped = !started;
  if (started) { try { command('pg_ctl', ['-D', dataDir, '-m', 'fast', '-w', 'stop']); stopped = true; } catch (error) { console.warn(`Test cluster retained at ${scratch}: ${error.message}`); } }
  const actual = realpathSync(scratch);
  if (stopped && actual.startsWith(realpathSync(tmpdir()) + sep) && basename(actual).startsWith('eflow-project-pg-')) {
    try { rmSync(actual, { recursive: true, maxRetries: 3, retryDelay: 200 }); } catch { console.warn(`Stopped test files retained at ${actual}`); }
  }
}
