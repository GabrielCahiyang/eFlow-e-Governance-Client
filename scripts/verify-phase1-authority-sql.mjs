/** Offline PostgreSQL rehearsal using deployed definitions, synthetic accounts, and no .env/network. */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {ltree} from '@electric-sql/pglite/contrib/ltree';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';
const fixture=JSON.parse(await readFile(new URL('../tests/sql/phase1-deployed-schema.json',import.meta.url),'utf8'));
const migration=await readFile(new URL('../supabase/migrations/20261003000004_simplified_roles_and_office_authority.sql',import.meta.url),'utf8');
const db=await PGlite.create({extensions:{ltree,pgcrypto}});
let count=0;
const uid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const org=n=>`10000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const task=n=>`20000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const identity=async n=>db.query("select set_config('request.jwt.claim.sub',$1,false)",[n?uid(n):'']);
const check=async expression=>{assert.equal((await db.query(`select (${expression}) ok`)).rows[0].ok,true,expression);count++;};
const denied=async (statement,message)=>{await assert.rejects(db.exec(statement),message);count++;};
try{
 await db.exec(`create extension ltree; create schema extensions; create extension pgcrypto with schema extensions;
 create schema auth; create table auth.users(id uuid primary key,email text);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create function auth.role() returns text language sql stable as $$select 'authenticated'::text$$;
 create role authenticated; create role anon; create role service_role;
 set check_function_bodies=false;`);
 const tables=[...new Set(fixture.columns.map(c=>c.table))];
 for(const t of tables){
  const cols=fixture.columns.filter(c=>c.table===t);
  for(const c of cols) if(c.default?.includes('nextval')) await db.exec(`create sequence if not exists ${c.default.match(/'([^']+)'/)[1]}`);
  await db.exec(`create table public."${t}" (${cols.map(c=>`"${c.column}" ${c.type}${c.default?' default '+c.default:''}${c.nullable===false?' not null':''}`).join(',')})`);
 }
 for(const c of fixture.constraints) await db.exec(`alter table public."${c.table}" add constraint "${c.name}" ${c.definition}`);
 for(const f of fixture.functions) await db.exec(f.definition+';');
 for(const p of fixture.policies.filter(p=>p.schemaname==='public')){await db.exec(`alter table public."${p.tablename}" enable row level security;create policy "${p.policyname}" on public."${p.tablename}" as ${p.permissive} for ${p.cmd} to ${p.roles.join(',')}${p.qual?' using ('+p.qual+')':''}${p.with_check?' with check ('+p.with_check+')':''};`);}
 await db.exec('grant usage on schema public,auth to authenticated; grant select,insert,update,delete on all tables in schema public to authenticated');
 await db.exec(`insert into organizations(id,name,slug,path,org_type) values
 ('${org(1)}','Office A','office_a','office_a','department'),('${org(2)}','Office B','office_b','office_b','department'),('${org(3)}','Board','board','board','board');
 insert into profiles(id,full_name,email,employee_id,org_id,role) values
 ('${uid(1)}','Admin','admin@example.test','A','${org(1)}','admin'),
 ('${uid(2)}','Head A','head@example.test','H','${org(1)}','dept_head'),
 ('${uid(3)}','Member A','member@example.test','M','${org(1)}','employee'),
 ('${uid(4)}','Former assistant','assistant@example.test','X','${org(1)}','assistant_head'),
 ('${uid(5)}','Accounting','accounting@example.test','C','${org(1)}','accounting_staff'),
 ('${uid(6)}','Head B','headb@example.test','HB','${org(2)}','department_head');
 update organizations set head_user_id='${uid(2)}',assistant_head_user_id='${uid(4)}' where id='${org(1)}';
 update organizations set head_user_id='${uid(6)}' where id='${org(2)}';
 update organizations set assistant_head_user_id='${uid(4)}' where id='${org(3)}';
 insert into role_permissions(role,permission,allowed) values ('admin','projects.create',true),('dept_head','tasks.assign',true);
 insert into projects(id,title,org_id,owner_id) values ('${task(90)}','Existing plan','${org(1)}','${uid(2)}');
 insert into tasks(id,title,org_id,assigned_to,status,reviewer_id) values
 ('${task(1)}','Member work','${org(1)}','${uid(3)}','in_progress','${uid(2)}'),
 ('${task(2)}','Head work','${org(1)}','${uid(2)}','in_progress','${uid(4)}'),
 ('${task(3)}','Explicit Head work','${org(1)}','${uid(2)}','in_progress','${uid(3)}');
 update tasks set review_route_mode='explicit' where id='${task(3)}';`);
 const relevant=/guard_profile_leadership_integrity|guard_administrative_role_management|guard_last_active_admin|guard_administrative_leadership_assignment|organizations_guard_leadership_membership|guard_admin_role_permissions|guard_admin_permission_overrides|tasks_route_organization_leadership_review|tasks_validate_reviewers|task_financial_completion_guard|guard_task_review_decision|tasks_guard_review_decision|guard_task_status_write|tasks_guard_subtask_readiness|petty_cash_liquidation_late_approval_guard/;
 for(const t of fixture.triggers.filter(t=>relevant.test(t))) await db.exec(t+';');
 // A prototype account blocks the transaction before any data changes or archive tables exist.
 await db.exec(`insert into profiles(id,full_name,email,employee_id,role) values('${uid(8)}','Prototype','proto@example.test','P','executive')`);
 await denied(migration,/Unsupported prototype roles/);await db.exec('rollback');
 await check("to_regclass('public.phase1_authority_row_backup') is null");
 await db.exec(`delete from profiles where id='${uid(8)}'`);
 await db.exec(migration);
 await check("not exists(select 1 from profiles where role not in ('admin','head','member','accounting_staff'))");
 await check(`(select role='member' from profiles where id='${uid(4)}')`);
 await check(`(select count(*) from organization_memberships where organization_id='${org(3)}' and user_id='${uid(4)}' and membership_role='backup_approver')=1`);
 await check("not exists(select 1 from organizations where assistant_head_user_id is not null)");
 await check("(select count(*) from projects)=1 and (select count(*) from tasks)=3");
 await check("(select count(*) from phase1_authority_row_backup where table_name='profiles')=6");
 await check(`not has_permission('${uid(1)}','projects.create') and has_permission('${uid(1)}','users.manage')`);
 await check(`not can_access_org('${uid(1)}','${org(1)}','manage') and not can_see_project('${task(90)}','${uid(1)}') and not can_see_task('${task(1)}','${uid(1)}')`);
 await check(`can_see_task('${task(1)}','${uid(2)}') and not can_see_task('${task(1)}','${uid(6)}')`);
 await check(`not has_permission('${uid(2)}','accounting.release_cash') and has_permission('${uid(5)}','accounting.release_cash')`);
 await check(`is_department_budget_approver('${org(1)}','${uid(2)}') and not is_department_budget_approver('${org(1)}','${uid(4)}')`);
 await check(`(select reviewer_id='${uid(2)}' and backup_reviewer_id is null from tasks where id='${task(2)}')`);
 await identity(3);await db.exec(`select submit_task_for_review('${task(1)}','{"note":"Member evidence"}')`);
 await denied(`select decide_task_review('${task(1)}',true)`,/own submission/);
 await identity(1);await denied(`select decide_task_review('${task(1)}',true)`,/Operational account/);
 await identity(2);await db.exec(`select decide_task_review('${task(1)}',true)`);
 await check(`(select status='completed' from tasks where id='${task(1)}')`);
 await db.exec(`select submit_task_for_review('${task(2)}','{"note":"Head evidence"}')`);
 await db.exec(`select decide_task_review('${task(2)}',true)`);
 await check(`exists(select 1 from audit_events where entity_id='${task(2)}' and action='task.transition.completed' and after_data->>'performedBy'='${uid(2)}' and after_data->>'finalizedBy'='${uid(2)}' and after_data->>'authority'='Office Head')`);
 await db.exec(`select submit_task_for_review('${task(3)}','{"note":"Governance stays separate"}')`);
 await denied(`select decide_task_review('${task(3)}',true)`,/own submission/);
 await identity(3);await db.exec(`select decide_task_review('${task(3)}',true)`);
 // Financial completion remains guarded even when Head is both performer and final reviewer.
 await identity(null);await db.exec(`insert into tasks(id,title,org_id,assigned_to,status) values('${task(4)}','Cash work','${org(1)}','${uid(2)}','in_progress');
 insert into department_fiscal_budgets(id,org_id,fiscal_year,created_by) values('${task(70)}','${org(1)}',2026,'${uid(2)}');
 insert into petty_cash_requests(id,request_number,fiscal_budget_id,commitment_id,allocation_id,task_id,org_id,funding_org_id,requester_org_id,requester_id,cash_recipient_id,purpose,status,requested_amount)
 values('${task(80)}',80,'${task(70)}','${task(71)}','${task(72)}','${task(4)}','${org(1)}','${org(1)}','${org(1)}','${uid(2)}','${uid(2)}','Evidence purchase','pending_leader_review',100)`);
 await identity(2);await db.exec(`select submit_task_for_review('${task(4)}','{"note":"Financial evidence"}')`);
 await denied(`select decide_task_review('${task(4)}',true)`,/Settle all/);
 await check(`(select status='for_review' from tasks where id='${task(4)}')`);
 // Head authorizes late packages; Accounting executes settlement and preserves that authorization.
 await identity(null);await db.exec(`insert into petty_cash_requests(id,request_number,fiscal_budget_id,commitment_id,allocation_id,task_id,org_id,funding_org_id,requester_org_id,requester_id,cash_recipient_id,purpose,status,requested_amount,liquidation_due_at)
 values('${task(81)}',81,'${task(70)}','${task(71)}','${task(72)}','${task(4)}','${org(1)}','${org(1)}','${org(1)}','${uid(3)}','${uid(3)}','Late receipt package','pending_department_settlement',100,now()-interval '2 days');
 insert into petty_cash_liquidations(id,request_id,version,declared_spent,returned_amount,note,submitted_by,status,submitted_at)
 values('${task(82)}','${task(81)}',1,80,20,'Evidence retained','${uid(3)}','pending_department_settlement',now()-interval '1 day');
 insert into petty_cash_releases(id,request_id,org_id,scheduled_date,amount,recipient_id,created_by)
 values('${task(83)}','${task(81)}','${org(1)}',current_date,100,'${uid(3)}','${uid(5)}')`);
 await identity(2);
 await denied(`select settle_accounting_liquidation('${task(82)}',true,'Verify receipts')`,/Only authorized Accounting Staff/);
 await denied(`select record_accounting_petty_cash_release('${task(83)}')`,/Accounting Staff|accounting access|Accounting access/);
 await denied(`select post_general_journal_adjustment('${task(70)}',current_date,'TEST','Test','[]')`,/Accounting access denied/);
 await identity(5);await denied(`select settle_accounting_liquidation('${task(82)}',true,'Verify receipts')`,/Late liquidation requires/);
 await identity(6);await denied(`select decide_petty_cash_liquidation('${task(82)}',true,'Authorize late')`,/Only the office Head/);
 await identity(2);await db.exec(`select decide_petty_cash_liquidation('${task(82)}',true,'Late receipts accepted with reason')`);
 await check(`(select status='pending_department_settlement' and department_decided_by='${uid(2)}' from petty_cash_liquidations where id='${task(82)}') and not exists(select 1 from budget_ledger_entries where petty_cash_request_id='${task(81)}')`);
 await identity(5);await db.exec(`select settle_accounting_liquidation('${task(82)}',true,'Verified receipts and returned change')`);
 await check(`(select status='approved' and decided_by='${uid(5)}' and department_decided_by='${uid(2)}' from petty_cash_liquidations where id='${task(82)}') and (select status='settled' from petty_cash_requests where id='${task(81)}')`);
 await check(`(select count(*) from budget_ledger_entries where petty_cash_request_id='${task(81)}')=2`);
 await identity(null);await db.exec(`update petty_cash_requests set status='pending_department_settlement',requester_id='${uid(5)}',cash_recipient_id='${uid(5)}' where id='${task(81)}'; update petty_cash_liquidations set status='pending_department_settlement' where id='${task(82)}'`);
 await identity(5);await denied(`select settle_accounting_liquidation('${task(82)}',true,'Own receipts')`,/own liquidation/);
 await identity(1);await denied(`select set_organization_leadership('${org(1)}','${uid(2)}','${uid(4)}')`,/Only one Head/);
 await denied("update role_permissions set allowed=true where role='admin' and permission='tasks.assign'",/fixed administrative access/);
 await db.exec('set role authenticated');
 await check('(select count(*) from projects)=0 and (select count(*) from tasks)=0');
 await check("not exists(select 1 from audit_events where entity_type='task')");
 await check('(select count(*) from phase1_authority_row_backup)>0');
 await identity(3);await check('(select count(*) from phase1_authority_row_backup)=0');
 await db.exec('reset role');await identity(null);
 await denied(`update profiles set is_active=false where id='${uid(1)}'`,/last active Admin/);
 console.log(`Phase 1 authority SQL rehearsal passed (${count} assertions).`);
}catch(error){console.error(error.message);if(error.detail)console.error(error.detail);if(error.where)console.error(error.where);process.exitCode=1;}finally{await db.close();}
