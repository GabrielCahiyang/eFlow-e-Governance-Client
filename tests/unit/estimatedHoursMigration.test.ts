import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {expect,it} from 'vitest';
import baseline from '../fixtures/estimatedHoursRemovalBaseline.json';

const readMigration=()=>readFile(new URL('../../supabase/migrations/20261118142306_remove_task_estimated_hours.sql',import.meta.url),'utf8');
async function database(){
 const db=await PGlite.create();
 await db.exec(`create role authenticated;create schema eflow_work_edit;create schema eflow_r9;create schema eflow_r7;
  create table public.tasks(id uuid primary key,title text,estimated_hours double precision default 0);
  insert into public.tasks values('00000000-0000-0000-0000-000000000001','Retained task',16);
  create table eflow_r7.nodes(id uuid);create table eflow_r7.receipts(id uuid);
  create table public.profiles(id uuid);create table public.projects(id uuid);
  create table public.monthly_productivity_snapshots(id uuid);
  create table public.proposal_collaboration_drafts(id uuid);
  create table public.proposal_collaboration_revisions(id uuid);
  create table public.proposal_collaboration_orgs(id uuid);
  create table public.milestones(id uuid);create table public.project_import_batches(id uuid);
  set check_function_bodies=off;`);
 for(const item of baseline)await db.exec(item.definition);
 await db.exec(`revoke all on function eflow_r7.command(uuid,integer,uuid,text,jsonb) from public;
  grant execute on function eflow_r7.command(uuid,integer,uuid,text,jsonb) to authenticated;
  set check_function_bodies=on;`);
 return db;
}

it('removes the stored column and function references atomically while retaining data and privileges',async()=>{
 const db=await database();
 try{
  const before=await db.query("select oid,proowner,proacl,prosecdef,proconfig from pg_proc where pronamespace in ('eflow_r7'::regnamespace,'eflow_work_edit'::regnamespace,'eflow_r9'::regnamespace) order by oid");
  await db.exec(await readMigration());
  expect((await db.query("select * from public.tasks")).rows).toEqual([{id:'00000000-0000-0000-0000-000000000001',title:'Retained task'}]);
  expect((await db.query("select proname from pg_proc where prokind='f' and prosrc ~* 'estimated.?hours'")).rows).toEqual([]);
  expect(await db.query("select oid,proowner,proacl,prosecdef,proconfig from pg_proc where pronamespace in ('eflow_r7'::regnamespace,'eflow_work_edit'::regnamespace,'eflow_r9'::regnamespace) order by oid")).toEqual(before);
  // A retired estimate must not turn an otherwise identical collaboration
  // revision into a material change. Other reviewed fields remain material.
  expect((await db.query<{changed:boolean}>(`select public.collaboration_revision_is_material('{"tasks":[{"key":"t","estimatedHours":8}]}','{"tasks":[{"key":"t","estimatedHours":40}]}') as changed`)).rows[0].changed).toBe(false);
  expect((await db.query<{changed:boolean}>(`select public.collaboration_revision_is_material('{"tasks":[{"key":"t","deadline":"2099-01-01"}]}','{"tasks":[{"key":"t","deadline":"2099-01-02"}]}') as changed`)).rows[0].changed).toBe(true);
  // Exercise the migrated hosted activity trigger on committed detail changes.
  // Helpers below only supply identity/display context in this disposable model.
  await db.exec(`create schema auth;
   create function auth.uid() returns uuid language sql as $$select null::uuid$$;
   create function eflow_r7.internal(uuid) returns boolean language sql as $$select false$$;
   create function eflow_work_edit.display(text,jsonb) returns text language sql as $$select coalesce($2 #>> '{}','None')$$;
   alter table public.profiles add column full_name text;
   alter table public.tasks add column priority text,add column deadline text,add column start_date date,add column dependency_ids uuid[];
   create function eflow_work_edit.dependency_value(jsonb) returns jsonb language sql as $$select coalesce($1,'[]'::jsonb)$$;
   create table public.task_activities(task_id uuid,actor_id uuid,actor_name text,type text,content text,metadata jsonb);
   create trigger record_details after update on public.tasks for each row execute function eflow_work_edit.record_task_details();
   select set_config('eflow.work_detail_change_reason','Approved extension',false);
   update public.tasks set title='Corrected task',priority='high',deadline='2099-12-02',start_date='2099-12-01',dependency_ids='{}';`);
  const activity=(await db.query<{metadata:{fields:Array<{key:string;before:string;after:string}>;reason:string}}>('select metadata from public.task_activities')).rows;
  expect(activity).toHaveLength(1);
  expect(activity[0].metadata.reason).toBe('Approved extension');
  expect(activity[0].metadata.fields.map(field=>field.key)).toEqual(['title','priority','start_date','deadline','dependency_ids']);
  expect(activity[0].metadata.fields[0]).toMatchObject({before:'Retained task',after:'Corrected task'});
 }finally{await db.close();}
},30_000);

it('aborts before dropping data when a hosted function has drifted',async()=>{
 const db=await database();
 try{
  await db.exec(`create or replace function public.collaboration_revision_is_material(p_previous jsonb,p_next jsonb) returns boolean language plpgsql immutable set search_path='public' as $$begin return false;end$$;`);
  await expect(db.exec(await readMigration())).rejects.toThrow('Hosted function changed; review removal migration');
  await db.exec('rollback;');
  expect((await db.query<{estimated_hours:number}>('select estimated_hours from public.tasks')).rows[0].estimated_hours).toBe(16);
 }finally{await db.close();}
},30_000);
