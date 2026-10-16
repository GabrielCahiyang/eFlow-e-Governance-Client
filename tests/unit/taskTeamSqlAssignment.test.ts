import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {expect,it} from 'vitest';

it('assigns the initial team atomically without disabling the task status guard',async()=>{
 const db=await PGlite.create();
 try{
  const dir=new URL('../../supabase/migrations/',import.meta.url),file=(await readdir(dir)).find(name=>name.endsWith('_fix_initial_task_team_assignment.sql'));
  const migration=await readFile(new URL(file!,dir),'utf8');
  const block=migration.match(/v_previous_status_write:=current_setting\('eflow.allow_status_write',true\);[\s\S]*?perform set_config\('eflow.allow_status_write',coalesce\(v_previous_status_write,'off'\),true\);/)?.[0];
  expect(block).toBeTruthy();
  await db.exec(`create table profiles(id uuid primary key,full_name text);
   create table tasks(id uuid primary key,status text,assigned_to uuid,assignee_name text,team_member_ids uuid[],team_member_names text[],
    constraint tasks_assignment_consistent check ((status='pending_assignment' and assigned_to is null) or status in ('todo','in_progress','for_review','changes_requested','completed','cancelled')));
   create function guard_status() returns trigger language plpgsql as $$begin
    if new.status is distinct from old.status and coalesce(current_setting('eflow.allow_status_write',true),'off')<>'on' then raise exception 'Task status guard';end if;return new;end$$;
   create trigger guard_status before update on tasks for each row execute function guard_status();
   set eflow.allow_status_write='off';`);
  const root='00000000-0000-4000-8000-000000000001',lead='00000000-0000-4000-8000-000000000002',member='00000000-0000-4000-8000-000000000003';
  await db.query("insert into profiles values($1,'Lead'),($2,'Contributor');",[lead,member]);
  await db.query("insert into tasks(id,status) values($1,'pending_assignment')",[root]);
  const define=(body:string)=>db.exec(`create or replace function fixture_assign(p_root uuid,v_lead uuid,v_people uuid[]) returns text language plpgsql as $$declare v_previous_status_write text;begin ${body} return current_setting('eflow.allow_status_write',true);end$$;`);
  const update=block!.match(/update public.tasks[\s\S]*?where id=p_root;/)![0];
  await define(update.replace("status=case when status='pending_assignment' then 'todo' else status end,",''));
  await expect(db.query('select fixture_assign($1,$2,$3)',[root,lead,[lead,member]])).rejects.toThrow(/tasks_assignment_consistent/);
  await define(block!);expect((await db.query('select fixture_assign($1,$2,$3) as flag',[root,lead,[lead,member]])).rows[0].flag).toBe('off');
  expect((await db.query('select status,assigned_to,team_member_ids from tasks')).rows[0]).toEqual({status:'todo',assigned_to:lead,team_member_ids:[lead,member]});
  expect((await db.query("select current_setting('eflow.allow_status_write') as flag")).rows[0].flag).toBe('off');
  await expect(db.query("update tasks set status='in_progress'")).rejects.toThrow(/Task status guard/);
  await db.exec("set eflow.allow_status_write='on';update tasks set status='in_progress';set eflow.allow_status_write='off';");
  await db.query('select fixture_assign($1,$2,$3)',[root,lead,[lead,member]]);
  expect((await db.query('select status from tasks')).rows[0].status).toBe('in_progress');
 }finally{await db.close();}
},30000);
