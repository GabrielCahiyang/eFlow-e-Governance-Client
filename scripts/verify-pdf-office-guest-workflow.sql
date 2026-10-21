begin;
do $$
declare h public.profiles;m public.profiles;p uuid:=gen_random_uuid();sid uuid:=gen_random_uuid();worker uuid:=gen_random_uuid();
 req uuid:=gen_random_uuid();s jsonb;r jsonb;review jsonb;identity uuid;task2 uuid;invite jsonb;before_profile jsonb;result jsonb;
begin
 select * into h from public.profiles where role='head' and is_active limit 1;
 select * into m from public.profiles where role='member' and is_active and email is not null limit 1;
 before_profile:=to_jsonb(m);
 perform set_config('request.jwt.claim.sub',h.id::text,true);
 insert into public.projects(id,title,org_id,owner_id,created_by) values(p,'Rollback named Office guest QA',h.org_id,h.id,h.id);
 review:=jsonb_build_object('schemaVersion',1,'sourceName','rollback.pdf','applyProjectDetails',false,
 'offices',jsonb_build_array(jsonb_build_object('key','o1','name','Agriculture Office QA','evidence','Agriculture Office QA implements consultation','officeId','','confirmed',true)),
 'groups',jsonb_build_array(jsonb_build_object('key','g1','title','Planning','color','#087f8c','existingGroupId','','tasks',
 jsonb_build_array(jsonb_build_object('key','t2','title','Office consultation','description','Source consultation','priority','medium','estimatedHours',4,'officeKey','o1','dependencies','[]'::jsonb,'subitems','[]'::jsonb)))));
 s:=public.save_pdf_import_session(sid,p,0,worker,jsonb_build_object('stage','ready','sourceName','rollback.pdf','review',review,'assignments','[]'::jsonb));
 r:=public.complete_pdf_import_session(sid,(s->>'revision')::int,worker);
 task2:=(r->'taskIds'->>'t2')::uuid;
 select identity_id into identity from public.project_office_work where task_id=task2;
 invite:=public.invite_project_office_person(req,identity,m.email,'employee');
 if invite->>'state'<>'approved' then raise exception 'Head invitation not approved';end if;
 perform public.r8_reserve_dispatch(h.id,req,(invite->>'revision')::int,repeat('a',64),168,false);
 perform public.r8_finish_dispatch(req,repeat('a',64),'rollback-provider',null);
 -- Service-role acceptance keeps global account identity untouched.
 perform set_config('request.jwt.claim.sub','',true);
 result:=public.r8_accept(repeat('a',64),m.id,m.full_name,null);
 if (select to_jsonb(q) from public.profiles q where q.id=m.id) is distinct from before_profile then raise exception 'Permanent account changed';end if;
 if not exists(select 1 from public.project_guest_members where request_id=req and user_id=m.id and ended_at is null and until_close) then raise exception 'Project guest not activated';end if;
 if exists(select 1 from public.tasks where id=task2 and proposed_office_identity_id is not null) then raise exception 'Task still waits for Head confirmation';end if;
 if not eflow_phase65.office_candidate(task2,m.id) or eflow_phase65.office_candidate(task2,h.id) then raise exception 'Office candidate scope incorrect';end if;
 perform set_config('request.jwt.claim.sub',h.id::text,true);
 s:=public.r7_work_tree(task2);
 perform public.auto_assign_project_task(task2,(s->>'revision')::int,gen_random_uuid(),m.id,array[m.id]);
 if exists(select 1 from public.project_office_members om join public.project_offices po on po.id=om.project_office_id where po.project_id=p and om.user_id=m.id) then raise exception 'Temporary guest was enrolled as permanent selected staff';end if;
 perform public.phase65_remove_project_office(null,identity);
 if exists(select 1 from public.project_guest_members where request_id=req and ended_at is null) then raise exception 'Removed Office guest access remains';end if;
 if exists(select 1 from public.tasks where id=task2 and assigned_to=m.id) then raise exception 'Removed Office staffing remains';end if;
 perform public.delete_project_permanently(p,'Rollback named Office guest QA','Rollback acceptance verification');
 if exists(select 1 from public.projects where id=p) then raise exception 'Project deletion still blocked';end if;
end $$;
select 'PASS: employee invitation approved by LEDIPO, accepted without department Head, temporary project membership active, work available, global profile unchanged, source-office candidate restriction' as checks;
rollback;
