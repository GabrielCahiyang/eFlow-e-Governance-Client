-- REVIEW ONLY. NOT APPLIED. Stage and obtain explicit approval before production.
-- Subtask visibility only: Task read/edit permissions and Personal work are unchanged.
-- Reuses existing restrictive gates; adds the missing Subtask attachment metadata gate.
begin;
set local lock_timeout='10s';
do $review$
declare dependency record; patch record; policy_record record; definition text;
begin
 for dependency in select * from (values
  ('eflow_m7.node_visible(uuid,uuid,uuid)','f21b8423ff87b3f4eb885a120edfae1f'),
  ('eflow_r7.m7_baseline_snapshot(uuid)','e9f53be54b07c82b214f9af1aef675b0'),
  ('eflow_m7.proposal_file_read(text,text)','abdef1c45f665fc3a20f840121c43fb8'),
  ('eflow_evidence.can_read(text,text,text)','6a8050c40dcfcd501478e9d5296cafe3'),
  ('eflow_m7.with_visible_counts(jsonb)','5678f6110f172eb34b208c6cda1480be'),
  ('eflow_m7.with_schedule(jsonb)','3211ede24cd504aee8fa6ae516191200'),
  ('eflow_m7.can_view_linked_work(uuid,uuid)','d5f9f080552974282993b6a8e68dabcd'),
  ('eflow_m7.can_view_work_event(uuid,uuid,jsonb,jsonb)','58308f763cdf907be7bbabe01c6de858'),
  ('eflow_r7.snapshot(uuid)','8473a0ab76721d978090fc872e5fe7b1')
 ) as reviewed(signature,hash) loop
  if to_regprocedure(dependency.signature) is null or md5(pg_get_functiondef(to_regprocedure(dependency.signature)))<>dependency.hash then
   raise exception 'Subtask visibility baseline differs: %. Stop for review.',dependency.signature;
  end if;
 end loop;
 for policy_record in select * from (values
  ('subtasks','m7_operational_subtask'),
  ('subtask_progress_updates','m7_operational_subtask_updates'),
  ('subtask_submissions','m7_operational_subtask_submissions'),
  ('work_tree_events','m7_operational_work_events'),
  ('notifications','m7_operational_notifications')
 ) as required(table_name,policy_name) loop
  if not exists(select 1 from pg_policy p join pg_class c on c.oid=p.polrelid join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname=policy_record.table_name and p.polname=policy_record.policy_name
     and not p.polpermissive and p.polcmd='r' and c.relrowsecurity) then
   raise exception 'Expected restrictive visibility policy missing: %. Stop for review.',policy_record.policy_name;
  end if;
 end loop;
 if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public' and c.relname='subtask_submission_attachments' and c.relrowsecurity) then
  raise exception 'Subtask attachment RLS prerequisite missing. Stop for review.';
 end if;
 if exists(select 1 from pg_policies where schemaname='public' and tablename='subtask_submission_attachments' and policyname='m7_parent_started_subtask_attachments') then
  raise exception 'Visibility attachment policy already exists. Stop for review.';
 end if;
end $review$;

-- Match the existing canonical Task Lead, including legacy recommendation compatibility.
-- Prior start history keeps genuinely started work visible after a later status change.
create or replace function eflow_m7.node_visible(p_root uuid,p_node uuid,p_actor uuid)
returns boolean language sql stable security definer set search_path='' as $function$
 select coalesce(public.can_see_task(p_root,p_actor),false) and exists(
  select 1 from public.subtasks s join public.tasks t on t.id=s.task_id
  where t.id=p_root and s.id=p_node and t.deleted_at is null and (
   coalesce(t.assigned_to,t.recommendation_lead_id)=p_actor
   or t.status::text in ('in_progress','for_review','changes_requested','completed')
   or exists(select 1 from public.task_status_history h where h.task_id=t.id and h.to_status::text='in_progress')
  )
 );
$function$;

do $review$
declare dependency record; patch record; definition text;
begin
 for dependency in select distinct signature from (values
  ('eflow_r7.m7_baseline_snapshot(uuid)','v_nodes jsonb;v_people jsonb;begin','v_nodes jsonb;v_people jsonb;v_result jsonb;begin'),
  ('eflow_r7.m7_baseline_snapshot(uuid)','into v_nodes from tree t;','into v_nodes from tree t where r->>''kind'' <> ''office'' or eflow_m7.node_visible(p_root,t.id,auth.uid());'),
  ('eflow_r7.m7_baseline_snapshot(uuid)','n.task_id=p_root and (n.lead_id=p.id or p.id=any(n.assigned_to_ids))','n.task_id=p_root and (r->>''kind''<>''office'' or eflow_m7.node_visible(p_root,n.id,auth.uid())) and (n.lead_id=p.id or p.id=any(n.assigned_to_ids))'),
  ('eflow_r7.m7_baseline_snapshot(uuid)','return jsonb_build_object(''root'',','v_result:=jsonb_build_object(''root'','),
  ('eflow_r7.m7_baseline_snapshot(uuid)','end $function$','return case when r->>''kind''=''office'' then eflow_m7.with_visible_counts(v_result) else v_result end;
end $function$'),
  ('eflow_m7.proposal_file_read(text,text)','f.author::text=p_owner and (','f.author::text=p_owner and (f.node is null or eflow_r7.root(f.root)->>''kind'' is distinct from ''office'' or eflow_m7.node_visible(f.root,f.node,auth.uid())) and ('),
  ('eflow_evidence.can_read(text,text,text)','if found then','if found then
    if seal.subtask_id is not null and not coalesce(eflow_m7.node_visible(seal.task_id,seal.subtask_id,auth.uid()),false) then return false;end if;'),
  ('eflow_evidence.can_read(text,text,text)','-- Owners can still clean up their unsubmitted upload after reassignment.','select * into ctx from eflow_evidence.path_context(p_name);
  if found and ctx.subtask_id is not null and not coalesce(eflow_m7.node_visible(ctx.task_id,ctx.subtask_id,auth.uid()),false) then return false;end if;
  -- Owners can still clean up their unsubmitted upload after reassignment.')
 ) as edits(signature,anchor,replacement) loop
  definition:=pg_get_functiondef(to_regprocedure(dependency.signature));
  for patch in select * from (values
  ('eflow_r7.m7_baseline_snapshot(uuid)','v_nodes jsonb;v_people jsonb;begin','v_nodes jsonb;v_people jsonb;v_result jsonb;begin'),
  ('eflow_r7.m7_baseline_snapshot(uuid)','into v_nodes from tree t;','into v_nodes from tree t where r->>''kind'' <> ''office'' or eflow_m7.node_visible(p_root,t.id,auth.uid());'),
  ('eflow_r7.m7_baseline_snapshot(uuid)','n.task_id=p_root and (n.lead_id=p.id or p.id=any(n.assigned_to_ids))','n.task_id=p_root and (r->>''kind''<>''office'' or eflow_m7.node_visible(p_root,n.id,auth.uid())) and (n.lead_id=p.id or p.id=any(n.assigned_to_ids))'),
  ('eflow_r7.m7_baseline_snapshot(uuid)','return jsonb_build_object(''root'',','v_result:=jsonb_build_object(''root'','),
  ('eflow_r7.m7_baseline_snapshot(uuid)','end $function$','return case when r->>''kind''=''office'' then eflow_m7.with_visible_counts(v_result) else v_result end;
end $function$'),
  ('eflow_m7.proposal_file_read(text,text)','f.author::text=p_owner and (','f.author::text=p_owner and (f.node is null or eflow_r7.root(f.root)->>''kind'' is distinct from ''office'' or eflow_m7.node_visible(f.root,f.node,auth.uid())) and ('),
  ('eflow_evidence.can_read(text,text,text)','if found then','if found then
    if seal.subtask_id is not null and not coalesce(eflow_m7.node_visible(seal.task_id,seal.subtask_id,auth.uid()),false) then return false;end if;'),
  ('eflow_evidence.can_read(text,text,text)','-- Owners can still clean up their unsubmitted upload after reassignment.','select * into ctx from eflow_evidence.path_context(p_name);
  if found and ctx.subtask_id is not null and not coalesce(eflow_m7.node_visible(ctx.task_id,ctx.subtask_id,auth.uid()),false) then return false;end if;
  -- Owners can still clean up their unsubmitted upload after reassignment.')
  ) as edits(signature,anchor,replacement) where signature=dependency.signature loop
   if length(definition)-length(replace(definition,patch.anchor,''))<>length(patch.anchor) then
    raise exception 'Subtask visibility anchor differs: %. Stop for review.',dependency.signature;
   end if;
   definition:=replace(definition,patch.anchor,patch.replacement);
  end loop;
  execute definition;
 end loop;
end $review$;

create policy m7_parent_started_subtask_attachments on public.subtask_submission_attachments
 as restrictive for select to authenticated
 using (eflow_m7.can_view_linked_work(task_id,subtask_id));
commit;
