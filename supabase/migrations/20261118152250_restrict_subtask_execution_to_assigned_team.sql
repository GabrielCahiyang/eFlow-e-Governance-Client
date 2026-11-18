-- PENDING: restrict Office subtask execution to its own appointed team.
-- Prepared from ixnfphgjyelhckjwjkdv on 2026-11-18. Not applied automatically.
-- A parent Task Lead/ancestor appointment alone does not grant execution.
-- Existing assigned-contributor Lead-review rules still apply. Independent Lead
-- decisions retain the private reviewed-application path; no new public bypass.
-- Root task progress, staffing, detail editing, finance, Personal work, historical
-- authorship, and existing migration timestamps are not changed.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
do $restrict_subtask_execution$
declare
 rules jsonb := '[
  {
    "identity": "eflow_r7.operation_capabilities(uuid,uuid)",
    "fingerprint": "ac410ba3c5e757c09c3acdae31706c5a",
    "changes": [
      [
        "   elsif action in (''execute'',''submit'') then\n    if not coalesce(manager,false)",
        "   elsif action in (''execute'',''submit'') then\n    if r->>''kind''=''office'' and not (\n     n.lead_id is not distinct from auth.uid() or coalesce(auth.uid()=any(coalesce(n.assigned_to_ids,''{}''::uuid[])),false)\n     or exists(select 1 from eflow_m7.applying_work_proposal a\n     join eflow_m7.work_proposals w on w.id=a.proposal_id\n     where a.tx=txid_current() and w.root_id=p_root and w.node_id=p_node\n       and w.reviewer_id=auth.uid() and w.state=''pending'')\n    ) then reason:=''branch_denied'';\n    elsif not coalesce(manager,false)"
      ]
    ]
  },
  {
    "identity": "eflow_evidence.guard_progress()",
    "fingerprint": "79d853688d519834d342ebce01c2d654",
    "changes": [
      [
        "  if s.id is null or t.id is null or s.task_id is distinct from t.id or not (",
        "  -- Also protect direct history INSERTs, not only the work-update RPC.\n  if s.id is not null and t.id=s.task_id and not (\n   s.lead_id is not distinct from auth.uid() or coalesce(auth.uid()=any(coalesce(s.assigned_to_ids,''{}''::uuid[])),false)\n   or exists(select 1 from eflow_m7.applying_work_proposal a\n     join eflow_m7.work_proposals w on w.id=a.proposal_id\n     where a.tx=txid_current() and w.root_id=t.id and w.node_id=s.id\n       and w.reviewer_id=auth.uid() and w.state=''pending'')\n  ) then raise exception ''Only this subtask lead or an assigned contributor may post work updates'' using errcode=''42501''; end if;\n  if s.id is null or t.id is null or s.task_id is distinct from t.id or not ("
      ]
    ]
  },
  {
    "identity": "eflow_m7.require_progress_authority(uuid,uuid)",
    "fingerprint": "e35fed903d6536ee5eed713caa91d823",
    "changes": [
      [
        " if t.linked_project_id is null or t.source_collaboration_draft_id is not null then return; end if;",
        " -- Direct updates require participation in this exact subtask. The private\n -- reviewed-application return above retains independent Lead decisions.\n if p_node is not null and not exists(select 1 from public.subtasks s\n  where s.id=p_node and s.task_id=p_root and\n   (s.lead_id=actor or actor=any(coalesce(s.assigned_to_ids,''{}''::uuid[])))) then\n  raise exception ''Only this subtask lead or an assigned contributor may post work updates'' using errcode=''42501'';\n end if;\n if t.linked_project_id is null or t.source_collaboration_draft_id is not null then return; end if;"
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
   raise exception 'Hosted function changed; review subtask participation migration: %',rule->>'identity';
  end if;
 end loop;
 for rule in select value from jsonb_array_elements(rules) loop
  function_id:=to_regprocedure(rule->>'identity');
  select proowner,proacl,prosecdef,proconfig into original_owner,original_acl,original_definer,original_config from pg_proc where oid=function_id;
  definition:=replace(pg_get_functiondef(function_id),E'\r','');
  for change in select value from jsonb_array_elements(rule->'changes') loop
   if strpos(definition,change->>0)=0 then raise exception 'Missing subtask participation anchor: %',rule->>'identity';end if;
   definition:=replace(definition,change->>0,change->>1);
  end loop;
  execute definition;
  if exists(select 1 from pg_proc where oid=function_id and (proowner is distinct from original_owner or proacl is distinct from original_acl or prosecdef is distinct from original_definer or proconfig is distinct from original_config)) then
   raise exception 'Unexpected privilege change: %',rule->>'identity';
  end if;
 end loop;
end;
$restrict_subtask_execution$;
commit;
