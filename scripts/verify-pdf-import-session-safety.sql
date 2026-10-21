begin;
do $$
declare h public.profiles;m public.profiles;p uuid:=gen_random_uuid();sid uuid:=gen_random_uuid();worker uuid:=gen_random_uuid();
 s jsonb;r jsonb;review jsonb;blocked boolean;state jsonb;
begin
 select * into h from public.profiles where role='head' and is_active limit 1;
 select * into m from public.profiles where role='member' and is_active limit 1;
 perform set_config('request.jwt.claim.sub',h.id::text,true);
 insert into public.projects(id,title,org_id,owner_id,created_by) values(p,'Rollback PDF recovery QA',h.org_id,h.id,h.id);
 review:='{"schemaVersion":1,"sourceName":"safe.pdf","applyProjectDetails":false,"offices":[],"groups":[{"key":"g1","title":"Planning","color":"#087f8c","existingGroupId":"","tasks":[{"key":"t1","title":"Kick Off Meeting","description":"Source methods","priority":"high","estimatedHours":4,"officeKey":"","dependencies":[],"subitems":[]}]}]}'::jsonb;
 state:=jsonb_build_object('stage','ready','sourceName','safe.pdf','review',review,'assignments',jsonb_build_array(jsonb_build_object('key','t1','lead',gen_random_uuid(),'people',jsonb_build_array(gen_random_uuid()))));
 s:=public.save_pdf_import_session(sid,p,0,worker,state);
 blocked:=false;begin perform public.save_pdf_import_session(sid,p,1,gen_random_uuid(),state);exception when sqlstate '40001' then blocked:=true;end;
 if not blocked then raise exception 'Concurrent runner stole active import';end if;
 blocked:=false;begin perform public.save_pdf_import_session(sid,p,null,worker,state);exception when sqlstate '22023' then blocked:=true;end;
 if not blocked then raise exception 'Null revision accepted';end if;
 blocked:=false;begin perform public.complete_pdf_import_session(sid,999,worker);exception when sqlstate '40001' then blocked:=true;end;
 if not blocked then raise exception 'Stale publication accepted';end if;
 -- Invalid staffing must roll back groups, tasks, offices and batch receipts.
 blocked:=false;begin perform public.complete_pdf_import_session(sid,1,worker);exception when sqlstate '42501' or sqlstate '22023' then blocked:=true;end;
 if not blocked or exists(select 1 from public.tasks where linked_project_id=p) or exists(select 1 from public.project_import_batches where id=sid)
 or not exists(select 1 from public.project_groups where project_id=p and is_default) then raise exception 'Failed staffing left partial imported work';end if;
 perform set_config('request.jwt.claim.sub',m.id::text,true);
 blocked:=false;begin perform public.save_pdf_import_session(sid,p,1,worker,state);exception when sqlstate '42501' then blocked:=true;end;
 if not blocked then raise exception 'Member resumed Head import';end if;
 set local role authenticated;
 if exists(select 1 from public.project_pdf_import_sessions where id=sid) then raise exception 'Member read private import source';end if;
 reset role;
 perform set_config('request.jwt.claim.sub',h.id::text,true);
 state:=jsonb_set(state,'{assignments}',jsonb_build_array(jsonb_build_object('key','t1','lead',h.id,'people',jsonb_build_array(h.id))));
 s:=public.save_pdf_import_session(sid,p,1,worker,state);
 set local role authenticated;
 r:=public.complete_pdf_import_session(sid,(s->>'revision')::int,worker);
 if public.complete_pdf_import_session(sid,999,gen_random_uuid())<>r then raise exception 'Retry did not return committed receipt';end if;
 reset role;
 if (select count(*) from public.tasks where linked_project_id=p)<>1
 or (select count(*) from public.project_import_batches where id=sid)<>1 then raise exception 'Import was duplicated';end if;
 if exists(select 1 from public.project_office_identities where project_id=p and canonical_office_id is distinct from h.org_id) then raise exception 'Unchecked office import created an Office';end if;
 set constraints all immediate;
end $$;
select 'PASS: exclusive resumable sessions, null/stale revisions, atomic staffing rollback, private source RLS, member denial, corrected publication, stable receipt and no duplicate tasks or unwanted Offices' as checks;
rollback;
