-- Rollback-only hosted regression. Never removes an existing project permanently.
begin;
do $$
declare h public.profiles; m uuid; p uuid:=gen_random_uuid(); g uuid;
 t1 public.tasks;t2 public.tasks; before_tasks jsonb;after_tasks jsonb;
 before_subtasks jsonb; before_audit jsonb; blocked boolean;
begin
 select * into h from public.profiles where role='head' and is_active order by id limit 1;
 if h.id is null then raise exception 'An active Head is required for verification';end if;
 select id into m from public.profiles where role='member' and is_active order by id limit 1;
 if m is null then raise exception 'A Member is required for permission verification';end if;
 perform set_config('request.jwt.claim.sub',h.id::text,true);
 insert into public.projects(id,title,org_id,owner_id,created_by)
 values(p,'Rollback project deletion QA',h.org_id,h.id,h.id);
 select id into g from public.project_groups where project_id=p and is_default;
 t1:=public.phase3_create_task(p,g,'Retain active task history');
 t2:=public.phase3_create_task(p,g,'Retain deleted task history');
 update public.tasks set deleted_at=now() where id=t2.id;
 select jsonb_agg(to_jsonb(t)-array['linked_project_id','milestone_id','group_id','updated_at'] order by t.id)
 into before_tasks from public.tasks t where t.linked_project_id=p;
 select coalesce(jsonb_agg(to_jsonb(s) order by s.id),'[]'::jsonb) into before_subtasks
 from public.subtasks s where s.task_id in(t1.id,t2.id);
 select coalesce(jsonb_agg(to_jsonb(a) order by a.id),'[]'::jsonb) into before_audit
 from public.audit_events a where a.entity_id in(p::text,t1.id::text,t2.id::text);
 blocked:=false;begin perform public.delete_project_permanently(p,'wrong title','Testing title validation');
 exception when sqlstate '22023' then blocked:=true;end;
 if not blocked then raise exception 'Wrong confirmation accepted';end if;
 blocked:=false;begin perform public.delete_project_permanently(p,'Rollback project deletion QA','x');
 exception when sqlstate '22023' then blocked:=true;end;
 if not blocked then raise exception 'Short deletion reason accepted';end if;
 perform set_config('request.jwt.claim.sub',m::text,true);
 blocked:=false;begin perform public.delete_project_permanently(p,'Rollback project deletion QA','Testing Member rejection');
 exception when sqlstate '42501' then blocked:=true;end;
 if not blocked then raise exception 'Member deletion accepted';end if;
 perform set_config('request.jwt.claim.sub','',true);
 blocked:=false;begin perform public.delete_project_permanently(p,'Rollback project deletion QA','Testing anonymous rejection');
 exception when sqlstate '42501' then blocked:=true;end;
 if not blocked then raise exception 'Anonymous deletion accepted';end if;
 perform set_config('request.jwt.claim.sub',h.id::text,true);
 if not exists(select 1 from public.projects where id=p) or exists(select 1 from eflow_phase6.project_deletions) then
  raise exception 'Denied requests changed the project or leaked deletion context';end if;
 -- A browser cannot manufacture or call the private cleanup authority.
 if has_table_privilege('authenticated','eflow_phase6.project_deletions','INSERT')
 or has_function_privilege('authenticated','eflow_phase6.project_deletion_detach(jsonb,jsonb)','EXECUTE') then
  raise exception 'Private deletion authority exposed';end if;
 blocked:=false;begin
  update public.tasks set linked_project_id=null,milestone_id=null,group_id=null where id=t2.id;
 exception when sqlstate '42501' then blocked:=true;end;
 if not blocked then raise exception 'Ordinary task edit bypassed the deleted-history guard';end if;
 -- Even an internal context accepts only exact detachment, never work edits.
 insert into eflow_phase6.project_deletions(tx,actor,project_id) values(txid_current(),h.id,p);
 if not eflow_phase6.project_deletion_detach(to_jsonb(t1),to_jsonb(t1)||jsonb_build_object('linked_project_id',null,'milestone_id',null,'group_id',null)) then
  raise exception 'Exact internal detachment rejected';end if;
 if eflow_phase6.project_deletion_detach(to_jsonb(t1),to_jsonb(t1)||jsonb_build_object('linked_project_id',null,'milestone_id',null,'group_id',null,'title','Unauthorized edit')) then
  raise exception 'Cleanup context accepted a work edit';end if;
 perform set_config('request.jwt.claim.sub',m::text,true);
 if eflow_phase6.project_deletion_detach(to_jsonb(t1),to_jsonb(t1)||jsonb_build_object('linked_project_id',null,'milestone_id',null,'group_id',null)) then
  raise exception 'Cleanup context accepted a different actor';end if;
 perform set_config('request.jwt.claim.sub',h.id::text,true);
 delete from eflow_phase6.project_deletions where tx=txid_current() and actor=h.id and project_id=p;
 -- Exercise the actual authenticated RPC execution role.
 set local role authenticated;
 perform public.delete_project_permanently(p,'Rollback project deletion QA','Explicit rollback-only acceptance');
 reset role;
 set constraints all immediate;
 if exists(select 1 from public.projects where id=p)
 or exists(select 1 from public.project_groups where project_id=p)
 or exists(select 1 from public.project_offices where project_id=p)
 or exists(select 1 from public.project_members where project_id=p) then raise exception 'Operational container remains';end if;
 select jsonb_agg(to_jsonb(t)-array['linked_project_id','milestone_id','group_id','updated_at'] order by t.id)
 into after_tasks from public.tasks t where t.id in(t1.id,t2.id);
 if before_tasks is distinct from after_tasks then raise exception 'Retained task facts changed';end if;
 if exists(select 1 from public.tasks where id in(t1.id,t2.id) and
 (linked_project_id is not null or milestone_id is not null or group_id is not null)) then raise exception 'Task links not cleared';end if;
 if before_subtasks is distinct from (select coalesce(jsonb_agg(to_jsonb(s) order by s.id),'[]'::jsonb) from public.subtasks s where s.task_id in(t1.id,t2.id)) then raise exception 'Subtask history changed';end if;
 if not before_audit <@ (select coalesce(jsonb_agg(to_jsonb(a) order by a.id),'[]'::jsonb) from public.audit_events a where a.entity_id in(p::text,t1.id::text,t2.id::text)) then raise exception 'Audit history lost';end if;
 if (select count(*) from public.audit_events where entity_id=p::text and action='project.deleted')<>1
 or exists(select 1 from eflow_phase6.project_deletions) then raise exception 'Missing deletion receipt or leaked cleanup authority';end if;
end $$;
select 'PASS: authenticated Head deletion, active/deleted task retention, scoped link cleanup, audit receipt, invalid title/reason, Member/anonymous denial and private context' as checks;
rollback;
