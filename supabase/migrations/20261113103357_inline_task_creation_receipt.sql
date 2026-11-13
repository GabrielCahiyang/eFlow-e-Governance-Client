begin;

create function eflow_project.create_inline_task(
  p_project uuid, p_group uuid, p_title text, p_request uuid, p_actor uuid, p_verify_only boolean
) returns uuid language plpgsql security definer set search_path='' as $$
declare
  actor uuid := auth.uid();
  terms jsonb := jsonb_build_object('operation','inline_task','project',p_project,'group',p_group,'title',btrim(p_title));
  receipt eflow_project.commands;
  task_id uuid;
begin
  if actor is null or actor is distinct from p_actor
    or not coalesce(public.can_see_project(p_project,actor),false) then
    raise exception 'Current project access required' using errcode='42501';
  end if;
  if p_request is null or p_verify_only is null then
    raise exception 'Request identity required' using errcode='22023';
  end if;
  if p_title is null or p_title !~ '[^[:space:]]' then
    raise exception 'Enter a task title (up to 300 characters)' using errcode='22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('inline-task:'||actor::text||':'||p_request::text,0));
  select * into receipt from eflow_project.commands where actor_id=actor and request_id=p_request;
  if found then
    if receipt.payload is distinct from terms then
      raise exception 'Task request ID was reused with different details' using errcode='22023';
    end if;
    return (receipt.result->>'task_id')::uuid;
  end if;
  if p_verify_only then return null; end if;

  task_id := (public.phase3_create_task(p_project,p_group,p_title)).id;
  insert into eflow_project.commands(actor_id,request_id,payload,result)
  values(actor,p_request,terms,jsonb_build_object('task_id',task_id));
  return task_id;
end $$;

create function public.create_inline_project_task(
  p_project uuid, p_group uuid, p_title text, p_request uuid, p_actor uuid, p_verify_only boolean
) returns uuid language sql security invoker set search_path='' as $$
  select eflow_project.create_inline_task(p_project,p_group,p_title,p_request,p_actor,p_verify_only);
$$;

revoke all on function eflow_project.create_inline_task(uuid,uuid,text,uuid,uuid,boolean),
  public.create_inline_project_task(uuid,uuid,text,uuid,uuid,boolean) from public,anon,authenticated,service_role;
grant execute on function eflow_project.create_inline_task(uuid,uuid,text,uuid,uuid,boolean),
  public.create_inline_project_task(uuid,uuid,text,uuid,uuid,boolean) to authenticated;

notify pgrst, 'reload schema';
commit;
