-- Fix canonical lead submission, atomic start/submit, contextual lead evidence and status-based notifications.
-- Existing signatures, grants, review/dependency/finance guards and historical records are preserved.
CREATE OR REPLACE FUNCTION public.submit_task_for_review(p_task_id uuid, p_submission jsonb)
 RETURNS tasks
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  caller uuid := auth.uid();
  caller_name text;
  completion_note text;
  submission_id uuid;
  submission_version int;
  attachment jsonb;
  normalized_submission jsonb;
  t public.tasks;
  resolved_reviewer uuid;
begin /* NW5.2 shared writer lock */ perform eflow_r7.lock_impact(p_task_id); /* NW4.2 completion serialization */ perform eflow_r7.lock_completion(p_task_id);
  if caller is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  completion_note := nullif(btrim(p_submission ->> 'note'), '');
  if completion_note is null then
    raise exception 'Completion note is required' using errcode = '22023';
  end if;
  if p_submission ? 'attachments'
     and jsonb_typeof(p_submission -> 'attachments') <> 'array' then
    raise exception 'Submission attachments must be an array' using errcode = '22023';
  end if;
  select full_name into caller_name
  from public.profiles where id = caller;
  select * into t
  from public.tasks
  where id = p_task_id and deleted_at is null
  for update;
  if not found then raise exception 'Task not found'; end if;
  if t.archived_at is not null or t.status not in ('todo','in_progress','changes_requested') then
    raise exception 'This task is no longer open for submission' using errcode = '22023';
  end if;
  if coalesce(t.assigned_to, t.recommendation_lead_id) is distinct from caller then
    raise exception 'Only the assignee or task lead may submit this work'
      using errcode = '42501';
  end if;
  if public.auth_role(caller) is null or public.auth_role(caller)='admin' then
    raise exception 'Operational account required' using errcode='42501';
  end if;
  if exists(select 1 from public.projects where id=t.linked_project_id and project_lead_id is not null) then
    resolved_reviewer:=eflow_project.reviewer(t.id,caller);
  else
  if t.review_route_mode='organization_default' then
    select o.head_user_id into resolved_reviewer from public.organizations o
      where o.id=t.org_id and public.is_office_output_reviewer(o.id,o.head_user_id);
  else
    select p.id into resolved_reviewer from public.profiles p
      where p.id in (t.reviewer_id,t.backup_reviewer_id) and p.is_active and p.role<>'admin'
        and p.id<>caller and p.id is distinct from t.assigned_to
      order by (p.id=t.reviewer_id) desc limit 1;
  end if;
  end if;
  if resolved_reviewer is null then raise exception 'Assign an eligible reviewer before submitting' using errcode='22023'; end if;
  -- Starting and submitting share the task lock and transaction. A contributor
  -- starting work or a delayed client render cannot race a second start RPC.
  if not coalesce(eflow_r3.eligible(caller),false) then
    raise exception 'Your current work access could not be verified' using errcode='42501';
  end if;
  if t.status <> 'in_progress' then
    perform public.transition_task_status(p_task_id,'in_progress',null,'Work submitted by task lead');
  end if;
  submission_id := case
    when coalesce(p_submission ->> 'id', '') ~
      '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
      then (p_submission ->> 'id')::uuid
    else gen_random_uuid()
  end;
  select coalesce(max(version), 0) + 1 into submission_version
  from public.task_submissions where task_id = p_task_id;
  insert into public.task_submissions (
    id, task_id, version, submitter_id, submitter_name, note
  ) values (
    submission_id,
    p_task_id,
    submission_version,
    caller,
    coalesce(caller_name, 'User'),
    completion_note
  );
  for attachment in
    select value from jsonb_array_elements(
      coalesce(p_submission -> 'attachments', '[]'::jsonb)
    )
  loop
    insert into public.task_attachments (
      task_id,
      submission_id,
      uploaded_by,
      uploader_name,
      file_name,
      file_path,
      file_size,
      mime_type
    ) values (
      p_task_id,
      submission_id,
      caller,
      coalesce(caller_name, 'User'),
      coalesce(attachment ->> 'fileName', 'Attachment'),
      attachment ->> 'filePath',
      case
        when coalesce(attachment ->> 'fileSize', '') ~ '^\d+$'
          then (attachment ->> 'fileSize')::bigint
        else 0
      end,
      coalesce(attachment ->> 'mimeType', '')
    );
  end loop;
  normalized_submission := jsonb_build_object(
    'id', submission_id::text,
    'version', submission_version,
    'note', completion_note,
    'submitterId', caller::text,
    'submitterName', coalesce(caller_name, 'User'),
    'submittedAt', floor(extract(epoch from clock_timestamp()) * 1000)::bigint,
    'attachments', coalesce(p_submission -> 'attachments', '[]'::jsonb)
  );
  perform set_config('eflow.allow_status_write', 'on', true);
  update public.tasks
  set
    reviewer_id = resolved_reviewer,
    latest_submission = normalized_submission,
    feedback = null,
    percent_complete = 100,
    status = 'for_review',
    last_activity_at = now()
  where id = p_task_id
  returning * into t;
  perform set_config('eflow.allow_status_write', 'off', true);
  insert into public.task_status_history (
    task_id, from_status, to_status, actor_id, actor_name, note
  ) values (
    p_task_id, 'in_progress', 'for_review', caller,
    coalesce(caller_name, 'User'), completion_note
  );
  insert into public.task_activities (
    task_id, type, content, actor_id, actor_name
  ) values (
    p_task_id, 'for_review', completion_note, caller,
    coalesce(caller_name, 'User')
  );
  insert into public.audit_events (
    actor_id, actor_name, entity_type, entity_id, action,
    reason, before_data, after_data, org_id
  ) values (
    caller, coalesce(caller_name, 'User'), 'task', p_task_id::text,
    'task.transition.for_review', completion_note,
    jsonb_build_object('status', 'in_progress'),
    jsonb_build_object(
      'status', 'for_review',
      'submissionId', submission_id,
      'submissionVersion', submission_version,
      'reviewerId', resolved_reviewer
    ),
    t.org_id
  );
  if resolved_reviewer <> caller then
    insert into public.notifications (
      user_id, type, title, message, task_id, task_title,
      actor_id, actor_name, status_from, status_to, reason
    ) values (
      resolved_reviewer, 'approval_needed', 'Task ready for review',
      coalesce(caller_name, 'Someone') || ' submitted "' || t.title || '" for review.',
      p_task_id, t.title, caller, coalesce(caller_name, 'User'),
      'in_progress', 'for_review', completion_note
    );
  end if;
  return t;
end;
$function$;

CREATE OR REPLACE FUNCTION eflow_evidence.can_upload(p_name text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare ctx record; t public.tasks; s public.subtasks;
begin
  if not eflow_evidence.active_actor() then return false; end if;
  if exists (select 1 from eflow_evidence.objects o where o.bucket_id = 'task-attachments' and o.object_name = p_name) then return false; end if;
  select * into ctx from eflow_evidence.path_context(p_name);
  if not found then return false; end if;
  if eflow_r7.root(ctx.task_id) is not null and (ctx.subtask_id is not null and not coalesce((eflow_r7.operation_capabilities(ctx.task_id,ctx.subtask_id)->'execute'->>'allowed')::boolean,false) or ctx.subtask_id is null and not eflow_r7.member((eflow_r7.root(ctx.task_id)->>'project')::uuid,(eflow_r7.root(ctx.task_id)->>'office')::uuid,auth.uid())) then return false;end if;
 select * into t from public.tasks where id = ctx.task_id;
  if t.deleted_at is not null or t.archived_at is not null
     or t.status is null or t.status not in ('todo', 'in_progress', 'changes_requested') then return false; end if;
  if ctx.subtask_id is null then
    return t.status in ('todo','in_progress','changes_requested')
      and coalesce(t.assigned_to, t.recommendation_lead_id) is not distinct from auth.uid()
      and not exists (select 1 from public.task_submissions a where a.id = ctx.attempt::uuid);
  end if;
  select * into s from public.subtasks where id = ctx.subtask_id;
  return coalesce(s.status in ('todo', 'in_progress', 'changes_requested'), false)
    and (case when eflow_r7.root(s.task_id)->>'kind'='office' then
      coalesce((eflow_r7.operation_capabilities(s.task_id,s.id)->'execute'->>'allowed')::boolean,false)
     else coalesce(s.assigned_to = auth.uid(), false)
      or coalesce(to_jsonb(s.assigned_to_ids), '[]'::jsonb) ? auth.uid()::text end)
    and (ctx.attempt = 'progress' or not exists (
      select 1 from public.subtask_submissions a where a.id::text = lower(ctx.attempt)));
end;
$function$;

CREATE OR REPLACE FUNCTION eflow_evidence.guard_progress()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare s public.subtasks; t public.tasks;
begin
  if not eflow_evidence.active_actor() or new.author_id is distinct from auth.uid() then
    raise exception 'Progress requires its active authenticated author' using errcode = '42501';
  end if;
  select * into s from public.subtasks where id = new.subtask_id;
  select * into t from public.tasks where id = new.task_id;
  if s.id is null or t.id is null or s.task_id is distinct from t.id or not (
    coalesce(eflow_r7.manage(s.task_id,s.id),false) or
    (eflow_r7.internal(s.task_id) and s.completed_by=auth.uid() and s.status='completed' and new.percent_complete=100) or
    case when eflow_r7.root(s.task_id)->>'kind'='office' then
      coalesce(eflow_r7.node_work(s.id,auth.uid()),false)
     else coalesce(s.assigned_to = auth.uid(), false) or coalesce(to_jsonb(s.assigned_to_ids), '[]'::jsonb) ? auth.uid()::text end
  ) then raise exception 'This subtask is not assigned to you' using errcode = '42501'; end if;
  if t.deleted_at is not null or t.archived_at is not null
     or t.status is null or t.status not in ('todo', 'in_progress', 'changes_requested')
     or s.status is null or (s.status not in ('todo', 'in_progress', 'changes_requested', 'for_review')
       and not (eflow_r7.internal(s.task_id) and s.status='completed'
         and s.completed_by=auth.uid() and new.percent_complete=100)) then
    raise exception 'Task/subtask is not open for progress' using errcode = '22023';
  end if;
  if new.percent_complete=100 and not (eflow_r7.internal(s.task_id) and s.status='completed' and s.completed_by=auth.uid()) then
    raise exception 'Use direct completion to finish a subitem' using errcode='42501';
  end if;
  if nullif(new.attachment_path, '') is not null then
    -- Direct completion stores files under its immutable request UUID, while
    -- ordinary updates use /progress/. Both retain the same evidence sealing.
    if eflow_r7.internal(s.task_id) and s.status='completed'
       and s.completed_by=auth.uid() and new.percent_complete=100 then
      perform eflow_evidence.seal_file(new.attachment_path,t.id,s.id,
        (select ctx.attempt from eflow_evidence.path_context(new.attachment_path) ctx), 'progress',new.id);
    else
      perform eflow_evidence.seal_file(new.attachment_path,t.id,s.id,'progress','progress',new.id);
    end if;
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.notify_subtask_progress_leader()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
declare s public.subtasks;t public.tasks;recipient uuid;details text;finished boolean;blocked boolean;
begin
 select * into s from public.subtasks where id=new.subtask_id;
 select * into t from public.tasks where id=new.task_id and deleted_at is null;
 if s.id is null or t.id is null then return new;end if;
 recipient:=public.resolve_subtask_reviewer(t,new.author_id);
 if recipient is null or recipient=new.author_id then return new;end if;
 finished:=s.status='completed' and s.completed_by=new.author_id and new.percent_complete=100;
 -- Extra evidence rows belong to the same completion, not another update.
 if finished and new.attachment_path is not null and
   (select ctx.attempt from eflow_evidence.path_context(new.attachment_path) ctx) is distinct from new.id::text then return new;end if;
 blocked:=nullif(btrim(new.blocker),'') is not null and coalesce(new.blocker_category,'None')<>'None';
 details:=concat_ws(' · ',nullif(btrim(new.note),''),
   case when blocked then 'Blocker: '||btrim(new.blocker) end,
   case when nullif(btrim(new.next_step),'') is not null then 'Next: '||btrim(new.next_step) end,
   case when nullif(btrim(new.attachment_name),'') is not null then 'Attachment: '||new.attachment_name end);
 insert into public.notifications(user_id,type,title,message,task_id,task_title,actor_id,actor_name,status_from,status_to,reason,project_id,org_id,entity_type,work_node_id)
 values(recipient,'status_change',case when finished then 'Subtask completed' when blocked then 'Subtask blocker reported' else 'Subtask work updated' end,
 coalesce(new.author_name,'A team member')||case when finished then ' completed "' when blocked then ' reported a blocker on "' else ' updated "' end||s.title||'".'||case when details<>'' then ' '||details else '' end,
 t.id,t.title,new.author_id,coalesce(new.author_name,'Team member'),'',case when finished then 'completed' else s.status end,details,t.linked_project_id,t.org_id,'subtask',s.id);
 return new;
end $function$;

NOTIFY pgrst, 'reload schema';
