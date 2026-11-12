-- Planned subtask dates, shared by Web and Mobile. No workflow status changes.
ALTER TABLE public.subtasks ADD COLUMN IF NOT EXISTS start_date date;
ALTER TABLE public.personal_subtasks ADD COLUMN IF NOT EXISTS start_date date;

CREATE OR REPLACE VIEW eflow_r7.nodes AS
 SELECT id,task_id,parent_subtask_id,lead_id,title,assigned_to_ids,sibling_order,due_date,is_standalone,status,percent_complete,created_at,'office'::text kind,start_date FROM public.subtasks
 UNION ALL SELECT id,task_id,parent_subtask_id,lead_id,title,assigned_to_ids,sibling_order,due_date,is_standalone,status,percent_complete,created_at,'personal'::text,start_date FROM public.personal_subtasks;

CREATE FUNCTION eflow_schedule.work_bounds(root_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT jsonb_build_object('projectStart',p.start_date,'projectDue',p.target_date,
    'taskStart',t.start_date,'taskDue',coalesce(eflow_schedule.calendar_day(t.deadline),eflow_schedule.calendar_day(t.due_date)))
  FROM public.tasks t LEFT JOIN public.projects p ON p.id=t.linked_project_id WHERE t.id=root_id
  UNION ALL SELECT '{}'::jsonb FROM public.personal_tasks WHERE id=root_id
$$;

CREATE FUNCTION eflow_schedule.guard_subtask_dates() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  project_id uuid;
  limits jsonb;
  first_day date;
  last_day date;
  conflict text;
BEGIN
  IF TG_OP='UPDATE' THEN
    IF ROW(NEW.start_date,NEW.due_date,NEW.parent_subtask_id)
      IS NOT DISTINCT FROM ROW(OLD.start_date,OLD.due_date,OLD.parent_subtask_id) THEN RETURN NEW; END IF;
    IF OLD.start_date IS NOT NULL AND NEW.start_date IS NULL THEN
      RAISE EXCEPTION 'Choose a subtask start date.' USING ERRCODE='22023';
    END IF;
  END IF;
  IF NEW.start_date IS NOT NULL AND (NEW.due_date IS NULL OR NEW.due_date < NEW.start_date) THEN
    RAISE EXCEPTION 'Choose a subtask due date on or after its start date.' USING ERRCODE='22023';
  END IF;
  IF TG_TABLE_NAME='subtasks' THEN
    SELECT linked_project_id INTO project_id FROM public.tasks WHERE id=NEW.task_id;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(
    CASE WHEN project_id IS NULL THEN 'subtask-schedule:' || NEW.task_id::text ELSE 'r9:' || project_id::text END,0));
  limits := eflow_schedule.work_bounds(NEW.task_id);
  first_day := greatest((limits->>'projectStart')::date,(limits->>'taskStart')::date);
  last_day := least((limits->>'projectDue')::date,(limits->>'taskDue')::date);

  WITH RECURSIVE ancestors AS (
    SELECT n.id,n.parent_subtask_id,n.start_date,n.due_date FROM eflow_r7.nodes n
    WHERE n.task_id=NEW.task_id AND n.id=NEW.parent_subtask_id
    UNION
    SELECT n.id,n.parent_subtask_id,n.start_date,n.due_date FROM eflow_r7.nodes n
    JOIN ancestors a ON n.id=a.parent_subtask_id WHERE n.task_id=NEW.task_id
  )
  SELECT greatest(first_day,max(start_date)),least(last_day,min(due_date))
  INTO first_day,last_day FROM ancestors;
  IF least(NEW.start_date,NEW.due_date) < first_day THEN
    RAISE EXCEPTION 'Subtask dates cannot be before %.',first_day USING ERRCODE='22023';
  END IF;
  IF greatest(NEW.start_date,NEW.due_date) > last_day THEN
    RAISE EXCEPTION 'Subtask dates cannot be after %.',last_day USING ERRCODE='22023';
  END IF;

  IF TG_OP='UPDATE' THEN
    WITH RECURSIVE descendants AS (
      SELECT n.id,n.title,n.start_date,n.due_date FROM eflow_r7.nodes n
      WHERE n.task_id=NEW.task_id AND n.parent_subtask_id=NEW.id
      UNION
      SELECT n.id,n.title,n.start_date,n.due_date FROM eflow_r7.nodes n
      JOIN descendants d ON n.parent_subtask_id=d.id WHERE n.task_id=NEW.task_id
    )
    SELECT title INTO conflict FROM descendants
    WHERE least(start_date,due_date) < greatest(NEW.start_date,first_day)
       OR greatest(start_date,due_date) > least(NEW.due_date,last_day)
    ORDER BY id LIMIT 1;
    IF FOUND THEN
      RAISE EXCEPTION 'Reschedule subtask "%" before changing this timeline.',conflict USING ERRCODE='22023';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER zz_subtask_schedule_bounds BEFORE INSERT OR UPDATE OF start_date,due_date,parent_subtask_id
 ON public.subtasks FOR EACH ROW EXECUTE FUNCTION eflow_schedule.guard_subtask_dates();
CREATE TRIGGER zz_subtask_schedule_bounds BEFORE INSERT OR UPDATE OF start_date,due_date,parent_subtask_id
 ON public.personal_subtasks FOR EACH ROW EXECUTE FUNCTION eflow_schedule.guard_subtask_dates();

CREATE FUNCTION eflow_schedule.guard_parent_subtask_dates() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE project_id uuid; parent_task_id uuid; first_day date; last_day date; conflict text;
BEGIN
  IF TG_TABLE_NAME='projects' THEN
    IF ROW(NEW.start_date,NEW.target_date) IS NOT DISTINCT FROM ROW(OLD.start_date,OLD.target_date) THEN RETURN NEW; END IF;
    project_id:=NEW.id;
    first_day:=NEW.start_date;
    last_day:=NEW.target_date;
  ELSE
    IF NEW.deleted_at IS NOT NULL OR ROW(NEW.linked_project_id,NEW.start_date,NEW.deadline,NEW.due_date)
        IS NOT DISTINCT FROM ROW(OLD.linked_project_id,OLD.start_date,OLD.deadline,OLD.due_date) THEN RETURN NEW; END IF;
    project_id:=NEW.linked_project_id;
    parent_task_id:=NEW.id;
    first_day:=NEW.start_date;
    last_day:=coalesce(eflow_schedule.calendar_day(NEW.deadline),eflow_schedule.calendar_day(NEW.due_date));
    IF project_id IS NOT NULL THEN
      SELECT greatest(first_day,p.start_date),least(last_day,p.target_date)
      INTO first_day,last_day FROM public.projects p WHERE p.id=project_id;
    END IF;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(
    CASE WHEN project_id IS NULL THEN 'subtask-schedule:' || parent_task_id::text ELSE 'r9:' || project_id::text END,0));
  IF parent_task_id IS NULL THEN
    SELECT s.title INTO conflict FROM public.subtasks s JOIN public.tasks t ON t.id=s.task_id
    WHERE t.linked_project_id=project_id AND t.deleted_at IS NULL
      AND (least(s.start_date,s.due_date)<first_day OR greatest(s.start_date,s.due_date)>last_day)
    ORDER BY s.id LIMIT 1;
  ELSE
    SELECT s.title INTO conflict FROM public.subtasks s
    WHERE s.task_id=parent_task_id
      AND (least(s.start_date,s.due_date)<first_day OR greatest(s.start_date,s.due_date)>last_day)
    ORDER BY s.id LIMIT 1;
  END IF;
  IF conflict IS NOT NULL THEN
    RAISE EXCEPTION 'Reschedule subtask "%" before changing this timeline.',conflict USING ERRCODE='22023';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER zz_project_subtask_schedule_bounds BEFORE UPDATE OF start_date,target_date
 ON public.projects FOR EACH ROW EXECUTE FUNCTION eflow_schedule.guard_parent_subtask_dates();
CREATE TRIGGER zz_task_subtask_schedule_bounds BEFORE UPDATE OF linked_project_id,start_date,deadline,due_date
 ON public.tasks FOR EACH ROW EXECUTE FUNCTION eflow_schedule.guard_parent_subtask_dates();

REVOKE ALL ON FUNCTION eflow_schedule.work_bounds(uuid),eflow_schedule.guard_subtask_dates(),
 eflow_schedule.guard_parent_subtask_dates() FROM PUBLIC,anon,authenticated;

-- Extend the installed functions in place. Authority, receipts and audit remain
-- on the original command, including checked edits and retries.
DO $migration$
DECLARE definition text; old_parts text[]; new_parts text[]; i integer;
BEGIN
  SELECT pg_get_functiondef('eflow_r7.command(uuid,integer,uuid,text,jsonb)'::regprocedure) INTO definition;
  old_parts:=ARRAY[
    '''title'',''due'',''standalone''',
    'if v_id is not null then select * into n',
    ',due_date,is_standalone)',
    '(p_payload->>''due'')::date,coalesce',
    'due_date=v_due,'
  ];
  new_parts:=ARRAY[
    '''title'',''due'',''start'',''standalone''',
    $rule$if p_payload ? 'start' and (p_command not in ('create','edit')
      or nullif(p_payload->>'start','') is null or nullif(p_payload->>'due','') is null) then
      raise exception 'Choose a subtask start date and due date.' using errcode='22023';
    end if;
    if v_id is not null then select * into n$rule$,
    ',due_date,start_date,is_standalone)',
    '(p_payload->>''due'')::date,(p_payload->>''start'')::date,coalesce',
    'due_date=v_due,start_date=case when p_payload ? ''start'' then (p_payload->>''start'')::date else n.start_date end,'
  ];
  FOR i IN 1..array_length(old_parts,1) LOOP
    IF (length(definition)-length(replace(definition,old_parts[i],'')))/length(old_parts[i]) <>
      (CASE WHEN i<=2 THEN 1 ELSE 2 END) THEN RAISE EXCEPTION 'Review the installed nested-work command before applying subtask dates (part %)',i;
    END IF;
    definition:=replace(definition,old_parts[i],new_parts[i]);
  END LOOP;
  EXECUTE definition;

  SELECT pg_get_functiondef('eflow_r7.work_impact(uuid,integer,text,jsonb)'::regprocedure) INTO definition;
  IF strpos(definition,old_parts[1])=0 THEN
    RAISE EXCEPTION 'Review the installed work impact before applying subtask dates';
  END IF;
  EXECUTE replace(definition,old_parts[1],new_parts[1]);

  SELECT pg_get_functiondef('eflow_r7.snapshot(uuid)'::regprocedure) INTO definition;
  IF strpos(definition,'jsonb_build_object(''root'',r||')=0 THEN
    RAISE EXCEPTION 'Review the installed work tree snapshot before applying subtask dates';
  END IF;
  EXECUTE replace(definition,'jsonb_build_object(''root'',r||',
    'jsonb_build_object(''root'',r||jsonb_build_object(''scheduleBounds'',eflow_schedule.work_bounds(p_root))||');
END
$migration$;
NOTIFY pgrst,'reload schema';
