// NW5.2: actual fixed RPCs, immutable historical controls and real cap writer.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
export async function verifyNestedWorkImpact({db,project,applyCorrection}) {
 let checks=0,key=31000,root;
 const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
 const value=async(sql,args=[])=>Object.values((await db.query(sql,args)).rows[0])[0];
 const equal=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;};
 const ok=(a,label)=>{assert.ok(a,label);checks++;};
 const actor=async n=>{await db.exec('reset role');await value("select set_config('request.jwt.claim.sub',$1,false)",[n?id(n):'']);await db.exec('set role authenticated');};
 const catalog=()=>value("select jsonb_agg(jsonb_build_object('name',p.oid::regprocedure::text,'body',p.prosrc,'acl',p.proacl,'args',pg_get_function_arguments(p.oid),'return',pg_get_function_result(p.oid),'config',p.proconfig,'definer',p.prosecdef,'volatility',p.provolatile) order by p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','eflow_r7','eflow_r9','eflow_r3','eflow_evidence','eflow_budget')");
 const access=()=>value("select jsonb_build_object('policies',(select jsonb_agg(to_jsonb(p) order by schemaname,tablename,policyname) from pg_policies p),'tables',(select jsonb_agg(jsonb_build_object('id',c.oid,'acl',c.relacl,'rls',c.relrowsecurity,'forced',c.relforcerowsecurity) order by c.oid) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','eflow_r7','eflow_r9','eflow_r3','eflow_evidence','eflow_budget') and c.relkind in ('r','v')))");
 await db.exec('reset role');const oldCatalog=await catalog(),oldAccess=await access();await applyCorrection();
 equal(await access(),oldAccess,'all existing RLS and table/view ACLs preserved');
 const after=await catalog();equal(after.filter(f=>!oldCatalog.some(o=>o.name===f.name)).map(f=>f.name).sort(),[
  'eflow_r7.history_roots(jsonb)','eflow_r7.lock_impact(uuid)','eflow_r7.serialize_history()',
  'eflow_r7.impact_fingerprint(uuid,text,jsonb,jsonb)','eflow_r7.work_path(uuid,uuid)',
  'eflow_r7.work_impact(uuid,integer,text,jsonb)','eflow_r7.checked_command(uuid,integer,uuid,text,jsonb,text)',
  'nw_work_impact(uuid,integer,text,jsonb)','nw_work_command(uuid,integer,uuid,text,jsonb,text)',
 ].sort(),'exact nine bounded helper/wrapper signatures, no replacement API');
 const source=await readFile(new URL('../../../supabase/migrations/20261010175812_nested_work_checked_confirmation.sql',import.meta.url),'utf8');
 const writerPatch=source.slice(source.indexOf('for entry in select * from (values'));
 const patches=[...writerPatch.matchAll(/ \('([^']+)',('(?:[^']|'')*')\)/g)].map(m=>[m[1],m[2].slice(1,-1).replaceAll("''","'")]);equal(patches.length,37,'reviewed writer inventory');
 for(const f of oldCatalog){const a=after.find(a=>a.name===f.name),patch=patches.find(([name])=>name===f.name);
  const body=patch?f.body.replace(/\bbegin\b/i,'begin /* NW5.2 shared writer lock */ '+patch[1]):f.body;
  equal(a,{...f,body},'only lock preamble, exact existing body/defaults/return/ACL '+f.name);
 }
 await applyCorrection();equal(await catalog(),after,'migration rerun preserves definitions');
 for(const f of after.filter(f=>!oldCatalog.some(o=>o.name===f.name))){
  equal(f.config,['search_path=""'],'fixed empty path '+f.name);
  equal(f.return,f.name.includes('history_roots')?'uuid[]':f.name.includes('lock_impact')?'void':f.name.includes('serialize_history')?'trigger':f.name.includes('fingerprint')?'text':'jsonb','fixed return '+f.name);
  const isWrapper=f.name.startsWith('nw_work_'),callable=isWrapper||f.name.startsWith('eflow_r7.work_impact(')||f.name.startsWith('eflow_r7.checked_command(');
  equal(f.definer,!isWrapper,'invoker entry point and private definer '+f.name);
  equal(await value("select has_function_privilege('authenticated',$1,'execute')",[f.name]),callable,'exact authenticated helper grant '+f.name);
  for(const role of ['anon','service_role'])equal(await value(`select has_function_privilege('${role}',$1,'execute')`,[f.name]),false,'API role denied '+role+' '+f.name);
 }
 equal(await value("select jsonb_agg(tgrelid::regclass::text order by tgrelid::regclass::text) from pg_trigger where tgname='a_nw52_history_serialization' and tgenabled='O'"),[
  'subtask_progress_updates','subtask_submissions','subtask_submission_attachments','task_submissions','task_attachments',
  'eflow_evidence.attempts','eflow_evidence.objects','work_budget_allocations','work_budget_allocation_lines','petty_cash_requests',
  'petty_cash_request_lines','petty_cash_releases','petty_cash_liquidations','petty_cash_receipts','petty_cash_receipt_items',
  'petty_cash_request_attachments','budget_ledger_entries','work_tree_events',
 ].sort(),'exact enabled bindings for the inventoried history relations');
 const tree=()=>value('select r7_work_tree($1)',[root]);
 const command=async(cmd,payload)=>value('select r7_work_command($1,$2,$3,$4,$5::jsonb)',[root,(await tree()).revision,id(key++),cmd,JSON.stringify(payload)]);
 const preview=async(cmd,payload,revision)=>value('select nw_work_impact($1,$2,$3,$4::jsonb)',[root,revision??(await tree()).revision,cmd,JSON.stringify(payload)]);
 const checked=(cmd,payload,impact,request=id(key++))=>value('select nw_work_command($1,$2,$3,$4,$5::jsonb,$6)',[root,impact.expected_revision,request,cmd,JSON.stringify(payload),impact.fingerprint]);
 const state=async()=>{await db.exec('reset role');return value(`select jsonb_build_object('task',(select to_jsonb(t) from tasks t where id=$1),'nodes',(select jsonb_agg(to_jsonb(n) order by id) from subtasks n where task_id=$1),'state',(select to_jsonb(s) from eflow_r7.tree_state s where root_id=$1),'receipts',(select jsonb_agg(to_jsonb(r) order by request_id) from eflow_r7.receipts r),'events',(select jsonb_agg(to_jsonb(e) order by id) from work_tree_events e),'finance',(select jsonb_agg(to_jsonb(l) order by id) from budget_ledger_entries l))`,[root]);};
 const deny=async(fn,pattern)=>{const before=await state();await actor(3);await assert.rejects(fn,pattern);checks++;equal(await state(),before,'denial preserves mutation/history/receipt/finance');await actor(3);};
 await actor(2);const group=await value('select id from project_groups where project_id=$1 order by position limit 1',[project]);
 root=await value('select (phase3_create_task($1,$2,$3)).id',[project,group,'NW5.2 checked work']);
 await db.exec('reset role;set session_replication_role=replica');await db.query("update tasks set assigned_to=$1,team_member_ids=$2::uuid[],percent_complete=37,due_date='2026-12-31',status='in_progress' where id=$3",[id(3),[3,4,5,6].map(id),root]);await db.exec('set session_replication_role=origin');
 await actor(3);const parent=id(key++),leaf=id(key++),other=id(key++);
 for(const [node,title,p] of [[parent,'Authorized branch',null],[leaf,'Selected item',parent],[other,'Other item',null]])await command('create',{id:node,parent:p,title,lead:id(4),people:[id(4),id(6)],standalone:true});
 const payload={id:parent};let impact=await preview('delete',payload);
 equal(Object.keys(impact).sort(),['root_id','expected_revision','current_revision','command','allowed','blocker_codes','selected_count','descendant_count','affected_appointment_count','before_path','after_path','fingerprint'].sort(),'fixed preview fields');
 equal(impact.allowed,true,'untouched subtree allowed');equal([impact.selected_count,impact.descendant_count],[2,1],'authoritative counts');equal(impact.before_path,['Authorized branch'],'readable path');equal(impact.after_path,[],'delete path empty');
 equal((await preview('delete',payload)).fingerprint,impact.fingerprint,'canonical facts exclude preview time/private version locks');
 const edit={id:other,title:'Confirmed name'},editImpact=await preview('edit',edit),req=id(key++);
 await checked('edit',edit,editImpact,req);const afterCommit=await state();await actor(3);
 // Deliberately lose the first transport result. Revision/fingerprint are old.
 const retry=await checked('edit',edit,editImpact,req);equal(retry.nodes.find(n=>n.id===other).title,'Confirmed name','exact committed retry returns current authorized snapshot');equal(await state(),afterCommit,'exact retry creates no event, history or second receipt');await actor(3);
 await deny(()=>checked('edit',{...edit,title:'Changed terms'},editImpact,req),/different work/);
 const currentEdit=await preview('edit',{id:other,title:'After finance'}),rev=(await tree()).revision;
 await actor(2);const section=await value("select s.id from office_budget_sections s join department_fiscal_budgets b on b.id=s.fiscal_budget_id where b.org_id=$1 and b.fiscal_year=2026 and b.status='locked' and not s.retired and not exists(select 1 from office_budget_sections c where c.parent_id=s.id and not c.retired) limit 1",[id(90)]);
 await value('select fund_office_work($1,2026,$2::jsonb,$3,$4)',[root,JSON.stringify([{partitionId:section,amount:100}]),'NW5.2 real funded history',id(key++)]);
 const line=await value('select l.id from work_budget_allocation_lines l join work_budget_allocations a on a.id=l.allocation_id where a.task_id=$1 and a.subtask_id is null',[root]);
 await actor(3);equal((await tree()).revision,rev,'root-only funding does not bump tree revision');
 await deny(()=>checked('edit',{id:other,title:'After finance'},currentEdit),/impact changed/);
 impact=await preview('delete',payload);const revision=impact.current_revision;
 await value('select set_subtask_budget_cap($1,$2,$3,20,$4,$5)',[root,leaf,line,'NW5.2 independent cap',id(key++)]);equal((await tree()).revision,revision,'real subitem cap leaves tree revision unchanged');
 await deny(()=>checked('delete',payload,impact),/impact changed/);
 const blocked=await preview('delete',payload);equal(blocked.allowed,false,'protected descendant cap blocks new preview');equal(blocked.blocker_codes,['history_blocked'],'public stable history code');
 ok(!JSON.stringify(blocked).includes('file_path')&&!JSON.stringify(blocked).includes('allocation_line_id'),'preview contains no private history rows or paths');
 await deny(()=>command('delete',payload),/history/i);
 await deny(()=>checked('delete',payload,blocked),/blocked/);
 await deny(async()=>checked('edit',{id:other,title:'No fingerprint'},{...(await preview('edit',{id:other,title:'No fingerprint'})),fingerprint:null}),/impact changed/);
 await actor(6);const denied=await preview('delete',{id:other});equal(denied.allowed,false,'contributor cannot plan');equal(denied.before_path,[],'denied action reveals no path');equal(denied.selected_count,0,'denied action reveals no private impact count');
 // Profile 24 is active/verified but has no membership in this project. The
 // foreign Head 7 is an existing approved guest, whose readable scope survives.
 await actor(24);await assert.rejects(()=>preview('delete',payload,revision),/access denied/);checks++;
 await actor(3);await assert.rejects(()=>preview('edit',{id:other,forged:'field'}),/Invalid/);checks++;
 await assert.rejects(()=>preview('edit',{id:other},0),/Work changed/);checks++;
 // Evidence can be legacy/reset-looking without a node or revision mutation.
 const evidenceTerms={id:other,title:'Metadata after evidence'},oldEvidence=await preview('edit',evidenceTerms),oldRevision=(await tree()).revision;
 await db.exec('reset role;set session_replication_role=replica');await db.query("insert into eflow_evidence.objects(bucket_id,object_name,task_id,subtask_id,actor_id,state,legacy) values('task-attachments','never-disclose-private-path',$1,$2,$3,'finalized',true)",[root,other,id(6)]);await db.exec('set session_replication_role=origin');await actor(3);
 equal((await tree()).revision,oldRevision,'evidence history can change independently of tree revision');await deny(()=>checked('edit',evidenceTerms,oldEvidence),/impact changed/);
 const freshEvidence=await preview('edit',evidenceTerms);ok(!JSON.stringify(freshEvidence).includes('never-disclose-private-path'),'private evidence path only participates inside opaque hash');await checked('edit',evidenceTerms,freshEvidence);
 console.log(`NW5.2 checked confirmation: ${checks} assertions passed; native separate-session races are verified separately.`);return checks;
}
