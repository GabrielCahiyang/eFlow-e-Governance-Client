-- NW5.5: authorized additive date impact; no lifecycle/authority exception.
begin;
set local lock_timeout='10s';

-- Called only from the authorized preview under its existing impact lock.
-- Expose schedule facts and aggregate history counts, never evidence/finance rows.
create or replace function eflow_r7.date_impact(p_root uuid,p_payload jsonb) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare target uuid:=(p_payload->>'id')::uuid;ids uuid[];n eflow_r7.nodes;a eflow_r7.nodes;
 r jsonb:=eflow_r7.root(p_root);old_due date;new_due date:=(p_payload->>'due')::date;
 root_due date:=(r->>'due')::date;ancestor_due date;old_bound date;new_bound date;
 cursor_id uuid;facts jsonb;items jsonb:='[]';material boolean:=false;bound_changed boolean;
begin
 ids:=eflow_r7.subtree_ids(p_root,target);
 select due_date into old_due from eflow_r7.nodes where id=target and task_id=p_root;
 if old_due is not distinct from new_due then
  return jsonb_build_object('requires_date_confirmation',false,'date_impact',jsonb_build_object('old_due',old_due,'new_due',new_due,'items','[]'::jsonb));
 end if;
 select parent_subtask_id into cursor_id from eflow_r7.nodes where id=target and task_id=p_root;
 ancestor_due:=root_due;
 while cursor_id is not null loop
  select * into a from eflow_r7.nodes where id=cursor_id and task_id=p_root;
  ancestor_due:=least(ancestor_due,a.due_date);cursor_id:=a.parent_subtask_id;
 end loop;
 -- Match existing canonical write constraints. Confirmation never overrides them.
 if new_due>ancestor_due then raise exception 'Child deadline cannot exceed an ancestor deadline' using errcode='23514';end if;
 if exists(select 1 from eflow_r7.nodes where task_id=p_root and id=any(ids) and id<>target and due_date>new_due) then
  raise exception 'Edit descendant dates before shortening this deadline' using errcode='23514';
 end if;
 for n in select * from eflow_r7.nodes where task_id=p_root and id=any(ids) order by id loop
  old_bound:=root_due;new_bound:=root_due;cursor_id:=n.id;
  while cursor_id is not null loop
   select * into a from eflow_r7.nodes where id=cursor_id and task_id=p_root;
   old_bound:=least(old_bound,a.due_date);
   new_bound:=least(new_bound,case when a.id=target then new_due else a.due_date end);
   cursor_id:=a.parent_subtask_id;
  end loop;
  facts:=eflow_r7.history_facts(p_root,array[n.id]);
  bound_changed:=n.id<>target and old_bound is distinct from new_bound;
  -- A changed inherited bound affects a child with no own deadline. Children
  -- whose earlier own deadline still governs do not alone make an edit material.
  -- Recorded work/commitments in this schedule scope also require review.
  material:=material or bound_changed or not (facts->>'untouched')::boolean;
  if n.id=target or bound_changed or not (facts->>'untouched')::boolean then
   items:=items||jsonb_build_array(jsonb_build_object('id',n.id,'path',eflow_r7.work_path(p_root,n.id),
    'old_bound',old_bound,'new_bound',new_bound,'bound_changed',bound_changed,'history_counts',facts->'counts'));
  end if;
 end loop;
 return jsonb_build_object('requires_date_confirmation',material,'date_impact',jsonb_build_object('old_due',old_due,'new_due',new_due,'items',items));
end $$;
revoke all on function eflow_r7.date_impact(uuid,jsonb) from public,anon,authenticated,service_role;

-- Keep the existing RPC signatures, authorization, locks, opaque fingerprint,
-- denied-branch redaction and checked transaction/receipt logic byte-for-byte.
do $$declare definition text;changed text;begin
 select pg_catalog.pg_get_functiondef('eflow_r7.work_impact(uuid,integer,text,jsonb)'::regprocedure) into definition;
 if definition like '%date_impact jsonb:=''{}'';%' then return;end if;
 changed:=replace(definition,'allowed boolean;','allowed boolean;date_impact jsonb:=''{}'';');
 changed:=replace(changed,'impact:=eflow_r7.operation_impact(p_root,p_command,p_payload);',
  'impact:=eflow_r7.operation_impact(p_root,p_command,p_payload); if p_command=''edit'' and p_payload ? ''due'' then date_impact:=eflow_r7.date_impact(p_root,p_payload);end if;');
 changed:=replace(changed,'return jsonb_build_object(''root_id'',p_root,','return date_impact||jsonb_build_object(''root_id'',p_root,');
 if changed=definition or changed not like '%date_impact jsonb%' or changed not like '%return date_impact||%' then
  raise exception 'Unexpected NW5.2 preview body; inspect before extending';
 end if;
 execute changed;
end $$;
commit;
