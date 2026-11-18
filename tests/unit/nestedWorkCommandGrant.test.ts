import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {expect,it} from 'vitest';

it('repairs the invoker-to-private-command permission path without allowing anonymous or unverified work',async()=>{
 const migration=await readFile(new URL('../../supabase/migrations/20261118135631_restore_nested_work_command_execution.sql',import.meta.url),'utf8');
 const grants=migration.match(/^grant execute[^;]+;/gm);
 expect(grants).toEqual(['grant execute on function eflow_r7.command(uuid,integer,uuid,text,jsonb) to authenticated;']);
 const db=await PGlite.create();
 try{
  // Disposable permission model. Hosted function bodies are checked separately
  // by the migration fingerprints and post-deployment catalog comparison.
  await db.exec(`create role authenticated;create role anon;create schema eflow_r7;
   grant usage on schema eflow_r7 to authenticated;
   create function eflow_r7.command(uuid,integer,uuid,text,jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
   begin
    if current_setting('request.jwt.claim.sub',true) is distinct from 'eligible-lead' then
     raise exception 'Active verified operational identity required' using errcode='42501';
    end if;
    return '{"saved":true}'::jsonb;
   end $$;
   create function public.r7_work_command(uuid,integer,uuid,text,jsonb) returns jsonb language sql security invoker set search_path='' as $$select eflow_r7.command($1,$2,$3,$4,$5)$$;
   revoke all on function eflow_r7.command(uuid,integer,uuid,text,jsonb) from public,anon,authenticated;
   revoke all on function public.r7_work_command(uuid,integer,uuid,text,jsonb) from public,anon;
   grant execute on function public.r7_work_command(uuid,integer,uuid,text,jsonb) to authenticated;
   set role authenticated;`);
  const call="select public.r7_work_command(null,1,null,'create','{}'::jsonb) as receipt";
  await expect(db.query(call)).rejects.toThrow('permission denied for function command');
  await db.exec('reset role;'+grants![0]+'set role authenticated;');
  await expect(db.query(call)).rejects.toThrow('Active verified operational identity required');
  await db.query("select set_config('request.jwt.claim.sub','eligible-lead',false)");
  expect((await db.query<{receipt:{saved:boolean}}>(call)).rows[0].receipt.saved).toBe(true);
  await db.exec('reset role;set role anon;');
  await expect(db.query(call)).rejects.toThrow('permission denied for function r7_work_command');
 }finally{await db.close();}
},30_000);
