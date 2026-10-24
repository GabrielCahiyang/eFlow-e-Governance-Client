// Disposable database only. Uses the captured installed function bodies, never live rows.
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {financialCompatibilityDatabase,financialBaselineSql,migrationSource,nwCorrections} from '../tests/sql/helpers/financialCompatibilityDatabase.mjs';
import {financialScenario,financeId as id} from '../tests/sql/helpers/financialScenario.mjs';
const migration='20261024002339_leadership_default_review_reroute.sql';
const catalog=JSON.parse(await readFile(new URL('../docs/system-issues-2026-10-24/leadership/installed-task-catalog.json',import.meta.url),'utf8'));
async function installedDelta(){
 let sql='';
 for(const name of ['20261015125031_financial_cash_compatibility.sql','20261015142837_financial_journal_and_refund_integrity.sql',...nwCorrections])sql+='\n'+await migrationSource(name)+'\n;\n';
 for(const name of (await readdir(new URL('../supabase/migrations/',import.meta.url))).filter(name=>name>'20261016000000'&&name<'20261021000000').sort())sql+='\n'+await migrationSource(name)+'\n;\n';
 for(const definition of new Set([...catalog.functions.map(f=>f.definition),...catalog.triggers.map(t=>t.handler_definition)]))sql+=definition+';\n';
 return sql;
}
if(process.argv.includes('--baseline-sql')){process.stdout.write(await financialBaselineSql()+await installedDelta());process.exit(0);}
let db,checks=0;
const equal=(actual,expected,label)=>{assert.deepEqual(actual,expected,label);checks++;};
try{
 db=await financialCompatibilityDatabase();
 await db.exec(await installedDelta());
 const s=await financialScenario(db),{value,actor}=s;
 const ordinary=await s.task(), custom=await s.task(), finished=await s.task();
 const summary=async()=>{await db.exec('reset role');return value("select jsonb_build_object('head',(select head_user_id from organizations where id=$1),'profiles',(select jsonb_agg(jsonb_build_array(id,role) order by id) from profiles),'tasks',(select jsonb_agg(to_jsonb(t) order by id) from tasks t),'audit',(select count(*) from audit_events))",[s.office]);};
 await actor(1);const before=await summary();await actor(1);
 await assert.rejects(value('select set_organization_leadership($1,$2,null)',[s.office,id(6)]),/Admin task access is read-only/);checks++;
 equal(await summary(),before,'Old failure rolls back office, roles, tasks and audit');
 await db.exec('reset role');
 const publicAcl=()=>value("select jsonb_object_agg(oid::text,jsonb_build_array(proowner,proacl::text)) from pg_proc where pronamespace='public'::regnamespace");
 const beforeAcl=await publicAcl();
 // An installation with a changed prerequisite must fail before creating anything.
 await db.exec('alter function public.guard_super_admin_task_mutation() set search_path=pg_catalog');
 await assert.rejects(db.exec(await migrationSource(migration)),/definition drift/);checks++;
 await db.exec('rollback');
 equal(await value("select to_regnamespace('eflow_leadership')"),null,'Preflight drift creates no private schema');
 await db.exec(catalog.triggers.find(t=>t.name==='guard_super_admin_task_mutation').handler_definition);
 await db.exec(await migrationSource(migration));
 equal(await publicAcl(),beforeAcl,'Existing public function owners and grants preserved');
 equal(await value("select has_table_privilege('authenticated','eflow_leadership.reroutes','insert')"),false,'Clients cannot forge capabilities');
 equal(await value("select has_table_privilege('authenticated','eflow_leadership.reroutes','select')"),false,'Clients cannot read capability storage');
 equal(await value("select has_function_privilege('anon','eflow_leadership.canonical_reroute(public.tasks,public.tasks)','execute')"),false,'Anonymous helper execution denied');
 equal(await value("select relrowsecurity from pg_class where oid='eflow_leadership.reroutes'::regclass"),true,'Private storage retains RLS');
 // Synthetic setup only, with normal reviewer validation and no hosted records.
 await actor(2);await db.query("update tasks set review_route_mode='explicit',reviewer_id=$2 where id=$1",[custom.task,id(6)]);
 await db.exec('reset role');
 // Completed history fixture: retain guards but avoid unrelated evidence submission setup.
 await db.exec('set session_replication_role=replica');
 await db.query("update tasks set status='completed' where id=$1",[finished.task]);
 await db.exec('set session_replication_role=origin');
 const taskRow=async task=>{await db.exec('reset role');return value('select to_jsonb(t) from tasks t where id=$1',[task]);};
 const originalOrdinary=await taskRow(ordinary.task),originalCustom=await taskRow(custom.task),originalFinished=await taskRow(finished.task);
 await actor(1);await value('select set_organization_leadership($1,$2,null)',[s.office,id(6)]);
 equal((await taskRow(ordinary.task)).reviewer_id,id(6),'Default task follows newly appointed Head');
 equal(await taskRow(custom.task),originalCustom,'Custom review routing unchanged');
 equal(await taskRow(finished.task),originalFinished,'Completed task history unchanged');
 const changed=await taskRow(ordinary.task);
 for(const key of Object.keys(originalOrdinary).filter(k=>!['reviewer_id','backup_reviewer_id','updated_at'].includes(k)))equal(changed[key],originalOrdinary[key],'Task field preserved: '+key);
 equal(await value('select count(*) from eflow_leadership.reroutes'),0,'No capability persists after RPC');
 const deny=async(who,query,args,pattern=/Admin task access is read-only|Current work access|required|permission denied|Admin access/)=>{
  await actor(1);const prior=await summary();await actor(who);
  // Owner SQL with the real Admin JWT exercises guards even behind a definer RPC;
  // authenticated direct table writes additionally remain blocked by RLS.
  if(who===1&&query.startsWith('update tasks'))await db.exec('reset role');
  await assert.rejects(value(query,args),pattern);checks++;await actor(1);equal(await summary(),prior,'Denied action changes no state');
 };
 await deny(1,'update tasks set title=$2 where id=$1 returning id',[ordinary.task,'Forbidden edit']);
 await deny(1,'update tasks set reviewer_id=$2 where id=$1 returning id',[ordinary.task,id(2)]);
 await deny(1,'update tasks set reviewer_id=reviewer_id where id=$1 returning id',[ordinary.task]);
 await deny(5,'select set_organization_leadership($1,$2,null)',[s.office,id(2)]);
 for(const candidate of [id(1),id(3),id(8)])await deny(1,'select set_organization_leadership($1,$2,null)',[s.office,candidate],/active member|another office/);
 await actor(1);await value('select set_organization_leadership($1,$2,null)',[s.office,id(2)]);
 equal((await taskRow(ordinary.task)).reviewer_id,id(2),'Replacing Head again works');
 await actor(1);
 await value('select set_organization_leadership($1,null,null)',[s.office]);
 equal((await taskRow(ordinary.task)).reviewer_id,null,'Clear Head removes derived reviewer from unstarted work');
 await actor(1);
 await value('select set_organization_leadership($1,$2,null)',[s.office,id(2)]);
 // A later failure in the RPC must undo its routing changes and roles.
 await db.exec('reset role');
 await db.exec("create function public.qa_fail_leadership_audit() returns trigger language plpgsql as $$begin if new.action='organization.leadership_changed' then raise exception 'Injected audit failure';end if;return new;end$$;create trigger qa_fail_leadership_audit before insert on audit_events for each row execute function public.qa_fail_leadership_audit();");
 await deny(1,'select set_organization_leadership($1,$2,null)',[s.office,id(6)],/Injected audit failure/);
 await db.exec('reset role');await db.exec('drop trigger qa_fail_leadership_audit on audit_events;drop function qa_fail_leadership_audit()');
 equal(await value('select count(*) from eflow_leadership.reroutes'),0,'Failed transaction leaves no capability');
 // Corrupt the proposed row before authorization to prove the capability is
 // not a blanket exception for title/status/staffing/revision changes.
 for(const mutation of ["new.title:='Tampered'","new.status:='in_progress'","new.assigned_to:='"+id(6)+"'","new.updated_at:=now()+interval '1 hour'"]){
  await db.exec('reset role');
  await db.exec(`create function public.qa_tamper_reroute() returns trigger language plpgsql as $$begin ${mutation};return new;end$$;create trigger aa_qa_tamper_reroute before update on tasks for each row execute function public.qa_tamper_reroute();`);
  await deny(1,'select set_organization_leadership($1,$2,null)',[s.office,id(6)],/Admin task access is read-only/);
  await db.exec('reset role');await db.exec('drop trigger aa_qa_tamper_reroute on tasks;drop function qa_tamper_reroute()');
 }
 await actor(1);await assert.rejects(db.exec('insert into eflow_leadership.reroutes(tx,actor,task_id) values(txid_current(),auth.uid(),gen_random_uuid())'),/permission denied/);checks++;
 await db.exec('reset role;set session_replication_role=replica');
 await db.query("update tasks set status='for_review' where id=$1",[ordinary.task]);
 await db.exec('set session_replication_role=origin');
 await deny(1,'select set_organization_leadership($1,null,null)',[s.office],/Assign an active Head/);
 await actor(1);await value('select set_organization_leadership($1,$2,null)',[s.office,id(6)]);
 equal((await taskRow(ordinary.task)).reviewer_id,id(6),'Pending review follows replacement Head');
 await db.exec('reset role;set session_replication_role=replica');
 await db.query("update projects set status='archived' where id=$1",[s.project]);
 await db.exec('set session_replication_role=origin');
 const archived=await taskRow(ordinary.task);
 await actor(1);await value('select set_organization_leadership($1,$2,null)',[s.office,id(2)]);
 equal(await taskRow(ordinary.task),archived,'Archived project routing stays immutable');
 console.log(JSON.stringify({passed:true,checks,disposable:true,hostedWrites:false,migration}));
}catch(error){console.error(JSON.stringify({passed:false,message:error.message,detail:error.detail,where:error.where,code:error.code,stack:error.stack?.split('\n').slice(0,4)}));process.exitCode=1;}finally{await db?.close();}
