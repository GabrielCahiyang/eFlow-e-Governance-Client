-- Explicit metadata workflow: invoker RLS, exact timestamp CAS, current owning
-- Head authority and existing material-change/lifecycle triggers remain active.
CREATE OR REPLACE FUNCTION public.update_project_metadata(p_project_id uuid,p_expected_updated_at timestamptz,p_changes jsonb)
RETURNS public.projects LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE current_project public.projects; result public.projects; k text; today date:=(current_timestamp AT TIME ZONE 'Asia/Manila')::date;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to edit project details' USING ERRCODE='42501'; END IF;
  -- Same lock order as the existing project mutation trigger.
  PERFORM pg_advisory_xact_lock(hashtextextended('r9:'||p_project_id::text,0));
  SELECT * INTO current_project FROM public.projects WHERE id=p_project_id FOR UPDATE;
  IF NOT FOUND OR NOT public.phase2_is_office_head(auth.uid(),current_project.org_id) OR NOT public.can_manage_project(p_project_id,auth.uid()) THEN
    RAISE EXCEPTION 'Only the appointed Head of the lead office can edit this project' USING ERRCODE='42501';
  END IF;
  IF current_project.status IN ('completed','archived') THEN RAISE EXCEPTION 'Closed project details are read-only' USING ERRCODE='22023'; END IF;
  IF p_expected_updated_at IS NULL OR current_project.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'Project updated elsewhere; review new values before saving' USING ERRCODE='40001';
  END IF;
  IF p_changes IS NULL OR jsonb_typeof(p_changes)<>'object' THEN RAISE EXCEPTION 'Project changes must be an object' USING ERRCODE='22023'; END IF;
  FOR k IN SELECT jsonb_object_keys(p_changes) LOOP
    IF k NOT IN ('title','description','priority','start_date','target_date') THEN RAISE EXCEPTION 'Use the governed workflow for %',k USING ERRCODE='22023'; END IF;
    IF k IN ('title','description','priority') AND jsonb_typeof(p_changes->k)<>'string' THEN RAISE EXCEPTION 'Invalid project field: %',k USING ERRCODE='22023'; END IF;
    IF k IN ('start_date','target_date') AND jsonb_typeof(p_changes->k) NOT IN ('string','null') THEN RAISE EXCEPTION 'Invalid project date' USING ERRCODE='22023'; END IF;
  END LOOP;
  result:=jsonb_populate_record(current_project,p_changes);
  result.title:=btrim(result.title);
  IF result.title IS NULL OR length(result.title)=0 OR length(result.title)>200 THEN RAISE EXCEPTION 'Project name must contain 1 to 200 characters' USING ERRCODE='22023'; END IF;
  IF result.priority IS NULL OR result.priority NOT IN ('low','medium','high') THEN RAISE EXCEPTION 'Choose a valid priority' USING ERRCODE='22023'; END IF;
  IF result.start_date IS NOT NULL AND result.target_date IS NOT NULL AND result.target_date<result.start_date THEN RAISE EXCEPTION 'Target date must be on or after the start date' USING ERRCODE='22023'; END IF;
  IF result.start_date IS DISTINCT FROM current_project.start_date AND result.start_date<today OR result.target_date IS DISTINCT FROM current_project.target_date AND result.target_date<today THEN RAISE EXCEPTION 'New project dates cannot be in the past' USING ERRCODE='22023'; END IF;
  UPDATE public.projects SET title=result.title,description=result.description,priority=result.priority,start_date=result.start_date,target_date=result.target_date
    WHERE id=p_project_id AND updated_at=p_expected_updated_at RETURNING * INTO result;
  IF NOT FOUND THEN RAISE EXCEPTION 'Project update denied or changed; refresh before saving' USING ERRCODE='40001'; END IF;
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.update_project_metadata(uuid,timestamptz,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.update_project_metadata(uuid,timestamptz,jsonb) TO authenticated;

-- Protect the same metadata boundary against direct Data API updates. Lifecycle
-- and staffing commands are unaffected when metadata itself does not change.
CREATE OR REPLACE FUNCTION public.guard_project_metadata_edit() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NOT NULL AND ROW(new.title,new.description,new.priority,new.start_date,new.target_date) IS DISTINCT FROM ROW(old.title,old.description,old.priority,old.start_date,old.target_date) THEN
   IF old.status IN ('completed','archived') OR NOT public.phase2_is_office_head(auth.uid(),old.org_id) OR NOT public.can_manage_project(old.id,auth.uid()) THEN RAISE EXCEPTION 'Project metadata is read-only for this account or lifecycle' USING ERRCODE='42501'; END IF;
 END IF;
 RETURN new;
END $$;
REVOKE ALL ON FUNCTION public.guard_project_metadata_edit() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER project_metadata_edit_guard BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.guard_project_metadata_edit();
