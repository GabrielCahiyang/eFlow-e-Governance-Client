-- A newly inserted project cannot already have child tasks. Avoid looking up
-- an existing project's tasks if a caller tries inserting a duplicate UUID;
-- let the existing uniqueness/authorization guards reject that insert.
CREATE OR REPLACE FUNCTION eflow_schedule.guard_project() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE issue text;
BEGIN
  IF NEW.start_date IS NOT NULL AND NEW.target_date < NEW.start_date THEN
    RAISE EXCEPTION 'Target date must be on or after the start date.' USING ERRCODE = '22023';
  END IF;
  IF TG_OP = 'INSERT' THEN RETURN NEW; END IF;
  IF ROW(NEW.start_date, NEW.target_date) IS NOT DISTINCT FROM ROW(OLD.start_date, OLD.target_date)
    AND NOT (NEW.status IN ('active', 'completed') AND NEW.status IS DISTINCT FROM OLD.status) THEN
    RETURN NEW;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('r9:' || NEW.id::text, 0));
  issue := eflow_schedule.project_conflict(NEW.id, NEW.start_date, NEW.target_date);
  IF issue IS NOT NULL THEN RAISE EXCEPTION '%', issue USING ERRCODE = '22023'; END IF;
  RETURN NEW;
END $$;
