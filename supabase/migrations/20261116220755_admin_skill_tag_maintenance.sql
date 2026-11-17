create table public.skill_tag_definitions (
  id text primary key default gen_random_uuid()::text,
  label text not null check (char_length(btrim(label)) between 1 and 100 and label !~ '[\x00-\x1f\x7f]'),
  position integer not null default 100 check (position between 0 and 999),
  retired boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index skill_tag_definitions_active_name
  on public.skill_tag_definitions (lower(regexp_replace(btrim(label), '\s+', ' ', 'g')))
  where not retired;

create index skill_tag_definitions_sort_idx
  on public.skill_tag_definitions (retired, position, label);

alter table public.skill_tag_definitions enable row level security;
revoke all on public.skill_tag_definitions from public, anon, authenticated;
grant select, insert, update on public.skill_tag_definitions to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'skill_tag_definitions'
     ) then
    alter publication supabase_realtime add table public.skill_tag_definitions;
  end if;
end;
$$;

create policy skill_tag_read on public.skill_tag_definitions
  for select to authenticated
  using ((select public.auth_role(auth.uid())) is not null);

create policy skill_tag_insert on public.skill_tag_definitions
  for insert to authenticated
  with check ((select public.auth_role(auth.uid())) = 'admin');

create policy skill_tag_update on public.skill_tag_definitions
  for update to authenticated
  using ((select public.auth_role(auth.uid())) = 'admin')
  with check ((select public.auth_role(auth.uid())) = 'admin');

insert into public.skill_tag_definitions (label, position)
values
  ('Project Coordination', 10),
  ('Budgeting', 20),
  ('Procurement', 30),
  ('Data Analysis', 40),
  ('Documentation & Reporting', 50),
  ('Monitoring & Evaluation', 60),
  ('Civil Engineering', 70),
  ('Community Outreach', 80),
  ('Financial Auditing', 90),
  ('Administrative Support', 100)
on conflict do nothing;

create or replace function public.eflow_validate_managed_activation(p_hash text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  i public.user_invitations;
  v_skills jsonb;
begin
  i := eflow_activation.lock_invite(p_hash);
  perform eflow_activation.assert_current(i);
  select d.skills into v_skills
  from public.managed_account_invite_details d
  where d.invitation_id = i.id;
  return (
    eflow_activation.safe_row(i)
    - array['invitation_id','source_mode','status','email_delivery_status','last_sent_at','created_at','awaiting_authority','needs_reconciliation']
  ) || jsonb_build_object('skills', coalesce(v_skills, '{}'::jsonb));
end;
$$;

create or replace function public.eflow_complete_managed_activation(
  p_hash text,
  p_claim uuid,
  p_auth_user uuid,
  p_skills jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  i public.user_invitations;
  d public.managed_account_invite_details;
  u auth.users;
  v_skills jsonb;
begin
  i := eflow_activation.lock_invite(p_hash);
  select * into d from public.managed_account_invite_details where invitation_id = i.id for update;
  if i.status = 'accepted' and d.completion_claim = p_claim and i.accepted_by = p_auth_user then
    return jsonb_build_object(
      'activated', true,
      'next_step', case when d.requested_privileged_role is not null and d.approved_at is null then 'awaiting_authority' else 'sign_in' end
    );
  end if;
  perform eflow_activation.assert_current(i);
  if i.acceptance_claim is distinct from p_claim or d.reconciliation_claim = p_claim or i.acceptance_claimed_at < now() - interval '5 minutes' then
    raise exception 'Activation attempt expired. Reopen your email link.' using errcode = '22023';
  end if;
  select * into u from auth.users where id = p_auth_user for update;
  if not found or lower(btrim(u.email)) <> i.email_normalized or u.email_confirmed_at is null or u.raw_app_meta_data->>'eflow_activation' is distinct from i.id::text or u.raw_app_meta_data->>'eflow_activation_attempt' is distinct from p_claim::text then
    raise exception 'This identity does not match the invitation.' using errcode = '42501';
  end if;
  if exists(select 1 from public.profiles where id = u.id or lower(btrim(email)) = i.email_normalized) then
    raise exception 'An account with this email already exists.' using errcode = '23505';
  end if;

  v_skills := coalesce(
    case when p_skills is not null and jsonb_typeof(p_skills) = 'object' then p_skills else null end,
    d.skills,
    '{}'::jsonb
  );

  insert into public.profiles(id, full_name, email, employee_id, org_id, role, skills, is_active)
  values(u.id, d.full_name, i.email_normalized, 'UNASSIGNED-' || u.id::text, i.office_id, i.account_role, v_skills, d.requested_privileged_role is null);
  insert into public.organization_memberships(organization_id, user_id, created_by)
  values(i.office_id, u.id, i.invited_by);
  if d.employee_notes is not null then
    insert into public.employee_notes(profile_id, strengths, weaknesses, notes, tags, updated_by)
    values(u.id, coalesce(d.employee_notes->>'strengths', ''), coalesce(d.employee_notes->>'weaknesses', ''), coalesce(d.employee_notes->>'notes', ''), array(select jsonb_array_elements_text(coalesce(d.employee_notes->'tags', '[]'))), i.invited_by);
  end if;
  insert into public.user_onboarding(user_id, tour_key) values(u.id, 'member-web-v1');
  update public.user_invitations
  set status = 'accepted', accepted_by = u.id, accepted_at = now(), acceptance_claim = null, acceptance_claimed_at = null
  where id = i.id
  returning * into i;
  update public.managed_account_invite_details set completion_claim = p_claim where invitation_id = i.id;
  perform eflow_activation.audit(u.id, i, 'account.activation_completed');
  return jsonb_build_object(
    'activated', true,
    'next_step', case when d.requested_privileged_role is not null then 'awaiting_authority' else 'sign_in' end
  );
end;
$$;

revoke all on function public.eflow_validate_managed_activation(text) from public, anon, authenticated;
grant execute on function public.eflow_validate_managed_activation(text) to service_role;
revoke all on function public.eflow_complete_managed_activation(text, uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.eflow_complete_managed_activation(text, uuid, uuid, jsonb) to service_role;
