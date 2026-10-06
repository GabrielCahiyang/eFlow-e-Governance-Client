begin;
-- Reserve an email attempt before network delivery; enforce limits across workers.
create function public.phase2_reserve_invitation_email(p_id uuid,p_hash text)
returns public.user_invitations language plpgsql security definer set search_path='' as $$
declare item public.user_invitations;
begin
 select * into item from public.user_invitations where id=p_id for update;
 if not found or item.status<>'pending' or item.token_hash<>p_hash or item.expires_at<=now() then
  raise exception 'Invitation expired, revoked, or invalid' using errcode='22023';
 end if;
 if not public.phase2_is_office_head(item.invited_by,item.office_id) then
  raise exception 'Inviter no longer leads this Office' using errcode='42501';
 end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('phase2-dispatch:'||item.office_id::text,0));
 if (select count(*) from public.audit_events where actor_id=item.invited_by and action='invitation_email_attempted' and created_at>now()-interval '1 hour')>=20 or
    (select count(*) from public.audit_events where org_id=item.office_id and action='invitation_email_attempted' and created_at>now()-interval '1 hour')>=40 then
  raise exception 'Invitation limit reached. Please try again later.';
 end if;
 if item.send_count>=10 then raise exception 'Resend limit reached. Revoke this invitation.'; end if;
 update public.user_invitations set last_sent_at=now(),send_count=send_count+1,updated_at=now()
 where id=p_id returning * into item;
 perform public.phase2_audit(item.invited_by,item.office_id,item.id,'invitation_email_attempted');
 return item;
end $$;
revoke all on function public.phase2_reserve_invitation_email(uuid,text) from public,anon,authenticated;
grant execute on function public.phase2_reserve_invitation_email(uuid,text) to service_role;
commit;
