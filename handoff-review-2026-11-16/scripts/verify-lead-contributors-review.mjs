// Local, disposable PostgreSQL only. Scope/eligibility/impact doubles are explicit;
// this is not hosted authenticated-role, RLS, staging or device acceptance.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
if (!process.env.EFLOW_WEB_SOURCE) throw new Error('Set EFLOW_WEB_SOURCE to the reviewed checkout. No packages are installed.');
const require=createRequire(path.join(path.resolve(process.env.EFLOW_WEB_SOURCE),'package.json'));
const {PGlite}=require('@electric-sql/pglite');
const folder=new URL('../docs/mobile-redesign/backend-review/lead-contributors/',import.meta.url);
const baseline=JSON.parse(fs.readFileSync(new URL('baseline-functions.json',folder),'utf8')).rows;
const dependencies=JSON.parse(fs.readFileSync(new URL('dependency-functions.json',folder),'utf8')).rows;
const sqlFile=fs.readFileSync(new URL('20261116000000_lead_contributor_authority_REVIEW.sql',folder),'utf8');
const crlfSql=process.argv.includes('--crlf-sql');
const migration=crlfSql?sqlFile.replace(/\r?\n/g,'\r\n'):sqlFile;
const db=new PGlite();
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const [R,S,P,H,C,U,T,T2,N,PR,O]=[1,2,3,4,5,6,7,8,9,10,11].map(id);
let checks=0, requestNumber=100;
const check=(actual,expected)=>{assert.deepEqual(actual,expected);checks++;};
const value=async(sql,args=[])=>Object.values((await db.query(sql,args)).rows[0])[0];
const actor=who=>db.query("select set_config('request.jwt.claim.sub',$1,false)",[who??'']);
const deny=async(operation,pattern)=>{await assert.rejects(operation,pattern);checks++;};
const cap=(node,action)=>value('select (eflow_r7.operation_capabilities($1,$2)->$3->>\'allowed\')::boolean',[T,node,action]);
const command=(name,payload,root=T,key=id(requestNumber++))=>db.query('select eflow_r7.command($1,1,$2,$3,$4)',[root,key,name,JSON.stringify(payload)]);
const reset=async()=>{
 await actor(null);
 await db.query('update public.tasks set assigned_to=$1,team_member_ids=array[$1::uuid] where id=$2',[R,T]);
 await db.query('update public.subtasks set lead_id=$1,assigned_to=$1,assigned_to_ids=array[$1::uuid] where id=$2',[S,N]);
};
try {
 await db.exec(`
 create schema auth; create schema eflow_r3; create schema eflow_r7;
 create schema eflow_publication; create schema eflow_phase6; create schema eflow_m7;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create table public.profiles(id uuid primary key,full_name text,role text default 'member',is_active boolean default true,org_id uuid);
 create table public.projects(id uuid primary key,status text,project_lead_id uuid,org_id uuid,source_collaboration_draft_id uuid);
 create table public.tasks(id uuid primary key,title text default 'Synthetic task',assigned_to uuid,recommendation_lead_id uuid,
  org_id uuid,linked_project_id uuid,status text default 'in_progress',team_member_ids uuid[] default '{}',team_member_names text[],assignee_name text,
  deleted_at timestamptz,proposed_office_identity_id uuid,source_collaboration_draft_id uuid);
 create table public.subtasks(id uuid primary key,task_id uuid,parent_subtask_id uuid,lead_id uuid,assigned_to uuid,
  assigned_to_ids uuid[],title text default 'Synthetic subtask',status text default 'in_progress',sibling_order int default 0,
  percent_complete int default 0,due_date date,created_at timestamptz default now(),is_standalone boolean default true,position int default 0,dependency_ids uuid[]);
 create view eflow_r7.nodes as select s.*,'office'::text as kind from public.subtasks s;
 create table eflow_r7.receipts(actor_id uuid,request_id uuid,root_id uuid,payload jsonb,result jsonb,unique(actor_id,request_id));
 create table eflow_r7.tree_state(root_id uuid,revision int);
 create table eflow_r7.mutations(tx bigint,actor uuid,root_id uuid);
 create table public.personal_projects(id uuid primary key);
 create table public.personal_tasks(id uuid primary key);
 create table public.personal_subtasks(id uuid primary key,task_id uuid,start_date date,started_at timestamptz);
 create table public.work_tree_events(root_id uuid,project_id uuid,actor_id uuid,actor_name text,command text,node_id uuid,before_data jsonb,after_data jsonb);
 create table public.notifications(user_id uuid,type text,title text,message text,task_id uuid,task_title text,actor_id uuid,actor_name text,project_id uuid,work_node_id uuid);
 create table public.subtask_progress_updates(subtask_id uuid);
 create table public.subtask_submissions(subtask_id uuid);
 create table public.work_budget_allocations(subtask_id uuid);
 create table public.petty_cash_requests(subtask_id uuid);
 create table public.budget_ledger_entries(subtask_id uuid);
 insert into public.profiles(id,full_name,org_id) select value,'Synthetic '||value,'${O}' from unnest(array['${R}','${S}','${P}','${H}','${C}','${U}']::uuid[]) value;
 insert into public.projects values('${PR}','active','${P}','${O}',null);
 insert into public.tasks(id,assigned_to,team_member_ids,org_id,linked_project_id) values('${T}','${R}',array['${R}']::uuid[],'${O}','${PR}'),('${T2}','${C}',array['${C}']::uuid[],'${O}','${PR}');
 insert into public.subtasks(id,task_id,lead_id,assigned_to,assigned_to_ids) values('${N}','${T}','${S}','${S}',array['${S}']::uuid[]);
 -- Synthetic fixture adapters below are not production RLS/identity/impact checks.
 create function eflow_r3.eligible(uuid) returns boolean language sql stable as $$select exists(select 1 from public.profiles where id=$1 and is_active)$$;
 create function eflow_r3.actor() returns void language plpgsql as $$begin if not coalesce(eflow_r3.eligible(auth.uid()),false) then raise exception 'Unavailable actor';end if;end$$;
 create function eflow_r7.root(uuid) returns jsonb language sql stable as $$select jsonb_build_object('id',id,'project',linked_project_id,'office',org_id,'kind','office','lead',assigned_to,'people',team_member_ids,'status',status,'open',status not in ('completed','cancelled')) from public.tasks where id=$1$$;
 create function eflow_r7.read_root(uuid) returns boolean language sql stable as $$select eflow_r3.eligible(auth.uid()) and exists(select 1 from public.tasks where id=$1)$$;
 create function eflow_phase6.head(uuid,uuid,uuid) returns boolean language sql stable as $$select $2='${O}'::uuid and $3='${H}'::uuid$$;
 create function eflow_r7.member(uuid,uuid,uuid) returns boolean language sql stable as $$select $1='${PR}'::uuid and $2='${O}'::uuid and $3<>'${U}'::uuid and eflow_r3.eligible($3)$$;
 create function eflow_r7.chain(uuid,uuid) returns boolean language sql stable as $$select exists(select 1 from public.subtasks where task_id=$1 and id=$2)$$;
 create function eflow_r7.node_work(uuid,uuid) returns boolean language sql stable as $$select exists(select 1 from public.subtasks where id=$1 and (lead_id=$2 or assigned_to_ids @> array[$2]))$$;
 create function eflow_r7.lock_impact(uuid) returns void language sql as $$select null::void$$;
 create function eflow_r7.lock_completion(uuid) returns void language sql as $$select null::void$$;
 create function eflow_r7.require_operation(uuid,text,jsonb) returns void language sql as $$select null::void$$;
 create function eflow_r7.operation_impact(uuid,text,jsonb) returns jsonb language sql as $$select '{"allowed":true}'::jsonb$$;
 create function eflow_m7.node_visible(uuid,uuid,uuid) returns boolean language sql as $$select true$$;
 create function eflow_m7.node_activated(uuid,uuid) returns boolean language sql as $$select true$$;
 create function eflow_m7.personal_node_activated(uuid,uuid) returns boolean language sql as $$select true$$;
 create function eflow_r7.snapshot(uuid) returns jsonb language sql stable as $$select jsonb_build_object('root',eflow_r7.root($1),'revision',1,'nodes',coalesce((select jsonb_agg(to_jsonb(n)) from eflow_r7.nodes n where task_id=$1),'[]'::jsonb))$$;
 `);
 for(const name of ['head','manage','planning_lead','manage_plan','subtask_staffing_locked']){
  const row=dependencies.find(r=>r.signature.split('(')[0].endsWith('.'+name));
  assert.ok(row,`Missing ${name}`);await db.exec(row.definition);
 }
 for(const row of baseline)await db.exec(row.definition);
 await db.exec(`create trigger root_staff before update on public.tasks for each row execute function eflow_publication.guard_active_root_contributor_change();
 create trigger subtask_staff before insert or update on public.subtasks for each row execute function eflow_publication.guard_active_subtask_staffing();`);
 await actor(R);
 check(await cap(null,'manage_contributors'),false);
 await deny(command('contributors',{people:[R,C]}),/read-only for the Task Lead/);
 await db.exec(migration); // Disposable local PGlite only; never a hosted connection.
 check(await cap(null,'manage_contributors'),true);
 check(await cap(null,'appoint_lead'),false);
 const key=id(requestNumber++), payload={people:[R,C]};
 await command('contributors',payload,T,key);
 check(await value('select assigned_to from public.tasks where id=$1',[T]),R);
 check(await value('select team_member_ids @> array[$1::uuid] from public.tasks where id=$2',[C,T]),true);
 await deny(command('root_lead',{lead:C,people:[R,C]}),/appointment authority/);
 await deny(command('contributors',{people:[R]} ,T2),/Only the Task Lead/);
 await actor(C);
 await deny(command('contributors',{people:[R,C]}),/Only the Task Lead/);
 await deny(db.query('update public.tasks set team_member_ids=array[$1::uuid] where id=$2',[C,T]),/Only the Task Lead/);
 await actor(S);
 check(await cap(N,'manage_contributors'),true);
 check(await cap(N,'appoint_lead'),false);
 await command('staff',{id:N,lead:S,people:[S,C]});
 check(await value('select lead_id from public.subtasks where id=$1',[N]),S);
 await deny(command('staff',{id:N,lead:C,people:[S,C]}),/Branch staffing denied/);
 await actor(R);
 await command('staff',{id:N,lead:C,people:[S,C]});
 check(await value('select lead_id from public.subtasks where id=$1',[N]),C);
 await reset();await actor(H);
 await command('contributors',{people:[R,C]});
 check(await value('select assigned_to from public.tasks where id=$1',[T]),R);
 await reset();await actor(P);
 await command('root_lead',{lead:C,people:[R,C]});
 check(await value('select assigned_to from public.tasks where id=$1',[T]),C);
 await actor(R);
 // A committed request remains verifiable after its actor loses appointment.
 await command('contributors',payload,T,key);
 check(await value('select assigned_to from public.tasks where id=$1',[T]),C);
 await reset();await actor(null);
 await db.query('update public.subtasks set lead_id=$1,assigned_to=$1,assigned_to_ids=array[$1::uuid] where id=$2',[P,N]);
 await actor(P);
 check(await cap(N,'manage_contributors'),true);
 check(await cap(N,'appoint_lead'),false);
 await command('staff',{id:N,lead:P,people:[P,C]});
 await deny(command('staff',{id:N,lead:C,people:[P,C]}),/read-only for the Project Lead/);
 await reset();await actor(P);
 check(await cap(N,'manage_contributors'),false);
 await deny(command('staff',{id:N,lead:S,people:[S,C]}),/read-only for the Project Lead/);
 await actor(null);await db.query('update public.tasks set assigned_to=$1 where id=$2',[P,T]);await actor(P);
 check(await cap(N,'appoint_lead'),true);
 await command('staff',{id:N,lead:C,people:[S,C]});
 check(await value('select lead_id from public.subtasks where id=$1',[N]),C);
 for(const row of dependencies)check(await value('select pg_get_functiondef(to_regprocedure($1))',[row.signature]),row.definition);
 await deny(db.exec(migration),/Installed staffing function differs/);
 await db.exec('rollback');
 console.log(JSON.stringify({checks,status:'PASS',environment:'disposable local PGlite',sqlLineEndings:crlfSql?'CRLF':'file',productionMutations:0,
  limitations:'Synthetic identity/scope/visibility/impact adapters; no hosted RLS, finance/history guards, authenticated roles, staging or device acceptance.'},null,2));
}finally{await db.close();}
