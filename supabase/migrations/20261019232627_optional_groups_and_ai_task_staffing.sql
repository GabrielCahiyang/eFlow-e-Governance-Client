-- Optional empty groups, transactional PDF cleanup, and explicit AI-selected task staffing.
CREATE OR REPLACE FUNCTION eflow_r7.guard_operation_write()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
 -- Deleted task records may only move to this project's default group during
 -- authorized empty-group cleanup. No work fields or staffing may change.
 if tg_table_name='tasks' and tg_op='UPDATE' and a->>'deleted_at' is not null and
  b->>'deleted_at' is not null and a->>'group_id' is distinct from b->>'group_id' and
  (a-array['group_id','updated_at'])=(b-array['group_id','updated_at']) and
  auth.uid() is not null and exists(
   select 1 from public.project_groups g join public.projects p on p.id=g.project_id
   where (g.id=(b->>'group_id')::uuid or b->>'group_id' is null) and g.project_id=(a->>'linked_project_id')::uuid
    and p.status not in ('completed','archived')
    and public.can_create_scoped_work(p.org_id,auth.uid()) and public.can_manage_project(p.id,auth.uid())
  ) then return new;end if;
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
end $function$;

CREATE OR REPLACE FUNCTION public.phase3_guard_group()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
 if tg_op='UPDATE' and (new.project_id<>old.project_id or new.is_default<>old.is_default) then
  raise exception 'A group cannot change its project or default identity' using errcode='23514';
 end if;
 if tg_op='DELETE' then
  if exists(select 1 from public.projects where id=old.project_id) then
   if exists(select 1 from public.tasks where group_id=old.id) then raise exception 'Move the tasks before deleting this group' using errcode='23514'; end if;
  end if;
  return old;
 end if;
 new.updated_at:=now(); return new;
end; $function$;

CREATE OR REPLACE FUNCTION public.phase3_guard_task_group()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
 if new.linked_project_id is null then new.group_id:=null;
 elsif (new.group_id is null and new.deleted_at is null) or (tg_op='UPDATE' and new.linked_project_id is distinct from old.linked_project_id) then
  select id into new.group_id from public.project_groups where project_id=new.linked_project_id order by is_default desc,position,created_at,id limit 1;
 end if;
 if new.group_id is not null and not exists(select 1 from public.project_groups where id=new.group_id and project_id=new.linked_project_id) then
  raise exception 'Choose a group from this project' using errcode='23514';
 end if;
 return new;
end; $function$;

CREATE OR REPLACE FUNCTION public.delete_empty_project_group(p_group_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare g public.project_groups; p public.projects; default_id uuid;
begin
 if auth.uid() is null then raise exception 'Not authenticated' using errcode='42501';end if;
 select * into g from public.project_groups where id=p_group_id;
 if not found then raise exception 'Group not available.' using errcode='42501';end if;
 select * into p from eflow_phase6.lock_project(g.project_id);
 if not found or not coalesce(public.can_create_scoped_work(p.org_id,auth.uid()),false)
  or not coalesce(public.can_manage_project(p.id,auth.uid()),false) then
  raise exception 'Only the project Head can delete groups.' using errcode='42501';
 end if;
 if p.status in ('completed','archived') then raise exception 'This project is read-only.' using errcode='22023';end if;
 select * into g from public.project_groups where id=p_group_id for update;
 if not found then raise exception 'Group not available.' using errcode='42501';end if;
 if exists(select 1 from public.tasks where deleted_at is null and (group_id=g.id or (g.is_default and group_id is null and linked_project_id=g.project_id))) then
  raise exception 'This group still has tasks. Move or delete them first. Archived tasks must be moved too.' using errcode='22023';
 end if;
 select id into default_id from public.project_groups where project_id=g.project_id and id<>g.id order by is_default desc,position,created_at,id limit 1;
 update public.tasks set group_id=default_id where group_id=g.id and deleted_at is not null;
 delete from public.project_groups where id=g.id;
end $function$;

CREATE OR REPLACE FUNCTION public.import_project_pdf_work(p_project_id uuid, p_request_id uuid, p_review jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare p public.projects; result jsonb; item jsonb; line jsonb; keys text[];seen text[]:='{}';line_keys text[]:='{}';fingerprint text;amount numeric;total numeric:=0;expected numeric;quantity numeric;unit_cost numeric; empty_group uuid;
begin
 select * into p from public.projects where id=p_project_id for update;
 if not found or auth.uid() is null or not public.can_manage_project(p.id,auth.uid()) or not public.can_create_scoped_work(p.org_id,auth.uid()) then
  raise exception 'Only the responsible Office Head can import project work' using errcode='42501';end if;
 -- Reuse the canonical receipt check; a retry never reapplies an old estimate
 -- over a later manual edit. Concurrent calls serialize on the project lock.
 if exists(select 1 from public.project_import_batches where id=p_request_id) then
  return public.phase65_import_project_work(p_project_id,p_request_id,p_review);
 end if;
 if p.status in ('completed','archived') then raise exception 'Closed project structure is read-only' using errcode='22023';end if;
 if p_review ? 'taskBudgets' then
  if jsonb_typeof(p_review->'taskBudgets') is distinct from 'array' or jsonb_array_length(p_review->'taskBudgets')>100
   or jsonb_typeof(p_review->'sourceBudgetTotal') is distinct from 'number' then raise exception 'Invalid source budget' using errcode='22023';end if;
  expected:=(p_review->>'sourceBudgetTotal')::numeric;
  if (expected::text in ('NaN','Infinity','-Infinity') or expected<0 or expected>1000000000000 or expected<>round(expected,2)) then raise exception 'Invalid source budget total' using errcode='22023';end if;
  select array_agg(t->>'key') into keys from jsonb_array_elements(p_review->'groups') g cross join lateral jsonb_array_elements(g->'tasks') t;
  for item in select value from jsonb_array_elements(p_review->'taskBudgets') loop
   if nullif(item->>'key','') is null or not (item->>'key'=any(keys)) or item->>'key'=any(seen)
    or jsonb_typeof(item->'lines') is distinct from 'array' or jsonb_array_length(item->'lines')>500
    or coalesce(item->>'decision','') not in ('funded','missing','no_cost') then raise exception 'Invalid task budget reference' using errcode='22023';end if;
   seen:=array_append(seen,item->>'key');
   if (item->>'decision'='funded') is distinct from (jsonb_array_length(item->'lines')>0) then raise exception 'Funded tasks need source cost lines' using errcode='22023';end if;
   for line in select value from jsonb_array_elements(item->'lines') loop
    if jsonb_typeof(line->'amount') is distinct from 'number' or length(btrim(coalesce(line->>'particular',''))) not between 1 and 2000
     or length(btrim(coalesce(line->>'fundSource',''))) not between 1 and 200 then raise exception 'Invalid source cost line' using errcode='22023';end if;
    if (line ? 'quantity' and jsonb_typeof(line->'quantity') is distinct from 'number') or (line ? 'unitCost' and jsonb_typeof(line->'unitCost') is distinct from 'number') then raise exception 'Invalid source quantity or unit cost' using errcode='22023';end if;
    amount:=(line->>'amount')::numeric;quantity:=coalesce((line->>'quantity')::numeric,1);unit_cost:=coalesce((line->>'unitCost')::numeric,amount);
    if amount<=0 or amount>9999999999 or amount<>round(amount,2) or quantity<=0 or quantity>90071992547409 or quantity<>round(quantity,2) or unit_cost<=0 or unit_cost>9999999999 or unit_cost<>round(unit_cost,2) then raise exception 'Invalid source amount, quantity or unit cost' using errcode='22023';end if;
    if round(coalesce((line->>'quantity')::numeric,1)*coalesce((line->>'unitCost')::numeric,amount),2)<>amount then raise exception 'Source quantity and price do not match the amount' using errcode='22023';end if;
    fingerprint:=jsonb_build_array(line->>'particular',line->>'fundSource',amount)::text;
    if fingerprint=any(line_keys) then raise exception 'A source cost was counted more than once' using errcode='22023';end if;
    line_keys:=array_append(line_keys,fingerprint);total:=total+amount;
   end loop;
  end loop;
  if cardinality(seen) is distinct from cardinality(keys) or total<>expected then raise exception 'Task budgets do not match the source total' using errcode='22023';end if;
 elsif p_review ? 'sourceBudgetTotal' then raise exception 'Source task budgets are missing' using errcode='22023';
 end if;
 result:=public.phase65_import_project_work(p_project_id,p_request_id,p_review);
 for item in select value from jsonb_array_elements(coalesce(p_review->'taskBudgets','[]')) loop
  select coalesce(sum((value->>'amount')::numeric),0) into amount from jsonb_array_elements(item->'lines');
  perform public.phase3_patch_task((result->'taskIds'->>(item->>'key'))::uuid,jsonb_build_object('budget_impact',amount));
 end loop;
 -- Remove only the original, genuinely empty default, after a successful import.
 -- A retry returns the existing receipt above and never runs cleanup again.
 if coalesce((result->>'taskCount')::int,0)>0 then
  for empty_group in select g.id from public.project_groups g
   where g.project_id=p_project_id and g.is_default
    and not exists(select 1 from public.tasks t where t.deleted_at is null
     and (t.group_id=g.id or (t.group_id is null and t.linked_project_id=g.project_id)))
  loop perform public.delete_empty_project_group(empty_group);end loop;
 end if;
 return result;
end $function$;

-- The authenticated gateway asks for the authorized directory, not a browser-
-- supplied candidate list. Existing temporary project guests are included.
create function public.project_ai_available_people(p_root uuid,p_actor uuid)
returns table(id uuid,full_name text) language plpgsql security definer set search_path='' as $$
declare r jsonb:=eflow_r7.root(p_root);
begin
 if r is null or r->>'kind'<>'office' or not coalesce(eflow_phase6.head((r->>'project')::uuid,(r->>'office')::uuid,p_actor),false) then raise exception 'Responsible Head required' using errcode='42501';end if;
 return query select p.id,p.full_name from public.profiles p where p.is_active and p.role<>'admin' and
  ((p.org_id=(r->>'office')::uuid and eflow_r9.allowed((r->>'project')::uuid,p.id,(r->>'office')::uuid))
   or eflow_r7.member((r->>'project')::uuid,(r->>'office')::uuid,p.id)) order by p.full_name,p.id;
end $$;
revoke all on function public.project_ai_available_people(uuid,uuid) from public,anon,authenticated;
grant execute on function public.project_ai_available_people(uuid,uuid) to service_role;

-- Existing task/staffing writers retain their lifecycle, audit and notification rules.
create function public.auto_assign_project_task(p_root uuid,p_revision int,p_request uuid,p_lead uuid,p_people uuid[])
returns jsonb language plpgsql security definer set search_path='' as $$
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
  -- Existing accepted project guests keep their scoped access. New additions
  -- come from the Head's active Office directory, never arbitrary accounts.
  if not coalesce(eflow_r7.member(o.project_id,o.office_id,u),false) and not
    (eflow_r9.allowed(o.project_id,u,o.office_id) and exists(select 1 from public.profiles where id=u and org_id=o.office_id and is_active and role<>'admin')) then
   raise exception 'A selected person is no longer available for this project' using errcode='42501';end if;
 end loop;
 select coalesce(array_agg(distinct user_id),'{}'::uuid[]) into roster from public.project_office_members where project_office_id=o.id;
 select array_agg(distinct id) into roster from unnest(roster || array(select p.id from public.profiles p where p.id=any(people) and p.org_id=o.office_id)) id;
 perform public.phase6_set_members(o.id,roster);
 -- Any stale revision or staffing failure rolls back project enrollment too.
 perform eflow_r7.command(p_root,p_revision,p_request,'root_lead',payload);
 return public.r7_work_tree(p_root);
end $$;
revoke all on function public.auto_assign_project_task(uuid,int,uuid,uuid,uuid[]) from public,anon;
grant execute on function public.auto_assign_project_task(uuid,int,uuid,uuid,uuid[]) to authenticated;
