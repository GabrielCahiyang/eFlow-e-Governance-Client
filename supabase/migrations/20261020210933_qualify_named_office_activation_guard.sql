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
 join public.project_office_identities office_record on office_record.id=w.identity_id join public.projects p on p.id=w.project_id
 join public.project_office_people o on o.identity_id=office_record.id join public.project_invitation_requests r on r.id=o.request_id
 join public.project_guest_members m on m.request_id=r.id
 where w.task_id=old.id and office_record.id=old.proposed_office_identity_id and office_record.canonical_office_id is null
 and coalesce(office_record.provenance->>'removed','false')<>'true' and p.status not in ('completed','archived')
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
