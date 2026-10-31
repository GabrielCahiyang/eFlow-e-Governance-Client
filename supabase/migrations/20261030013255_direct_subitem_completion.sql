-- Direct subitem completion under contextual leads; final task review is unchanged.
-- All prior function signatures, planning/finance guards and request locks are preserved.
-- Archived task reviews and all historical submissions remain unchanged.
-- Existing evidence/review history remains immutable. The submit capability key is retained for compatibility.
CREATE OR REPLACE FUNCTION eflow_r7.operation_capabilities(p_root uuid, p_node uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$

declare

 r jsonb := eflow_r7.root(p_root);

 n eflow_r7.nodes;

 actions text[] := case when p_node is null then

  array['manage_contributors','appoint_lead','create_child','order_children'] else

  array['manage_contributors','appoint_lead','create_child','edit_details','move','order_children','delete','execute','submit','review'] end;

 action text;

 reason text;

 common_reason text;

 result jsonb := '{}';

 manager boolean;

 untouched boolean;

 descendants_complete boolean;

 ordered_ready boolean;

 node_depth integer;

begin

 -- Do not disclose row state through the private projector to an unavailable

 -- actor/scope. Snapshot retains its existing read exception.

 if r is null or auth.uid() is null or not coalesce(eflow_r7.read_root(p_root),false) then

  common_reason := 'access_unavailable';

 elsif not coalesce(eflow_r3.eligible(auth.uid()),false) then

  common_reason := 'read_only';

 elsif not coalesce((r->>'open')::boolean,false) then

  common_reason := 'lifecycle_blocked';

 end if;

 if p_node is not null then

  select * into n from eflow_r7.nodes where id=p_node and task_id=p_root;

  if not found then common_reason := 'access_unavailable'; end if;

 end if;

 if common_reason is null then

  manager := coalesce(eflow_r7.manage(p_root,p_node),false);

  if p_node is not null then

   with recursive below as (

    select * from eflow_r7.nodes where id=p_node and task_id=p_root

    union all select c.* from eflow_r7.nodes c join below b on c.parent_subtask_id=b.id where c.task_id=p_root

   ) select not exists(select 1 from below where status<>'todo' or percent_complete<>0),

    not exists(select 1 from below where id<>p_node and status<>'completed')

    into untouched,descendants_complete;

   with recursive above as (

    select id,parent_subtask_id,1 depth from eflow_r7.nodes where id=p_node and task_id=p_root

    union all select c.id,c.parent_subtask_id,a.depth+1 from eflow_r7.nodes c join above a on c.id=a.parent_subtask_id where c.task_id=p_root and a.depth<8

   ) select max(depth) into node_depth from above;

   ordered_ready := n.is_standalone or not exists(select 1 from eflow_r7.nodes c

    where c.task_id=p_root and c.parent_subtask_id is not distinct from n.parent_subtask_id

    and c.sibling_order<n.sibling_order and not c.is_standalone and c.status<>'completed');

  end if;

 end if;

 foreach action in array actions loop

  reason := common_reason;

  if reason is null then

   if action='appoint_lead' then

    if not coalesce(case when p_node is null then eflow_r7.head(p_root)

     else eflow_r7.manage(p_root,p_node,true) end,false) then reason := 'appointment_denied';

    elsif p_node is not null and n.status='completed' then reason := 'lifecycle_blocked'; end if;

   elsif action in ('execute','submit') then
    if not coalesce(manager,false) and (action='submit' or not coalesce(eflow_r7.node_work(p_node,auth.uid()),false)) then reason:='branch_denied';
    elsif n.status='completed' or r->>'kind'='office' and r->>'status' not in ('todo','in_progress','changes_requested') then reason:='lifecycle_blocked';
    elsif not ordered_ready or action='submit' and not descendants_complete then reason:='lifecycle_blocked';end if;
   elsif action='review' then
    reason:='lifecycle_blocked'; -- Subitems complete directly; final task retains its review.
   elsif not manager then reason := 'branch_denied';

   elsif action='manage_contributors' then

    if p_node is null and r->>'kind'<>'office' then reason := 'read_only';

    elsif p_node is null and r->>'lead' is null or p_node is not null and (n.lead_id is null or n.status='completed') then reason := 'lifecycle_blocked'; end if;

   elsif action='create_child' then

    if p_node is not null and (n.status<>'todo' or n.percent_complete<>0 or node_depth>=8) then reason := 'lifecycle_blocked'; end if;

   elsif action='order_children' then

    -- This is parent:p_node, including parent:null for root direct children.

    if exists(select 1 from eflow_r7.nodes c where c.task_id=p_root

     and c.parent_subtask_id is not distinct from p_node and (c.status<>'todo' or c.percent_complete<>0)) then reason := 'lifecycle_blocked'; end if;

   elsif action in ('edit_details','move','delete') then

    if not untouched then reason := 'lifecycle_blocked';

    elsif action='delete' and r->>'kind'='office' and exists(

     with recursive below as (select id from eflow_r7.nodes where id=p_node and task_id=p_root

      union all select c.id from eflow_r7.nodes c join below b on c.parent_subtask_id=b.id where c.task_id=p_root)

     select 1 from below b where

      exists(select 1 from public.subtask_progress_updates where subtask_id=b.id) or

      exists(select 1 from public.subtask_submissions where subtask_id=b.id) or

      exists(select 1 from public.work_budget_allocations where subtask_id=b.id) or

      exists(select 1 from public.petty_cash_requests where subtask_id=b.id) or

      exists(select 1 from public.budget_ledger_entries where subtask_id=b.id)

    ) then reason := 'history_blocked'; end if;

   end if;

  end if;

  /* NW5.1 history capability */

  if reason is null and action in ('create_child','order_children','move','delete') then

   if not (eflow_r7.operation_impact(p_root,case action when 'create_child' then 'create' when 'order_children' then 'order' else action end,

    case when action in ('create_child','order_children') then jsonb_build_object('parent',p_node) else jsonb_build_object('id',p_node,'parent',n.parent_subtask_id) end)->>'allowed')::boolean then reason:='history_blocked';end if;

  end if;

 result := result || jsonb_build_object(action,jsonb_build_object('allowed',reason is null,'reason_code',reason));

 end loop;

 return result;

end $function$
;

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
  if p_command='review' then raise exception 'Subitems complete directly; open the work action instead' using errcode='22023';
  elsif not coalesce((eflow_r7.operation_capabilities(p_root,v_id)->(case when p_command='progress' then 'execute' else 'submit' end)->>'allowed')::boolean,false) then raise exception 'Current subitem lead or task lead authority required' using errcode='42501';end if;
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
  if p_command in ('submit','review') and exists(with recursive below as (select * from eflow_r7.nodes where parent_subtask_id=v_id union all select c.* from eflow_r7.nodes c join below b on c.parent_subtask_id=b.id) select 1 from below where status<>'completed') then raise exception 'Complete every child step first';end if;
  if p_command='progress' then
   if (p_payload->>'progress')::int not between 0 and 99 then raise exception 'Progress must be 0–99; submit at completion';end if;
   update public.personal_subtasks set percent_complete=(p_payload->>'progress')::int,status='in_progress',note=coalesce(p_payload->>'note','') where id=v_id;
  elsif p_command='submit' then
   update public.personal_subtasks set status='completed',percent_complete=100,note=coalesce(p_payload->>'note',''),submitted_by=auth.uid(),reviewer_id=null where id=v_id;
  else
   raise exception 'Subitems complete directly; review the parent task instead' using errcode='22023';
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

CREATE OR REPLACE FUNCTION public.save_subtask_work_update(p_subtask_id uuid, p_state text, p_blocker text DEFAULT NULL::text, p_note text DEFAULT NULL::text, p_next_step text DEFAULT NULL::text, p_attachment_path text DEFAULT NULL::text, p_attachment_name text DEFAULT NULL::text)
 RETURNS subtasks
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

declare

  caller uuid := auth.uid();

  caller_name text;

  subtask_row public.subtasks;

  task_row public.tasks;

begin /* NW5.2 shared writer lock */ perform eflow_r7.lock_impact((select task_id from public.subtasks where id=p_subtask_id)); /* NW4.2 completion serialization */ perform eflow_r7.lock_completion((select task_id from public.subtasks where id=p_subtask_id));

 if eflow_r7.root((select task_id from public.subtasks where id=p_subtask_id)) is not null then

 if not eflow_r3.eligible(auth.uid()) then raise exception 'Current verified operational identity required' using errcode='42501';end if;

 if not eflow_r7.read_root((select task_id from public.subtasks where id=p_subtask_id)) then raise exception 'Work access denied' using errcode='42501';end if;end if;

  if caller is null then raise exception 'Not authenticated' using errcode = '42501'; end if;

  if p_state is null or p_state not in ('in_progress','stuck') then raise exception 'Choose In progress or Stuck' using errcode='22023'; end if;

  if p_state='stuck' and nullif(btrim(p_blocker),'') is null then raise exception 'A blocker reason is required' using errcode='22023'; end if;

  if length(coalesce(p_note,''))>3000 or length(coalesce(p_blocker,''))>3000 or length(coalesce(p_next_step,''))>300 then raise exception 'Work update exceeds its text limit' using errcode='22023'; end if;



  select * into subtask_row from public.subtasks where id = p_subtask_id for update;

  if not found then raise exception 'Subtask not found' using errcode = 'P0002'; end if;



  if not eflow_r3.eligible(caller) or not (case when eflow_r7.root(subtask_row.task_id) is not null then
   coalesce((eflow_r7.operation_capabilities(subtask_row.task_id,p_subtask_id)->'execute'->>'allowed')::boolean,false)
   else public.can_manage_subtasks(subtask_row.task_id,caller) or caller=any(coalesce(subtask_row.assigned_to_ids,'{}'::uuid[])) or subtask_row.assigned_to=caller end)
  then raise exception 'Current task team access required' using errcode='42501';end if;
  if subtask_row.status='completed' then

    raise exception 'This subitem is already completed'

      using errcode = '22023';

  end if;



  select * into task_row from public.tasks

  where id = subtask_row.task_id and deleted_at is null;

  if not found or task_row.status in ('for_review', 'completed', 'cancelled') then

    raise exception 'The parent task is not open for subtask progress'

      using errcode = '22023';

  end if;



  select full_name into caller_name from public.profiles where id = caller;



  perform set_config('eflow.subtask_workflow_authorized', 'on', true);

  update public.subtasks

  set

    status = 'in_progress',

    is_completed = false,

    completed_by = null,

    completed_at = null

  where id = p_subtask_id

  returning * into subtask_row;

  perform set_config('eflow.subtask_workflow_authorized', 'off', true);



  insert into public.subtask_progress_updates (

    subtask_id, task_id, author_id, author_name, percent_complete,

    blocker_category, blocker, next_step, note, attachment_path, attachment_name

  ) values (

    p_subtask_id, subtask_row.task_id, caller, coalesce(caller_name, 'User'),

    subtask_row.percent_complete, case when p_state='stuck' then 'Other' else 'None' end,

    case when p_state='stuck' then nullif(btrim(p_blocker), '') else null end, nullif(btrim(p_next_step), ''),

    nullif(btrim(p_note), ''), nullif(p_attachment_path, ''),

    nullif(p_attachment_name, '')

  );



  insert into public.task_activities (task_id, type, content, actor_id, actor_name)

  values (

    subtask_row.task_id, 'subtask_progress',

    case when p_state='stuck' then 'Reported a blocker on "' else 'Started or updated "' end || subtask_row.title || '"',

    caller, coalesce(caller_name, 'User')

  );



  return subtask_row;

end;

$function$
;

CREATE OR REPLACE FUNCTION eflow_r7.guard_completion()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$

declare v_node uuid;begin

 v_node:=new.id;

 if new.status in ('for_review','completed') and new.status is distinct from old.status and exists(

  with recursive below as (select * from eflow_r7.nodes where parent_subtask_id=v_node union all select c.* from eflow_r7.nodes c join below b on c.parent_subtask_id=b.id)

  select 1 from below where status<>'completed') then raise exception 'Complete every child step first';end if;

 return new;

end $function$
;

CREATE OR REPLACE FUNCTION public.guard_subtask_execution_dependencies()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

declare

  workflow_authorized boolean :=

    coalesce(current_setting('eflow.subtask_workflow_authorized', true), 'off') = 'on';

  blocking_title text;

  blocking_step integer;

begin

  -- Direct edits are handled by guard_subtask_contributor_update. Execution

  -- dependencies apply to the evidence/progress RPC workflow only.

  if not workflow_authorized then

    if new.is_standalone is distinct from old.is_standalone

       and (old.status <> 'todo' or old.percent_complete > 0) then

      raise exception 'Execution mode cannot change after subtask work has started'

        using errcode = '22023',

          hint = 'Reset or finish the existing work before changing between sequential and standalone.';

    end if;

    return new;

  end if;



  -- A reviewer must still be able to approve or request changes for evidence

  -- that was valid when submitted.

  if old.status = 'for_review' or new.is_standalone then

    return new;

  end if;



  select prerequisite.title, (

    select count(*)::integer

    from public.subtasks numbered

    where numbered.task_id = prerequisite.task_id

      and numbered.is_standalone = false

      and numbered.parent_subtask_id is not distinct from prerequisite.parent_subtask_id and numbered.sibling_order <= prerequisite.sibling_order

  )

    into blocking_title, blocking_step

  from public.subtasks prerequisite

  where prerequisite.task_id = new.task_id

    and prerequisite.id <> new.id

    and prerequisite.parent_subtask_id is not distinct from new.parent_subtask_id and prerequisite.sibling_order < new.sibling_order

    and prerequisite.is_standalone = false

    and prerequisite.is_completed = false

  order by prerequisite.sibling_order, prerequisite.created_at, prerequisite.id

  limit 1;



  if blocking_title is not null then

    raise exception 'Complete Step %: "%" before starting this subtask',

      blocking_step, blocking_title

      using errcode = '22023',

        detail = 'Complete ordered subitems in sequence.',

        hint = 'Ask the Team Lead to mark this subtask Standalone only when it is genuinely independent.';

  end if;



  return new;

end;

$function$
;

CREATE OR REPLACE FUNCTION public.guard_subtask_contributor_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  caller uuid := auth.uid();
  workflow_authorized boolean :=
    coalesce(current_setting('eflow.subtask_workflow_authorized', true), 'off') = 'on';
begin if tg_op='UPDATE' and eflow_r9.internal(coalesce((select linked_project_id from public.tasks where id=coalesce((to_jsonb(new)->>'task_id')::uuid,(to_jsonb(new)->>'id')::uuid)),(select project_id from public.personal_tasks where id=coalesce((to_jsonb(new)->>'task_id')::uuid,(to_jsonb(new)->>'id')::uuid)))) then return new;end if;
 if tg_table_name='subtasks' and eflow_r7.internal(case when tg_op='DELETE' then old.task_id else new.task_id end) then if tg_op='DELETE' then return old;else return new;end if;end if;
  if workflow_authorized then
    return new;
  end if;

  if new.is_completed is distinct from old.is_completed
     or new.completed_by is distinct from old.completed_by
     or new.completed_at is distinct from old.completed_at
     or new.status is distinct from old.status
     or new.percent_complete is distinct from old.percent_complete
     or new.reviewer_id is distinct from old.reviewer_id
     or new.latest_submission_id is distinct from old.latest_submission_id then
    raise exception 'Use the subitem completion action; direct row edits are disabled'
      using errcode = '42501';
  end if;

  if public.can_manage_subtasks(old.task_id, caller) then
    return new;
  end if;

  if not (
    case when eflow_r7.root(old.task_id)->>'kind'='office' then
    coalesce(eflow_r7.node_work(old.id,caller),false)
   else old.assigned_to = caller
    or caller = any(coalesce(old.assigned_to_ids, '{}'::uuid[])) end
  ) then
    raise exception 'This subtask is not assigned to you' using errcode = '42501';
  end if;

  if new.task_id is distinct from old.task_id
     or new.title is distinct from old.title
     or new.position is distinct from old.position
     or new.is_standalone is distinct from old.is_standalone
     or new.source is distinct from old.source
     or new.created_by is distinct from old.created_by
     or new.assigned_to is distinct from old.assigned_to
     or new.assigned_to_ids is distinct from old.assigned_to_ids then
    raise exception 'Only a task lead may edit, reassign, or change the execution rule of a subtask'
      using errcode = '42501';
  end if;

  return new;
end;
$function$
;


create or replace function eflow_r7.complete_subitem(p_subtask_id uuid,p_completion jsonb)
returns public.subtasks language plpgsql security definer set search_path='' as $$
declare
 caller uuid:=auth.uid();root_id uuid;r jsonb;s public.subtasks;t public.tasks;
 v_request uuid;previous_status text;terms jsonb;receipt eflow_r7.receipts;name text;attachment jsonb;
 files jsonb:=coalesce(p_completion->'attachments','[]'::jsonb);note text:=btrim(coalesce(p_completion->>'note',''));
 index integer:=0;previous_flag text;
begin
 perform eflow_r3.actor();
 select task_id into root_id from public.subtasks where id=p_subtask_id;
 if root_id is null then raise exception 'Subitem unavailable' using errcode='42501';end if;
 r:=eflow_r7.root(root_id);
 if r is not null and not coalesce(eflow_r7.read_root(root_id),false) then raise exception 'Current work access required' using errcode='42501';end if;
 perform eflow_r7.lock_impact(root_id);
 perform 1 from public.projects where id=(r->>'project')::uuid for update;
 perform eflow_r7.lock_completion(root_id);
 select * into t from public.tasks where id=root_id and deleted_at is null for update;
 select * into s from public.subtasks where id=p_subtask_id and task_id=root_id for update;
 if t.id is null or s.id is null then raise exception 'Subitem unavailable' using errcode='42501';end if;
 previous_status:=s.status;
 v_request:=(p_completion->>'id')::uuid;
 if v_request is null or jsonb_typeof(files)<>'array' or jsonb_array_length(files)>10 or length(note)>3000
 or exists(select 1 from jsonb_object_keys(p_completion) k where k not in ('id','note','attachments')) then raise exception 'Invalid completion details' using errcode='22023';end if;
 terms:=jsonb_build_object('command','complete_subitem','payload',p_completion,'subtask',p_subtask_id);
 select * into receipt from eflow_r7.receipts q where q.actor_id=caller and q.request_id=v_request;
 -- Qualify the parameter/local name to avoid receipt/request column ambiguity below.
 if found then
  if receipt.root_id<>root_id or receipt.payload<>terms then raise exception 'Completion request terms changed' using errcode='22023';end if;
  return s;
 end if;
 r:=eflow_r7.root(root_id);
 if r is not null then
  if not coalesce((eflow_r7.operation_capabilities(root_id,p_subtask_id)->'submit'->>'allowed')::boolean,false) then raise exception 'Only a current subitem lead or task lead may complete this step; finish earlier and child steps first' using errcode='42501';end if;
 elsif not coalesce(public.can_manage_subtasks(root_id,caller) or s.assigned_to=caller or s.lead_id=caller,false) then raise exception 'Current task or subitem lead required' using errcode='42501';end if;
 if t.status not in ('todo','in_progress','changes_requested') or s.status='completed' then raise exception 'This work is closed or already completed' using errcode='22023';end if;
 if not s.is_standalone and exists(select 1 from public.subtasks c where c.task_id=root_id and c.parent_subtask_id is not distinct from s.parent_subtask_id and c.sibling_order<s.sibling_order and not c.is_standalone and c.status<>'completed') then raise exception 'Complete earlier ordered steps first' using errcode='22023';end if;
 perform eflow_r7.require_completed_descendants(root_id,p_subtask_id);
 for attachment in select value from jsonb_array_elements(files) loop
  if jsonb_typeof(attachment)<>'object' or coalesce(attachment->>'filePath','') not like 'subtasks/'||p_subtask_id::text||'/'||v_request::text||'/%'
   or length(coalesce(attachment->>'fileName','')) not between 1 and 255 or coalesce((attachment->>'fileSize')::bigint,0) not between 1 and 26214400
   or not exists(select 1 from storage.objects o where o.bucket_id='task-attachments' and o.name=attachment->>'filePath' and o.owner_id=caller::text)
  then raise exception 'Completion attachment does not belong to this request' using errcode='42501';end if;
 end loop;
 select full_name into name from public.profiles where id=caller;
 insert into eflow_r7.mutations values(txid_current(),caller,root_id);
 previous_flag:=coalesce(current_setting('eflow.subtask_workflow_authorized',true),'off');
 perform set_config('eflow.subtask_workflow_authorized','on',true);
 update public.subtasks set status='completed',is_completed=true,percent_complete=100,completed_by=caller,completed_at=now(),reviewer_id=null,latest_submission_id=null where id=p_subtask_id returning * into s;
 perform set_config('eflow.subtask_workflow_authorized',previous_flag,true);
 -- Use existing update/evidence history; no review or approval record is created.
 insert into public.subtask_progress_updates(id,subtask_id,task_id,author_id,author_name,percent_complete,blocker_category,note,attachment_path,attachment_name)
 values(v_request,s.id,root_id,caller,coalesce(name,'User'),100,'None','Completed subitem.'||case when note='' then '' else E'\n'||note end,files->0->>'filePath',files->0->>'fileName');
 for attachment in select value from jsonb_array_elements(files) loop
  if index>0 then insert into public.subtask_progress_updates(subtask_id,task_id,author_id,author_name,percent_complete,blocker_category,note,attachment_path,attachment_name)
   values(s.id,root_id,caller,coalesce(name,'User'),100,'None','Additional completion attachment',attachment->>'filePath',attachment->>'fileName');end if;
  index:=index+1;
 end loop;
 insert into public.task_activities(task_id,type,content,actor_id,actor_name) values(root_id,'subtask_completed',coalesce(name,'User')||' completed subitem "'||s.title||'"',caller,coalesce(name,'User'));
 insert into public.audit_events(actor_id,actor_name,entity_type,entity_id,action,before_data,after_data,org_id)
 values(caller,coalesce(name,'User'),'subtask',s.id::text,'subtask.completed_directly',jsonb_build_object('status',previous_status),jsonb_build_object('status','completed','request',v_request),t.org_id);
 delete from eflow_r7.mutations where tx=txid_current() and actor=caller and eflow_r7.mutations.root_id=s.task_id;
 insert into eflow_r7.receipts values(caller,v_request,root_id,terms,to_jsonb(s));
 return s;
end $$;
revoke all on function eflow_r7.complete_subitem(uuid,jsonb) from public,anon;
grant execute on function eflow_r7.complete_subitem(uuid,jsonb) to authenticated;
create or replace function public.complete_subitem(p_subtask_id uuid,p_completion jsonb)
returns public.subtasks language sql security invoker set search_path='' as $$ select eflow_r7.complete_subitem(p_subtask_id,p_completion) $$;
revoke all on function public.complete_subitem(uuid,jsonb) from public,anon;
grant execute on function public.complete_subitem(uuid,jsonb) to authenticated;

-- Historical clients use the same guarded direct-completion writer.
create or replace function public.submit_subtask_for_review(p_subtask_id uuid,p_submission jsonb)
returns public.subtasks language sql security invoker set search_path='' as $$ select eflow_r7.complete_subitem(p_subtask_id,p_submission) $$;
create or replace function public.decide_subtask_review(p_subtask_id uuid,p_approve boolean,p_feedback text default null)
returns public.subtasks language plpgsql security invoker set search_path='' as $$ begin
 raise exception 'Subitems complete directly. Use Mark complete in the subitem; final approval belongs to the task.' using errcode='22023';
end $$;
create or replace function eflow_r7.pending_reviews()
returns jsonb language plpgsql stable security definer set search_path='' as $$ begin perform eflow_r3.actor();return '[]'::jsonb;end $$;

CREATE OR REPLACE FUNCTION eflow_r7.require_completed_descendants(p_root uuid, p_target uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$

declare personal boolean;bad record;

begin

 personal:=exists(select 1 from public.personal_tasks where id=p_root);

 with recursive required as (

  select n.* from eflow_r7.nodes n where n.task_id=p_root and

   (p_target=p_root or n.parent_subtask_id=p_target)

  union

  select c.* from eflow_r7.nodes c join required p on c.parent_subtask_id=p.id where c.task_id=p_root

 )

 select n.id,n.title into bad from required n

 left join public.subtasks s on s.id=n.id and not personal

 where n.status is distinct from 'completed' or not personal and (

  not coalesce(s.is_completed,false) or

  -- Legacy completed rows without an attempt remain valid. An existing formal

  -- binding must still identify its own approved attempt, never pending/rejected.

  s.latest_submission_id is not null and not exists(

   select 1 from public.subtask_submissions a where a.id=s.latest_submission_id

    and a.subtask_id=s.id and a.task_id=p_root and a.status='approved'))

 order by n.id limit 1;

 if found then

  raise exception 'Complete every child step first: resolve "%" (%).',bad.title,bad.id

   using errcode='23514',hint='Complete the remaining child steps, then retry the parent action.';

 end if;

end $function$
;

CREATE OR REPLACE FUNCTION public.guard_task_subtask_readiness()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$

begin

  if new.status = 'for_review'

     and old.status is distinct from new.status

     and exists (

       select 1 from public.subtasks s

       where s.task_id = new.id and not s.is_completed

     ) then

    raise exception 'Complete every subitem before submitting the parent task'

      using errcode = '22023';

  end if;

  return new;

end;

$function$
;
-- The protected completion transaction may write its final evidence update.
-- Ordinary clients still cannot append progress to a completed step.
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
    perform eflow_evidence.seal_file(new.attachment_path, t.id, s.id, 'progress', 'progress', new.id);
  end if;
  return new;
end;
$function$
;

-- Retain a truthful completion update; normal progress remains limited to 0–99.
alter table public.subtask_progress_updates drop constraint subtask_progress_updates_percent_complete_check;
alter table public.subtask_progress_updates add constraint subtask_progress_updates_percent_complete_check check (percent_complete between 0 and 100);
