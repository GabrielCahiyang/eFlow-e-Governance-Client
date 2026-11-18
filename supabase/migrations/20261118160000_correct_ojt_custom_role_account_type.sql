-- Repair the OJT role created when access to Reviews inferred the Head account type.
-- Existing non-Member accounts and resumable privileged invitations need separate review.
update public.custom_roles as role
set base_role = 'member', updated_at = clock_timestamp()
where lower(btrim(role.label)) = 'ojt'
  and role.base_role = 'head'
  and not exists (
    select 1
    from public.profiles as profile
    where profile.custom_role_key = role.key
      and profile.role is distinct from 'member'
  )
  and not exists (
    select 1
    from public.managed_account_invite_details as details
    join public.user_invitations as invitation on invitation.id = details.invitation_id
    where details.custom_role_key = role.key
      and invitation.status in ('pending', 'expired')
      and (invitation.account_role is distinct from 'member' or details.requested_privileged_role is not null)
  );
