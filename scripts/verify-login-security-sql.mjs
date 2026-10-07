import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const db = new PGlite();
const uid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
let checks=0;
const check=(value,label)=>{assert.ok(value,label);checks++;};
const q=async(sql,args=[]) => (await db.query(sql,args)).rows[0];
const rpc=async(name,args,types)=> (await q(`select public.eflow_login_${name}(${types.map((t,i)=>'$'+(i+1)+'::'+t).join(',')}) result`,args)).result;
const begin=email=>rpc('begin',[email],['text']);
const finish=(attempt,outcome,ban=null)=>rpc('finish',[attempt.user_id,attempt.lease,outcome,ban],['uuid','uuid','text','timestamptz']);
const admin=(actor,action,user=null,limit=null,lease=null)=>rpc('admin',[actor,action,user,limit,lease],['uuid','text','uuid','integer','uuid']);
try {
  await db.exec(`create role anon; create role authenticated; create role service_role; create schema auth;
    create function auth.role() returns text language sql as $$ select current_setting('request.jwt.claim.role',true) $$;
    create table auth.users(id uuid primary key,email text);
    create table public.profiles(id uuid primary key,full_name text,role text,is_active boolean);
    insert into auth.users values('${uid(1)}','admin@example.test'),('${uid(2)}','person@example.test'),('${uid(3)}','other@example.test');
    insert into public.profiles values('${uid(1)}','Admin','admin',true),('${uid(2)}','Person','member',true),('${uid(3)}','Other','head',true);`);
  await db.exec(await readFile(new URL('../supabase/migrations/20261007191654_account_login_lockout.sql',import.meta.url),'utf8'));
  await q("select set_config('request.jwt.claim.role','service_role',false)");
  check((await admin(uid(1),'read')).max_attempts===3,'Default is 3');
  check((await begin('missing@example.test')).status==='unknown','Unknown account has no counter');
  let a=await begin(' PERSON@EXAMPLE.TEST ');
  check(a.user_id===uid(2),'Case and whitespace normalization');
  check((await begin('person@example.test')).status==='busy','Parallel login cannot race the counter');
  check((await finish(a,'invalid_credentials')).status==='invalid_credentials','First failure');
  a=await begin('person@example.test'); await finish(a,'abort');
  check((await q('select failed_attempts from private.eflow_login_accounts where user_id=$1',[uid(2)])).failed_attempts===1,'Transport error not counted');
  a=await begin('person@example.test'); await finish(a,'success');
  check((await q('select failed_attempts from private.eflow_login_accounts where user_id=$1',[uid(2)])).failed_attempts===0,'Success resets consecutive failures');
  for(let i=1;i<=3;i++){a=await begin('person@example.test');check((await finish(a,'invalid_credentials')).status===(i===3?'locked':'invalid_credentials'),'Exact threshold '+i);}
  check((await begin('other@example.test')).status==='ready','Different account unaffected');
  check((await begin('person@example.test')).status==='locked','Correct password cannot bypass existing lock');
  await finish(a,'ban','2126-01-01T00:00:00Z');
  await assert.rejects(admin(uid(3),'unlock_begin',uid(2)),/insufficient_privilege|insufficient privilege/);checks++;
  await admin(uid(1),'settings',null,5);
  check((await admin(uid(1),'read')).accounts.length===1,'Setting change does not unlock accounts');
  let unlock=await admin(uid(1),'unlock_begin',uid(2));
  check(unlock.auth_ban_until!==null,'Admin gets provider ban ownership');
  check((await admin(uid(1),'unlock_finish',uid(2),null,uid(3))).status==='stale','Forged unlock lease denied');
  check((await admin(uid(1),'unlock_finish',uid(2),null,unlock.lease)).status==='unlocked','Admin unlock succeeds');
  check((await admin(uid(1),'read')).accounts.length===0,'Unlocked account disappears');
  for(let i=1;i<=5;i++){a=await begin('person@example.test'); check((await finish(a,'invalid_credentials')).status===(i===5?'locked':'invalid_credentials'),'Dynamic threshold '+i);}
  await finish(a,'abort');
  await assert.rejects(admin(uid(1),'settings',null,0),/between 1 and 20/);checks++;
  await assert.rejects(admin(uid(1),'settings',null,21),/between 1 and 20/);checks++;
  for(const role of ['anon','authenticated']) {
    await db.exec('set role '+role);
    await assert.rejects(begin('person@example.test'),/permission denied/);checks++;
    await assert.rejects(admin(uid(1),'read'),/permission denied/);checks++;
    await assert.rejects(db.query('select * from private.eflow_login_accounts'),/permission denied/);checks++;
    await db.exec('reset role');
  }
  await q("select set_config('request.jwt.claim.role','authenticated',false)");
  await assert.rejects(begin('person@example.test'),/insufficient_privilege|insufficient privilege/);checks++;
  console.log(JSON.stringify({disposable_database:true,checks,passed:true}));
} finally {await db.close();}
