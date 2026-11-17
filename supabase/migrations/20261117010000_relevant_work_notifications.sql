-- Add recipient-scoped work alerts without rewriting history or changing workflow authority.
-- Pending deployment: apply only from an isolated workspace containing the target's live history.
begin;
set local lock_timeout = '10s';
create schema eflow_notify;
revoke all on schema eflow_notify from public,anon,authenticated,service_role;

create function eflow_notify.emit_work(
 p_task uuid,p_node uuid,p_actor uuid,p_title text,p_action text,p_details text default '',
 p_from text default '',p_to text default '',p_skip uuid[] default '{}'
) returns void language plpgsql security definer set search_path='' as $$
declare t public.tasks; actor_name text; recipient uuid;
begin
 select * into t from public.tasks where id=p_task and deleted_at is null;
 if not found or exists(select 1 from public.projects where id=t.linked_project_id and publication_state='draft') then return; end if;
 select full_name into actor_name from public.profiles where id=p_actor;
 for recipient in
  with recursive branch as (
   select s.* from public.subtasks s where s.task_id=t.id and s.id=p_node
   union all select parent.* from public.subtasks parent join branch child on child.parent_subtask_id=parent.id where parent.task_id=t.id
  ), people as (
   select unnest(array[t.assigned_to,t.recommendation_lead_id,
    (select project_lead_id from public.projects where id=t.linked_project_id),
    (select head_user_id from public.organizations where id=t.org_id)]
    ||case when p_node is null then coalesce(t.team_member_ids,'{}') else '{}'::uuid[] end) id
   union select unnest(coalesce(s.assigned_to_ids,'{}')||array[s.lead_id]) from branch s where s.id=p_node
   union select s.lead_id from branch s
  )
  select distinct p.id from people p join public.profiles profile on profile.id=p.id
   where p.id is distinct from p_actor and not(p.id=any(p_skip))
    and profile.is_active and coalesce(eflow_r3.eligible(p.id),false)
    and public.can_see_task(t.id,p.id)
    and (p_node is null or eflow_m7.node_visible(t.id,p_node,p.id))
 loop
  insert into public.notifications(user_id,type,title,message,task_id,task_title,actor_id,actor_name,
   status_from,status_to,reason,project_id,org_id,work_node_id,entity_type)
  values(recipient,'status_change',p_title,coalesce(nullif(actor_name,''),'eFlow')||' '||p_action,
   t.id,t.title,p_actor,coalesce(actor_name,'eFlow'),coalesce(p_from,''),coalesce(p_to,''),coalesce(p_details,''),
   t.linked_project_id,t.org_id,p_node,'work_change');
 end loop;
end $$;

create function eflow_notify.field_changes(p_before jsonb,p_after jsonb)
returns text language sql immutable set search_path='' as $$
 select coalesce(string_agg(label||': '||coalesce(nullif(p_before->>field,''),'Not set')||' → '||coalesce(nullif(p_after->>field,''),'Not set'),E'\n' order by position),'')
 from (values ('title','Title',1),('start_date','Start date',2),('due_date','Due date',3),('priority','Priority',4)) f(field,label,position)
 where nullif(p_before->>field,'') is distinct from nullif(p_after->>field,'');
$$;

create function eflow_notify.task_changed()
returns trigger language plpgsql security definer set search_path='' as $$
declare details text:=eflow_notify.field_changes(to_jsonb(old),to_jsonb(new));
begin
 if details='' then return null; end if;
 perform eflow_notify.emit_work(new.id,null,auth.uid(),
  case when old.due_date is distinct from new.due_date or old.start_date is distinct from new.start_date then 'Task schedule changed' else 'Task details changed' end,
  'updated "'||new.title||'". Check the changes before continuing.',details);
 return null;
end $$;
create trigger relevant_task_changes after update of title,start_date,due_date,priority on public.tasks
 for each row execute function eflow_notify.task_changed();

create function eflow_notify.subtask_changed()
returns trigger language plpgsql security definer set search_path='' as $$
declare details text:=eflow_notify.field_changes(to_jsonb(old),to_jsonb(new));
begin
 -- Nested commands emit one final event after their changes; don't notify intermediate writes.
 if eflow_r7.internal(new.task_id) or details='' then return null; end if;
 perform eflow_notify.emit_work(new.task_id,new.id,auth.uid(),
  case when old.due_date is distinct from new.due_date or old.start_date is distinct from new.start_date then 'Subtask schedule changed' else 'Subtask details changed' end,
  'updated "'||new.title||'". Check the changes before continuing.',details);
 return null;
end $$;
create trigger relevant_subtask_changes after update of title,start_date,due_date on public.subtasks
 for each row execute function eflow_notify.subtask_changed();

create function eflow_notify.work_tree_changed()
returns trigger language plpgsql security definer set search_path='' as $$
declare before_node jsonb; after_node jsonb; details text; item_title text; node uuid:=new.node_id;
 skip_people uuid[]:='{}';
begin
 if new.command not in ('edit','move','delete','order','staff','contributors','root_lead') then return null; end if;
 -- Personal work keeps its separate access model; no Office recipient inference is used.
 if not exists(select 1 from public.tasks where id=new.root_id) then return null; end if;
 select n into before_node from jsonb_array_elements(new.before_data->'nodes') n where n->>'id'=node::text;
 select n into after_node from jsonb_array_elements(new.after_data->'nodes') n where n->>'id'=node::text;
 item_title:=coalesce(after_node->>'title',before_node->>'title',new.after_data->'root'->>'title',
  (select title from public.tasks where id=new.root_id));
 if new.command='edit' then
  details:=eflow_notify.field_changes(before_node,after_node);
  if before_node->'is_standalone' is distinct from after_node->'is_standalone' then
   details:=concat_ws(E'\n',nullif(details,''),'Work sequence: '||case when (after_node->>'is_standalone')::boolean then 'Can run independently' else 'Follows the subtask order' end);
  end if;
  if coalesce(details,'')='' then return null; end if;
 elsif new.command='move' then details:='This subtask moved to a different place in the task. Check its parent and work sequence.';
 elsif new.command='delete' then
  details:='This subtask was removed. Check the remaining work in the task.'; node:=null;
 elsif new.command='order' then
  if new.before_data->'nodes'=new.after_data->'nodes' then return null; end if;
  details:='The subtask order changed. Check which work comes next.'; node:=null;
 elsif new.command in ('staff','root_lead') then
  if node is null then
   if new.before_data->'root'->'lead' is not distinct from new.after_data->'root'->'lead' then return null; end if;
   details:='Task Lead: '||coalesce((select full_name from public.profiles where id=(new.after_data->'root'->>'lead')::uuid),'Not assigned');
  else
   if before_node->'lead_id' is not distinct from after_node->'lead_id' and before_node->'assigned_to_ids' is not distinct from after_node->'assigned_to_ids' then return null; end if;
   details:='Subtask Lead: '||coalesce((select full_name from public.profiles where id=(after_node->>'lead_id')::uuid),'Not assigned')||'. Check the current team before continuing.';
   -- New workers already receive the canonical assignment notice.
   select coalesce(array_agg(value::uuid),'{}') into skip_people from jsonb_array_elements_text(coalesce(after_node->'assigned_to_ids','[]')) a(value)
    where not coalesce(before_node->'assigned_to_ids','[]') ? value;
  end if;
 else
  if new.before_data->'root'->'people' is not distinct from new.after_data->'root'->'people' then return null; end if;
  details:='The people assigned to this task changed. Check the current task team.';
  select coalesce(array_agg(value::uuid),'{}') into skip_people from jsonb_array_elements_text(coalesce(new.after_data->'root'->'people','[]')) a(value)
   where not coalesce(new.before_data->'root'->'people','[]') ? value;
 end if;
 perform eflow_notify.emit_work(new.root_id,node,new.actor_id,
  case new.command when 'edit' then 'Subtask details changed' when 'move' then 'Subtask moved' when 'delete' then 'Subtask removed'
   when 'order' then 'Work sequence changed' else 'Work responsibility changed' end,
  case new.command when 'delete' then 'removed "'||item_title||'" from your task.' when 'order' then 'changed the subtask order in "'||item_title||'".'
   else 'updated "'||item_title||'". Check what changed before continuing.' end,details,'','',skip_people);
 return null;
end $$;
create trigger relevant_work_tree_changes after insert on public.work_tree_events
 for each row execute function eflow_notify.work_tree_changed();

create function eflow_notify.task_status_changed()
returns trigger language plpgsql security definer set search_path='' as $$
declare t public.tasks; label text;
begin
 if new.from_status is not distinct from new.to_status then return null; end if;
 select * into t from public.tasks where id=new.task_id;
 label:=case new.to_status when 'in_progress' then 'In progress' when 'for_review' then 'Awaiting review'
  when 'changes_requested' then 'Changes requested' when 'completed' then 'Completed' when 'cancelled' then 'Cancelled'
  when 'todo' then 'Not started' when 'pending_assignment' then 'Awaiting assignment' else replace(new.to_status,'_',' ') end;
 -- Existing workflow notices cover the assignee, submitting lead and assigned reviewer.
 perform eflow_notify.emit_work(t.id,null,new.actor_id,'Task status changed',
  'changed "'||t.title||'" to '||label||'.',new.note,new.from_status,new.to_status,
  array_remove(array[t.assigned_to,t.recommendation_lead_id,t.reviewer_id,t.backup_reviewer_id,
   nullif(t.latest_submission->>'submitterId','')::uuid],null));
 return null;
end $$;
create trigger relevant_task_status after insert on public.task_status_history
 for each row execute function eflow_notify.task_status_changed();

create function eflow_notify.task_update_added()
returns trigger language plpgsql security definer set search_path='' as $$
declare t public.tasks; details text; blocked boolean;
begin
 select * into t from public.tasks where id=new.task_id;
 blocked:=nullif(btrim(new.blocker),'') is not null;
 details:=concat_ws(E'\n',nullif(btrim(new.note),''),case when blocked then 'Blocker: '||new.blocker end,
  case when nullif(btrim(new.next_step),'') is not null then 'Next step: '||new.next_step end);
 perform eflow_notify.emit_work(t.id,null,new.author_id,case when blocked then 'Task blocker reported' else 'Task work updated' end,
  case when blocked then 'reported a blocker on "' else 'posted a work update on "' end||t.title||'".',details,'','',
  -- The legacy Web blocker path already notifies the creator after this RPC.
  case when blocked then array_remove(array[t.created_by],null) else '{}'::uuid[] end);
 return null;
end $$;
create trigger relevant_task_update after insert on public.task_progress_updates
 for each row execute function eflow_notify.task_update_added();

create function eflow_notify.subtask_update_added()
returns trigger language plpgsql security definer set search_path='' as $$
declare t public.tasks; s public.subtasks; reviewer uuid; details text; finished boolean; blocked boolean;
begin
 select * into t from public.tasks where id=new.task_id;
 select * into s from public.subtasks where id=new.subtask_id and task_id=t.id;
 if not found then return null; end if;
 finished:=s.status='completed' and s.completed_by=new.author_id and new.percent_complete=100;
 if finished and new.attachment_path is not null and
  (select ctx.attempt from eflow_evidence.path_context(new.attachment_path) ctx) is distinct from new.id::text then return null; end if;
 reviewer:=public.resolve_subtask_reviewer(t,new.author_id);
 blocked:=nullif(btrim(new.blocker),'') is not null;
 details:=concat_ws(E'\n',nullif(btrim(new.note),''),case when blocked then 'Blocker: '||new.blocker end,
  case when nullif(btrim(new.next_step),'') is not null then 'Next step: '||new.next_step end);
 perform eflow_notify.emit_work(t.id,s.id,new.author_id,
  case when finished then 'Subtask completed' when blocked then 'Subtask blocker reported' else 'Subtask work updated' end,
  case when finished then 'completed "' when blocked then 'reported a blocker on "' else 'posted a work update on "' end||s.title||'".',
  details,'',case when finished then 'completed' else s.status end,array_remove(array[reviewer],null));
 return null;
end $$;
create trigger relevant_subtask_update after insert on public.subtask_progress_updates
 for each row execute function eflow_notify.subtask_update_added();

-- Replace only the two generic notice fragments. The reviewed workflow bodies,
-- guards, receipts, grants and public return contracts remain intact.
create function eflow_notify.proposal_notice(p_work eflow_m7.work_proposals,p_submitted boolean)
returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); actor_name text; root_title text; item_title text; project uuid; personal boolean;
begin
 select full_name into actor_name from public.profiles where id=actor;
 select t.title,t.linked_project_id into root_title,project from public.tasks t where t.id=p_work.root_id;
 personal:=not found;
 if personal then select title,project_id into root_title,project from public.personal_tasks where id=p_work.root_id; end if;
 if p_work.node_id is not null then
  if personal then select title into item_title from public.personal_subtasks where id=p_work.node_id;
  else select title into item_title from public.subtasks where id=p_work.node_id; end if;
 end if;
 item_title:=coalesce(item_title,root_title,'your work');
 insert into public.notifications(user_id,type,title,message,task_id,task_title,actor_id,actor_name,work_node_id,entity_type,project_id,status_to,reason)
 values(case when p_submitted then p_work.reviewer_id else p_work.author_id end,
  case when p_submitted then 'approval_needed' else 'status_change' end,
  case when p_submitted then 'Your review is needed' when p_work.state='approved' then 'Your work update was accepted' else 'Changes requested for your work' end,
  coalesce(actor_name,'Your teammate')||case when p_submitted then ' sent "'||item_title||'" for your review.'
   when p_work.state='approved' then ' accepted your update to "'||item_title||'".'
   else ' requested changes to "'||item_title||'". Read the feedback before sending another update.' end,
  p_work.root_id,root_title,actor,actor_name,p_work.node_id,
  case when personal then 'm7_personal_work_proposal' else 'm7_work_proposal' end,project,
  case when p_submitted then 'for_review' when p_work.state='changes_requested' then 'changes_requested' else '' end,
  case when p_submitted then p_work.terms->>'note' else p_work.decision_note end);
end $$;
do $migration$
begin
 perform eflow_m7.replace_body_part('eflow_m7.propose_work(uuid,uuid,uuid,text,jsonb,uuid)',
 $old$insert into public.notifications(user_id,type,title,message,task_id,actor_id,work_node_id,entity_type,project_id)
 select chosen,'approval_needed','Work awaiting Lead review','Open the work to review the submission.',p_root,actor,p_node,
  case when exists(select 1 from public.personal_tasks where id=p_root) then 'm7_personal_work_proposal' else 'm7_work_proposal' end,
  (select project_id from public.personal_tasks where id=p_root);$old$,
 $new$perform eflow_notify.proposal_notice(existing,true);$new$);
 perform eflow_m7.replace_body_part('eflow_m7.decide_work(uuid,uuid,boolean,text)',
 $old$insert into public.notifications(user_id,type,title,message,task_id,actor_id,work_node_id,entity_type,project_id)
 select work.author_id,'status_change',case when p_approve then 'Work update accepted' else 'Changes requested' end,
  'Open the work to see the Lead decision.',work.root_id,actor,work.node_id,
  case when exists(select 1 from public.personal_tasks where id=work.root_id) then 'm7_personal_work_proposal' else 'm7_work_proposal' end,
  (select project_id from public.personal_tasks where id=work.root_id);$old$,
 $new$perform eflow_notify.proposal_notice(work,false);$new$);
end $migration$;

revoke all on all functions in schema eflow_notify from public,anon,authenticated,service_role;
notify pgrst,'reload schema';
commit;
