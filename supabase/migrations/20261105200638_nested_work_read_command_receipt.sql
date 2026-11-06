begin;

create function eflow_r7.work_command_receipt(p_root uuid, p_request uuid, p_command text, p_payload jsonb)
returns boolean
language plpgsql stable security definer set search_path=''
as $$
begin
  perform eflow_r3.actor();
  if not coalesce(eflow_r7.read_root(p_root),false) then
    raise exception 'Work access denied' using errcode='42501';
  end if;

  return exists (
    select 1 from eflow_r7.receipts r
    where r.actor_id=auth.uid() and r.request_id=p_request and r.root_id=p_root
      and r.payload=jsonb_build_object('command',p_command,'payload',p_payload)
  );
end
$$;

create function public.nw_work_command_receipt(p_root uuid, p_request uuid, p_command text, p_payload jsonb)
returns boolean language sql stable security invoker set search_path=''
as $$ select eflow_r7.work_command_receipt(p_root, p_request, p_command, p_payload) $$;

revoke all on function eflow_r7.work_command_receipt(uuid,uuid,text,jsonb) from public,anon,authenticated;
revoke all on function public.nw_work_command_receipt(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function eflow_r7.work_command_receipt(uuid,uuid,text,jsonb),
  public.nw_work_command_receipt(uuid,uuid,text,jsonb) to authenticated;
notify pgrst, 'reload schema';

commit;
