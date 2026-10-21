CREATE OR REPLACE FUNCTION public.save_pdf_import_session(p_id uuid, p_project uuid, p_revision integer, p_runner uuid, p_state jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare s public.project_pdf_import_sessions;p public.projects;
begin
 p:=eflow_phase65.require_lead(p_project,auth.uid());
 if p.status in ('completed','archived') then raise exception 'This project is read-only' using errcode='22023';end if;
 if p_revision is null or p_revision<0 or p_runner is null or jsonb_typeof(p_state)<>'object' or octet_length(p_state::text)>3000000
 or coalesce(p_state->>'stage','') not in ('reading','preparing','offices','review_offices','staffing','ready','saving','failed','discarded') then raise exception 'Invalid import checkpoint' using errcode='22023';end if;
 select * into s from public.project_pdf_import_sessions where id=p_id for update;
 if not found then
  if p_revision<>0 then raise exception 'Import session changed. Reopen the import.' using errcode='40001';end if;
  insert into public.project_pdf_import_sessions(id,project_id,actor_id,state,runner,lease_until)
   values(p_id,p_project,auth.uid(),p_state,p_runner,now()+interval '90 seconds') returning * into s;
 else
  if s.project_id<>p_project or s.actor_id<>auth.uid() then raise exception 'Import session unavailable' using errcode='42501';end if;
  if s.result is not null then return to_jsonb(s);end if;
  if s.revision<>p_revision or s.runner is distinct from p_runner and s.lease_until>now() then raise exception 'This import is open elsewhere. Wait briefly and resume it.' using errcode='40001';end if;
  update public.project_pdf_import_sessions set state=p_state,revision=revision+1,runner=p_runner,
   lease_until=now()+interval '90 seconds',updated_at=now() where id=s.id returning * into s;
 end if;
 return to_jsonb(s);
end $function$;

CREATE OR REPLACE FUNCTION public.complete_pdf_import_session(p_id uuid, p_revision integer, p_runner uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare s public.project_pdf_import_sessions;p public.projects;r jsonb;a jsonb;t jsonb;g jsonb;i uuid;root uuid;snap jsonb;
 assigned integer:=0;offices integer:=0;seen text[]:='{}';k text;
begin
 select * into s from public.project_pdf_import_sessions where id=p_id;
 if s.id is null or s.actor_id is distinct from auth.uid() then raise exception 'Import session unavailable' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('r9:'||s.project_id::text,0));
 p:=eflow_phase65.require_lead(s.project_id,auth.uid());
 select * into s from public.project_pdf_import_sessions where id=p_id for update;
 if s.result is not null then return s.result;end if;
 if p_revision is null or s.revision<>p_revision or s.runner is distinct from p_runner or s.lease_until<=now() then raise exception 'Import session changed. Resume it before saving.' using errcode='40001';end if;
 if s.state->>'stage' not in ('ready','saving') or jsonb_typeof(s.state->'review') is distinct from 'object' or jsonb_typeof(coalesce(s.state->'assignments','[]')) is distinct from 'array' then raise exception 'Finish preparing the import first' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('r9:'||p.id::text,0));
 r:=public.import_project_pdf_work(p.id,s.id,s.state->'review');
 if not coalesce((r->>'alreadyImported')::boolean,false) then
  for g in select value from jsonb_array_elements(s.state->'review'->'groups') loop
   for t in select value from jsonb_array_elements(g->'tasks') loop
    select (x.identity_ids->>(t->>'officeKey'))::uuid into i from eflow_phase65.import_receipts x where x.batch_id=s.id;
    if i is not null and exists(select 1 from public.project_office_identities where id=i and canonical_office_id is distinct from p.org_id) then
     insert into public.project_office_work(task_id,identity_id,project_id) values((r->'taskIds'->>(t->>'key'))::uuid,i,p.id);
    end if;
   end loop;
  end loop;
  for a in select value from jsonb_array_elements(coalesce(s.state->'assignments','[]')) loop
   k:=a->>'key';root:=(r->'taskIds'->>k)::uuid;
   if root is null or k=any(seen) then raise exception 'Invalid assignment task reference' using errcode='22023';end if;
   seen:=array_append(seen,k);
   if exists(select 1 from public.tasks where id=root and proposed_office_identity_id is not null) then raise exception 'Office invitations must be accepted before assignment' using errcode='22023';end if;
   snap:=public.r7_work_tree(root);
   perform public.auto_assign_project_task(root,(snap->>'revision')::int,gen_random_uuid(),(a->>'lead')::uuid,
    array(select jsonb_array_elements_text(a->'people'))::uuid[]);
   assigned:=assigned+1;
  end loop;
 end if;
 select count(*) into offices from eflow_phase65.import_receipts x cross join lateral jsonb_each_text(x.identity_ids) z
 join public.project_office_identities q on q.id=z.value::uuid
 where x.batch_id=s.id and q.canonical_office_id is distinct from p.org_id;
 r:=r||jsonb_build_object('assignedTaskCount',assigned,'officeCount',offices,
 'needsPeopleCount',greatest(0,coalesce((r->>'taskCount')::int,0)-assigned));
 update public.project_pdf_import_sessions set result=r,state=state-'sourceText'-'draft'||jsonb_build_object('stage','completed'),
 revision=revision+1,lease_until=null,updated_at=now() where id=s.id;
 return r;
end $function$;

CREATE OR REPLACE FUNCTION eflow_phase65.guard_task()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare i public.project_office_identities;begin
 -- An accepted project guest can activate named-Office work without a directory Head.
 -- Only this one pending marker may change; all work/staffing facts stay identical.
 if tg_op='UPDATE' and old.proposed_office_identity_id is not null and new.proposed_office_identity_id is null
 and old.status='pending_assignment' and new.assigned_to is null and new.recommendation_lead_id is null
 and (to_jsonb(old)-array['proposed_office_identity_id','updated_at'])=(to_jsonb(new)-array['proposed_office_identity_id','updated_at'])
 and exists(select 1 from public.project_office_work w
 join public.project_office_identities i on i.id=w.identity_id join public.projects p on p.id=w.project_id
 join public.project_office_people o on o.identity_id=i.id join public.project_invitation_requests r on r.id=o.request_id
 join public.project_guest_members m on m.request_id=r.id
 where w.task_id=old.id and i.id=old.proposed_office_identity_id and i.canonical_office_id is null
 and coalesce(i.provenance->>'removed','false')<>'true' and p.status not in ('completed','archived')
 and r.state='accepted' and m.ended_at is null and (m.access_end is null or m.access_end>now())
 and eflow_r7.member(p.id,m.office_id,r.accepted_by)) then return new;end if;
 if tg_op='UPDATE' and old.proposed_office_identity_id is not null and new.proposed_office_identity_id is not null and new.org_id is distinct from old.org_id then raise exception 'Resolve proposed responsibility atomically before changing canonical Office' using errcode='42501';end if;
 if tg_op='UPDATE' and old.proposed_office_identity_id is not null and (new.linked_project_id is distinct from old.linked_project_id or new.source_collaboration_draft_id is distinct from old.source_collaboration_draft_id) then raise exception 'Project work identity is protected' using errcode='42501';end if;
 if (tg_op='INSERT' and new.proposed_office_identity_id is not null) or (tg_op='UPDATE' and new.proposed_office_identity_id is distinct from old.proposed_office_identity_id) then
  perform eflow_phase65.require_lead(new.linked_project_id,auth.uid());
  if tg_op='UPDATE' and old.proposed_office_identity_id is not null and new.proposed_office_identity_id is null then
   select * into i from public.project_office_identities where id=old.proposed_office_identity_id;
   if i.canonical_office_id is null or new.org_id is distinct from i.canonical_office_id or old.status<>'pending_assignment' or new.status<>'pending_assignment' or new.assigned_to is not null or new.recommendation_lead_id is not null or cardinality(coalesce(new.team_member_ids,'{}'::uuid[]))>0 or not exists(select 1 from public.project_offices where id=i.project_office_id and invitation_status='joined' and relationship_type<>'observer') then raise exception 'Resolve proposed responsibility to a joined canonical Office' using errcode='42501';end if;
  end if;
 end if;
 if new.proposed_office_identity_id is not null then
  if new.status not in ('pending_assignment','cancelled') or new.assigned_to is not null or new.recommendation_lead_id is not null or cardinality(coalesce(new.team_member_ids,'{}'::uuid[]))>0 or nullif(btrim(new.team_id),'') is not null then raise exception 'Resolve proposed Office identity before staffing or execution' using errcode='42501';end if;
  if exists(select 1 from public.subtasks where task_id=new.id and (status<>'todo' or assigned_to is not null or cardinality(coalesce(assigned_to_ids,'{}'::uuid[]))>0)) or exists(select 1 from public.task_submissions where task_id=new.id) or exists(select 1 from public.subtask_submissions where task_id=new.id) or exists(select 1 from public.subtask_progress_updates where task_id=new.id) or exists(select 1 from public.work_budget_allocations where task_id=new.id) or exists(select 1 from public.petty_cash_requests where task_id=new.id) then raise exception 'Started, staffed or funded work cannot become proposed responsibility' using errcode='42501';end if;
 end if;return new;
end $function$;

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
 select array_agg(distinct id) into roster from unnest(roster || array(select p.id from public.profiles p where p.id=any(people) and p.org_id=o.office_id and not exists(select 1 from public.project_guest_members gm where gm.project_id=o.project_id and gm.office_id=o.office_id and gm.user_id=p.id and gm.ended_at is null and (gm.access_end is null or gm.access_end>now())))) id;
 perform public.phase6_set_members(o.id,roster);
 -- Any stale revision or staffing failure rolls back project enrollment too.
 perform eflow_r7.command(p_root,p_revision,p_request,'root_lead',payload);
 return public.r7_work_tree(p_root);
end $function$;

CREATE OR REPLACE FUNCTION public.delete_project_permanently(p_project_id uuid, p_expected_title text, p_reason text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  caller uuid := auth.uid();
  caller_role text;
  caller_name text;
  project_row public.projects;
  retained_task_count int;
begin
  if caller is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  select role::text, full_name
    into caller_role, caller_name
  from public.profiles
  where id = caller and is_active;

  if caller_role is distinct from 'head' then
    raise exception 'Only an active Head may permanently delete a project'
      using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('r9:'||p_project_id::text,0));

  select * into project_row
  from public.projects
  where id = p_project_id
  for update;

  if not found then
    raise exception 'Project not found' using errcode = 'P0002';
  end if;

  if not coalesce(public.org_in_my_subtree(project_row.org_id, caller),false)
     or not coalesce(public.can_manage_project(p_project_id,caller),false) then
    raise exception 'This project is outside your organization scope'
      using errcode = '42501';
  end if;

  if coalesce(p_expected_title, '') <> project_row.title then
    raise exception 'Type the exact project title to confirm deletion'
      using errcode = '22023';
  end if;

  if length(btrim(coalesce(p_reason, ''))) < 5 then
    raise exception 'A deletion reason of at least 5 characters is required'
      using errcode = '22023';
  end if;

  select count(*)::int into retained_task_count
  from public.tasks
  where linked_project_id = p_project_id and deleted_at is null;

  -- Private transaction-scoped authority; clients cannot create this context.
  insert into eflow_phase6.project_deletions(tx,actor,project_id)
  values(txid_current(),caller,p_project_id);

  update public.tasks
  set linked_project_id = null,
      milestone_id = null,
      group_id = null
  where linked_project_id = p_project_id;

  insert into public.audit_events (
    actor_id, actor_name, entity_type, entity_id, action, reason,
    before_data, after_data, org_id
  ) values (
    caller, coalesce(caller_name, 'Administrator'), 'project', p_project_id::text,
    'project.deleted', btrim(p_reason),
    jsonb_build_object(
      'title', project_row.title,
      'status', project_row.status,
      'ownerId', project_row.owner_id,
      'retainedTaskCount', retained_task_count,
      'guestMemberships',(select coalesce(jsonb_agg(to_jsonb(gm)),'[]') from public.project_guest_members gm where gm.project_id=p_project_id)
    ),
    jsonb_build_object('deleted', true, 'taskLinksCleared', retained_task_count),
    project_row.org_id
  );

  delete from public.project_guest_members where project_id=p_project_id;
  delete from public.projects where id = p_project_id;
  delete from eflow_phase6.project_deletions
  where tx=txid_current() and actor=caller and project_id=p_project_id;
  return p_project_id;
end;
$function$;


revoke insert,update,delete on public.project_pdf_import_sessions from public,anon,authenticated;
create function eflow_phase65.end_named_office_guests()
returns trigger language plpgsql security definer set search_path='' as $$
declare r public.project_invitation_requests;m public.project_guest_members;
begin
 if coalesce(new.provenance->>'removed','false')<>'true' or old.provenance->>'removed'='true' then return new;end if;
 for r in select q.* from public.project_invitation_requests q join public.project_office_people o on o.request_id=q.id where o.identity_id=new.id order by q.id for update of q loop
  if r.state in ('pending','approved') then perform eflow_r8.decide(r.id,r.revision,'revoked');end if;
  for m in select * from public.project_guest_members where request_id=r.id and ended_at is null for update loop
   update public.project_guest_members set ended_at=now() where request_id=m.request_id and user_id=m.user_id;
   perform eflow_r9.clear_staff(m.project_id,m.user_id,m.office_id);
  end loop;
 end loop;
 return new;
end $$;
create trigger named_office_guests_ended after update of provenance on public.project_office_identities
 for each row execute function eflow_phase65.end_named_office_guests();
revoke all on function eflow_phase65.end_named_office_guests() from public,anon,authenticated;
