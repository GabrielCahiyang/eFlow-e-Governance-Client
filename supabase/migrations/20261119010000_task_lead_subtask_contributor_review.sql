-- Follow-up to 20261118152250_restrict_subtask_execution_to_assigned_team.sql.
-- Target: ixnfphgjyelhckjwjkdv. Prepared locally; apply separately after review.
-- A Task Lead explicitly assigned ONLY as a subtask contributor must propose
-- progress/completion through the existing independent reviewer resolver.
-- No self-review or direct-update fallback when no eligible reviewer exists.
-- Root Task Lead updates and appointed Subtask Lead direct updates are retained.
-- Preserves existing Personal/governed-work rules, private review application,
-- function owners, ACLs, SECURITY DEFINER and search_path. No schema/RLS changes.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';

do $task_lead_contributor_review$
declare
 rules jsonb := '[
  {
    "identity": "eflow_m7.work_reviewer(uuid,uuid,uuid,text)",
    "fingerprint": "6f414390a9e1aafb7f28474e26cb38c9",
    "changes": [
      [
        "  if n.id is null or p_author=t.assigned_to then return null; end if;",
        "  if n.id is null then return null; end if;"
      ]
    ]
  },
  {
    "identity": "eflow_m7.require_progress_authority(uuid,uuid)",
    "fingerprint": "7dc68366319bccb18a2ffdd69b7fb311",
    "changes": [
      [
        " if t.assigned_to is distinct from actor and n.lead_id is distinct from actor then",
        " if (p_node is null and t.assigned_to is distinct from actor)\n    or (p_node is not null and n.lead_id is distinct from actor) then"
      ]
    ]
  },
  {
    "identity": "eflow_evidence.guard_progress()",
    "fingerprint": "465463d989c57923be533a58003bfd62",
    "changes": [
      [
        "  if s.id is null or t.id is null or s.task_id is distinct from t.id or not (",
        "  -- A Task Lead assigned only as a contributor follows the review path,\n  -- including direct history writes. Reviewed application retains its private context.\n  if s.id is not null and t.id=s.task_id\n     and t.linked_project_id is not null and t.source_collaboration_draft_id is null\n     and t.assigned_to=auth.uid() and s.lead_id is distinct from auth.uid()\n     and coalesce(auth.uid()=any(coalesce(s.assigned_to_ids,''{}''::uuid[])),false) then\n    perform eflow_m7.require_progress_authority(t.id,s.id);\n  end if;\n  if s.id is null or t.id is null or s.task_id is distinct from t.id or not ("
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
   raise exception 'Hosted function changed; review Task Lead contributor migration: %',rule->>'identity';
  end if;
 end loop;
 for rule in select value from jsonb_array_elements(rules) loop
  function_id:=to_regprocedure(rule->>'identity');
  select proowner,proacl,prosecdef,proconfig into original_owner,original_acl,original_definer,original_config from pg_proc where oid=function_id;
  definition:=replace(pg_get_functiondef(function_id),E'\r','');
  for change in select value from jsonb_array_elements(rule->'changes') loop
   if strpos(definition,change->>0)=0 then raise exception 'Missing Task Lead contributor anchor: %',rule->>'identity';end if;
   definition:=replace(definition,change->>0,change->>1);
  end loop;
  execute definition;
  if exists(select 1 from pg_proc where oid=function_id and (proowner is distinct from original_owner or proacl is distinct from original_acl or prosecdef is distinct from original_definer or proconfig is distinct from original_config)) then
   raise exception 'Unexpected privilege change: %',rule->>'identity';
  end if;
 end loop;
end;
$task_lead_contributor_review$;
commit;
