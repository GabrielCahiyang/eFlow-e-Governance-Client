-- Replace SQLSTATE '40001' (serialization_failure) with custom SQLSTATE 'P0049'
-- for optimistic concurrency / stale revision errors in eflow_r7.command and
-- eflow_r7.checked_command. PostgREST automatically retries SQLSTATE '40001'
-- in a 1-second loop until Warp kills the HTTP thread, causing the UI to hang
-- on "Saving..." and fail with an unverified request error instead of returning
-- an immediate stale-revision response.

DO $migration$
DECLARE
  v_def text;
  v_sig text;
BEGIN
  FOREACH v_sig IN ARRAY ARRAY[
    'eflow_r7.command(uuid,integer,uuid,text,jsonb)',
    'eflow_r7.checked_command(uuid,integer,uuid,text,jsonb,text)'
  ] LOOP
    SELECT pg_get_functiondef(v_sig::regprocedure) INTO v_def;
    IF position('40001' IN v_def) > 0 THEN
      v_def := replace(v_def, $q$using errcode='40001'$q$, $q$using errcode='P0049'$q$);
      v_def := replace(v_def, $q$USING ERRCODE = '40001'$q$, $q$USING ERRCODE = 'P0049'$q$);
      EXECUTE v_def;
    END IF;
  END LOOP;
END $migration$;
