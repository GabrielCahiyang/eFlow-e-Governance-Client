SET lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.r7_work_tree(p_root uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
 SET statement_timeout TO '15s'
AS $function$
declare
  v jsonb;
begin
  v := eflow_r7.snapshot(p_root);
  if v->'root'->>'kind' <> 'office' then
    return v;
  end if;

  v := jsonb_set(v, '{root,blocker}', coalesce((
    select to_jsonb(u.blocker)
    from public.task_progress_updates u
    where u.task_id = p_root
    order by u.created_at desc, u.id desc limit 1
  ), 'null'::jsonb));

  if jsonb_array_length(v->'nodes') = 0 then
    return v;
  end if;

  return jsonb_set(v, '{nodes}', coalesce((
    with latest_blockers as (
      select distinct on (u.subtask_id) u.subtask_id, u.blocker
      from public.subtask_progress_updates u
      where u.task_id = p_root
      order by u.subtask_id, u.created_at desc, u.id desc
    )
    select jsonb_agg(
      n.value || jsonb_build_object(
        'blocker', lb.blocker,
        'custom_status_id', s.custom_status_id
      )
      order by n.ordinality
    )
    from jsonb_array_elements(v->'nodes') with ordinality n(value, ordinality)
    left join public.subtasks s on s.task_id = p_root and s.id = (n.value->>'id')::uuid
    left join latest_blockers lb on lb.subtask_id = s.id
  ), '[]'::jsonb));
end;
$function$;

RESET lock_timeout;
