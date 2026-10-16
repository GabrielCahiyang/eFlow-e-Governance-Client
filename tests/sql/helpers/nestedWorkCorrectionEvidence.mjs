import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';

const sha256 = data => createHash('sha256').update(data).digest('hex');
// Evidence is local and reproducible; no credentials or hosted state are read.
export function correctionEvidence({currentFinance=false}={}) {
 const installations = [], stages = [];
 return {
  installed(file, sql, source = 'runner') {
   const entry = { order: installations.length + 1, file, sha256: sha256(sql), source };
   installations.push(entry);
   console.log(`applied #${entry.order} ${file} sha256=${entry.sha256} (${source})`);
  },
  async stage(name, run) {
   const assertions = await run();
   stages.push({ name, assertions });
   return assertions;
  },
  async finish(db, totalAssertions, scenarios) {
   await db.exec('reset role');
   const functions = (await db.query(`select n.nspname schema, p.oid::regprocedure::text signature,
    pg_get_functiondef(p.oid) definition, p.prosecdef security_definer, p.proconfig config, p.proacl acl
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname in ('public','eflow_r7','eflow_r9','eflow_r3','eflow_evidence','eflow_budget','eflow_r11')
    and p.prokind='f' order by n.nspname, p.oid::regprocedure::text`)).rows
    .map(row => ({ ...row, sha256: sha256(row.definition) }));
   const view = (await db.query("select pg_get_viewdef('eflow_r11.events'::regclass,true) definition, reloptions from pg_class where oid='eflow_r11.events'::regclass")).rows[0];
   const required = {
    'eflow_r7.node_work(uuid,uuid)': ['n.lead_id=p_user'],
    'eflow_r7.reviewer(uuid,uuid)': ['then n.id else n.parent_subtask_id end'],
    'eflow_r7.command(uuid,integer,uuid,text,jsonb)': ['NW5.2 shared writer lock', 'require_operation'],
    'eflow_r7.operation_capabilities(uuid,uuid)': ['operation_impact'],
    'eflow_r7.work_impact(uuid,integer,text,jsonb)': ['date_impact'],
    'eflow_r7.checked_command(uuid,integer,uuid,text,jsonb,text)': ['impact changed', 'lock_impact'],
    'eflow_r7.require_completed_descendants(uuid,uuid)': ['resolve descendant'],
    'eflow_r9.remove_person(uuid,uuid,uuid,text,uuid)': ['lock_removal_work', 'clear_removed_staff'],
    'eflow_r9.lock_removal_work(uuid,uuid)': ['lock_completion', 'for update'],
   };
   for (const [signature, anchors] of Object.entries(required)) {
    const fn = functions.find(row => row.signature === signature);
    assert.ok(fn, 'Missing installed correction: ' + signature);
    for (const anchor of anchors) assert.ok(fn.definition.includes(anchor), signature + ': ' + anchor);
    console.log(`effective ${signature} sha256=${fn.sha256}`);
   }
   assert.ok(view.definition.includes('work_event'), 'Activity correction not installed');
   assert.ok(view.reloptions.includes('security_invoker=true'), 'Activity source RLS lost');
   assert.equal(new Set(installations.map(row => row.file)).size, 39, currentFinance
    ? '27 installed baseline source equivalents + evidence contract + 2 installed finance corrections + 9 pending NW corrections'
    : '20 helper + 10 integration + 9 corrections');
   assert.equal(stages.reduce((sum, row) => sum + row.assertions, 0), totalAssertions);
   const directory = new URL(currentFinance ? '../../../test-results/nw-correction-current-finance/' : '../../../test-results/nw-correction/', import.meta.url);
   await mkdir(directory, { recursive: true });
   await writeFile(new URL('effective-definitions.json', directory), JSON.stringify({ functions, view: { ...view, sha256: sha256(view.definition) } }, null, 2) + '\n');
   await writeFile(new URL('receipt.json', directory), JSON.stringify({
    status: 'passed', mode: currentFinance ? 'disposable current 29-version financial baseline source equivalents' : 'disposable repositoryContinuation', installations, stages,
    totalAssertions, finalScenarioCount: scenarios.length, scenarios,
    definitionCount: functions.length,
    limitations: ['Synthetic auth.uid claims; no signed JWT or provider expiry verification.',
     'Storage rows and metadata only; no object bytes, network upload or signed URL verification.',
     'PGlite runs serially; separate native runners are required for transaction concurrency.',
     currentFinance ? 'Reconstructed installed source equivalents and synthetic data; not a protected restore of the 29-version hosted database.' : 'Historical liveHistoryDirectory accepts an older 18-entry boundary, not the dated 27-entry hosted ledger.',
     'No hosted installation, acceptance, deployment, backup or restore proof.'],
   }, null, 2) + '\n');
   console.log(`NW10.1: ${totalAssertions} assertions; ${scenarios.length} final scenarios; 39 distinct migrations (${installations.length} applications including explicit idempotency reruns); ${functions.length} effective definitions recorded in ${directory.pathname}.`);
  },
 };
}
