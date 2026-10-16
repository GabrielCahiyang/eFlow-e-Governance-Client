// NW10.1 final installed state; synthetic claims/Storage metadata only.
import assert from 'node:assert/strict';

export async function verifyNestedWorkFinal({ db, project, office }) {
 let assertions = 0, request = 81000, root;
 const scenarios = [];
 const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
 const equal = (a, b, label) => { assert.deepEqual(a, b, label); assertions++; };
 const ok = (a, label) => { assert.ok(a, label); assertions++; };
 const value = async (sql, args = []) => Object.values((await db.query(sql, args)).rows[0])[0];
 const actor = async n => { await db.exec('reset role'); await value("select set_config('request.jwt.claim.sub',$1,false)", [id(n)]); await db.exec('set role authenticated'); };
 const setup = async (sql, args) => { await db.exec('reset role;set session_replication_role=replica'); try { await db.query(sql, args); } finally { await db.exec('set session_replication_role=origin'); } };
 const tree = () => value('select r7_work_tree($1)', [root]);
 const command = async (name, payload) => value('select r7_work_command($1,$2,$3,$4,$5::jsonb)', [root, (await tree()).revision, id(request++), name, JSON.stringify(payload)]);
 const preview = (name, payload, revision) => value('select nw_work_impact($1,$2,$3,$4::jsonb)', [root, revision, name, JSON.stringify(payload)]);
 const checked = (name, payload, impact, key) => value('select nw_work_command($1,$2,$3,$4,$5::jsonb,$6)', [root, impact.expected_revision, key, name, JSON.stringify(payload), impact.fingerprint]);
 const state = async () => {
  await db.exec('reset role');
  return value(`select jsonb_build_object('tasks',(select jsonb_agg(to_jsonb(t) order by id) from tasks t),
   'nodes',(select jsonb_agg(to_jsonb(t) order by id) from subtasks t),
   'events',(select jsonb_agg(to_jsonb(t) order by id) from work_tree_events t),
   'receipts',(select jsonb_agg(to_jsonb(t) order by root_id,request_id) from eflow_r7.receipts t),
   'seals',(select jsonb_agg(to_jsonb(t) order by object_name) from eflow_evidence.objects t),
   'submissions',(select jsonb_agg(to_jsonb(t) order by id) from subtask_submissions t),
   'allocations',(select jsonb_agg(to_jsonb(t) order by id) from work_budget_allocations t),
   'lines',(select jsonb_agg(to_jsonb(t) order by id) from work_budget_allocation_lines t),
   'ledger',(select jsonb_agg(to_jsonb(t) order by id) from budget_ledger_entries t))`);
 };
 const deny = async (who, sql, args, pattern) => {
  const before = await state(); await actor(who);
  await assert.rejects(db.query(sql, args), pattern); assertions++;
  equal(await state(), before, 'denial preserves full work/history/evidence/finance state'); await actor(who);
 };
 await actor(2);
 const group = await value('select id from project_groups where project_id=$1 order by position limit 1', [project]);
 root = await value('select (phase3_create_task($1,$2,$3)).id', [project, group, 'NW10 final installed state']);
 await setup("update tasks set assigned_to=$1,team_member_ids=$2::uuid[],status='todo',percent_complete=37,due_date='2026-12-31' where id=$3", [id(3), [3,4,5,6].map(id), root]);
 await actor(3);
 const nodes = Array.from({ length: 8 }, (_, i) => id(82000 + i));
 for (let i = 0; i < nodes.length; i++) await command('create', { id: nodes[i], parent: i ? nodes[i-1] : null, title: 'Depth ' + (i+1), lead: id(5), people: [id(5),id(6)], standalone: true });
 equal((await tree()).nodes.length, 8, 'depth eight preserved');
 await deny(3, 'select r7_work_command($1,$2,$3,$4,$5::jsonb)', [root, (await tree()).revision, id(request++), 'create', JSON.stringify({ id: id(82008), parent: nodes[7], title: 'Depth nine', lead: id(5) })], /depth/i);
 scenarios.push('depth-eight creation and atomic depth-nine rejection on final corrections');
 const leaf = nodes[7];
 await setup('update subtasks set assigned_to=null,assigned_to_ids=$1::uuid[] where id=$2', [[id(6)], leaf]);
 await actor(5);
 equal((await tree()).nodes.find(n => n.id === leaf).capabilities.execute.allowed, true, 'Lead-only execution after all corrections');
 await value('select save_subtask_progress($1,20,null,null,null,$2,null,null)', [leaf, 'Final installed Lead-only progress']);
 await actor(3);
 await deny(3, 'select save_subtask_progress($1,25,null,null,null,null,null,null)', [leaf], /denied|not assigned|cannot|not allowed/i);
 scenarios.push('Lead-only guarded progress and unassigned ancestor denial');
 await db.exec('reset role');
 equal(await value('select eflow_r7.reviewer($1,$2)', [leaf,id(6)]), id(5), 'own Lead first');
 equal(await value('select eflow_r7.reviewer($1,$2)', [leaf,id(5)]), id(3), 'submitter skipped across same-Lead ancestors');
 await setup('update profiles set is_active=false where id=$1', [id(5)]);
 await db.exec('reset role');
 equal(await value('select eflow_r7.reviewer($1,$2)', [leaf,id(6)]), id(3), 'invalid chain falls back to eligible Task Lead');
 await setup('update profiles set is_active=true where id=$1', [id(5)]);
 await actor(6);
 const attempt = id(83000), path = `subtasks/${leaf}/${attempt}/final.pdf`;
 await db.query('insert into storage.objects(bucket_id,name,owner_id,metadata) values($1,$2,$3,$4::jsonb)', ['task-attachments', path,id(6),JSON.stringify({ size:12,mimetype:'application/pdf' })]);
 await value('select submit_subtask_for_review($1,$2::jsonb)', [leaf, JSON.stringify({ id:attempt,note:'Final contributor evidence',attachments:[{ fileName:'final.pdf',filePath:path,fileSize:12,mimeType:'application/pdf' }] })]);
 await actor(6); await deny(6, 'select decide_subtask_review($1,true,null)', [leaf], /You cannot review your own subtask submission/);
 await actor(5); await value('select decide_subtask_review($1,true,null)', [leaf]);
 await db.exec('reset role');
 equal(await value('select jsonb_build_object(\'worker\',submitter_id,\'reviewer\',decided_by) from subtask_submissions where id=$1', [attempt]), { worker:id(6),reviewer:id(5) }, 'final formal review records own Lead and contributor');
 equal(await value("select count(*) from eflow_evidence.objects where subtask_id=$1 and state='finalized'", [leaf]), 1, 'formal evidence finalized');
 await actor(5);
 equal((await tree()).nodes.find(n => n.id === nodes[6]).status, 'todo', 'child approval does not approve parent');
 equal(await value('select percent_complete from tasks where id=$1', [root]), 37, 'manual root progress preserved');
 await deny(3, 'delete from subtasks where id=$1', [leaf], /history|denied|immutable|protected|structur/i);
 scenarios.push('final contributor submission, own-Lead decision, immutable evidence and independent parent/root state');
 await actor(3);
 const spare = id(84000); await command('create', { id:spare,title:'Untouched sibling',lead:id(4),people:[id(4),id(6)],standalone:true });
 const terms = { id:spare,title:'Checked final name' }, impact = await preview('edit',terms,(await tree()).revision), key = id(request++);
 await checked('edit',terms,impact,key); const committed = await state(); await actor(3);
 await checked('edit',terms,impact,key); equal(await state(),committed,'exact retry has no second write/event/receipt');
 await actor(3);
 const staleTerms = { id:spare,title:'Never stale save' }, stale = await preview('edit',staleTerms,(await tree()).revision);
 await command('create', { id:id(84001),title:'Revision changer',lead:id(4),standalone:true });
 await deny(3,'select nw_work_command($1,$2,$3,$4,$5::jsonb,$6)',[root,stale.expected_revision,id(request++),'edit',JSON.stringify(staleTerms),stale.fingerprint],/changed|revision|stale/i);
 await actor(6);
 equal((await tree()).nodes.find(n=>n.id===spare).capabilities.manage_contributors.allowed,false,'contributor cannot staff');
 await deny(6,'select r7_work_command($1,$2,$3,$4,$5::jsonb)',[root,(await tree()).revision,id(request++),'staff',JSON.stringify({id:spare,lead:id(6),people:[id(6)]})],/denied/i);
 await deny(6,'update subtasks set lead_id=$1 where id=$2',[id(6),spare],/Use the versioned nested work operation/);
 scenarios.push('checked exact retry, stale revision, RPC/direct-table contributor denial');
 await actor(5);
 const projectionSql = "select jsonb_agg(to_jsonb(v) order by event_id) from (select event_id,project_id,task_id,kind,title,detail,actor_name,occurred_at from eflow_r11.events where task_id=$1) v";
 const beforeProjection = await value(projectionSql,[root]);
 const events = await value('select r7_work_activity($1::uuid[])',[[root]]);
 ok(events.events.length > 0,'bounded work Activity readable');
 await db.exec('reset role');
 const recorded = (await db.query("select e.id,e.actor_name,e.before_data,e.after_data,v.work_event from work_tree_events e join eflow_r11.events v on v.event_id='work:'||e.id::text where e.root_id=$1",[root])).rows;
 ok(recorded.length > 0,'Activity correction projects final command events');
 for (const row of recorded) { equal(row.work_event.actor_name,row.actor_name,'historical actor unchanged'); equal(row.work_event.before_data,row.before_data,'historical before snapshot unchanged'); equal(row.work_event.after_data,row.after_data,'historical after snapshot unchanged'); }
 await setup("update project_office_members set access_ended_at=now() where project_office_id=$1 and user_id=$2",[office,id(5)]);
 await actor(5); await assert.rejects(tree(),/denied/i); assertions++;
 equal((await value('select r7_work_activity($1::uuid[])',[[root]])).events,[],'expired scope reveals no Activity rows');
 await setup('update project_office_members set access_ended_at=null where project_office_id=$1 and user_id=$2',[office,id(5)]);
 await actor(5);
 equal(await value(projectionSql,[root]),beforeProjection,'membership expiry does not rewrite projected history');
 scenarios.push('recorded Activity metadata, current expiry denial and immutable history');
 console.log(`NW10.1 final installed integration: ${assertions} assertions across ${scenarios.length} scenarios passed; root=${root}.`);
 return { assertions, scenarios };
}
