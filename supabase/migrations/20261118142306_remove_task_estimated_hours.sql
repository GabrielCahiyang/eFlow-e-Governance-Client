-- PENDING / DESTRUCTIVE: permanently removes public.tasks.estimated_hours.
-- Prepared for ixnfphgjyelhckjwjkdv from its 2026-11-18 live definitions.
-- Release the compatible Web, Python gateway, and Mobile readers/writers together.
-- Older Mobile builds still use this column: do not apply until they are retired.
-- Back up task data first. Historical migrations, signed receipts, activity and
-- closed monthly snapshots are retained. No CASCADE and no privilege changes.
-- Use an isolated migration workspace populated from the latest hosted history.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';

do $remove_duration$
declare
 rules jsonb := '[
  {
    "identity": "eflow_work_edit.guard_details()",
    "fingerprint": "b434e56ca51d4338b5d482c125e6edc7",
    "changes": [
      [
        "''estimated_hours'',",
        ""
      ]
    ]
  },
  {
    "identity": "eflow_work_edit.record_task_details()",
    "fingerprint": "7965df8e58c57999e3f11898317897f4",
    "changes": [
      [
        "(''estimated_hours'',''Estimated hours'',7),",
        ""
      ]
    ]
  },
  {
    "identity": "eflow_r9.record_project_field_history()",
    "fingerprint": "d42a933955e3281d03e77c69b6eeb7dd",
    "changes": [
      [
        "''estimated_hours'',",
        ""
      ]
    ]
  },
  {
    "identity": "public.create_task_with_details(jsonb)",
    "fingerprint": "7fe86c5a7f96f0ddd90f2d1ab4098bfe",
    "changes": [
      [
        "barangay, estimated_hours, budget_impact",
        "barangay, budget_impact"
      ],
      [
        "    coalesce((p_payload ->> ''estimated_hours'')::numeric, 0),\n",
        ""
      ]
    ]
  },
  {
    "identity": "public.phase3_patch_task(uuid,jsonb)",
    "fingerprint": "67f1fef92652a8433ad276fa25a99097",
    "changes": [
      [
        "''estimated_hours'',",
        ""
      ],
      [
        " if p_patch ? ''estimated_hours'' and (coalesce((p_patch->>''estimated_hours'')::numeric,0)<0 or coalesce((p_patch->>''estimated_hours'')::numeric,0)>100000) then raise exception ''Effort must be between 0 and 100000 hours'' using errcode=''22023''; end if;\n",
        ""
      ],
      [
        "  estimated_hours=case when p_patch ? ''estimated_hours'' then coalesce((p_patch->>''estimated_hours'')::double precision,0) else estimated_hours end,\n",
        ""
      ]
    ]
  },
  {
    "identity": "public.recalculate_monthly_productivity(date,text)",
    "fingerprint": "011ce72450cf7a9154999201448de6fd",
    "changes": [
      [
        "      task.estimated_hours,\n",
        ""
      ],
      [
        "      null::numeric as estimated_hours,\n",
        ""
      ],
      [
        "case priority when ''high'' then 2.0 when ''medium'' then 1.5 else 1.0 end\n        * case when kind = ''task'' then least(3.0, greatest(0.75, coalesce(estimated_hours, 8) / 8.0)) else 1.0 end as effort_weight",
        "case priority when ''high'' then 2.0 when ''medium'' then 1.5 else 1.0 end as priority_weight"
      ],
      [
        "effort_weight * 10",
        "priority_weight * 10"
      ],
      [
        "round(least(10, coalesce(\n        avg(case when cycle_hours <= estimated_hours * 2 then 10 else 0 end)\n          filter (where kind = ''task'' and estimated_hours is not null),\n        0\n      ))::numeric, 2) as speed_score",
        "0::numeric as speed_score"
      ],
      [
        "''calculation_version'', ''v1''",
        "''calculation_version'', ''v2_without_duration''"
      ]
    ]
  },
  {
    "identity": "public.commit_collaboration_draft(uuid,uuid)",
    "fingerprint": "476c3d504794d48f1c6c605c9fe870e9",
    "changes": [
      [
        "percent_complete, estimated_hours,",
        "percent_complete,"
      ],
      [
        "          greatest(coalesce((task_item ->> ''estimatedHours'')::numeric, 0), 0),\n",
        ""
      ]
    ]
  },
  {
    "identity": "public.collaboration_revision_is_material(jsonb,jsonb)",
    "fingerprint": "6cb1d6ea45321257fb5bf2fa444ba444",
    "changes": [
      [
        "    ''estimatedHours'', coalesce((task ->> ''estimatedHours'')::numeric, 0),\n",
        ""
      ]
    ]
  },
  {
    "identity": "public.phase5_import_project_work(uuid,uuid,jsonb)",
    "fingerprint": "c103b4e31a5ca9d8a709c57f0e8aa5d6",
    "changes": [
      [
        "''estimatedHours'',",
        ""
      ],
      [
        "    or coalesce((t->>''estimatedHours'')::numeric,-1) not between 0 and 100000\n",
        ""
      ],
      [
        "Invalid reviewed task, effort, or Office responsibility",
        "Invalid reviewed task or Office responsibility"
      ],
      [
        ",''estimated_hours'',(t->>''estimatedHours'')::numeric",
        ""
      ]
    ]
  },
  {
    "identity": "public.phase6_guard_task()",
    "fingerprint": "bdb1eb30f648647da41ee85af4daf087",
    "changes": [
      [
        "''estimated_hours'',",
        ""
      ]
    ]
  },
  {
    "identity": "eflow_r9.edit_selected_project_task(uuid,jsonb)",
    "fingerprint": "3c475e1d5ab45d3057a413433bebfbe8",
    "changes": [
      [
        "''estimated_hours'',",
        ""
      ],
      [
        " if p_patch ? ''estimated_hours'' and (coalesce((p_patch->>''estimated_hours'')::numeric,0)<0 or coalesce((p_patch->>''estimated_hours'')::numeric,0)>100000) then raise exception ''Effort must be between 0 and 100000 hours'' using errcode=''22023''; end if;\n",
        ""
      ],
      [
        "  estimated_hours=case when p_patch ? ''estimated_hours'' then coalesce((p_patch->>''estimated_hours'')::double precision,0) else estimated_hours end,\n",
        ""
      ]
    ]
  },
  {
    "identity": "eflow_r7.command(uuid,integer,uuid,text,jsonb)",
    "fingerprint": "bdc1ac03af1848ce5f9be3871d93ff26",
    "changes": [
      [
        "(v_due is distinct from n.due_date or\n      (p_payload ? ''start'' and (p_payload->>''start'')::date is distinct from\n        (select s.start_date from public.subtasks s where s.id=v_id)))",
        "v_due is distinct from n.due_date"
      ],
      [
        "v_due is distinct from due_date or (p_payload ? ''start'' and (p_payload->>''start'')::date is distinct from start_date)",
        "v_due is distinct from due_date"
      ]
    ]
  }
]'::jsonb;
 rule jsonb; change jsonb; function_id oid; definition text;
 original_owner oid; original_acl aclitem[]; original_definer boolean; original_config text[];
begin
 -- Check every original body before changing anything. A changed hosted contract
 -- must be reviewed again rather than overwritten by an old migration.
 for rule in select value from jsonb_array_elements(rules) loop
  function_id:=to_regprocedure(rule->>'identity');
  if function_id is null or md5(replace(pg_get_functiondef(function_id), E'\r','')) is distinct from rule->>'fingerprint' then
   raise exception 'Hosted function changed; review removal migration: %',rule->>'identity';
  end if;
 end loop;
 for rule in select value from jsonb_array_elements(rules) loop
  function_id:=to_regprocedure(rule->>'identity');
  select proowner,proacl,prosecdef,proconfig into original_owner,original_acl,original_definer,original_config from pg_proc where oid=function_id;
  definition:=replace(pg_get_functiondef(function_id), E'\r','');
  for change in select value from jsonb_array_elements(rule->'changes') loop
   if strpos(definition,change->>0)=0 then raise exception 'Missing removal anchor: %',rule->>'identity';end if;
   definition:=replace(definition,change->>0,change->>1);
  end loop;
  if definition ~* 'estimated.?hours' then raise exception 'Duration reference remains: %',rule->>'identity';end if;
  execute definition;
  if exists(select 1 from pg_proc where oid=function_id and (proowner is distinct from original_owner or proacl is distinct from original_acl or prosecdef is distinct from original_definer or proconfig is distinct from original_config)) then
   raise exception 'Unexpected privilege change: %',rule->>'identity';
  end if;
 end loop;
end;
$remove_duration$;

-- RESTRICT is intentional: unexpected views or dependencies abort the transaction.
alter table public.tasks drop column estimated_hours restrict;

do $verify_duration_removal$
begin
 if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname in ('public','eflow_work_edit','eflow_r9','eflow_r7') and p.prokind='f' and p.prosrc ~* 'estimated.?hours') then
  raise exception 'Unreviewed duration reference remains; transaction rolled back';
 end if;
end;
$verify_duration_removal$;
commit;
