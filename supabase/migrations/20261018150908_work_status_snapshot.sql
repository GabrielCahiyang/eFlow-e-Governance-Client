-- Add display-only blocker state to the already authorized work snapshot.
-- The stored workflow status and all existing capability checks are unchanged.
CREATE OR REPLACE FUNCTION public.r7_work_tree(p_root uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $function$
DECLARE v jsonb;
BEGIN
  v := eflow_r7.snapshot(p_root);
  IF v->'root'->>'kind' <> 'office' THEN RETURN v; END IF;
  v := jsonb_set(v,'{root,blocker}',coalesce((
    SELECT to_jsonb(u.blocker) FROM public.task_progress_updates u
    WHERE u.task_id=p_root ORDER BY u.created_at DESC,u.id DESC LIMIT 1
  ),'null'::jsonb));
  RETURN jsonb_set(v,'{nodes}',coalesce((SELECT jsonb_agg(n || jsonb_build_object('blocker',(
    SELECT u.blocker FROM public.subtask_progress_updates u
    WHERE u.task_id=p_root AND u.subtask_id=(n->>'id')::uuid
    ORDER BY u.created_at DESC,u.id DESC LIMIT 1
  ))) FROM jsonb_array_elements(v->'nodes') n),'[]'::jsonb));
END;
$function$;
