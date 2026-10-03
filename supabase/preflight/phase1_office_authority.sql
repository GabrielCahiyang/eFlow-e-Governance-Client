-- Read-only report. Run after a verified full backup and before the Phase 1 migration.
select jsonb_build_object(
  'role_counts', (select jsonb_object_agg(role,n) from (select role,count(*) n from public.profiles group by role) r),
  'legacy_profiles', (select count(*) from public.profiles where role in ('super_admin','dept_head','department_head','assistant_head','employee')),
  'unsupported_profiles', (select count(*) from public.profiles where role not in ('admin','super_admin','head','dept_head','department_head','assistant_head','member','employee','accounting_staff')),
  'profiles_without_office', (select count(*) from public.profiles where org_id is null),
  'head_assignments', (select count(*) from public.organizations where head_user_id is not null),
  'assistant_assignments', (select count(*) from public.organizations where assistant_head_user_id is not null),
  'invalid_head_assignments', (select count(*) from public.organizations o left join public.profiles p on p.id=o.head_user_id where o.head_user_id is not null and (p.id is null or not p.is_active or p.org_id is distinct from o.id or p.role not in ('head','dept_head','department_head'))),
  'active_heads_without_appointment', (select count(*) from public.profiles p where p.is_active and p.role in ('head','dept_head','department_head') and not exists(select 1 from public.organizations o where o.id=p.org_id and o.head_user_id=p.id and o.is_active)),
  'tasks_with_assistant_reviewer', (select count(*) from public.tasks t join public.profiles p on p.id=t.reviewer_id where t.deleted_at is null and p.role='assistant_head'),
  'normal_open_tasks_with_old_cross_routing', (select count(*) from public.tasks t join public.organizations o on o.id=t.org_id where t.deleted_at is null and t.status not in ('completed','cancelled') and t.review_route_mode='organization_default' and t.assigned_to is not null and t.reviewer_id is distinct from o.head_user_id),
  'normal_reviews_without_active_head', (select count(*) from public.tasks t where t.deleted_at is null and t.status='for_review' and t.review_route_mode='organization_default' and not exists(select 1 from public.organizations o join public.profiles p on p.id=o.head_user_id where o.id=t.org_id and o.is_active and p.is_active and p.org_id=o.id and p.role in ('head','dept_head','department_head'))),
  'baseline_rows', jsonb_build_object(
    'profiles',(select count(*) from public.profiles),
    'organizations',(select count(*) from public.organizations),
    'projects',(select count(*) from public.projects),
    'tasks',(select count(*) from public.tasks),
    'subtasks',(select count(*) from public.subtasks),
    'petty_cash_requests',(select count(*) from public.petty_cash_requests),
    'petty_cash_releases',(select count(*) from public.petty_cash_releases),
    'petty_cash_liquidations',(select count(*) from public.petty_cash_liquidations),
    'budget_ledger_entries',(select count(*) from public.budget_ledger_entries)
  )
) as phase1_preflight;
