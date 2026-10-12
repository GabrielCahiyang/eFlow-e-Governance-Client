// NW2.1/NW2.2/NW4.1/NW4.2: disposable PostgreSQL, synthetic claims and actual private
// evidence guards. This is local compatibility, not JWT/Storage/live acceptance.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { phase65Database } from '../tests/sql/helpers/phase65Database.mjs';
import { verifyOwnLeadExecution } from '../tests/sql/helpers/nestedWorkExecution.mjs';
import { verifyOfficeReviewRouting } from '../tests/sql/helpers/nestedWorkReview.mjs';
import { verifyNestedWorkCompletion } from '../tests/sql/helpers/nestedWorkCompletion.mjs';
import { verifyNestedWorkOperationSafety } from '../tests/sql/helpers/nestedWorkOperationSafety.mjs';
import { verifyNestedWorkImpact } from '../tests/sql/helpers/nestedWorkImpact.mjs';
import { verifyNestedWorkMaterialDate } from '../tests/sql/helpers/nestedWorkMaterialDate.mjs';

// Reviewed order from NW1.3. Never glob pending migrations or rewrite old runners.
const integration = [
 '20261009120000_refinement_project_creation_compatibility.sql',
 '20260831000001_task_evidence_security.sql',
 '20261007120000_r3_personal_workspaces.sql',
 '20261008030659_r6_project_file_library.sql',
 '20261008035748_r7_project_members_and_nested_work.sql',
 '20261008060756_r8_approved_project_invitations.sql',
 '20261008081855_r9_project_access_lifecycle.sql',
 '20261009120100_refinement_office_removal_guest_termination.sql',
 '20261008123723_r11_project_activity_snapshots.sql',
 '20261008134347_r12_presentation_settings.sql',
];
const corrections = [
 '20261010103936_nested_work_capabilities_and_execution.sql',
 '20261010105440_nested_work_own_lead_execution.sql',
 '20261010144145_nested_work_office_review_routing.sql',
 '20261010161650_nested_work_approval_consistency.sql',
 '20261010164510_nested_work_operation_safety.sql',
  '20261010172348_nested_work_r9_staffing_removal.sql',
 '20261010175812_nested_work_checked_confirmation.sql',
 '20261011071015_nested_work_material_date_preview.sql',
];
const baselineHashes = {
 '20261008035748_r7_project_members_and_nested_work.sql': '7968b5506f701a33d68cee4a8caa99df',
 '20261008060756_r8_approved_project_invitations.sql': 'bfc975054ca520d2c92a72a608476d1a',
 '20261008081855_r9_project_access_lifecycle.sql': 'e591af80fbdfd387b6dcf292f9bb0af8',
 '20261009120000_refinement_project_creation_compatibility.sql': '56698997d74d4ec6e6ea61ea80171826',
 '20261009120100_refinement_office_removal_guest_termination.sql': 'f58bee3f2c6968923cba704da1001418',
};
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const rootKeys = ['manage_contributors','appoint_lead','create_child','order_children'];
const nodeKeys = [...rootKeys,'edit_details','move','delete','execute','submit','review'];
let db, root, request = 8000, checks = 0;
const value = async (sql, args = []) => Object.values((await db.query(sql, args)).rows[0])[0];
const check = (condition, label) => { assert.ok(condition, label); checks++; };
const equal = (actual, expected, label) => { assert.deepEqual(actual, expected, label); checks++; };
const actor = async n => {
 await db.exec('reset role');
 await value("select set_config('request.jwt.claim.sub',$1,false)", [n ? id(n) : '']);
 await db.exec('set role authenticated');
};
const tree = () => value('select r7_work_tree($1)', [root]);
const node = async n => (await tree()).nodes.find(row => row.id === id(n));
const command = async (name, payload) => value('select r7_work_command($1,$2,$3,$4,$5::jsonb)',
 [root, (await tree()).revision, id(request++), name, JSON.stringify(payload)]);
const entry = (map, key, allowed, reason = null) => equal(map[key], { allowed, reason_code: reason }, key);
const state = async () => {
 await db.exec('reset role');
 return value(`select jsonb_build_object('task',(select to_jsonb(t) from tasks t where id=$1),
  'nodes',(select jsonb_agg(to_jsonb(n) order by id) from subtasks n where task_id=$1),
  'revision',(select revision from eflow_r7.tree_state where root_id=$1),
  'receipts',(select count(*) from eflow_r7.receipts),'events',(select count(*) from work_tree_events),
  'progress',(select count(*) from subtask_progress_updates),'submissions',(select count(*) from subtask_submissions),
  'seals',(select count(*) from eflow_evidence.objects),'notifications',(select count(*) from notifications))`, [root]);
};
// Every failed public operation must leave rows, revision and receipts intact.
const deny = async (who, sql, args = [], pattern) => {
 const before = await state();
 await actor(who);
 await assert.rejects(db.query(sql, args), pattern);
 checks++;
 equal(await state(), before, 'denial is atomic');
 await actor(who);
};
const denyCommand = async (who, name, payload, pattern) => {
 await actor(who);
 const revision = (await tree()).revision;
 await deny(who, 'select r7_work_command($1,$2,$3,$4,$5::jsonb)',
  [root, revision, id(request++), name, JSON.stringify(payload)], pattern);
};
const stripped = snapshot => ({ ...snapshot,
 root: Object.fromEntries(Object.entries(snapshot.root).filter(([key]) => key !== 'capabilities')),
 nodes: snapshot.nodes.map(row => Object.fromEntries(Object.entries(row).filter(([key]) => key !== 'capabilities'))),
});
const install = async file => {
 const sql = await readFile(new URL('../supabase/migrations/' + file, import.meta.url), 'utf8');
 if (baselineHashes[file]) equal(createHash('md5').update(sql.replace(/\r/g, '')).digest('hex'), baselineHashes[file], 'NW1 effective baseline ' + file);
 await db.exec(sql);
 console.log(`installed ${file} sha256=${createHash('sha256').update(sql).digest('hex')}`);
};

try {
 console.log('Stage NW2.1 / NW-F01: phase65Database({repositoryContinuation:true}); 20 helper migrations, explicit integration/correction manifest; no hosted writes.');
 const helper = await readFile(new URL('../tests/sql/helpers/phase65Database.mjs',import.meta.url),'utf8');
 equal(createHash('sha256').update(helper).digest('hex'),'2cc398014076fd5e2b9c20b4b698e54851c5fb9aa0719597e26cf9f877f4ae70','NW1.3 helper unchanged');
 db = await phase65Database({ repositoryContinuation: true });
 for (const list of ['migrations','continuation']) {
  const files = [...helper.match(new RegExp(`const ${list} = \\[([\\s\\S]*?)\\];`))[1].matchAll(/'(\d{14}_[a-z0-9_]+\.sql)'/g)].map(match=>match[1]);
  equal(files.length,10,'reviewed helper '+list+' count');
  for (const file of files) {
   const sql=await readFile(new URL('../supabase/migrations/'+file,import.meta.url));
   console.log(`helper installed ${file} sha256=${createHash('sha256').update(sql).digest('hex')}`);
  }
 }
 await install(integration[0]);
 await db.exec(`create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,owner_id text,metadata jsonb,created_at timestamptz default now(),unique(bucket_id,name));
  alter table storage.objects enable row level security;grant usage on schema storage to authenticated;grant all on storage.objects to authenticated;
  insert into storage.buckets(id,name,public) values('task-attachments','task-attachments',false);
  insert into organizations(id,name,slug,path,org_type) values('${id(90)}','Office A','office_a','office_a','department'),('${id(91)}','Office B','office_b','office_b','department');
  insert into auth.users(id,email,email_confirmed_at) values ${Array.from({length:24},(_,i)=>i+1).map(n=>`('${id(n)}','p${n}@example.test',${n===9?'null':'now()'})`).join(',')};
  insert into profiles(id,full_name,email,employee_id,role,is_active,org_id) values ${Array.from({length:24},(_,i)=>i+1).map(n=>`('${id(n)}','${[5,6].includes(n)?'Same name':'Person '+n}','p${n}@example.test','${n}','${n===1?'admin':'member'}',${n===8?'false':'true'},'${n===7?id(91):id(90)}')`).join(',')};`);
 await value("select set_config('request.jwt.claim.sub',$1,false)", [id(1)]);
 await value('select set_organization_leadership($1,$2,null)', [id(90),id(2)]);
 await value('select set_organization_leadership($1,$2,null)', [id(91),id(7)]);
 await value("select set_config('request.jwt.claim.sub',$1,false)", [id(2)]);
 const project = await value('select (create_project_with_details($1::jsonb)).id', [JSON.stringify({title:'NW2.1 synthetic scope',org_id:id(90),status:'planning'})]);
 const group = await value('select id from project_groups where project_id=$1 order by position limit 1', [project]);
 root = await value('select (phase3_create_task($1,$2,$3)).id', [project,group,'NW2.1 root']);
 // Pre-install backfill control, matching the existing integrated harness.
 await db.exec('set session_replication_role=replica');
 await db.query("update tasks set status='todo',assigned_to=$1,team_member_ids=$2::uuid[],due_date='2026-12-31',percent_complete=37,recommendation_lead_id=$4 where id=$3", [id(3),[id(3),id(4)],root,id(5)]);
 await db.query("insert into subtasks(id,task_id,title,position,assigned_to,assigned_to_ids,created_by,due_date) values($1,$2,'Legacy flat control',0,$3,$4::uuid[],$5,'2026-12-20')", [id(100),root,id(4),[id(4)],id(3)]);
 await db.exec('set session_replication_role=origin');
 const originalRoot = await value('select to_jsonb(t) from tasks t where id=$1', [root]);
 for (const file of integration.slice(1)) await install(file);
 equal(await value('select to_jsonb(t) from tasks t where id=$1', [root]), originalRoot, 'backfill preserves manual progress/root');
 await actor(2);
 const office = await value('select id from project_offices where project_id=$1 and office_id=$2', [project,id(90)]);
 await value('select phase6_set_members($1,$2::uuid[])', [office,[2,3,4,5,6,10,13,14,15,16].map(id)]);
 const grant = await value('select r9_grant_access($1,$2,$3,$4,$5,null,true)', [id(7000),project,'p11@example.test','viewer','Permanent']);
 await actor(11); await value('select r9_open_share($1)', [grant.id]);
 await db.exec('reset role;set session_replication_role=replica');
 await db.query("insert into project_offices(id,project_id,office_id,relationship_type,invitation_status) values($1,$2,$3,'collaborating','joined')", [id(2800),project,id(91)]);
 await db.exec('set session_replication_role=origin');
 await actor(3);
 await command('staff',{id:id(100),lead:id(15),people:[id(15)]});
 for (const payload of [
  {id:id(101),parent:id(100),title:'Parent',lead:id(4),people:[id(4)],standalone:true},
  {id:id(102),parent:id(101),title:'Target',lead:id(5),people:[id(5),id(6)],standalone:true},
  {id:id(103),title:'Other branch',lead:id(16),people:[id(16)],standalone:true},
  {id:id(104),parent:id(102),title:'Target child A',lead:id(5),standalone:true},
  {id:id(105),parent:id(102),title:'Target child B',lead:id(5),standalone:true},
  {id:id(106),parent:id(101),title:'Untouched leaf',lead:id(5),people:[id(5),id(6)],standalone:true},
 ]) await command('create',payload);
 const actors = [2,3,4,5,6,7,10,11,15,16];
 const legacy = new Map();
 for (const who of actors) { await actor(who); legacy.set(who,await tree()); }
 await db.exec('reset role');
 const acl = await value("select jsonb_agg(jsonb_build_object('name',oid::regprocedure::text,'acl',proacl,'config',proconfig,'definer',prosecdef) order by oid) from pg_proc where oid in ('eflow_r7.snapshot(uuid)'::regprocedure,'eflow_r7.command(uuid,integer,uuid,text,jsonb)'::regprocedure,'public.r7_work_tree(uuid)'::regprocedure,'public.r7_work_command(uuid,integer,uuid,text,jsonb)'::regprocedure)");
 const currentBodies = await value("select jsonb_agg(jsonb_build_object('name',proname,'body',prosrc) order by proname) from pg_proc where pronamespace='eflow_r7'::regnamespace and proname in ('root','member','manage','chain','node_work','reviewer','pending_reviewer','command','guard_root','guard_node','guard_completion')");
 // Keep all NW2.1 assertions against its own stage before the execution change.
 await install(corrections[0]);
 equal(await value("select jsonb_agg(jsonb_build_object('name',oid::regprocedure::text,'acl',proacl,'config',proconfig,'definer',prosecdef) order by oid) from pg_proc where oid in ('eflow_r7.snapshot(uuid)'::regprocedure,'eflow_r7.command(uuid,integer,uuid,text,jsonb)'::regprocedure,'public.r7_work_tree(uuid)'::regprocedure,'public.r7_work_command(uuid,integer,uuid,text,jsonb)'::regprocedure)"),acl,'existing security/grants unchanged');
 equal(await value("select jsonb_agg(jsonb_build_object('name',proname,'body',prosrc) order by proname) from pg_proc where pronamespace='eflow_r7'::regnamespace and proname in ('root','member','manage','chain','node_work','reviewer','pending_reviewer','command','guard_root','guard_node','guard_completion')"),currentBodies,'effective authority/work/reviewer/guard bodies unchanged');
 for (const role of ['anon','authenticated','service_role']) check(!await value('select has_function_privilege($1,$2,$3)',[role,'eflow_r7.operation_capabilities(uuid,uuid)','EXECUTE']),role+' cannot call private projector');
 check(!await value("select has_function_privilege('anon','public.r7_work_command(uuid,integer,uuid,text,jsonb)','EXECUTE')"),'anonymous mutation denied');
 const unavailable = await value('select eflow_r7.operation_capabilities($1,$2)',[root,id(9999)]);
 for (const key of nodeKeys) entry(unavailable,key,false,'access_unavailable');
 for (const who of actors) {
  await actor(who); const snapshot=await tree();
  equal(stripped(snapshot),legacy.get(who),'all legacy snapshot values retained for actor '+who);
  equal(Object.keys(snapshot.root.capabilities).sort(),rootKeys.toSorted(),'root action keys');
  for (const row of snapshot.nodes) {
   equal(Object.keys(row.capabilities).sort(),nodeKeys.toSorted(),'node action keys');
   for (const item of Object.values(row.capabilities)) check(typeof item.allowed==='boolean' && (item.allowed ? item.reason_code===null : typeof item.reason_code==='string'),'reason entry is stable/explicit');
  }
 }
 console.log(`Fixture root=${root}; project=${project}; canonical tree 100(Lead15) > 101(Lead4) > 102(Lead5,workers5/6), siblings104/105, other branch103; root manual progress=37.`);
 await actor(3);
 for (const key of rootKeys.filter(key=>key!=='appoint_lead')) entry((await tree()).root.capabilities,key,true);
 entry((await tree()).root.capabilities,'appoint_lead',false,'appointment_denied');
 await command('contributors',{people:[id(3),id(4),id(5)]});
 await command('order',{parent:null,order:[id(103),id(100)]});
 await deny(3,'select phase3_create_task($1,$2,$3)',[project,group,'No project-structure escalation'],/responsible Office Head/);
 await deny(3,'insert into project_groups(project_id,title) values($1,$2)',[project,'No group escalation'],/row-level security/);
 await denyCommand(3,'root_lead',{lead:id(4)},/responsible Head/);
 await denyCommand(3,'create',{id:id(500),title:'Forged Office',office:id(91)},/Unsupported branch fields/);
 await actor(2); for (const key of rootKeys) entry((await tree()).root.capabilities,key,true);
 entry((await node(106)).capabilities,'execute',false,'branch_denied');
 await command('staff',{id:id(106),lead:id(5),people:[id(5),id(6)]});
 await actor(5);
 entry((await node(102)).capabilities,'manage_contributors',true);
 entry((await node(102)).capabilities,'appoint_lead',false,'appointment_denied');
 entry((await node(102)).capabilities,'order_children',true);
 check(!(await node(102)).can_order,'legacy own-sibling ordering flag differs from new child-list action');
 await command('staff',{id:id(102),lead:id(5),people:[id(5),id(6)]});
 await command('order',{parent:id(102),order:[id(105),id(104)]});
 await command('create',{id:id(107),parent:id(102),title:'Own branch creation',lead:id(5),standalone:true});
 await denyCommand(5,'staff',{id:id(102),lead:id(16),people:[id(5),id(6),id(16)]},/Branch staffing denied/);
 entry((await node(101)).capabilities,'manage_contributors',false,'branch_denied');
 await denyCommand(5,'staff',{id:id(101),lead:id(4),people:[id(4)]},/Branch staffing denied/);
 await denyCommand(5,'order',{parent:id(101),order:[id(106),id(102)]},/Sibling ordering denied/);
 entry((await node(106)).capabilities,'move',true); // source prerequisite, destination remains checked
 await denyCommand(5,'move',{id:id(106),parent:id(103)},/Destination branch denied/);
 await command('edit',{id:id(106),title:'Leaf rename',due:'2026-12-19',standalone:true});
 await actor(4); entry((await node(102)).capabilities,'appoint_lead',true);
 entry((await node(106)).capabilities,'execute',false,'branch_denied');
 await deny(4,'select save_subtask_progress($1,20,null,null,null,null,null,null)',[id(106)]);
 for (const who of [6,7,10,11,16]) {
  await actor(who);
  for (const key of rootKeys.filter(k=>k!=='appoint_lead')) entry((await tree()).root.capabilities,key,false,'branch_denied');
  entry((await node(102)).capabilities,'manage_contributors',false,'branch_denied');
  await denyCommand(who,'staff',{id:id(102),lead:id(5),people:[id(5),id(6)]});
  await denyCommand(who,'create',{id:id(600+who),parent:id(102),title:'Denied escalation'});
 }
 await actor(6);
 entry((await node(106)).capabilities,'execute',true);
 entry((await node(106)).capabilities,'submit',true);
 await value('select save_subtask_progress($1,20,null,null,null,$2,null,null)',[id(106),'NW2.1 real evidence guard progress']);
 // Real authenticated Storage policy and durable seal; no automatic path repair.
 const attempt=id(7100),path=`subtasks/${id(106)}/${attempt}/control.pdf`;
 await db.query('insert into storage.objects(bucket_id,name,owner_id,metadata) values($1,$2,$3,$4::jsonb)', ['task-attachments',path,id(6),JSON.stringify({size:12,mimetype:'application/pdf'})]);
 await value('select submit_subtask_for_review($1,$2::jsonb)',[id(106),JSON.stringify({id:attempt,note:'Control evidence',attachments:[{fileName:'control.pdf',filePath:path,fileSize:12,mimeType:'application/pdf'}]})]);
 entry((await node(106)).capabilities,'execute',false,'lifecycle_blocked');
 entry((await node(106)).capabilities,'submit',false,'lifecycle_blocked');
 await deny(6,'select save_subtask_progress($1,20,null,null,null,null,null,null)',[id(106)]);
 await actor(4); entry((await node(106)).capabilities,'review',true);
 await deny(4,'select decide_subtask_review($1,false,null)',[id(106)],/Feedback/);
 await value('select decide_subtask_review($1,true,null)',[id(106)]);
 await db.exec('reset role');
 check(await value("select count(*)=1 from eflow_evidence.objects where subtask_id=$1 and state='finalized'",[id(106)]),'actual evidence sealing installed');
 equal(await value('select jsonb_build_object(\'worker\',submitter_id,\'reviewer\',decided_by) from subtask_submissions where id=$1',[attempt]),{worker:id(6),reviewer:id(4)},'historical actors preserved (NW4 own-Lead-first correction remains deferred)');
 await actor(3);
 entry((await node(106)).capabilities,'delete',false,'lifecycle_blocked');
 entry((await node(101)).capabilities,'edit_details',false,'lifecycle_blocked');
 entry((await node(101)).capabilities,'create_child',true); // current create checks parent only
 await denyCommand(3,'delete',{id:id(101)},/untouched/);
 // A real progress record survives a trusted reset-looking state and prevents delete.
 await actor(5); await value('select save_subtask_progress($1,0,null,null,null,$2,null,null)',[id(107),'History at zero']);
 await actor(3); entry((await node(107)).capabilities,'delete',false,'history_blocked');
 await denyCommand(3,'delete',{id:id(107)},/history/i);
 await actor(3);
 // Unappointed planning work is preserved, without fabricating an executor.
 await command('create',{id:id(310),title:'Unappointed planning',standalone:true});
 equal((await node(310)).lead_id,null,'planning has no implicit Lead');
 entry((await node(310)).capabilities,'appoint_lead',true);
 entry((await node(310)).capabilities,'manage_contributors',false,'lifecycle_blocked');
 entry((await node(310)).capabilities,'execute',false,'branch_denied');
 await command('create',{id:id(311),title:'Untouched deletable control',lead:id(3),standalone:true});
 entry((await node(311)).capabilities,'delete',true);
 await command('delete',{id:id(311)});
 let parent=id(103);
 for (let depth=2;depth<=8;depth++) { await command('create',{id:id(200+depth),parent,title:'Depth '+depth,lead:id(16),standalone:true});parent=id(200+depth); }
 entry((await node(208)).capabilities,'create_child',false,'lifecycle_blocked');
 await denyCommand(3,'create',{id:id(209),parent,title:'Depth nine'},/depth is 8/);
 await command('create',{id:id(300),title:'Ordered first',lead:id(5)});
 await command('create',{id:id(301),title:'Ordered second',lead:id(5)});
 await actor(5); entry((await node(301)).capabilities,'execute',false,'lifecycle_blocked');
 await deny(5,'select save_subtask_progress($1,20,null,null,null,null,null,null)',[id(301)],/Complete Step/);
 // Membership changes use trusted fixture privileges, never hosted accounts.
 for (const stateSql of ["access_end=now()-interval '1 second',engagement='OJT'",'access_end=null,engagement=\'Permanent\',access_ended_at=now()']) {
  await db.exec('reset role');await db.query(`update project_office_members set ${stateSql} where project_office_id=$1 and user_id=$2`,[office,id(5)]);
  await actor(5);await assert.rejects(tree());checks++;
  await deny(5,'select save_subtask_progress($1,20,null,null,null,null,null,null)',[id(102)]);
 }
 await db.exec('reset role');await db.query("update project_office_members set access_end=null,access_ended_at=null,engagement='Permanent' where project_office_id=$1 and user_id=$2",[office,id(5)]);
 await db.query("update project_office_members set access_end=now()-interval '1 second',engagement='OJT' where project_office_id=$1 and user_id=$2",[office,id(4)]);
 await actor(5);entry((await node(102)).capabilities,'manage_contributors',false,'branch_denied');
 entry((await node(102)).capabilities,'execute',false,'branch_denied');
 await denyCommand(5,'create',{id:id(400),parent:id(102),title:'Broken chain'});
 await db.exec('reset role');await db.query("update project_office_members set access_end=null,engagement='Permanent' where project_office_id=$1 and user_id=$2",[office,id(4)]);
 for (const who of [1,8,9,null]) await deny(who,'select r7_work_command($1,1,$2,$3,$4::jsonb)',[root,id(request++),'create',JSON.stringify({id:id(900+(who||0)),title:'Unavailable actor'})]);
 // Closed root keeps authorized historical reads but denies every operation.
 await db.exec('reset role;set session_replication_role=replica');await db.query("update tasks set status='completed' where id=$1",[root]);await db.exec('set session_replication_role=origin');
 await actor(3);
 for (const map of [(await tree()).root.capabilities,(await node(102)).capabilities]) for (const key of Object.keys(map)) entry(map,key,false,'lifecycle_blocked');
 await denyCommand(3,'contributors',{people:[id(3),id(4)]},/read-only/);
 // Personal branch retains its independent reviewer/work contract.
 await actor(21);
 const workspace=await value('select r3_create_workspace($1,$2,$3)',[id(7400),'Personal NW2.1','Asia/Singapore']);
 const personal=await value('select r3_create_personal_project($1,$2,$3)',[workspace.id,id(7401),'Personal project']);
 await value('select r3_personal_project_command($1,$2,$3::jsonb,$4)',[personal.id,'set_member',JSON.stringify({user_id:id(22),access:'member',state:'active'}),id(7402)]);
 await value('select r3_personal_project_command($1,$2,$3::jsonb,$4)',[personal.id,'create_task',JSON.stringify({title:'Personal task',lead_id:id(22)}),id(7403)]);
 const officeRoot=root;root=await value('select id from personal_tasks where project_id=$1',[personal.id]);
 entry((await tree()).root.capabilities,'manage_contributors',false,'read_only');
 await command('create',{id:id(7410),title:'Personal leaf',lead:id(22)});
 await actor(22);entry((await node(7410)).capabilities,'execute',true);entry((await node(7410)).capabilities,'submit',true);
 await command('progress',{id:id(7410),progress:25,note:'Personal control'});
 await command('submit',{id:id(7410),note:'Independent personal review'});
 await actor(21);entry((await node(7410)).capabilities,'review',true);
 await command('review',{id:id(7410),approve:true});
 root=officeRoot;
 console.log(`NW2.1 stage: ${checks} assertions passed before NW2.2 installation.`);
 checks += await verifyOwnLeadExecution({db,root,project,office,personalProject:personal.id,applyCorrection:()=>install(corrections[1])});
 console.log(`NW2.2 stage: ${checks} assertions passed before NW4.1 installation.`);
 checks += await verifyOfficeReviewRouting({db,root,project,office,personalProject:personal.id,applyCorrection:()=>install(corrections[2])});
 console.log(`NW4.1 correction PostgreSQL: ${checks} total assertions passed before NW4.2 completion matrix.`);
 checks += await verifyNestedWorkCompletion({db,root,project,personalProject:personal.id,applyCorrection:()=>install(corrections[3])});
 console.log(`NW4.2 correction PostgreSQL: ${checks} total assertions passed before NW5.1 installation.`);
 checks += await verifyNestedWorkOperationSafety({db,project,personalProject:personal.id,applyCorrection:()=>install(corrections[4]),applyRemoval:()=>install(corrections[5])});
 console.log(`NW5.1 correction PostgreSQL: ${checks} total assertions passed before NW5.2 installation.`);
 checks += await verifyNestedWorkImpact({db,project,applyCorrection:()=>install(corrections[6])});
 console.log(`NW5.2 correction PostgreSQL: ${checks} total assertions passed. Genuine JWT/Storage transport remains deferred.`);
 checks += await verifyNestedWorkMaterialDate({db,project,personalProject:personal.id,applyCorrection:()=>install(corrections[7])});
 console.log(`NW5.5 correction PostgreSQL: ${checks} total assertions passed. Genuine JWT/Storage transport remains deferred.`);
} finally { await db?.close(); }
