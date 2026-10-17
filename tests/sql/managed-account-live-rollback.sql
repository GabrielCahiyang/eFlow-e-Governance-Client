-- Disposable live-schema verification. Every fixture is enclosed in ROLLBACK.
-- Run only against the approved hosted target with an active Admin and LEDIPO.
begin;
do $test$
declare a uuid; o uuid; i jsonb; c jsonb; p jsonb; h text:=repeat('1',64); uid uuid:=gen_random_uuid(); attempt uuid:=gen_random_uuid(); rid uuid:=gen_random_uuid();
begin
 select id into strict a from public.profiles where role='admin' and is_active limit 1;
 select id into strict o from public.organizations where slug='ledipo' and is_active;
 if has_function_privilege('anon','public.eflow_complete_managed_activation(text,uuid,uuid)','EXECUTE') or has_function_privilege('authenticated','public.eflow_create_managed_activation(uuid,jsonb,text,integer)','EXECUTE') or has_table_privilege('authenticated','public.managed_account_invite_details','SELECT') or has_table_privilege('authenticated','public.profiles','INSERT') then raise exception 'Managed activation grants failed';end if;
 p:=jsonb_build_object('request_id',rid,'mode','ledipo_create','email','activation-rollback-'||rid::text||'@example.invalid','full_name','Disposable activation verification','role','member','org_id',o,'skills',jsonb_build_object('Planning',true),'pds_notes',jsonb_build_object('notes','Synthetic verification only','tags',jsonb_build_array('Planning')));
 i:=public.eflow_create_managed_activation(a,p,h,24);
 if exists(select 1 from auth.users where email=p->>'email') or exists(select 1 from public.profiles where email=p->>'email') then raise exception 'Staging created an identity';end if;
 if (public.eflow_create_managed_activation(a,p,repeat('2',64),24)->>'invitation_id')<>i->>'invitation_id' then raise exception 'Stage idempotency failed';end if;
 perform public.eflow_validate_managed_activation(h);
 c:=public.eflow_claim_managed_activation(h,attempt);
 insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data,aud,role) values(uid,p->>'email',now(),jsonb_build_object('eflow_activation',i->>'invitation_id','eflow_activation_attempt',attempt::text),'authenticated','authenticated');
 c:=public.eflow_complete_managed_activation(h,attempt,uid);
 if c->>'next_step'<>'sign_in' or not exists(select 1 from public.profiles where id=uid and role='member' and is_active and org_id=o) or not exists(select 1 from public.organization_memberships where user_id=uid and organization_id=o) or not exists(select 1 from public.employee_notes where profile_id=uid and notes='Synthetic verification only') then raise exception 'Atomic Member activation failed';end if;
 if public.eflow_complete_managed_activation(h,attempt,uid)<>c then raise exception 'Completion retry failed';end if;
 if (public.eflow_reconcile_managed_activation((i->>'invitation_id')::uuid,attempt,uid)->>'accepted')::boolean is not true then raise exception 'Accepted reconcile failed';end if;
 begin perform public.eflow_claim_managed_activation(h,gen_random_uuid());raise exception 'Replay was accepted';exception when sqlstate '22023' then null;end;
 -- A privileged invitation verifies email to an inactive Member first.
 p:=jsonb_set(jsonb_set(jsonb_set(p,'{request_id}',to_jsonb(gen_random_uuid())),'{email}',to_jsonb('activation-admin-'||rid::text||'@example.invalid')),'{role}','"admin"');
 h:=repeat('3',64);uid:=gen_random_uuid();attempt:=gen_random_uuid();
 i:=public.eflow_create_managed_activation(a,p,h,24);perform public.eflow_claim_managed_activation(h,attempt);
 insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data,aud,role) values(uid,p->>'email',now(),jsonb_build_object('eflow_activation',i->>'invitation_id','eflow_activation_attempt',attempt::text),'authenticated','authenticated');
 c:=public.eflow_complete_managed_activation(h,attempt,uid);
 if c->>'next_step'<>'awaiting_authority' or not exists(select 1 from public.profiles where id=uid and role='member' and not is_active) then raise exception 'Elevated activation bypassed approval';end if;
 perform public.eflow_manage_managed_activation(a,(i->>'invitation_id')::uuid,'approve',null,24);
 if not exists(select 1 from public.profiles where id=uid and role='admin' and is_active) then raise exception 'Deliberate Admin approval failed';end if;
end $test$;
rollback;
select 'live_activation_transactions_passed_and_rolled_back' as result;

begin;
do $test$
declare a uuid; o uuid:=gen_random_uuid(); uid uuid:=gen_random_uuid(); attempt uuid:=gen_random_uuid(); i jsonb; p jsonb; h text:=repeat('5',64);
begin
 select id into strict a from public.profiles where role='admin' and is_active limit 1;
 insert into public.organizations(id,name,slug,path,org_type,is_active) values(o,'Disposable rollback office','qa_activation_'||o::text,('qa_activation_'||replace(o::text,'-',''))::public.ltree,'division',true);
 p:=jsonb_build_object('request_id',gen_random_uuid(),'mode','office_invite','email','head-activation-'||o::text||'@example.invalid','full_name','Disposable Head activation','role','head','org_id',o,'skills','{}'::jsonb);
 i:=public.eflow_create_managed_activation(a,p,h,24);
 perform public.eflow_claim_managed_activation(h,attempt);
 insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data,aud,role) values(uid,p->>'email',now(),jsonb_build_object('eflow_activation',i->>'invitation_id','eflow_activation_attempt',attempt::text),'authenticated','authenticated');
 perform public.eflow_complete_managed_activation(h,attempt,uid);
 perform public.eflow_manage_managed_activation(a,(i->>'invitation_id')::uuid,'approve',null,24);
 if not exists(select 1 from public.profiles where id=uid and role='head' and is_active and org_id=o) or not exists(select 1 from public.organizations where id=o and head_user_id=uid) then raise exception 'Canonical Head approval failed';end if;
 -- Resend invalidates the previous hash and revocation invalidates its replacement.
 h:=repeat('6',64);
 p:=jsonb_set(jsonb_set(jsonb_set(p,'{request_id}',to_jsonb(gen_random_uuid())),'{email}',to_jsonb('rotation-'||o::text||'@example.invalid')),'{role}','"member"');
 i:=public.eflow_create_managed_activation(a,p,h,24);
 if public.eflow_reserve_managed_activation_email((i->>'invitation_id')::uuid,h) is not true then raise exception 'Dispatch reservation failed';end if;
 if public.eflow_reserve_managed_activation_email((i->>'invitation_id')::uuid,h) is not false then raise exception 'Dispatch duplicated';end if;
 begin perform public.eflow_manage_managed_activation(a,(i->>'invitation_id')::uuid,'resend',repeat('7',64),24);raise exception 'Cooldown bypass';exception when sqlstate '54000' then null;end;
 -- A new unsent invitation can be rotated without waiting for a delivery attempt.
 p:=jsonb_set(jsonb_set(p,'{request_id}',to_jsonb(gen_random_uuid())),'{email}',to_jsonb('reissue-'||o::text||'@example.invalid'));
 h:=repeat('8',64);i:=public.eflow_create_managed_activation(a,p,h,24);
 perform public.eflow_manage_managed_activation(a,(i->>'invitation_id')::uuid,'resend',repeat('9',64),24);
 begin perform public.eflow_validate_managed_activation(h);raise exception 'Old token still valid';exception when sqlstate '22023' then null;end;
 perform public.eflow_manage_managed_activation(a,(i->>'invitation_id')::uuid,'revoke',null,24);
 begin perform public.eflow_claim_managed_activation(repeat('9',64),gen_random_uuid());raise exception 'Revoked token accepted';exception when sqlstate '22023' then null;end;
end $test$;
rollback;
select 'live_head_approval_rotation_revocation_and_cooldown_passed_and_rolled_back' as result;

