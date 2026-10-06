begin;
set local lock_timeout='10s';
-- Always authorize from the existing identity before examining a proposed link.
-- Otherwise moving a row out of a shared project could bypass its guards.
do $$ declare d text;begin
 select pg_get_functiondef('public.phase6_guard_task()'::regprocedure) into d;
 d:=replace(d,'if tg_op=''DELETE'' then t:=old;else t:=new;end if;','if tg_op in (''DELETE'',''UPDATE'') then t:=old;else t:=new;end if;');
 d:=replace(d,'elsif not eflow_phase6.work(t.id,actor) then',
 'elsif not eflow_phase6.work(t.id,actor) and not (tg_op=''UPDATE'' and public.phase2_is_office_head(actor,p.org_id) and (to_jsonb(new)-array[''group_id'',''workspace_position'',''updated_at''])=(to_jsonb(old)-array[''group_id'',''workspace_position'',''updated_at''])) then');
 if d not like '%to_jsonb(new)-array%' or d not like '%t:=old;else t:=new%' then raise exception 'Review changed Phase 6 task guard';end if;
 execute d;
 select pg_get_functiondef('public.phase6_guard_subtask()'::regprocedure) into d;
 d:=replace(d,'if tg_op=''DELETE'' then tid:=old.task_id;else tid:=new.task_id;end if;',
 'if tg_op in (''DELETE'',''UPDATE'') then tid:=old.task_id;else tid:=new.task_id;end if;');
 d:=replace(d,'if tg_op=''DELETE'' then return old;else return new;end if;',
 'if tg_op=''UPDATE'' and new.task_id is distinct from old.task_id and eflow_phase6.shared(t.linked_project_id) then raise exception ''Project work identity is protected'' using errcode=''42501'';end if; if tg_op=''DELETE'' then return old;else return new;end if;');
 if d not like '%Project work identity is protected%' then raise exception 'Review changed Phase 6 subtask guard';end if;
 execute d;
end $$;

create function public.phase6_move_task(p_task uuid,p_group uuid,p_position integer) returns void language plpgsql security definer set search_path='' as $$
declare t public.tasks;p public.projects;
begin
 select * into t from public.tasks where id=p_task and deleted_at is null;
 select * into p from public.projects where id=t.linked_project_id for update;
 select * into t from public.tasks where id=p_task and deleted_at is null for update;
 if p.id is null or not public.phase2_is_office_head(auth.uid(),p.org_id) or not public.can_manage_project(p.id,auth.uid()) or p.source_collaboration_draft_id is not null then raise exception 'Only the Lead Office Head can organize shared project groups' using errcode='42501';end if;
 if p.status in ('completed','archived') or t.archived_at is not null or t.status in ('completed','cancelled') then raise exception 'Closed work is read-only' using errcode='22023';end if;
 if p_position is null or p_position<0 or not exists(select 1 from public.project_groups where id=p_group and project_id=p.id) then raise exception 'Choose a group in this project' using errcode='22023';end if;
 update public.tasks set group_id=p_group,workspace_position=p_position where id=t.id;
 insert into public.audit_events(actor_id,entity_type,entity_id,action,org_id,after_data) values(auth.uid(),'task',t.id::text,'project.task_group',p.org_id,jsonb_build_object('group_id',p_group,'position',p_position));
end $$;
revoke all on function public.phase6_move_task(uuid,uuid,integer) from public,anon;
grant execute on function public.phase6_move_task(uuid,uuid,integer) to authenticated;

create or replace function public.phase6_guard_project_member() returns trigger language plpgsql security definer set search_path='' as $$
declare pid uuid;uid uuid;oid uuid;begin
 if tg_op in ('DELETE','UPDATE') then pid:=old.project_id;uid:=old.user_id;else pid:=new.project_id;uid:=new.user_id;end if;
 if eflow_phase6.shared(pid) and auth.uid() is not null then
  select org_id into oid from public.profiles where id=uid and is_active;
  if not eflow_phase6.head(pid,oid,auth.uid()) then raise exception 'Each Office selects its own project personnel' using errcode='42501';end if;
  if tg_op='UPDATE' and (new.project_id is distinct from old.project_id or new.user_id is distinct from old.user_id) then raise exception 'Project member identity is protected' using errcode='42501';end if;
 end if;
 if tg_op='DELETE' then return old;else return new;end if;
end $$;
commit;
