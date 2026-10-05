-- Coordinated rollback only: revert the frontend/gateway first. Back up the
-- readiness review table before a committed rollback to preserve review history.
-- Acceptance executes this inside a savepoint and rolls it back, never live.
drop trigger phase7_task_revision on public.tasks;
drop trigger phase7_office_revision on public.project_offices;
drop trigger phase7_project_readiness on public.projects;
do $$declare d text;begin
 select pg_get_functiondef('eflow_phase7.baseline_completion(uuid)'::regprocedure) into d;
 execute replace(d,'FUNCTION eflow_phase7.baseline_completion(','FUNCTION public.project_completion_readiness_internal(');
end $$;
drop function public.phase7_project_readiness(uuid),public.phase7_review_project(uuid,text),public.phase7_activate_project(uuid),public.phase7_closeout_summary(uuid);
drop table public.project_readiness_reviews;
drop schema eflow_phase7 cascade;
revoke all on function public.project_completion_readiness_internal(uuid) from public,anon,authenticated;
notify pgrst,'reload schema';
