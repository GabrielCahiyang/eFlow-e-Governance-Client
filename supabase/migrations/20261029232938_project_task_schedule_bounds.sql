-- Project dates contain all measurable, non-deleted Office task schedules.
-- No existing dates, roles, RLS policies or public RPC signatures are changed.
CREATE SCHEMA eflow_schedule;
REVOKE ALL ON SCHEMA eflow_schedule FROM PUBLIC, anon, authenticated;

CREATE FUNCTION eflow_schedule.calendar_day(value text) RETURNS date
LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
BEGIN
  IF value IS NULL OR btrim(value) = '' THEN RETURN NULL; END IF;
  IF value ~ '^\d{4}-\d{2}-\d{2}$' THEN RETURN value::date; END IF;
  IF value ~ '^\d{4}-\d{2}-\d{2}[T ][0-9]{2}:[0-9]{2}' THEN
    IF value ~ '(Z|[+-][0-9]{2}:[0-9]{2})$' THEN
      RETURN (value::timestamptz AT TIME ZONE 'Asia/Manila')::date;
    END IF;
    RETURN value::timestamp::date;
  END IF;
  -- Legacy relative schedules, e.g. Month 1, have no calendar bound yet.
  RETURN NULL;
END $$;

CREATE FUNCTION eflow_schedule.project_conflict(project uuid, starts date, ends date)
RETURNS text LANGUAGE plpgsql VOLATILE SET search_path = '' AS $$
DECLARE conflict record;
BEGIN
  SELECT t.title, least(t.start_date, d.due) AS first_day,
    greatest(t.start_date, d.due) AS last_day INTO conflict
  FROM public.tasks t CROSS JOIN LATERAL (
    SELECT coalesce(eflow_schedule.calendar_day(nullif(t.deadline, '')),
      eflow_schedule.calendar_day(t.due_date)) AS due
  ) d
  WHERE t.linked_project_id = project AND t.deleted_at IS NULL
    AND ((starts IS NOT NULL AND least(t.start_date, d.due) < starts)
      OR (ends IS NOT NULL AND greatest(t.start_date, d.due) > ends))
  ORDER BY t.id LIMIT 1;
  IF FOUND THEN
    IF starts IS NOT NULL AND conflict.first_day < starts THEN
      RETURN format('Project start date cannot be after %s: task "%s" is scheduled on that date. Reschedule the task or extend the project timeline.', conflict.first_day, conflict.title);
    END IF;
    RETURN format('Project target date cannot be before %s: task "%s" is scheduled on that date. Reschedule the task or extend the project timeline.', conflict.last_day, conflict.title);
  END IF;
  RETURN NULL;
END $$;

-- These are integrity-only triggers, not callable Data API endpoints. Definer
-- visibility prevents collaborating-Office RLS from hiding a conflicting task;
-- existing authorization triggers/RLS still control every write.
CREATE FUNCTION eflow_schedule.guard_project() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE issue text;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF ROW(NEW.start_date, NEW.target_date) IS NOT DISTINCT FROM ROW(OLD.start_date, OLD.target_date)
      AND NOT (NEW.status IN ('active', 'completed') AND NEW.status IS DISTINCT FROM OLD.status) THEN
      RETURN NEW;
    END IF;
  END IF;
  -- Same serialization key already used by project/task mutation workflows.
  PERFORM pg_advisory_xact_lock(hashtextextended('r9:' || NEW.id::text, 0));
  IF NEW.start_date IS NOT NULL AND NEW.target_date < NEW.start_date THEN
    RAISE EXCEPTION 'Target date must be on or after the start date.' USING ERRCODE = '22023';
  END IF;
  issue := eflow_schedule.project_conflict(NEW.id, NEW.start_date, NEW.target_date);
  IF issue IS NOT NULL THEN RAISE EXCEPTION '%', issue USING ERRCODE = '22023'; END IF;
  RETURN NEW;
END $$;

CREATE FUNCTION eflow_schedule.guard_task() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE p record; due date;
BEGIN
  IF NEW.linked_project_id IS NULL OR NEW.deleted_at IS NOT NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' THEN
    IF ROW(NEW.linked_project_id, NEW.start_date, NEW.deadline, NEW.due_date, NEW.deleted_at)
      IS NOT DISTINCT FROM ROW(OLD.linked_project_id, OLD.start_date, OLD.deadline, OLD.due_date, OLD.deleted_at) THEN
      RETURN NEW;
    END IF;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('r9:' || NEW.linked_project_id::text, 0));
  SELECT start_date, target_date INTO p FROM public.projects WHERE id = NEW.linked_project_id;
  IF NOT FOUND THEN RETURN NEW; END IF; -- Existing FK/link guards handle this.
  due := coalesce(eflow_schedule.calendar_day(nullif(NEW.deadline, '')),
    eflow_schedule.calendar_day(NEW.due_date));
  IF NEW.start_date IS NOT NULL AND due < NEW.start_date THEN
    RAISE EXCEPTION 'Task due date cannot be before its start date.' USING ERRCODE = '22023';
  END IF;
  IF p.start_date IS NOT NULL AND least(NEW.start_date, due) < p.start_date THEN
    RAISE EXCEPTION 'Task dates cannot be before the project start date (%). Extend the project timeline first.', p.start_date USING ERRCODE = '22023';
  END IF;
  IF p.target_date IS NOT NULL AND greatest(NEW.start_date, due) > p.target_date THEN
    RAISE EXCEPTION 'Task dates cannot be after the project target date (%). Extend the project timeline first.', p.target_date USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END $$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA eflow_schedule FROM PUBLIC, anon, authenticated;
CREATE TRIGGER zz_project_schedule_bounds BEFORE INSERT OR UPDATE OF start_date, target_date, status
  ON public.projects FOR EACH ROW EXECUTE FUNCTION eflow_schedule.guard_project();
CREATE TRIGGER zz_task_project_schedule_bounds BEFORE INSERT OR UPDATE OF linked_project_id, start_date, deadline, due_date, deleted_at
  ON public.tasks FOR EACH ROW EXECUTE FUNCTION eflow_schedule.guard_task();

-- Extend the installed Phase 6.5 wrapper; retain its baseline reviews, Office
-- identity gate, output shape and authorization in the public readiness RPC.
CREATE OR REPLACE FUNCTION eflow_phase7.readiness(p_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE r jsonb; checks jsonb; n integer; good boolean; p record; issue text;
BEGIN
  r := eflow_phase65.baseline_readiness(p_id);
  SELECT count(*) INTO n FROM public.tasks WHERE linked_project_id = p_id
    AND proposed_office_identity_id IS NOT NULL AND deleted_at IS NULL AND status <> 'cancelled';
  checks := (r->'checks') || jsonb_build_array(jsonb_build_object('key', 'office_identity',
    'label', 'Proposed Office responsibilities resolved', 'ok', n = 0,
    'detail', n || ' tasks need directory linking, Office Head confirmation and explicit handover in Project Offices.'));
  SELECT start_date, target_date INTO p FROM public.projects WHERE id = p_id;
  issue := eflow_schedule.project_conflict(p_id, p.start_date, p.target_date);
  IF issue IS NOT NULL THEN
    SELECT jsonb_agg(CASE WHEN c->>'key' = 'schedule'
      THEN c || jsonb_build_object('ok', false, 'detail', issue) ELSE c END ORDER BY ordinal)
      INTO checks FROM jsonb_array_elements(checks) WITH ORDINALITY entries(c, ordinal);
  END IF;
  good := NOT EXISTS(SELECT 1 FROM jsonb_array_elements(checks) c WHERE NOT (c->>'ok')::boolean);
  RETURN r || jsonb_build_object('checks', checks, 'ready', good,
    'canActivate', good AND (r->>'canActivate')::boolean,
    'stage', CASE WHEN n > 0 THEN 'Office identity resolution'
      WHEN issue IS NOT NULL THEN 'Schedule review' ELSE r->>'stage' END);
END $$;
