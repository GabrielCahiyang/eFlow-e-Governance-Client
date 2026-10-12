-- NW2.1: current action prerequisites only. Commands still validate payloads,
-- destinations, revisions and authority at mutation time. No execution/review
-- policy correction or historical worker-array repair is performed here.
begin;
set local lock_timeout = '10s';

create function eflow_r7.operation_capabilities(p_root uuid, p_node uuid default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
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
    if not coalesce(eflow_r7.node_work(p_node,auth.uid()),false) then reason := 'branch_denied';
    elsif n.status in ('for_review','completed') or
     r->>'kind'='office' and r->>'status' not in ('todo','in_progress','changes_requested') then reason := 'lifecycle_blocked';
    elsif not ordered_ready then reason := 'lifecycle_blocked';
    elsif action='submit' and (not descendants_complete or eflow_r7.reviewer(p_node,auth.uid()) is null) then reason := 'lifecycle_blocked'; end if;
   elsif action='review' then
    if auth.uid() is distinct from eflow_r7.pending_reviewer(p_node) then reason := 'branch_denied';
    elsif n.status<>'for_review' or not descendants_complete or r->>'kind'='office' and not exists(
     select 1 from public.subtasks s join public.subtask_submissions sub on sub.id=s.latest_submission_id
     where s.id=p_node and sub.status='pending' and sub.submitter_id<>auth.uid()) then reason := 'lifecycle_blocked'; end if;
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
  result := result || jsonb_build_object(action,jsonb_build_object('allowed',reason is null,'reason_code',reason));
 end loop;
 return result;
end $$;
revoke all on function eflow_r7.operation_capabilities(uuid,uuid) from public,anon,authenticated,service_role;


-- Preserve every legacy snapshot field, value and grant.
create or replace function eflow_r7.snapshot(p_root uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare r jsonb:=eflow_r7.root(p_root);v_nodes jsonb;v_people jsonb;begin
 if not eflow_r7.read_root(p_root) then raise exception 'Nested work access denied' using errcode='42501';end if;
 with recursive tree as (
  select n.*,1 depth,array[n.sibling_order] path from eflow_r7.nodes n where n.task_id=p_root and n.parent_subtask_id is null
  union all select n.*,t.depth+1,t.path||n.sibling_order from eflow_r7.nodes n join tree t on n.parent_subtask_id=t.id where n.task_id=p_root and t.depth<8
 ) select coalesce(jsonb_agg(to_jsonb(t)||jsonb_build_object('capabilities',eflow_r7.operation_capabilities(p_root,t.id),'can_manage',eflow_r7.manage(p_root,t.id),'can_appoint',eflow_r7.manage(p_root,t.id,true),'can_order',eflow_r7.manage(p_root,t.parent_subtask_id),'can_work',eflow_r7.node_work(t.id,auth.uid()),'can_review',t.status='for_review' and eflow_r7.pending_reviewer(t.id)=auth.uid(),'current_reviewer',eflow_r7.pending_reviewer(t.id)) order by path,id),'[]'::jsonb) into v_nodes from tree t;
 select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.full_name,'office',p.org_id,'eligible',eflow_r7.member((r->>'project')::uuid,(r->>'office')::uuid,p.id)) order by p.full_name,p.id),'[]'::jsonb) into v_people from public.profiles p where eflow_r7.member((r->>'project')::uuid,(r->>'office')::uuid,p.id) or p.id=(r->>'lead')::uuid or coalesce(r->'people','[]') ? p.id::text or exists(select 1 from eflow_r7.nodes n where n.task_id=p_root and (n.lead_id=p.id or p.id=any(n.assigned_to_ids)));
 return jsonb_build_object('root',r||jsonb_build_object('capabilities',eflow_r7.operation_capabilities(p_root)),'revision',coalesce((select revision from eflow_r7.tree_state where root_id=p_root),1),'can_manage',eflow_r7.manage(p_root,null),'can_transfer',eflow_r7.head(p_root),'nodes',v_nodes,'people',v_people,
 'leaf_total',(select count(*) from eflow_r7.nodes n where n.task_id=p_root and not exists(select 1 from eflow_r7.nodes c where c.parent_subtask_id=n.id)),
 'leaf_completed',(select count(*) from eflow_r7.nodes n where n.task_id=p_root and n.status='completed' and not exists(select 1 from eflow_r7.nodes c where c.parent_subtask_id=n.id)));
end $$;

commit;
