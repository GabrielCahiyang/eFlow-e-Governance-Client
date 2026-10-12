-- NW5.2: additional checked confirmation; existing R7/R9 authority, finance,
-- evidence and historical authorship contracts remain authoritative.
begin;
set local lock_timeout='10s';

-- Resolve all canonical and historical fallback links. No caller-controlled
-- relation names or dynamic lookup paths are accepted by this resolver.
create or replace function eflow_r7.history_roots(p_row jsonb) returns uuid[]
language sql stable security definer set search_path='' as $$
 with links as (
  select nullif(p_row->>'task_id','')::uuid id
  union select nullif(p_row->>'root_id','')::uuid
  union select task_id from public.subtasks where id=nullif(p_row->>'subtask_id','')::uuid
  union select task_id from public.subtask_submissions where id=nullif(p_row->>'submission_id','')::uuid
  union select task_id from public.task_submissions where id=nullif(p_row->>'submission_id','')::uuid
  union select task_id from public.work_budget_allocations where id=nullif(p_row->>'allocation_id','')::uuid
  union select a.task_id from public.work_budget_allocation_lines l join public.work_budget_allocations a on a.id=l.allocation_id
   where l.id=any(array[nullif(p_row->>'allocation_line_id','')::uuid,nullif(p_row->>'parent_allocation_line_id','')::uuid])
  union select c.task_id from public.petty_cash_requests c where c.id=any(array[nullif(p_row->>'request_id','')::uuid,nullif(p_row->>'petty_cash_request_id','')::uuid])
  union select a.task_id from public.petty_cash_requests c join public.work_budget_allocations a on a.id=c.allocation_id
   where c.id=any(array[nullif(p_row->>'request_id','')::uuid,nullif(p_row->>'petty_cash_request_id','')::uuid])
  union select c.task_id from public.petty_cash_liquidations l join public.petty_cash_requests c on c.id=l.request_id
   where l.id=nullif(p_row->>'liquidation_id','')::uuid
  union select c.task_id from public.petty_cash_receipts r join public.petty_cash_liquidations l on l.id=r.liquidation_id
   join public.petty_cash_requests c on c.id=l.request_id where r.id=nullif(p_row->>'receipt_id','')::uuid
 ) select coalesce(array_agg(distinct id order by id) filter(where id is not null),'{}'::uuid[]) from links
$$;

-- Advisory precedes explicit project/completion/root/node row locks in RPCs.
-- The real completion-version write also rejects old repeatable-read snapshots.
create or replace function eflow_r7.lock_impact(p_root uuid) returns void
language plpgsql security definer set search_path='' as $$
declare r jsonb:=eflow_r7.root(p_root);pid uuid;
begin
 if r is null then return;end if;pid:=(r->>'project')::uuid;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('r9:'||pid::text,0));
 perform 1 from public.projects where id=pid for update;
 perform 1 from public.personal_projects where id=pid for update;
 perform eflow_r7.lock_completion(p_root);
 perform 1 from public.tasks where id=p_root for update;
 perform 1 from public.personal_tasks where id=p_root for update;
 perform 1 from public.subtasks where task_id=p_root order by id for update;
 perform 1 from public.personal_subtasks where task_id=p_root order by id for update;
end $$;

create or replace function eflow_r7.serialize_history() returns trigger
language plpgsql security definer set search_path='' as $$
declare roots uuid[]:='{}';root_id uuid;r jsonb;row_data jsonb;
begin
 if tg_op<>'INSERT' then roots:=roots||eflow_r7.history_roots(to_jsonb(old));end if;
 if tg_op<>'DELETE' then roots:=roots||eflow_r7.history_roots(to_jsonb(new));end if;
 -- Direct writes already hold their target tuple when a row trigger runs.
 -- Take the advisory and real version lock without acquiring unrelated nodes:
 -- opposite tuple/advisory order may abort with a deadlock, never bypass safety.
 for root_id in select distinct x from unnest(roots) x order by x loop
  r:=eflow_r7.root(root_id);
  if r is not null then
   perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('r9:'||(r->>'project'),0));
   perform eflow_r7.lock_completion(root_id);
  end if;
 end loop;
 if tg_op='DELETE' then return old;else return new;end if;
end $$;

-- BEFORE guards, including evidence sealing and AFTER financial audit producers.
-- No policies/permissions/financial or evidence validation are replaced.
do $$declare rel text;begin
 foreach rel in array array[
 'public.subtask_progress_updates','public.subtask_submissions','public.subtask_submission_attachments',
 'public.task_submissions','public.task_attachments','eflow_evidence.attempts','eflow_evidence.objects',
 'public.work_budget_allocations','public.work_budget_allocation_lines','public.petty_cash_requests',
 'public.petty_cash_request_lines','public.petty_cash_releases','public.petty_cash_liquidations','public.petty_cash_receipts',
 'public.petty_cash_receipt_items','public.petty_cash_request_attachments','public.budget_ledger_entries','public.work_tree_events'
 ] loop
  if pg_catalog.to_regclass(rel) is null then raise exception 'Required NW5.2 writer relation missing: %',rel;end if;
  execute pg_catalog.format('drop trigger if exists a_nw52_history_serialization on %s',rel);
  execute pg_catalog.format('create trigger a_nw52_history_serialization before insert or update or delete on %s for each row execute function eflow_r7.serialize_history()',rel);
 end loop;
end $$;

-- Fingerprint rows stay private. Conservatively include the entire root's
-- current topology and root-linked history: independent sibling history may
-- require another preview, but does not become a branch eligibility blocker.
create or replace function eflow_r7.impact_fingerprint(p_root uuid,p_command text,p_payload jsonb,p_impact jsonb)
returns text language plpgsql security definer set search_path='' as $$
declare facts jsonb;history jsonb:='{}';rel text;rows jsonb;
begin
 facts:=jsonb_build_object('root',eflow_r7.root(p_root),'nodes',(select coalesce(jsonb_agg(to_jsonb(n) order by id),'[]') from eflow_r7.nodes n where task_id=p_root),
  'office_root',(select to_jsonb(t) from public.tasks t where id=p_root),'personal_root',(select to_jsonb(t) from public.personal_tasks t where id=p_root),
  'office_nodes',(select coalesce(jsonb_agg(to_jsonb(n) order by id),'[]') from public.subtasks n where task_id=p_root),
  'personal_nodes',(select coalesce(jsonb_agg(to_jsonb(n) order by id),'[]') from public.personal_subtasks n where task_id=p_root),
  'snapshot',eflow_r7.snapshot(p_root),'impact',p_impact,'command',p_command,'payload',p_payload);
 foreach rel in array array[
 'public.subtask_progress_updates','public.subtask_submissions','public.subtask_submission_attachments',
 'public.task_submissions','public.task_attachments','eflow_evidence.attempts','eflow_evidence.objects',
 'public.work_budget_allocations','public.work_budget_allocation_lines','public.petty_cash_requests',
 'public.petty_cash_request_lines','public.petty_cash_releases','public.petty_cash_liquidations','public.petty_cash_receipts',
 'public.petty_cash_receipt_items','public.petty_cash_request_attachments','public.budget_ledger_entries','public.work_tree_events'
 ] loop
  execute pg_catalog.format('select coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text),''[]''::jsonb) from %s x where $1=any(eflow_r7.history_roots(to_jsonb(x)))',rel) into rows using p_root;
  history:=history||jsonb_build_object(rel,rows);
 end loop;
 return pg_catalog.encode(extensions.digest((facts||jsonb_build_object('history',history))::text,'sha256'),'hex');
end $$;

create or replace function eflow_r7.work_path(p_root uuid,p_node uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb:='[]';n eflow_r7.nodes;depth integer:=0;
begin
 while p_node is not null loop
  select * into n from eflow_r7.nodes where id=p_node and task_id=p_root;
  if not found or depth>=8 then raise exception 'Choose a valid path in this root' using errcode='23514';end if;
  result:=jsonb_build_array(n.title)||result;p_node:=n.parent_subtask_id;depth:=depth+1;
 end loop;return result;
end $$;

create or replace function eflow_r7.work_impact(p_root uuid,p_revision integer,p_command text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r jsonb;current_revision integer;impact jsonb;snapshot jsonb;cap jsonb;codes jsonb:='[]';
 target uuid;parent uuid;action text;before_path jsonb:='[]';after_path jsonb:='[]';allowed boolean;
begin
 perform eflow_r3.actor();
 if not coalesce(eflow_r7.read_root(p_root),false) then raise exception 'Work access denied' using errcode='42501';end if;
 perform eflow_r7.lock_impact(p_root);
 if not coalesce(eflow_r7.read_root(p_root),false) then raise exception 'Work access denied' using errcode='42501';end if;
 if p_command not in ('create','staff','edit','move','delete','order','contributors','root_lead','progress','submit','review') or p_command is null
  or p_payload is null or jsonb_typeof(p_payload)<>'object' or exists(select 1 from jsonb_object_keys(p_payload) k where k not in ('id','parent','lead','people','title','due','standalone','order','note','progress','approve')) then
  raise exception 'Invalid work command or payload' using errcode='22023';end if;
 target:=nullif(p_payload->>'id','')::uuid;parent:=nullif(p_payload->>'parent','')::uuid;
 r:=eflow_r7.root(p_root);snapshot:=eflow_r7.snapshot(p_root);current_revision:=(snapshot->>'revision')::integer;
 if p_revision is null or p_revision<>current_revision then raise exception 'Work changed; reload and review the impact again' using errcode='40001';end if;
 action:=case p_command when 'create' then 'create_child' when 'order' then 'order_children' when 'root_lead' then 'appoint_lead'
  when 'contributors' then 'manage_contributors' when 'staff' then case when (p_payload->>'lead')::uuid is distinct from (select lead_id from eflow_r7.nodes where id=target and task_id=p_root) then 'appoint_lead' else 'manage_contributors' end
  when 'edit' then 'edit_details' when 'progress' then 'execute' else p_command end;
 if p_command in ('root_lead','contributors') or p_command in ('create','order') and parent is null then cap:=snapshot->'root'->'capabilities'->action;
 else select x->'capabilities'->action into cap from jsonb_array_elements(snapshot->'nodes') x where x->>'id'=coalesce(case when p_command in ('create','order') then parent else target end::text,'');end if;
 allowed:=coalesce((cap->>'allowed')::boolean,false);
 if p_command in ('progress','submit','review') and r->>'kind'<>'personal' then allowed:=false;cap:=jsonb_build_object('reason_code','branch_denied');end if;
 if not allowed then codes:=jsonb_build_array(coalesce(cap->>'reason_code','branch_denied'));end if;
 -- Do not collect private history or paths on an unauthorized branch/action.
 if allowed then
  impact:=eflow_r7.operation_impact(p_root,p_command,p_payload);
  if not (impact->>'allowed')::boolean then allowed:=false;codes:=jsonb_build_array(case when impact->'blocker_codes' ? 'lifecycle_blocked' then 'lifecycle_blocked' else 'history_blocked' end);end if;
  if p_command='move' and not eflow_r7.manage(p_root,parent) then allowed:=false;codes:=jsonb_build_array('branch_denied');end if;
  if target is not null and p_command<>'create' then before_path:=eflow_r7.work_path(p_root,target);end if;
  after_path:=case when p_command='delete' then '[]'::jsonb when p_command in ('move','create') then eflow_r7.work_path(p_root,parent)||jsonb_build_array(coalesce(p_payload->>'title',(select title from eflow_r7.nodes where id=target and task_id=p_root),'New subitem')) else before_path end;
 end if;
 return jsonb_build_object('root_id',p_root,'expected_revision',p_revision,'current_revision',current_revision,'command',p_command,'allowed',allowed,'blocker_codes',codes,
  'selected_count',coalesce((impact->>'selected_count')::integer,0),'descendant_count',coalesce((impact->>'descendant_count')::integer,0),
  'affected_appointment_count',coalesce((impact->>'affected_appointment_count')::integer,0),'before_path',before_path,'after_path',after_path,
  'fingerprint',case when impact is null then pg_catalog.md5(jsonb_build_object('root',p_root,'actor',auth.uid(),'revision',current_revision,'command',p_command,'payload',p_payload,'codes',codes)::text)
   else eflow_r7.impact_fingerprint(p_root,p_command,p_payload,impact) end);
end $$;

create or replace function eflow_r7.checked_command(p_root uuid,p_revision integer,p_request uuid,p_command text,p_payload jsonb,p_impact_fingerprint text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare receipt eflow_r7.receipts;impact jsonb;terms jsonb;
begin
 perform eflow_r3.actor();
 if not coalesce(eflow_r7.read_root(p_root),false) then raise exception 'Work access denied' using errcode='42501';end if;
 if p_request is null then raise exception 'Work request identity required' using errcode='22023';end if;
 perform eflow_r7.lock_impact(p_root);
 if not coalesce(eflow_r7.read_root(p_root),false) then raise exception 'Work access denied' using errcode='42501';end if;
 terms:=jsonb_build_object('command',p_command,'payload',p_payload);
 select * into receipt from eflow_r7.receipts where actor_id=auth.uid() and request_id=p_request;
 if found then
  if receipt.root_id<>p_root or receipt.payload<>terms then raise exception 'Request identity already used for different work' using errcode='23505';end if;
  return eflow_r7.snapshot(p_root);
 end if;
 impact:=eflow_r7.work_impact(p_root,p_revision,p_command,p_payload);
 if p_impact_fingerprint is null or p_impact_fingerprint is distinct from impact->>'fingerprint' then
  raise exception 'Work impact changed; reload and review affected work before confirming again' using errcode='40001';end if;
 if not (impact->>'allowed')::boolean then raise exception 'This work operation is blocked: %; resolve affected work first',impact->'blocker_codes' using errcode='42501';end if;
 return eflow_r7.command(p_root,p_revision,p_request,p_command,p_payload);
end $$;

create or replace function public.nw_work_impact(p_root uuid,p_revision integer,p_command text,p_payload jsonb) returns jsonb
language sql security invoker set search_path='' as $$select eflow_r7.work_impact(p_root,p_revision,p_command,p_payload)$$;
create or replace function public.nw_work_command(p_root uuid,p_revision integer,p_request uuid,p_command text,p_payload jsonb,p_impact_fingerprint text) returns jsonb
language sql security invoker set search_path='' as $$select eflow_r7.checked_command(p_root,p_revision,p_request,p_command,p_payload,p_impact_fingerprint)$$;

revoke all on function eflow_r7.history_roots(jsonb),eflow_r7.lock_impact(uuid),eflow_r7.serialize_history(),
 eflow_r7.impact_fingerprint(uuid,text,jsonb,jsonb),eflow_r7.work_path(uuid,uuid),eflow_r7.work_impact(uuid,integer,text,jsonb),
 eflow_r7.checked_command(uuid,integer,uuid,text,jsonb,text),public.nw_work_impact(uuid,integer,text,jsonb),
 public.nw_work_command(uuid,integer,uuid,text,jsonb,text) from public,anon,authenticated,service_role;
grant execute on function eflow_r7.work_impact(uuid,integer,text,jsonb),eflow_r7.checked_command(uuid,integer,uuid,text,jsonb,text),
 public.nw_work_impact(uuid,integer,text,jsonb),public.nw_work_command(uuid,integer,uuid,text,jsonb,text) to authenticated;

-- Writer preambles are appended below. Migration remains atomic.

do $$declare entry record;definition text;changed text;begin
 for entry in select * from (values
 ('eflow_r7.command(uuid,integer,uuid,text,jsonb)','perform eflow_r3.actor(); if not coalesce(eflow_r7.read_root(p_root),false) then raise exception ''Work access denied'' using errcode=''42501'';end if; perform eflow_r7.lock_impact(p_root);'),
 ('save_subtask_progress(uuid,integer,text,text,text,text,text,text)','perform eflow_r7.lock_impact((select task_id from public.subtasks where id=p_subtask_id));'),
 ('submit_subtask_for_review(uuid,jsonb)','perform eflow_r7.lock_impact((select task_id from public.subtasks where id=p_subtask_id));'),
 ('decide_subtask_review(uuid,boolean,text)','perform eflow_r7.lock_impact((select task_id from public.subtasks where id=p_subtask_id));'),
 ('submit_task_for_review(uuid,jsonb)','perform eflow_r7.lock_impact(p_task_id);'),
 ('decide_task_review(uuid,boolean,text,text)','perform eflow_r7.lock_impact(p_task_id);'),
 ('create_subtask_budget_allocation(uuid,uuid,uuid,numeric,text)','perform eflow_r7.lock_impact(p_task_id);'),
 ('set_subtask_budget_cap(uuid,uuid,uuid,numeric,text,uuid)','perform eflow_r7.lock_impact(p_task_id);'),
 ('create_work_budget_allocation(uuid,uuid,numeric,text)','perform eflow_r7.lock_impact(p_task_id);'),
 ('create_contextual_cash_request(uuid,uuid,uuid,numeric,text,date,uuid)','perform eflow_r7.lock_impact(p_task_id);'),
 ('eflow_budget.fund_work(uuid,integer,jsonb,text,uuid)','perform eflow_r7.lock_impact(p_task_id);'),
 ('eflow_budget.cash_request_v2(uuid,uuid,jsonb,text,date,uuid,uuid)','perform eflow_r7.lock_impact(p_task);'),
 ('eflow_budget.submit_items(uuid,numeric,text,jsonb,uuid,text,date)','perform eflow_r7.lock_impact((select task_id from public.petty_cash_requests where id=p_request));'),
 ('eflow_budget.legacy_resubmit_cash(uuid,uuid,numeric,text,date)','perform eflow_r7.lock_impact((select task_id from public.petty_cash_requests where id=p_request_id));'),
 ('resubmit_contextual_cash_request(uuid,uuid,numeric,text,date)','perform eflow_r7.lock_impact((select task_id from public.petty_cash_requests where id=p_request_id));'),
 ('cancel_contextual_cash_request(uuid,text)','perform eflow_r7.lock_impact((select task_id from public.petty_cash_requests where id=p_request_id));'),
 ('decide_petty_cash_leader_review(uuid,boolean,text)','perform eflow_r7.lock_impact((select task_id from public.petty_cash_requests where id=p_request_id));'),
 ('decide_petty_cash_request(uuid,boolean,text)','perform eflow_r7.lock_impact((select task_id from public.petty_cash_requests where id=p_request_id));'),
 ('schedule_petty_cash_releases(uuid,uuid)','perform eflow_r7.lock_impact((select task_id from public.petty_cash_requests where id=p_request_id));'),
 ('add_cash_request_attachment(uuid,text,text,text,bigint)','perform eflow_r7.lock_impact((select task_id from public.petty_cash_requests where id=p_request_id));'),
 ('submit_contextual_cash_liquidation(uuid,numeric,text,jsonb,uuid)','perform eflow_r7.lock_impact((select task_id from public.petty_cash_requests where id=p_request_id));'),
 ('submit_accounting_cash_liquidation(uuid,numeric,text,jsonb,uuid,text,date)','perform eflow_r7.lock_impact((select task_id from public.petty_cash_requests where id=p_request_id));'),
 ('submit_petty_cash_liquidation(uuid,numeric,text,jsonb)','perform eflow_r7.lock_impact((select task_id from public.petty_cash_requests where id=p_request_id));'),
 ('create_petty_cash_request(uuid,numeric,text,date)','perform eflow_r7.lock_impact((select task_id from public.work_budget_allocations where id=p_allocation_id));'),
 ('create_petty_cash_request(uuid,numeric,text,date,uuid)','perform eflow_r7.lock_impact((select task_id from public.work_budget_allocations where id=p_allocation_id));'),
 ('decide_work_budget_allocation(uuid,boolean,text)','perform eflow_r7.lock_impact((select task_id from public.work_budget_allocations where id=p_allocation_id));'),
 ('delete_subtask_budget_allocation(uuid)','perform eflow_r7.lock_impact((select task_id from public.work_budget_allocations where id=p_allocation_id));'),
 ('remove_subtask_budget_cap(uuid,text,uuid)','perform eflow_r7.lock_impact((select task_id from public.work_budget_allocations where id=p_cap_allocation_id));'),
 ('record_petty_cash_release_internal(uuid,text)','perform eflow_r7.lock_impact((select c.task_id from public.petty_cash_releases r join public.petty_cash_requests c on c.id=r.request_id where r.id=p_release_id));'),
 ('acknowledge_petty_cash_release(uuid)','perform eflow_r7.lock_impact((select c.task_id from public.petty_cash_releases r join public.petty_cash_requests c on c.id=r.request_id where r.id=p_release_id));'),
 ('record_accounting_petty_cash_release(uuid,text,text)','perform eflow_r7.lock_impact((select c.task_id from public.petty_cash_releases r join public.petty_cash_requests c on c.id=r.request_id where r.id=p_release_id));'),
 ('override_accounting_petty_cash_release_schedule(uuid,text,text,text)','perform eflow_r7.lock_impact((select c.task_id from public.petty_cash_releases r join public.petty_cash_requests c on c.id=r.request_id where r.id=p_release_id));'),
 ('decide_petty_cash_liquidation(uuid,boolean,text)','perform eflow_r7.lock_impact((select c.task_id from public.petty_cash_liquidations l join public.petty_cash_requests c on c.id=l.request_id where l.id=p_liquidation_id));'),
 ('decide_petty_cash_liquidation_leader_review(uuid,boolean,text)','perform eflow_r7.lock_impact((select c.task_id from public.petty_cash_liquidations l join public.petty_cash_requests c on c.id=l.request_id where l.id=p_liquidation_id));'),
 ('settle_accounting_liquidation(uuid,boolean,text)','perform eflow_r7.lock_impact((select c.task_id from public.petty_cash_liquidations l join public.petty_cash_requests c on c.id=l.request_id where l.id=p_liquidation_id));'),
 ('eflow_evidence.seal_file(text,uuid,uuid,text,text,uuid)','perform eflow_r7.lock_impact(p_task);'),
 ('claim_task_evidence_cleanup(text,text)','perform eflow_r7.lock_impact((select task_id from eflow_evidence.path_context(p_object_name)));')
 ) as patches(signature,preamble) loop
  if pg_catalog.to_regprocedure(entry.signature) is null then raise exception 'Required NW5.2 writer missing: %',entry.signature;end if;
  select pg_catalog.pg_get_functiondef(pg_catalog.to_regprocedure(entry.signature)) into definition;
  changed:=pg_catalog.regexp_replace(definition,'\mbegin\M','begin /* NW5.2 shared writer lock */ '||entry.preamble,'i');
  if definition like '%NW5.2 shared writer lock%' then continue;end if;
  if changed=definition then raise exception 'Unexpected NW5.2 writer body: %',entry.signature;end if;
  execute changed;
 end loop;
end $$;
commit;
