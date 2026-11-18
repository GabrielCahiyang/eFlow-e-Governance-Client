CREATE OR REPLACE FUNCTION public.eflow_manage_managed_activation(
  p_actor uuid,
  p_id uuid,
  p_action text,
  p_hash text DEFAULT NULL::text,
  p_ttl integer DEFAULT 24
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
declare
  i public.user_invitations;
  d public.managed_account_invite_details;
  prior_claim text;
  v_result jsonb;
begin
  perform eflow_activation.require_admin(p_actor);
  perform pg_advisory_xact_lock(hashtextextended('eflow.activation.actor:'||p_actor::text,0));
  select * into i from public.user_invitations where id=p_id and invitation_type='managed_account';
  if not found then
    raise exception 'This invitation is no longer available. Refresh the list.' using errcode='22023';
  end if;
  i:=eflow_activation.lock_invite(i.token_hash);
  perform eflow_activation.require_admin(p_actor,i.office_id);
  if p_action='approve' then
    select * into d from public.managed_account_invite_details where invitation_id=i.id for update;
    if i.status<>'accepted' or d.requested_privileged_role is null then raise exception 'Verify the email before approving this account.' using errcode='22023';end if;
    if d.approved_at is not null then return eflow_activation.safe_row(i);end if;
    perform 1 from public.profiles where id=i.accepted_by and not is_active and role='member' and org_id=i.office_id for update;
    if not found then raise exception 'This account changed. Review it before approval.' using errcode='22023';end if;
    if d.requested_privileged_role='head' then
      perform pg_advisory_xact_lock(hashtextextended('eflow.office_leadership',0));
      perform 1 from public.organizations where id=i.office_id and head_user_id is null for update;
      if not found then raise exception 'This office already has a Head. Review its leadership first.' using errcode='22023';end if;
      update public.profiles set is_active=true where id=i.accepted_by;
      prior_claim:=current_setting('request.jwt.claim.sub',true);
      perform set_config('request.jwt.claim.sub',p_actor::text,true);
      perform public.set_organization_leadership(i.office_id,i.accepted_by,null);
      perform set_config('request.jwt.claim.sub',coalesce(prior_claim,''),true);
    else update public.profiles set role='admin',is_active=true where id=i.accepted_by;end if;
    update public.managed_account_invite_details set approved_by=p_actor,approved_at=now() where invitation_id=i.id;
  elsif p_action='revoke' then
    if i.status='accepted' then raise exception 'This account is activated. Use account deactivation instead.' using errcode='22023';end if;
    update public.user_invitations set status='revoked',revoked_at=coalesce(revoked_at,now()),acceptance_claim=null,acceptance_claimed_at=null where id=i.id returning * into i;
  elsif p_action='delete' then
    if i.status='accepted' then raise exception 'This account is activated. Use account deactivation instead.' using errcode='22023';end if;
    if i.status<>'revoked' then raise exception 'Revoke this invitation before deleting it.' using errcode='22023';end if;
    v_result:=eflow_activation.safe_row(i)||jsonb_build_object('deleted',true);
    perform eflow_activation.audit(p_actor,i,'account.activation_deleted');
    delete from public.user_pds_documents where invitation_id=i.id and user_id is null;
    update public.user_pds_documents set invitation_id=null where invitation_id=i.id;
    delete from eflow_activation.dispatches where invitation_id=i.id;
    delete from public.managed_account_invite_details where invitation_id=i.id;
    delete from public.user_invitations where id=i.id;
    return v_result;
  elsif p_action='resend' then
    if not exists(select 1 from public.profiles where id=i.invited_by and role='admin' and is_active)
      or exists(select 1 from public.managed_account_invite_details where invitation_id=i.id and retention_purged_at is not null) then
      raise exception 'Revoke this invitation and create a new one. Its original authority or retained details are no longer available.' using errcode='22023';end if;
    if i.status not in ('pending','expired') then raise exception 'This invitation can no longer be resent.' using errcode='22023';end if;
    if i.acceptance_claimed_at>now()-interval '5 minutes' then raise exception 'Activation is in progress. Please wait.' using errcode='54000';end if;
    if i.send_count>=6 or i.last_sent_at>now()-interval '1 minute' then raise exception 'Please wait before resending.' using errcode='54000';end if;
    if p_ttl not between 1 and 168 then raise exception 'Invalid expiry.';end if;
    update public.user_invitations set token_hash=p_hash,expires_at=now()+make_interval(hours=>p_ttl),status='pending',acceptance_claim=null,acceptance_claimed_at=null,email_delivery_status='queued',updated_at=now() where id=i.id returning * into i;
  else raise exception 'Invalid activation action.' using errcode='22023';end if;
  perform eflow_activation.audit(p_actor,i,'account.activation_'||p_action);
  return eflow_activation.safe_row(i)||case when p_action='resend' then jsonb_build_object('token_hash',i.token_hash) else '{}'::jsonb end;
end
$function$;

revoke all on function public.eflow_manage_managed_activation(uuid, uuid, text, text, integer) from public, anon, authenticated;
grant execute on function public.eflow_manage_managed_activation(uuid, uuid, text, text, integer) to service_role;
