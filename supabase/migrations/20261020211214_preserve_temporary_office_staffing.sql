CREATE OR REPLACE FUNCTION public.auto_assign_project_task(p_root uuid, p_revision integer, p_request uuid, p_lead uuid, p_people uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r jsonb; o public.project_offices; receipt eflow_r7.receipts; payload jsonb; people uuid[]; roster uuid[]; u uuid;
begin
 perform eflow_r3.actor();
 if not coalesce(eflow_r7.head(p_root),false) then raise exception 'Only the responsible Office Head can auto assign work' using errcode='42501';end if;
 perform eflow_r7.lock_impact(p_root);
 r:=eflow_r7.root(p_root);
 if r->>'kind'<>'office' or not coalesce(eflow_r7.head(p_root),false) then raise exception 'Office task access required' using errcode='42501';end if;
 if p_request is null or p_lead is null or p_people is null or cardinality(p_people) not between 1 and 200 or not p_lead=any(p_people) then raise exception 'Choose a lead and task team' using errcode='22023';end if;
 select array_agg(distinct id order by id) into people from unnest(p_people) id;
 payload:=jsonb_build_object('lead',p_lead,'people',people);
 select * into receipt from eflow_r7.receipts where actor_id=auth.uid() and request_id=p_request;
 if found then
  if receipt.root_id<>p_root or receipt.payload<>jsonb_build_object('command','root_lead','payload',payload) then raise exception 'Request identity already used' using errcode='23505';end if;
  return public.r7_work_tree(p_root);
 end if;
 if not (r->>'open')::bool or r->>'status' not in ('pending_assignment','todo') or r->>'lead' is not null then raise exception 'Auto assign is for tasks that have not started and have no lead. Existing assignments are kept.' using errcode='22023';end if;
 if exists(select 1 from eflow_r7.nodes where task_id=p_root and lead_id is not null) then raise exception 'This task already has subtask leads. Choose its lead manually to review their assignments.' using errcode='22023';end if;
 if exists(select 1 from jsonb_array_elements_text(r->'people') id where not id::uuid=any(people)) then raise exception 'Keep the existing task contributors' using errcode='22023';end if;
 select * into o from public.project_offices where project_id=(r->>'project')::uuid and office_id=(r->>'office')::uuid for update;
 if o.id is null or o.invitation_status<>'joined' or o.relationship_type='observer' then raise exception 'A joined participating Office is required' using errcode='42501';end if;
 foreach u in array people loop
  if not eflow_phase65.office_candidate(p_root,u) then raise exception 'Choose people who joined the responsible project Office' using errcode='42501';end if;
  -- Existing accepted project guests keep their scoped access. New additions
  -- come from the Head's active Office directory, never arbitrary accounts.
  if not coalesce(eflow_r7.member(o.project_id,o.office_id,u),false) and not
    (eflow_r9.allowed(o.project_id,u,o.office_id) and exists(select 1 from public.profiles where id=u and org_id=o.office_id and is_active and role<>'admin')) then
   raise exception 'A selected person is no longer available for this project' using errcode='42501';end if;
 end loop;
 select coalesce(array_agg(distinct user_id),'{}'::uuid[]) into roster from public.project_office_members where project_office_id=o.id;
 select coalesce(array_agg(distinct id),'{}'::uuid[]) into roster from unnest(roster || array(select p.id from public.profiles p where p.id=any(people) and p.org_id=o.office_id and not exists(select 1 from public.project_guest_members gm where gm.project_id=o.project_id and gm.office_id=o.office_id and gm.user_id=p.id and gm.ended_at is null and (gm.access_end is null or gm.access_end>now())))) id;
 perform public.phase6_set_members(o.id,roster);
 -- Any stale revision or staffing failure rolls back project enrollment too.
 perform eflow_r7.command(p_root,p_revision,p_request,'root_lead',payload);
 return public.r7_work_tree(p_root);
end $function$;
