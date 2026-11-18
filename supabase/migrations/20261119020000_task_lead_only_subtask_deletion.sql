-- Office subtask deletion belongs only to the appointed root Task Lead.
-- Follow-up after 20261118152250 and 20261119010000; target ixnfphgjyelhckjwjkdv.
-- Prepared locally; NOT applied. Expected bodies come from captured capability
-- evidence plus the repository's latest fast-capability / node-guard migration.
-- Fingerprint drift aborts: inspect live definitions rather than removing checks.
-- Preserve edit authority, exact-node execution/review, Personal work, history,
-- evidence/finance restrictions, owners, ACLs, SECURITY DEFINER and search paths.
-- The node trigger also checks internal/versioned command deletions.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';

do $task_lead_subtask_deletion$
declare
 rules jsonb := '[
  {
    "identity": "eflow_r7.operation_capabilities(uuid,uuid)",
    "fingerprint": "ee24e7b228f6b3bb2461d1d689749048",
    "changes": [
      [
        "   elsif action=''appoint_lead'' then",
        "   elsif p_node is not null and action=''delete'' and r->>''kind''=''office'' and (r->>''lead'')::uuid is distinct from auth.uid() then\n    reason := ''branch_denied'';\n   elsif p_node is not null and action=''delete'' and r->>''kind''=''office'' and exists(\n    with recursive below as (select id from public.subtasks where id=p_node and task_id=p_root\n     union all select c.id from public.subtasks c join below b on c.parent_subtask_id=b.id where c.task_id=p_root)\n    select 1 from public.subtasks s join below b on s.id=b.id where s.started_at is not null\n   ) then reason := ''lifecycle_blocked'';\n   elsif action=''appoint_lead'' then"
      ]
    ]
  },
  {
    "identity": "eflow_r7.node_capabilities_fast(uuid,uuid,jsonb,boolean,boolean,boolean,boolean,boolean,boolean,uuid[],text,boolean)",
    "fingerprint": "7bd90368ca8c41460fc5cd8235d09e86",
    "changes": [
      [
        "      elsif action = ''appoint_lead'' then",
        "      elsif action = ''delete'' and v_kind = ''office'' and v_root_lead is distinct from v_uid then\n        reason := ''branch_denied'';\n      elsif action = ''delete'' and v_kind = ''office'' and exists(\n        select 1 from public.subtasks s where s.id=any(v_subtree_ids) and s.started_at is not null\n      ) then\n        reason := ''lifecycle_blocked'';\n      elsif action = ''appoint_lead'' then"
      ]
    ]
  },
  {
    "identity": "eflow_r7.guard_node()",
    "fingerprint": "e5b4cc91e56e4543babbe855d08a06cc",
    "changes": [
      [
        " if tg_op=''DELETE'' then\n",
        " if tg_op=''DELETE'' then\n  -- Applies to direct DELETE and internal/versioned command execution alike.\n  if tg_table_name=''subtasks'' and r->>''kind''=''office'' and auth.uid() is not null\n     and (r->>''lead'')::uuid is distinct from auth.uid() then\n   raise exception ''Only the Task Lead can delete this subtask'' using errcode=''42501'';\n  end if;\n"
      ],
      [
        "  if old.status<>''todo'' or old.percent_complete<>0 then raise exception ''Started work and history cannot be deleted'';end if;",
        "  if old.status<>''todo'' or old.percent_complete<>0\n     or (tg_table_name=''subtasks'' and nullif(to_jsonb(old)->>''started_at'','''') is not null)\n  then raise exception ''Started work and history cannot be deleted'';end if;"
      ]
    ]
  }
]'::jsonb;
 rule jsonb; change jsonb; function_id oid; definition text;
 original_owner oid; original_acl aclitem[]; original_definer boolean; original_config text[];
begin
 for rule in select value from jsonb_array_elements(rules) loop
  function_id:=to_regprocedure(rule->>'identity');
  if function_id is null or md5(replace(pg_get_functiondef(function_id),E'\r','')) is distinct from rule->>'fingerprint' then
   raise exception 'Hosted function changed; review Task Lead deletion migration: %',rule->>'identity';
  end if;
 end loop;
 for rule in select value from jsonb_array_elements(rules) loop
  function_id:=to_regprocedure(rule->>'identity');
  select proowner,proacl,prosecdef,proconfig into original_owner,original_acl,original_definer,original_config from pg_proc where oid=function_id;
  definition:=replace(pg_get_functiondef(function_id),E'\r','');
  for change in select value from jsonb_array_elements(rule->'changes') loop
   if strpos(definition,change->>0)=0 then raise exception 'Missing Task Lead deletion anchor: %',rule->>'identity';end if;
   definition:=replace(definition,change->>0,change->>1);
  end loop;
  execute definition;
  if exists(select 1 from pg_proc where oid=function_id and (proowner is distinct from original_owner or proacl is distinct from original_acl or prosecdef is distinct from original_definer or proconfig is distinct from original_config)) then
   raise exception 'Unexpected privilege change: %',rule->>'identity';
  end if;
 end loop;
end;
$task_lead_subtask_deletion$;
commit;
