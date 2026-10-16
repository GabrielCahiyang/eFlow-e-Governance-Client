-- Initial lead appointment must move an unassigned task to To Do atomically.
-- Keep the original authorization, locks, confirmation and receipt behavior.
CREATE OR REPLACE FUNCTION eflow_r7.command(p_root uuid, p_revision integer, p_request uuid, p_command text, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r jsonb;n eflow_r7.nodes;parent eflow_r7.nodes;v_id uuid:=(p_payload->>'id')::uuid;v_parent uuid:=(p_payload->>'parent')::uuid;v_lead uuid:=(p_payload->>'lead')::uuid;
 v_people uuid[];v_order uuid[];v_subtree uuid[];v_uid uuid;v_receipt eflow_r7.receipts;v_before jsonb;v_result jsonb;v_terms jsonb;v_kind text;v_position int;v_due date;v_previous_status_write text;begin /* NW5.2 shared writer lock */ perform eflow_r3.actor(); if not coalesce(eflow_r7.read_root(p_root),false) then raise exception 'Work access denied' using errcode='42501';end if; perform eflow_r7.lock_impact(p_root);
 perform eflow_r3.actor();
 if p_request is null then raise exception 'Request identity required';end if;
 r:=eflow_r7.root(p_root);v_kind:=r->>'kind';
 if not eflow_r7.read_root(p_root) then raise exception 'Work access denied' using errcode='42501';end if;
 perform 1 from public.projects where id=(r->>'project')::uuid for update;
 perform 1 from public.personal_projects where id=(r->>'project')::uuid for update;
 /* NW4.2 completion serialization */ perform eflow_r7.lock_completion(p_root); perform 1 from public.tasks where id=p_root for update;
 perform 1 from public.personal_tasks where id=p_root for update;
 r:=eflow_r7.root(p_root);
 v_terms:=jsonb_build_object('command',p_command,'payload',p_payload);
 select * into v_receipt from eflow_r7.receipts where actor_id=auth.uid() and request_id=p_request;
 if found then
  if v_receipt.root_id<>p_root or v_receipt.payload<>v_terms then raise exception 'Request terms conflict';end if;
  return eflow_r7.snapshot(p_root);
 end if;
 if not coalesce((r->>'open')::boolean,false) then raise exception 'Closed or unresolved work is read-only' using errcode='42501';end if;
 if coalesce((select revision from eflow_r7.tree_state where root_id=p_root),1) is distinct from p_revision then raise exception 'Work changed; reload and review the current tree' using errcode='40001';end if;
 if exists(select 1 from jsonb_object_keys(p_payload) k where k not in ('id','parent','lead','people','title','due','standalone','order','note','progress','approve')) then raise exception 'Unsupported branch fields';end if;
 if v_id is not null then select * into n from eflow_r7.nodes where id=v_id and task_id=p_root;end if;
 if p_command<>'create' and p_command not in ('contributors','order','root_lead') and n.id is null then raise exception 'Choose a node in this root';end if;
 if p_command in ('progress','submit','review') then
  if v_kind<>'personal' then raise exception 'Use the existing Office evidence workflow';end if;
  if p_command='review' then
   if n.status<>'for_review' or not coalesce(p_payload->>'approve','') in ('true','false') or auth.uid() is distinct from eflow_r7.reviewer(n.id,(select submitted_by from public.personal_subtasks where id=n.id)) then raise exception 'Current independent reviewer required' using errcode='42501';end if;
  elsif not coalesce(eflow_r7.node_work(n.id,auth.uid()),false) or n.status in ('for_review','completed') then raise exception 'Current assigned worker required' using errcode='42501';end if;
 elsif p_command='create' then
  if not coalesce(eflow_r7.manage(p_root,v_parent),false) then raise exception 'Only a current lead may add work below their branch' using errcode='42501';end if;
 elsif p_command='order' then
  if not coalesce(eflow_r7.manage(p_root,v_parent),false) then raise exception 'Sibling ordering denied' using errcode='42501';end if;
 elsif p_command='root_lead' then
  if not coalesce(eflow_r7.head(p_root),false) then raise exception 'Only its responsible Head or personal owner transfers the root' using errcode='42501';end if;
 else
  if not coalesce(eflow_r7.manage(p_root,v_id,p_command='staff' and v_lead is distinct from n.lead_id),false) then raise exception 'Branch staffing denied; ancestors and siblings are protected' using errcode='42501';end if;
 end if;
 if p_command not in ('progress','submit','review','contributors','staff') and n.id is not null and (n.status<>'todo' or n.percent_complete<>0) then raise exception 'Planning changes require untouched work';end if;
 /* NW5.1 operation safety */ if p_command not in ('progress','submit','review') then perform eflow_r7.require_operation(p_root,p_command,p_payload);end if; v_before:=eflow_r7.snapshot(p_root);
 insert into eflow_r7.mutations values(txid_current(),auth.uid(),p_root);
 if p_command='root_lead' then
  if v_id is not null or v_lead is null or not eflow_r7.member((r->>'project')::uuid,(r->>'office')::uuid,v_lead) then raise exception 'Choose an eligible selected root lead';end if;
  if v_kind='office' then
   select coalesce(array_agg(distinct value::uuid),'{}') into v_people from jsonb_array_elements_text(coalesce(p_payload->'people',to_jsonb(array_remove((select team_member_ids from public.tasks where id=p_root)||array[v_lead],null))));
   if cardinality(v_people)>200 or not(v_people @> array[v_lead]) then raise exception 'Include the root lead in contributors';end if;
   v_previous_status_write:=current_setting('eflow.allow_status_write',true);
   perform set_config('eflow.allow_status_write','on',true);
   update public.tasks set status=case when status='pending_assignment' then 'todo' else status end,assigned_to=v_lead,assignee_name=(select full_name from public.profiles where id=v_lead),team_member_ids=v_people,team_member_names=array(select full_name from public.profiles where id=any(v_people) order by array_position(v_people,id)) where id=p_root;
   perform set_config('eflow.allow_status_write',coalesce(v_previous_status_write,'off'),true);
  else update public.personal_tasks set lead_id=v_lead,revision=revision+1 where id=p_root;end if;
 elsif p_command='contributors' then
  select coalesce(array_agg(distinct value::uuid),'{}') into v_people from jsonb_array_elements_text(coalesce(p_payload->'people','[]'));
  if cardinality(v_people)>200 or v_kind<>'office' or v_id is not null or not coalesce(eflow_r7.manage(p_root,null),false) then raise exception 'Root contributor operation denied' using errcode='42501';end if;
  if not (v_people @> array[(r->>'lead')::uuid]) then raise exception 'Root lead must remain; transfer uses its responsible Head';end if;
  foreach v_uid in array v_people loop if not eflow_r7.member((r->>'project')::uuid,(r->>'office')::uuid,v_uid) then raise exception 'Choose selected project people';end if;end loop;
  update public.tasks set team_member_ids=v_people,team_member_names=array(select full_name from public.profiles where id=any(v_people) order by array_position(v_people,id)) where id=p_root;
 elsif p_command='create' then
  if v_parent is not null and exists(select 1 from eflow_r7.nodes where id=v_parent and (status<>'todo' or percent_complete<>0)) then raise exception 'Add children before starting the parent';end if;
  if v_id is null or exists(select 1 from eflow_r7.nodes where id=v_id) or exists(select 1 from public.tasks where id=v_id) or exists(select 1 from public.personal_tasks where id=v_id) then raise exception 'New disjoint node identity required';end if;
  if length(btrim(p_payload->>'title')) not between 1 and 200 then raise exception 'Enter a subitem title';end if;
  select coalesce(max(sibling_order),-1)+1 into v_position from eflow_r7.nodes where task_id=p_root and parent_subtask_id is not distinct from v_parent;
  select coalesce(array_agg(distinct value::uuid),'{}') into v_people from jsonb_array_elements_text(coalesce(p_payload->'people',to_jsonb(array_remove(array[v_lead],null))));
  if v_lead is not null and not(v_people @> array[v_lead]) or cardinality(v_people)>200 then raise exception 'Include the appointed lead in contributors';end if;
  if v_kind='office' then
   insert into public.subtasks(id,task_id,parent_subtask_id,title,lead_id,assigned_to,assigned_to_ids,sibling_order,position,created_by,due_date,is_standalone)
   values(v_id,p_root,v_parent,btrim(p_payload->>'title'),v_lead,v_lead,v_people,v_position,(select coalesce(max(position),-1)+1 from public.subtasks where task_id=p_root),auth.uid(),(p_payload->>'due')::date,coalesce((p_payload->>'standalone')::boolean,false));
  else
   insert into public.personal_subtasks(id,task_id,parent_subtask_id,title,lead_id,assigned_to_ids,sibling_order,due_date,is_standalone)
   values(v_id,p_root,v_parent,btrim(p_payload->>'title'),v_lead,v_people,v_position,(p_payload->>'due')::date,coalesce((p_payload->>'standalone')::boolean,false));
  end if;
 elsif p_command='staff' then
  if n.status='completed' then raise exception 'Completed responsibility is historical';end if;
  select coalesce(array_agg(distinct value::uuid),'{}') into v_people from jsonb_array_elements_text(coalesce(p_payload->'people','[]'));
  if cardinality(v_people)>200 or v_lead is null or not(v_people @> array[v_lead]) then raise exception 'Choose a lead and include them among contributors';end if;
  foreach v_uid in array v_people loop if not eflow_r7.member((r->>'project')::uuid,(r->>'office')::uuid,v_uid) then raise exception 'Choose eligible project people';end if;end loop;
  with recursive below as (select id from eflow_r7.nodes where parent_subtask_id=v_id union all select c.id from eflow_r7.nodes c join below b on c.parent_subtask_id=b.id)
   select coalesce(array_agg(id),'{}') into v_subtree from below;
  if exists(select 1 from eflow_r7.nodes c where c.id=any(v_subtree) and c.status<>'completed' and not(c.assigned_to_ids <@ v_people)) then raise exception 'Reassign unfinished descendant workers before removing a branch contributor';end if;
  if v_kind='office' then
   update public.subtasks set lead_id=v_lead,assigned_to=v_lead,assigned_to_ids=v_people where id=v_id;
   if n.lead_id is distinct from v_lead then update public.subtasks set lead_id=null where id=any(v_subtree);end if;
  else
   update public.personal_subtasks set lead_id=v_lead,assigned_to_ids=v_people where id=v_id;
   if n.lead_id is distinct from v_lead then update public.personal_subtasks set lead_id=null where id=any(v_subtree);end if;
  end if;
 elsif p_command in ('edit','move','delete') then
  with recursive below as (select * from eflow_r7.nodes where id=v_id union all select c.* from eflow_r7.nodes c join below b on c.parent_subtask_id=b.id)
   select array_agg(id) into v_subtree from below;
  if exists(select 1 from eflow_r7.nodes c where c.id=any(v_subtree) and (c.status<>'todo' or c.percent_complete<>0)) then raise exception 'The entire subtree must be untouched';end if;
  if p_command='move' then
   if not coalesce(eflow_r7.manage(p_root,v_parent),false) or v_parent=any(v_subtree) then raise exception 'Destination branch denied or cycle';end if;
   select * into parent from eflow_r7.nodes where id=v_parent and task_id=p_root;
   if v_parent is not null and parent.id is null then raise exception 'Destination must share the root';end if;
   select coalesce(max(sibling_order),-1)+1 into v_position from eflow_r7.nodes where task_id=p_root and parent_subtask_id is not distinct from v_parent;
   if v_kind='office' then update public.subtasks set parent_subtask_id=v_parent,sibling_order=v_position where id=v_id;else update public.personal_subtasks set parent_subtask_id=v_parent,sibling_order=v_position where id=v_id;end if;
   -- Revalidate every descendant after the parent move, including depth overflow.
   if v_kind='office' then update public.subtasks set parent_subtask_id=parent_subtask_id,lead_id=null where id=any(v_subtree) and id<>v_id;else update public.personal_subtasks set parent_subtask_id=parent_subtask_id,lead_id=null where id=any(v_subtree) and id<>v_id;end if;
  elsif p_command='edit' then
   v_due:=(p_payload->>'due')::date;
   if v_due is not null and exists(select 1 from eflow_r7.nodes c where c.id=any(v_subtree) and c.id<>v_id and c.due_date>v_due) then raise exception 'Edit descendant dates before shortening this deadline';end if;
   if length(btrim(p_payload->>'title')) not between 1 and 200 then raise exception 'Enter a title';end if;
   perform set_config('eflow.subtask_deadline_authorized','on',true);
   if v_kind='office' then update public.subtasks set title=btrim(p_payload->>'title'),due_date=v_due,due_date_change_reason=coalesce(p_payload->>'note','Nested work planning'),due_date_changed_at=now(),due_date_changed_by=auth.uid(),is_standalone=coalesce((p_payload->>'standalone')::boolean,is_standalone) where id=v_id;
   else update public.personal_subtasks set title=btrim(p_payload->>'title'),due_date=v_due,is_standalone=coalesce((p_payload->>'standalone')::boolean,is_standalone) where id=v_id;end if;
   perform set_config('eflow.subtask_deadline_authorized','off',true);
  else
   if v_kind='office' and (exists(select 1 from public.subtask_progress_updates where subtask_id=any(v_subtree)) or exists(select 1 from public.subtask_submissions where subtask_id=any(v_subtree))
    or exists(select 1 from public.work_budget_allocations where subtask_id=any(v_subtree)) or exists(select 1 from public.petty_cash_requests where subtask_id=any(v_subtree))
    or exists(select 1 from public.budget_ledger_entries where subtask_id=any(v_subtree))) then raise exception 'Evidence, budget and cash history prohibit subtree deletion';end if;
   -- Children first: no CASCADE can erase evidence or financial identities.
   loop
    select id into v_uid from eflow_r7.nodes c where c.id=any(v_subtree) and not exists(select 1 from eflow_r7.nodes d where d.parent_subtask_id=c.id) limit 1;
    exit when v_uid is null;
    if v_kind='office' then delete from public.subtasks where id=v_uid;else delete from public.personal_subtasks where id=v_uid;end if;
   end loop;
  end if;
 elsif p_command='order' then
  select coalesce(array_agg(value::uuid),'{}') into v_order from jsonb_array_elements_text(coalesce(p_payload->'order','[]'));
  if (select count(*) from eflow_r7.nodes where task_id=p_root and parent_subtask_id is not distinct from v_parent)<>cardinality(v_order)
   or (select count(distinct u) from unnest(v_order) u)<>cardinality(v_order) or exists(select 1 from unnest(v_order) u where not exists(select 1 from eflow_r7.nodes c where c.id=u and c.task_id=p_root and c.parent_subtask_id is not distinct from v_parent and c.status='todo' and c.percent_complete=0)) then raise exception 'Order must contain every untouched sibling exactly once';end if;
  if v_kind='office' then update public.subtasks set sibling_order=array_position(v_order,id)-1 where id=any(v_order);else update public.personal_subtasks set sibling_order=array_position(v_order,id)-1 where id=any(v_order);end if;
 elsif p_command in ('progress','submit','review') then
  if p_command<>'review' and not n.is_standalone and exists(select 1 from eflow_r7.nodes c where c.task_id=p_root and c.parent_subtask_id is not distinct from n.parent_subtask_id and c.sibling_order<n.sibling_order and not c.is_standalone and c.status<>'completed') then raise exception 'Complete earlier ordered siblings first';end if;
  if p_command in ('submit','review') and exists(with recursive below as (select * from eflow_r7.nodes where parent_subtask_id=v_id union all select c.* from eflow_r7.nodes c join below b on c.parent_subtask_id=b.id) select 1 from below where status<>'completed') then raise exception 'Complete and review every descendant first';end if;
  if p_command='progress' then
   if (p_payload->>'progress')::int not between 0 and 99 then raise exception 'Progress must be 0–99; submit at completion';end if;
   update public.personal_subtasks set percent_complete=(p_payload->>'progress')::int,status='in_progress',note=coalesce(p_payload->>'note','') where id=v_id;
  elsif p_command='submit' then
   v_lead:=eflow_r7.reviewer(v_id,auth.uid());if v_lead is null then raise exception 'An independent ancestor lead or owner is required';end if;
   update public.personal_subtasks set status='for_review',percent_complete=100,note=coalesce(p_payload->>'note',''),submitted_by=auth.uid(),reviewer_id=v_lead where id=v_id;
  else
   if not (p_payload->>'approve')::boolean and btrim(coalesce(p_payload->>'note',''))='' then raise exception 'Feedback required';end if;
   update public.personal_subtasks set status=case when (p_payload->>'approve')::boolean then 'completed' else 'changes_requested' end,percent_complete=case when (p_payload->>'approve')::boolean then 100 else 99 end,note=coalesce(p_payload->>'note','') where id=v_id;
  end if;
 else raise exception 'Unsupported work command';end if;
 if v_kind='office' and p_command not in ('contributors','progress','submit','review') then
  if exists(select 1 from pg_constraint where conrelid='public.subtasks'::regclass and conname='subtasks_task_position_unique') then set constraints public.subtasks_task_position_unique deferred;end if;
  with recursive ordered as (
   select id,array[lpad(sibling_order::text,10,'0')||id::text] path from public.subtasks where task_id=p_root and parent_subtask_id is null
   union all select c.id,p.path||(lpad(c.sibling_order::text,10,'0')||c.id::text) from public.subtasks c join ordered p on c.parent_subtask_id=p.id where c.task_id=p_root
  ), ranked as (select id,row_number() over(order by path)-1 rank from ordered)
  update public.subtasks s set position=r.rank from ranked r where s.id=r.id and s.position<>r.rank;
  if exists(select 1 from pg_constraint where conrelid='public.subtasks'::regclass and conname='subtasks_task_position_unique') then set constraints public.subtasks_task_position_unique immediate;end if;
 end if;
 delete from eflow_r7.mutations where tx=txid_current() and actor=auth.uid() and root_id=p_root;
 v_result:=eflow_r7.snapshot(p_root);
 insert into public.work_tree_events(root_id,project_id,actor_id,actor_name,command,node_id,before_data,after_data) values(p_root,(r->>'project')::uuid,auth.uid(),(select full_name from public.profiles where id=auth.uid()),p_command,v_id,v_before,v_result);
 if v_kind='office' and p_command in ('create','staff','contributors','root_lead') then
  foreach v_uid in array coalesce(v_people,'{}') loop
   if v_uid<>auth.uid() and not coalesce((case when p_command in ('contributors','root_lead') then v_before->'root'->'people' else (select to_jsonb(assigned_to_ids) from jsonb_to_recordset(v_before->'nodes') as old_node(id uuid,assigned_to_ids uuid[]) where id=v_id) end) ? v_uid::text,false) then
    insert into public.notifications(user_id,type,title,message,task_id,task_title,actor_id,actor_name,project_id,work_node_id)
    values(v_uid,'assignment',case when v_id is null then 'Task assignment' else 'Subtask assignment' end,'You were assigned to "'||coalesce(p_payload->>'title',n.title,(select title from public.tasks where id=p_root))||'".',p_root,(select title from public.tasks where id=p_root),auth.uid(),(select full_name from public.profiles where id=auth.uid()),(r->>'project')::uuid,v_id);
   end if;
  end loop;
 end if;
 insert into eflow_r7.receipts values(auth.uid(),p_request,p_root,v_terms,v_result);
 return v_result;
end $function$
;

