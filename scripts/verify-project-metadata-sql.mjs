import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const db=new PGlite();let checks=0;
const head='00000000-0000-4000-8000-000000000001',member='00000000-0000-4000-8000-000000000002',project='00000000-0000-4000-8000-000000000003';
try{
 await db.exec(`create role anon;create role authenticated;create schema auth;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create table projects(id uuid primary key,org_id uuid,title text,description text,priority text,status text,start_date date,target_date date,updated_at timestamptz default clock_timestamp());
 create function phase2_is_office_head(uuid,uuid) returns bool language sql stable as $$select $1='${head}'::uuid$$;
 create function can_manage_project(uuid,uuid) returns bool language sql stable as $$select $2='${head}'::uuid$$;
 create function touch_project_test() returns trigger language plpgsql as $$begin new.updated_at:=clock_timestamp();return new;end$$;
 create trigger projects_touch before update on projects for each row execute function touch_project_test();
 grant usage on schema public,auth to authenticated;grant select,update on projects to authenticated;
 alter table projects enable row level security;
 create policy readable on projects for select to authenticated using (auth.uid() is not null);
 create policy editable on projects for update to authenticated using (can_manage_project(id,auth.uid())) with check (can_manage_project(id,auth.uid()));`);
 await db.exec(await readFile('supabase/migrations/20261019194632_project_metadata_revision_guard.sql','utf8'));
 await db.query(`insert into projects values($1,$1,'Original','Details','medium','planning',null,null,'2026-01-01T00:00:00.123456Z')`,[project]);
 const read=async()=>(await db.query('select updated_at::text version,title,status from projects')).rows[0];
 const original=(await read()).version;
 const save=(version,changes)=>db.query('select * from update_project_metadata($1,$2,$3)',[project,version,JSON.stringify(changes)]);
 await db.exec('set role authenticated');
 await assert.rejects(save(original,{title:'Denied'}),/Sign in/);checks++;
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[member]);await assert.rejects(save(original,{title:'Denied'}),/appointed Head/);checks++;
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[head]);
 await assert.rejects(save(null,{title:'Missing revision'}),/updated elsewhere/);checks++;
 await assert.rejects(save('2026-01-01T00:00:00.123Z',{title:'Truncated revision'}),/updated elsewhere/);checks++;
 for(const changes of [{title:''},{title:'x'.repeat(201)},{priority:'extreme'},{status:'active'},{org_id:head},{start_date:'invalid'},{target_date:'2000-01-01'},{start_date:'2099-03-10',target_date:'2099-03-01'}]){await assert.rejects(save(original,changes));checks++;}
 await save(original,{title:'Saved safely'});assert.equal((await read()).title,'Saved safely');checks++;
 await assert.rejects(save(original,{title:'Stale second session'}),/updated elsewhere/);assert.equal((await read()).title,'Saved safely');checks++;
 await db.exec('reset role');await db.query("update projects set status='completed'");const closed=(await read()).version;await db.exec('set role authenticated');
 await assert.rejects(save(closed,{title:'Closed edit'}),/read-only/);checks++;
 await assert.rejects(db.query("update projects set title='Direct closed edit'"),/read-only/);checks++;
 assert.equal((await db.query("select has_function_privilege('anon','update_project_metadata(uuid,timestamptz,jsonb)','execute') allowed")).rows[0].allowed,false);checks++;
 console.log(JSON.stringify({passed:checks,scope:'Disposable PostgreSQL: exact CAS, validation, closed metadata guard, invoker RLS; authority functions use explicit test stubs.'}));
}catch(e){console.error(e);process.exitCode=1;}finally{await db.close();}

