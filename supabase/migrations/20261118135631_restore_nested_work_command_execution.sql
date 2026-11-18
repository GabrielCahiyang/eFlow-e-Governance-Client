-- Restore the original authenticated entry path through the SECURITY INVOKER
-- public.r7_work_command wrapper. Keep every actor/branch/lifecycle check intact.
-- Reviewed against ixnfphgjyelhckjwjkdv on 18 November 2026.
begin;

do $preflight$
declare
  target regprocedure := to_regprocedure('eflow_r7.command(uuid,integer,uuid,text,jsonb)');
begin
  if target is null or md5(pg_get_functiondef(target)) <> 'bdc1ac03af1848ce5f9be3871d93ff26' then
    raise exception 'Nested work command differs from the reviewed live definition. Stop for review.';
  end if;
  if md5(pg_get_functiondef('public.r7_work_command(uuid,integer,uuid,text,jsonb)'::regprocedure)) <> 'a6c26124cdd59ac758837669df80bbb8' then
    raise exception 'Nested work public wrapper differs from the reviewed live definition. Stop for review.';
  end if;
  if not exists(select 1 from pg_proc where oid=target and prosecdef and proowner='postgres'::regrole) then
    raise exception 'Unexpected nested work command security configuration.';
  end if;
  if has_function_privilege('anon',target,'EXECUTE') then
    raise exception 'Unexpected anonymous execution privilege. Stop for review.';
  end if;
end
$preflight$;

grant execute on function eflow_r7.command(uuid,integer,uuid,text,jsonb) to authenticated;

do $verify$
begin
  if not has_function_privilege('authenticated','eflow_r7.command(uuid,integer,uuid,text,jsonb)','EXECUTE')
    or has_function_privilege('anon','eflow_r7.command(uuid,integer,uuid,text,jsonb)','EXECUTE') then
    raise exception 'Nested work command execution privileges did not match the reviewed correction.';
  end if;
end
$verify$;

commit;
