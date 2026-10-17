import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

it('enforces managed activation authority, mailbox claims, delivery, replay and elevated-role approval', async () => {
  const db = new PGlite();
  try {
    await db.exec(readFileSync('tests/sql/managed-account-bootstrap.sql', 'utf8'));
    await db.exec(readFileSync('supabase/migrations/20261016231317_managed_account_email_activation.sql', 'utf8'));
    const admin = '00000000-0000-4000-8000-000000000001', member = '00000000-0000-4000-8000-000000000002';
    const office = '10000000-0000-4000-8000-000000000001';
    const run = async (sql: string, args: unknown[] = []) => Object.values((await db.query('select ' + sql, args)).rows[0])[0] as any;
    const payload = (email: string, role = 'member') => ({ request_id: crypto.randomUUID(), mode: 'ledipo_create', full_name: 'Invited Person', email, role, org_id: office, skills: { Planning: true }, pds_notes: { strengths: 'Planning', weaknesses: '', notes: 'Reviewed', tags: ['Planning'] } });
    const stage = (input: ReturnType<typeof payload>, hash: string, actor = admin) => run('eflow_create_managed_activation($1,$2,$3,24)', [actor,input,hash]);
    const claim = (hash: string, attempt: string) => run('eflow_claim_managed_activation($1,$2)', [hash,attempt]);
    const complete = (hash: string, attempt: string, uid: string) => run('eflow_complete_managed_activation($1,$2,$3)', [hash,attempt,uid]);
    const action = (id: string, op: string, hash: string | null = null, actor = admin) => run('eflow_manage_managed_activation($1,$2,$3,$4,24)', [actor,id,op,hash]);
    const auth = (id: string, email: string, invitation: string, attempt: string) => db.query('insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data) values($1,$2,now(),$3)', [id,email,{eflow_activation:invitation,eflow_activation_attempt:attempt}]);
    expect(await run("has_function_privilege('authenticated','public.eflow_create_managed_activation(uuid,jsonb,text,integer)','EXECUTE')")).toBe(false);
    expect(await run("has_table_privilege('authenticated','public.managed_account_invite_details','SELECT')")).toBe(false);
    expect(await run("has_table_privilege('authenticated','public.profiles','INSERT')")).toBe(false);
    await expect(stage(payload('denied@example.test'),'a'.repeat(64),member)).rejects.toThrow('Admin');
    const first = payload('person@example.test'), hash = 'a'.repeat(64);
    const row = await stage(first,hash);
    expect(await run("count(*)::int from auth.users where email='person@example.test'")).toBe(0);
    expect(await run("count(*)::int from public.profiles where email='person@example.test'")).toBe(0);
    expect((await stage(first,'b'.repeat(64))).invitation_id).toBe(row.invitation_id);
    await expect(stage({...first,full_name:'Changed'},'b'.repeat(64))).rejects.toThrow('different details');
    await expect(stage(payload('PERSON@example.test'),'b'.repeat(64))).rejects.toThrow('already pending');
    expect(await run('eflow_reserve_managed_activation_email($1,$2)',[row.invitation_id,hash])).toBe(true);
    expect(await run('eflow_reserve_managed_activation_email($1,$2)',[row.invitation_id,hash])).toBe(false);
    await run("eflow_managed_activation_delivery($1,$2,'failed',null)",[row.invitation_id,hash]);
    expect((await run('eflow_list_managed_activations($1)',[admin])).invitations[0].email_delivery_status).toBe('failed');
    await expect(action(row.invitation_id,'resend','b'.repeat(64))).rejects.toThrow('wait');
    await db.query("update public.user_invitations set last_sent_at=now()-interval '2 minutes' where id=$1",[row.invitation_id]);
    await action(row.invitation_id,'resend','b'.repeat(64));
    await expect(claim(hash,crypto.randomUUID())).rejects.toThrow('Invalid');
    await expect(run('phase2_claim_invitation($1,$2)',['b'.repeat(64),crypto.randomUUID()])).rejects.toThrow('account activation');
    const attempt = crypto.randomUUID(); await claim('b'.repeat(64),attempt);
    await expect(claim('b'.repeat(64),crypto.randomUUID())).rejects.toThrow('in progress');
    await action(row.invitation_id,'revoke');
    await expect(claim('b'.repeat(64),attempt)).rejects.toThrow('Invalid');

    const second = payload('activated@example.test'), secondHash = 'c'.repeat(64), secondAttempt = crypto.randomUUID(), uid = crypto.randomUUID();
    const secondRow = await stage(second,secondHash); await claim(secondHash,secondAttempt);
    await auth(uid,second.email,secondRow.invitation_id,secondAttempt);
    expect(await complete(secondHash,secondAttempt,uid)).toEqual({activated:true,next_step:'sign_in'});
    expect(await complete(secondHash,secondAttempt,uid)).toEqual({activated:true,next_step:'sign_in'});
    expect(await run('is_active from public.profiles where id=$1',[uid])).toBe(true);
    expect(await run('notes from public.employee_notes where profile_id=$1',[uid])).toBe('Reviewed');
    await expect(claim(secondHash,crypto.randomUUID())).rejects.toThrow('Invalid');
    await expect(stage(payload(second.email),'d'.repeat(64))).rejects.toThrow('already exists');
    await auth(crypto.randomUUID(),'orphan@example.test',crypto.randomUUID(),crypto.randomUUID());
    await expect(stage(payload('orphan@example.test'),'d'.repeat(64))).rejects.toThrow('already exists');

    const elevated = payload('new-admin@example.test','admin'), elevatedHash = 'd'.repeat(64), elevatedAttempt = crypto.randomUUID(), elevatedUid = crypto.randomUUID();
    const elevatedRow = await stage(elevated,elevatedHash); await claim(elevatedHash,elevatedAttempt); await auth(elevatedUid,elevated.email,elevatedRow.invitation_id,elevatedAttempt);
    expect((await complete(elevatedHash,elevatedAttempt,elevatedUid)).next_step).toBe('awaiting_authority');
    expect(await run("role||':'||is_active::text from public.profiles where id=$1",[elevatedUid])).toBe('member:false');
    await expect(action(elevatedRow.invitation_id,'approve',null,member)).rejects.toThrow('Admin');
    await action(elevatedRow.invitation_id,'approve');
    expect(await run("role||':'||is_active::text from public.profiles where id=$1",[elevatedUid])).toBe('admin:true');

    const head = payload('new-head@example.test','head'), headHash = 'e'.repeat(64), headAttempt = crypto.randomUUID(), headUid = crypto.randomUUID();
    const headRow = await stage(head,headHash); await claim(headHash,headAttempt); await auth(headUid,head.email,headRow.invitation_id,headAttempt); await complete(headHash,headAttempt,headUid);
    await action(headRow.invitation_id,'approve');
    expect(await run('head_user_id from public.organizations where id=$1',[office])).toBe(headUid);
    expect(await run('role from public.profiles where id=$1',[headUid])).toBe('head');

    // A timeout reconcile waits on the same locks as completion and prevents
    // a delayed completion from committing an identity marked for compensation.
    const cleanup = payload('cleanup@example.test'), cleanupHash = '1'.repeat(64), cleanupAttempt = crypto.randomUUID(), cleanupUid = crypto.randomUUID();
    const cleanupRow = await stage(cleanup,cleanupHash); await claim(cleanupHash,cleanupAttempt); await auth(cleanupUid,cleanup.email,cleanupRow.invitation_id,cleanupAttempt);
    expect((await run('eflow_reconcile_managed_activation($1,$2,$3)',[cleanupRow.invitation_id,cleanupAttempt,cleanupUid])).discard_created_identity).toBe(true);
    await expect(complete(cleanupHash,cleanupAttempt,cleanupUid)).rejects.toThrow('expired');
    await expect(claim(cleanupHash,cleanupAttempt)).rejects.toThrow('cleanup');
    await db.query('delete from auth.users where id=$1',[cleanupUid]);
    expect((await claim(cleanupHash,cleanupAttempt)).auth_user_id).toBeNull();
    expect((await run('eflow_reconcile_managed_activation($1,$2,$3)',[secondRow.invitation_id,secondAttempt,uid])).accepted).toBe(true);

    const expires = await stage(payload('expired@example.test'),'2'.repeat(64));
    await db.query("update public.user_invitations set expires_at=now()-interval '1 minute' where id=$1",[expires.invitation_id]);
    await expect(claim('2'.repeat(64),crypto.randomUUID())).rejects.toThrow('expired');
    await db.query('update public.profiles set is_active=false where id=$1',[admin]);
    await expect(stage(payload('lost-authority@example.test'),'3'.repeat(64))).rejects.toThrow('Admin');
    await expect(claim(cleanupHash,cleanupAttempt)).rejects.toThrow('Admin');
    await db.query('update public.profiles set is_active=true where id=$1',[admin]);

    const inactive = await stage(payload('inactive@example.test'),'f'.repeat(64));
    await db.query('update public.organizations set is_active=false where id=$1',[office]);
    await expect(claim('f'.repeat(64),crypto.randomUUID())).rejects.toThrow('active participating office');
    expect(inactive.status).toBe('pending');
  } finally { await db.close(); }
}, 60_000);
