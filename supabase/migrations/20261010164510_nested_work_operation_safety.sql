-- NW5.1: private history facts and operation scope. Public RPCs/receipts stay
-- compatible. Checked confirmation and history-writer serialization are NW5.2.
begin;
set local lock_timeout='10s';

create or replace function eflow_r7.subtree_ids(p_root uuid,p_node uuid)
returns uuid[] language plpgsql stable security definer set search_path='' as $$
declare ids uuid[]; invalid boolean;
begin
 if eflow_r7.root(p_root) is null then raise exception 'Work scope unavailable' using errcode='42501';end if;
 if p_node is not null and not exists(select 1 from eflow_r7.nodes where id=p_node and task_id=p_root) then
  raise exception 'Choose a node in this root' using errcode='23514';
 end if;
 -- Inspect ancestry as well as descendants: an orphan/cycle must not silently
 -- disappear from a rooted traversal. The ninth hop is diagnostic, not allowed.
 with recursive above as (
  select n.id origin,n.id,n.parent_subtask_id,array[n.id] path,1 depth,false cycle
  from eflow_r7.nodes n where n.task_id=p_root
  union all select a.origin,n.id,n.parent_subtask_id,a.path||n.id,a.depth+1,n.id=any(a.path)
  from above a join eflow_r7.nodes n on n.id=a.parent_subtask_id and n.task_id=p_root
  where not a.cycle and a.depth<=8
 ) select exists(select 1 from above a where a.cycle or a.depth>8 or
  a.parent_subtask_id is not null and not exists(select 1 from eflow_r7.nodes n where n.id=a.parent_subtask_id and n.task_id=p_root)) into invalid;
 if invalid then raise exception 'Work hierarchy has a cycle, foreign parent or depth beyond 8; resolve it first' using errcode='23514';end if;
 with recursive below as (
  select id from eflow_r7.nodes where task_id=p_root and (p_node is null or id=p_node)
  union select n.id from eflow_r7.nodes n join below b on n.parent_subtask_id=b.id where n.task_id=p_root
 ) select coalesce(array_agg(id order by id),'{}') into ids from below;
 return ids;
end $$;

create or replace function eflow_r7.history_facts(p_root uuid,p_ids uuid[])
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare r jsonb:=eflow_r7.root(p_root); facts jsonb; codes text[]:='{}'; k text; v bigint;
begin
 if r is null or p_ids is null or exists(select 1 from unnest(p_ids) x where not exists(select 1 from eflow_r7.nodes n where n.id=x and n.task_id=p_root)) then
  raise exception 'Required history scope unavailable' using errcode='23514';end if;
 select jsonb_build_object('state',(select count(*) from eflow_r7.nodes where task_id=p_root and id=any(p_ids) and (status<>'todo' or percent_complete<>0)),
  'progress',0,'submissions',0,'reviews',0,'attachments',0,'evidence',0,'attempts',0,'allocations',0,'allocation_lines',0,'cash',0,'ledger',0,'execution_events',0) into facts;
 if r->>'kind'='office' then
  -- Missing canonical relations/columns cause an error; never treat unavailable
  -- history as an empty result. Count inactive/cancelled/rejected finance too.
  with allocations as (select id from public.work_budget_allocations where subtask_id=any(p_ids)),
  lines as (select id from public.work_budget_allocation_lines where allocation_id in(select id from allocations)),
  cash as (select c.id from public.petty_cash_requests c where c.subtask_id=any(p_ids) or c.allocation_id in(select id from allocations)
   or c.allocation_line_id in(select id from lines) or exists(select 1 from public.petty_cash_request_lines l where l.request_id=c.id and l.allocation_line_id in(select id from lines)))
  select facts||jsonb_build_object(
   'state',(select count(*) from public.subtasks where task_id=p_root and id=any(p_ids) and (status<>'todo' or percent_complete<>0 or is_completed or latest_submission_id is not null or completed_by is not null or completed_at is not null)),
   'progress',(select count(*) from public.subtask_progress_updates where subtask_id=any(p_ids)),
   'submissions',(select count(*) from public.subtask_submissions where subtask_id=any(p_ids)),
   'reviews',(select count(*) from public.subtask_submissions where subtask_id=any(p_ids) and (status<>'pending' or decided_by is not null or decided_at is not null)),
   'attachments',(select count(*) from public.subtask_submission_attachments a where a.subtask_id=any(p_ids) or a.submission_id in(select id from public.subtask_submissions where subtask_id=any(p_ids))),
   'evidence',(select count(*) from eflow_evidence.objects o where o.subtask_id=any(p_ids)
    or o.reference_kind='subtask_attachment' and o.reference_id in(select id from public.subtask_submission_attachments where subtask_id=any(p_ids))
    or o.reference_kind='progress' and o.reference_id in(select id from public.subtask_progress_updates where subtask_id=any(p_ids))),
   'attempts',(select count(*) from eflow_evidence.attempts a where a.subtask_id=any(p_ids) or a.kind='subtask' and a.submission_id in(select id from public.subtask_submissions where subtask_id=any(p_ids))),
   'allocations',(select count(*) from allocations),'allocation_lines',(select count(*) from lines),'cash',(select count(*) from cash),
   'ledger',(select count(*) from public.budget_ledger_entries l where l.subtask_id=any(p_ids) or l.allocation_id in(select id from allocations) or l.petty_cash_request_id in(select id from cash))) into facts;
 else
  facts:=facts||jsonb_build_object('state',(select count(*) from public.personal_subtasks where task_id=p_root and id=any(p_ids) and
   (status<>'todo' or percent_complete<>0 or submitted_by is not null or reviewer_id is not null)),
   'execution_events',(select count(*) from public.work_tree_events e where e.root_id=p_root and
    (e.command in ('progress','submit','review') and e.node_id=any(p_ids) or exists(
     select 1 from jsonb_array_elements(coalesce(e.before_data->'nodes','[]')||coalesce(e.after_data->'nodes','[]')) n
     where n->>'id'=any(p_ids::text[]) and (not(n ? 'status' and n ? 'percent_complete') or coalesce(n->>'status','todo')<>'todo' or coalesce((n->>'percent_complete')::numeric,0)<>0
      or nullif(n->>'submitted_by','') is not null))))) ;
 end if;
 for k,v in select key,value::bigint from jsonb_each_text(facts) order by key loop
  if v>0 then codes:=array_append(codes,case when k='state' then 'lifecycle_blocked' else 'history_'||k end);end if;
 end loop;
 return jsonb_build_object('counts',facts,'blocker_codes',to_jsonb(codes),'untouched',cardinality(codes)=0);
end $$;

create or replace function eflow_r7.operation_impact(p_root uuid,p_command text,p_payload jsonb)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare r jsonb:=eflow_r7.root(p_root);n eflow_r7.nodes; target uuid:=(p_payload->>'id')::uuid;
 parent uuid:=(p_payload->>'parent')::uuid;ids uuid[]:='{}';selected uuid[]:='{}';extra uuid[];row_id uuid;
 structural boolean:=false;facts jsonb;codes text[]:='{}';incoming uuid[];old_people uuid[];lead uuid;compatibility_ids uuid[]:='{}';
begin
 if r is null then raise exception 'Work scope unavailable' using errcode='42501';end if;
 -- Validate bounded topology even when the command's selected scope is empty.
 extra:=eflow_r7.subtree_ids(p_root,null);
 if target is not null and p_command<>'create' then
  select * into n from eflow_r7.nodes where id=target and task_id=p_root;
  if not found then raise exception 'Choose a node in this root' using errcode='23514';end if;
 end if;
 if p_command in ('delete','edit','move','staff') then selected:=eflow_r7.subtree_ids(p_root,target);ids:=selected;
 elsif p_command in ('root_lead','contributors') then selected:=extra;ids:=selected;
 elsif p_command='create' then
  if parent is not null then selected:=array[parent];ids:=eflow_r7.subtree_ids(p_root,parent);end if;
 elsif p_command='order' then
  if parent is not null then perform eflow_r7.subtree_ids(p_root,parent);end if;
  for row_id in select id from eflow_r7.nodes where task_id=p_root and parent_subtask_id is not distinct from parent loop
   selected:=array_append(selected,row_id);ids:=ids||eflow_r7.subtree_ids(p_root,row_id);
  end loop;
 end if;
 structural:=p_command in ('move','order','delete','create') or p_command='edit' and p_payload ? 'standalone' and (p_payload->>'standalone')::boolean is distinct from n.is_standalone;
 if p_command='move' or p_command='edit' and structural then
  if p_command='move' and n.parent_subtask_id is not null then ids:=ids||array[n.parent_subtask_id];end if;
  if p_command='move' and parent is not null then perform eflow_r7.subtree_ids(p_root,parent);ids:=ids||array[parent];end if;
  -- Dependency scopes at both endpoints; include every sibling's descendants.
  for row_id in select id from eflow_r7.nodes where task_id=p_root and
   (parent_subtask_id is not distinct from n.parent_subtask_id or p_command='move' and parent_subtask_id is not distinct from parent) loop
   ids:=ids||eflow_r7.subtree_ids(p_root,row_id);
  end loop;
 end if;
 select coalesce(array_agg(distinct x order by x),'{}') into ids from unnest(ids) x;
 facts:=eflow_r7.history_facts(p_root,ids);
 if structural then select coalesce(array_agg(value),'{}') into codes from jsonb_array_elements_text(facts->'blocker_codes');end if;
 if p_command in ('staff','root_lead','contributors') then
  lead:=case when p_command='contributors' then (r->>'lead')::uuid else (p_payload->>'lead')::uuid end;
  old_people:=case when target is null then array(select value::uuid from jsonb_array_elements_text(coalesce(r->'people','[]'))) else coalesce(n.assigned_to_ids,'{}') end;
  if r->>'kind'='office' or target is not null then
   incoming:=case when p_payload ? 'people' then array(select value::uuid from jsonb_array_elements_text(p_payload->'people'))
    when p_command='root_lead' then array_remove(old_people||array[lead],null) else '{}'::uuid[] end;
   if p_command in ('staff','root_lead') and lead is distinct from (case when target is null then (r->>'lead')::uuid else n.lead_id end) and not(old_people <@ incoming) then
    codes:=codes||array['transfer_worker_removal'];
   end if;
   if exists(select 1 from eflow_r7.nodes c where c.task_id=p_root and c.id=any(selected) and c.id is distinct from target
    and c.status<>'completed' and exists(select 1 from unnest(c.assigned_to_ids) worker where worker=any(old_people) and not worker=any(incoming))) then
    codes:=codes||array['unfinished_worker_removal'];
   end if;
  end if;
 end if;
 if r->>'kind'='office' and p_command in ('create','edit','staff','root_lead','move','order','delete') then
  -- Existing R7 writes derived global positions after these commands. Track
  -- prospective position changes separately from canonical dependency scopes:
  -- changing a compatibility number does not itself reopen historical work.
  with recursive planned as (
   select c.id,case when p_command='move' and c.id=target then parent else c.parent_subtask_id end parent_id,
    case when p_command='move' and c.id=target then (select coalesce(max(sibling_order),-1)+1 from eflow_r7.nodes where task_id=p_root and parent_subtask_id is not distinct from parent)
     when p_command='order' and p_payload ? 'order' and c.parent_subtask_id is not distinct from parent then
      (select ordinality::integer-1 from jsonb_array_elements_text(p_payload->'order') with ordinality x where x.value=c.id::text)
     else c.sibling_order end sibling_order
   from eflow_r7.nodes c where c.task_id=p_root and not(p_command='delete' and c.id=any(selected))
   union all select target,parent,(select coalesce(max(sibling_order),-1)+1 from eflow_r7.nodes where task_id=p_root and parent_subtask_id is not distinct from parent)
    where p_command='create' and target is not null and not exists(select 1 from eflow_r7.nodes where id=target)
  ), ordered as (
   select id,array[lpad(sibling_order::text,10,'0')||id::text] path,1 depth from planned where parent_id is null
   union all select c.id,o.path||(lpad(c.sibling_order::text,10,'0')||c.id::text),o.depth+1 from planned c join ordered o on c.parent_id=o.id where o.depth<8
  ), ranked as (select id,row_number() over(order by path)-1 position from ordered)
  select coalesce(array_agg(c.id order by c.id),'{}') into compatibility_ids from public.subtasks c join ranked x on x.id=c.id where c.task_id=p_root and c.position<>x.position;
 end if;
 return jsonb_build_object('root_id',p_root,'command',p_command,'allowed',cardinality(codes)=0,'blocker_codes',to_jsonb(codes),
  'ids',to_jsonb(ids),'selected_count',cardinality(selected),'descendant_count',greatest(cardinality(selected)-case when target is null then 0 else 1 end,0),
  'affected_appointment_count',(select count(*) from eflow_r7.nodes where task_id=p_root and id=any(selected) and lead_id is not null
   and (p_command='root_lead' and (p_payload->>'lead')::uuid is distinct from (r->>'lead')::uuid
    or p_command='move' and id<>target or p_command='staff' and (p_payload->>'lead')::uuid is distinct from n.lead_id and id<>target)),
  'compatibility_position_ids',to_jsonb(compatibility_ids),'history',facts,'structural',structural);
end $$;

create or replace function eflow_r7.require_operation(p_root uuid,p_command text,p_payload jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare impact jsonb;
begin
 impact:=eflow_r7.operation_impact(p_root,p_command,p_payload);
 if not (impact->>'allowed')::boolean then raise exception 'Work history or dependent responsibilities block this operation: %; resolve affected work first',impact->'blocker_codes'
  using errcode='23514',hint='Preserve recorded evidence and finance; resolve staffing separately. Confirmation cannot override protected history.';end if;
end $$;

create or replace function eflow_r7.guard_operation_write()
returns trigger language plpgsql security definer set search_path='' as $$
declare a jsonb:=case when tg_op<>'INSERT' then to_jsonb(old) else '{}' end;
 b jsonb:=case when tg_op<>'DELETE' then to_jsonb(new) else '{}' end;
 root_id uuid; r jsonb; node_id uuid; cmd text;payload jsonb;
begin
 root_id:=case when tg_table_name in ('tasks','personal_tasks') then (b->>'id')::uuid else coalesce((a->>'task_id')::uuid,(b->>'task_id')::uuid) end;
 r:=eflow_r7.root(root_id);if r is null then if tg_op='DELETE' then return old;else return new;end if;end if;
 -- Preserve the private R9 UPDATE-only staffing removal, never a client marker
 -- or a structural bypass. Existing R9 authority/preview/serialization is kept.
 if tg_op='UPDATE' and eflow_r9.internal((r->>'project')::uuid) and
  (a-array['lead_id','assigned_to','recommendation_lead_id','assigned_to_ids','team_member_ids','team_member_names','assignee_name','reviewer_id','backup_reviewer_id','revision','updated_at'])=
  (b-array['lead_id','assigned_to','recommendation_lead_id','assigned_to_ids','team_member_ids','team_member_names','assignee_name','reviewer_id','backup_reviewer_id','revision','updated_at']) then return new;end if;
 if auth.uid() is not null and not coalesce(eflow_r7.read_root(root_id),false) then raise exception 'Current work access required' using errcode='42501';end if;
 if tg_table_name in ('tasks','personal_tasks') then
  if tg_op='UPDATE' and coalesce(b->>'lead_id',b->>'assigned_to',b->>'recommendation_lead_id') is distinct from coalesce(a->>'lead_id',a->>'assigned_to',a->>'recommendation_lead_id') then
   cmd:='root_lead';payload:=jsonb_build_object('lead',coalesce(b->>'lead_id',b->>'assigned_to',b->>'recommendation_lead_id'),'people',b->'team_member_ids');
   if tg_table_name='personal_tasks' then payload:=payload-'people';end if;
  elsif tg_op='UPDATE' and b->'team_member_ids' is distinct from a->'team_member_ids' then cmd:='contributors';payload:=jsonb_build_object('people',b->'team_member_ids');end if;
 else
  node_id:=coalesce((a->>'id')::uuid,(b->>'id')::uuid);
  if tg_op='DELETE' then cmd:='delete';payload:=jsonb_build_object('id',node_id);
  elsif tg_op='INSERT' then cmd:='create';payload:=jsonb_build_object('id',node_id,'parent',b->'parent_subtask_id');
  elsif b->'parent_subtask_id' is distinct from a->'parent_subtask_id' then cmd:='move';payload:=jsonb_build_object('id',node_id,'parent',b->'parent_subtask_id');
  elsif b->'sibling_order' is distinct from a->'sibling_order' or b->'position' is distinct from a->'position' and not eflow_r7.internal(root_id) then cmd:='order';payload:=jsonb_build_object('parent',a->'parent_subtask_id');
  elsif b->'is_standalone' is distinct from a->'is_standalone' then cmd:='edit';payload:=jsonb_build_object('id',node_id,'standalone',b->'is_standalone');
  elsif b->'lead_id' is distinct from a->'lead_id' or b->'assigned_to_ids' is distinct from a->'assigned_to_ids' then
   -- Canonical transfer/move clears descendants after checking the full scope.
   if b->>'lead_id' is null and eflow_r7.internal(root_id) and b->'assigned_to_ids'=a->'assigned_to_ids' then return new;end if;
   cmd:='staff';payload:=jsonb_build_object('id',node_id,'lead',b->'lead_id','people',b->'assigned_to_ids');
  elsif b->'title' is distinct from a->'title' or b->'due_date' is distinct from a->'due_date' then
   cmd:='edit';payload:=jsonb_build_object('id',node_id,'title',b->'title','due',b->'due_date','standalone',b->'is_standalone');
  end if;
 end if;
 if cmd is not null then perform eflow_r7.require_operation(root_id,cmd,payload);end if;
 if tg_op='DELETE' then return old;else return new;end if;
end $$;

revoke all on function eflow_r7.subtree_ids(uuid,uuid),eflow_r7.history_facts(uuid,uuid[]),eflow_r7.operation_impact(uuid,text,jsonb),
 eflow_r7.require_operation(uuid,text,jsonb),eflow_r7.guard_operation_write() from public,anon,authenticated,service_role;

-- Original R7 entry: after authority/payload/revision checks and before any
-- snapshot/marker/write. Exact receipt retries return through the old early path.
do $$declare d text;anchor text:='v_before:=eflow_r7.snapshot(p_root);';begin
 select pg_get_functiondef('eflow_r7.command(uuid,integer,uuid,text,jsonb)'::regprocedure) into d;
 if strpos(d,'/* NW5.1 operation safety */')=0 then
  if (length(d)-length(replace(d,anchor,'')))/length(anchor)<>1 then raise exception 'Review changed R7 command before adding history checks';end if;
  execute replace(d,anchor,'/* NW5.1 operation safety */ if p_command not in (''progress'',''submit'',''review'') then perform eflow_r7.require_operation(p_root,p_command,p_payload);end if; '||anchor);
 end if;
end $$;

drop trigger if exists nw51_operation_safety on public.subtasks;
create trigger nw51_operation_safety before insert or update or delete on public.subtasks for each row execute function eflow_r7.guard_operation_write();
drop trigger if exists nw51_operation_safety on public.personal_subtasks;
create trigger nw51_operation_safety before insert or update or delete on public.personal_subtasks for each row execute function eflow_r7.guard_operation_write();
drop trigger if exists nw51_operation_safety on public.tasks;
create trigger nw51_operation_safety before update on public.tasks for each row execute function eflow_r7.guard_operation_write();
drop trigger if exists nw51_operation_safety on public.personal_tasks;
create trigger nw51_operation_safety before update on public.personal_tasks for each row execute function eflow_r7.guard_operation_write();

-- Keep NW2's authority/lifecycle and JSON shape. Additional history predicates
-- use the same collector; staffing remains an authorized active-work amendment.
do $$declare d text;anchor text:='result := result || jsonb_build_object(action,jsonb_build_object(''allowed'',reason is null,''reason_code'',reason));';addition text;begin
 select pg_get_functiondef('eflow_r7.operation_capabilities(uuid,uuid)'::regprocedure) into d;
 addition:=$patch$/* NW5.1 history capability */
  if reason is null and action in ('create_child','order_children','move','delete') then
   if not (eflow_r7.operation_impact(p_root,case action when 'create_child' then 'create' when 'order_children' then 'order' else action end,
    case when action in ('create_child','order_children') then jsonb_build_object('parent',p_node) else jsonb_build_object('id',p_node,'parent',n.parent_subtask_id) end)->>'allowed')::boolean then reason:='history_blocked';end if;
  end if;
 $patch$;
 if strpos(d,'/* NW5.1 history capability */')=0 then
  if (length(d)-length(replace(d,anchor,'')))/length(anchor)<>1 then raise exception 'Review changed capability projector';end if;
  execute replace(d,anchor,addition||anchor);
 end if;
end $$;
commit;
