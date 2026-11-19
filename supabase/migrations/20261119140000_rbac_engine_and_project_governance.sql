-- Slice 1 & 2: RBAC Dependency/Custom-Role Engine + Delegated Project Creation + Accounting Funding Countersign
-- Target: hosted Supabase ixnfphgjyelhckjwjkdv

-- ============================================================================
-- 1. SLICE 1: SERVER-SIDE RBAC DEPENDENCY & CUSTOM ROLE ENGINE
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_admin_only_permission(p_permission text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path TO ''
AS $$
  SELECT COALESCE(p_permission, '') IN (
    'navigation.user_management',
    'users.manage',
    'navigation.organization',
    'navigation.audit',
    'audit.read',
    'navigation.system_settings',
    'settings.manage',
    'navigation.data_tools',
    'database.backup'
  );
$$;

CREATE OR REPLACE FUNCTION public.permission_prerequisites(p_permission text)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
SET search_path TO ''
AS $$
  SELECT CASE COALESCE(p_permission, '')
    WHEN 'projects.create' THEN ARRAY['navigation.projects']::text[]
    WHEN 'projects.archive' THEN ARRAY['navigation.projects']::text[]
    WHEN 'projects.delete' THEN ARRAY['navigation.projects']::text[]
    WHEN 'tasks.assign' THEN ARRAY['navigation.tasks']::text[]
    WHEN 'tasks.verify' THEN ARRAY['navigation.reviews']::text[]
    WHEN 'reports.export' THEN ARRAY['navigation.reports']::text[]
    WHEN 'announcements.publish' THEN ARRAY['navigation.announcements']::text[]
    WHEN 'users.manage' THEN ARRAY['navigation.user_management']::text[]
    WHEN 'audit.read' THEN ARRAY['navigation.audit']::text[]
    WHEN 'settings.manage' THEN ARRAY['navigation.system_settings']::text[]
    WHEN 'database.backup' THEN ARRAY['navigation.data_tools']::text[]
    WHEN 'accounting.release_cash' THEN ARRAY['navigation.accounting_releases']::text[]
    WHEN 'accounting.settle_liquidation' THEN ARRAY['navigation.accounting_releases']::text[]
    WHEN 'accounting.post_journal' THEN ARRAY['navigation.accounting_journal']::text[]
    ELSE ARRAY[]::text[]
  END;
$$;

CREATE OR REPLACE FUNCTION public.default_role_has_permission(p_role text, p_permission text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path TO ''
AS $$
  SELECT CASE COALESCE(p_role, '')
    WHEN 'admin' THEN public.is_admin_only_permission(p_permission)
    WHEN 'super_admin' THEN public.is_admin_only_permission(p_permission)
    WHEN 'member' THEN COALESCE(p_permission, '') IN (
      'navigation.projects',
      'navigation.tasks',
      'navigation.reports',
      'navigation.announcements',
      'reports.export'
    )
    WHEN 'head' THEN COALESCE(p_permission, '') IN (
      'navigation.projects',
      'navigation.tasks',
      'navigation.reports',
      'navigation.announcements',
      'reports.export',
      'navigation.reviews',
      'navigation.team_supervision',
      'navigation.team_intelligence',
      'navigation.department_budgets',
      'projects.create',
      'projects.archive',
      'projects.delete',
      'tasks.assign',
      'tasks.verify'
    )
    WHEN 'accounting_staff' THEN COALESCE(p_permission, '') IN (
      'navigation.projects',
      'navigation.tasks',
      'navigation.reports',
      'navigation.announcements',
      'reports.export',
      'navigation.accounting_overview',
      'navigation.accounting_releases',
      'navigation.accounting_journal',
      'navigation.accounting_audit',
      'navigation.department_budgets',
      'accounting.release_cash',
      'accounting.settle_liquidation',
      'accounting.post_journal'
    )
    ELSE false
  END;
$$;

CREATE OR REPLACE FUNCTION public.raw_has_permission(p_user_id uuid, p_permission text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_profile record;
  v_custom_base text;
  v_override boolean;
  v_role_allowed boolean;
  v_effective_role text;
  v_fallback_role text;
BEGIN
  IF p_user_id IS NULL OR NULLIF(btrim(COALESCE(p_permission, '')), '') IS NULL THEN
    RETURN false;
  END IF;

  SELECT p.id, p.role::text AS role, p.custom_role_key, p.is_active
    INTO v_profile
  FROM public.profiles p
  WHERE p.id = p_user_id;

  IF NOT FOUND OR v_profile.is_active IS DISTINCT FROM true OR v_profile.role IS NULL THEN
    RETURN false;
  END IF;

  IF v_profile.role IN ('admin', 'super_admin') THEN
    RETURN public.is_admin_only_permission(p_permission);
  END IF;

  -- Non-admin accounts never inherit or gain Admin-only system capabilities.
  IF public.is_admin_only_permission(p_permission) THEN
    RETURN false;
  END IF;

  -- 1. Individual per-user override takes highest precedence.
  SELECT o.allowed
    INTO v_override
  FROM public.user_permission_overrides o
  WHERE o.user_id = p_user_id
    AND o.permission = p_permission
  LIMIT 1;

  IF FOUND THEN
    RETURN COALESCE(v_override, false);
  END IF;

  -- 2. Resolve active custom role if assigned; otherwise canonical role.
  v_effective_role := v_profile.role;
  v_fallback_role := v_profile.role;

  IF NULLIF(btrim(COALESCE(v_profile.custom_role_key, '')), '') IS NOT NULL THEN
    SELECT cr.base_role::text
      INTO v_custom_base
    FROM public.custom_roles cr
    WHERE cr.key = btrim(v_profile.custom_role_key)
    LIMIT 1;

    IF FOUND THEN
      v_effective_role := btrim(v_profile.custom_role_key);
      v_fallback_role := v_custom_base;
    END IF;
  END IF;

  SELECT rp.allowed
    INTO v_role_allowed
  FROM public.role_permissions rp
  WHERE rp.role = v_effective_role
    AND rp.permission = p_permission
  LIMIT 1;

  IF FOUND THEN
    RETURN COALESCE(v_role_allowed, false);
  END IF;

  -- 3. Fallback defaults matching frontend FALLBACK_DEFAULTS.
  RETURN public.default_role_has_permission(v_fallback_role, p_permission);
END;
$$;

CREATE OR REPLACE FUNCTION public.has_permission(p_user_id uuid, p_permission text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_req text;
BEGIN
  IF NOT public.raw_has_permission(p_user_id, p_permission) THEN
    RETURN false;
  END IF;

  FOREACH v_req IN ARRAY public.permission_prerequisites(p_permission) LOOP
    IF NOT public.raw_has_permission(p_user_id, v_req) THEN
      RETURN false;
    END IF;
  END LOOP;

  RETURN true;
END;
$$;

-- Atomic Admin RPC: update role permissions with dependency & admin-lock validation.
CREATE OR REPLACE FUNCTION public.admin_set_role_permissions(p_role text, p_changes jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_role text := NULLIF(btrim(COALESCE(p_role, '')), '');
  v_base_role text;
  v_perm text;
  v_val jsonb;
  v_allowed boolean;
  v_req text;
  v_req_allowed boolean;
  v_check_perm text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only Admin can manage role permissions' USING ERRCODE = '42501';
  END IF;

  IF v_role IS NULL OR v_role IN ('admin', 'super_admin') THEN
    RAISE EXCEPTION 'Admin defaults are fixed administrative access' USING ERRCODE = '42501';
  END IF;

  IF v_role IN ('head', 'member', 'accounting_staff') THEN
    v_base_role := v_role;
  ELSE
    SELECT cr.base_role::text INTO v_base_role
    FROM public.custom_roles cr
    WHERE cr.key = v_role;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Choose a canonical account role or active custom role' USING ERRCODE = '22023';
    END IF;
  END IF;

  IF p_changes IS NULL OR jsonb_typeof(p_changes) <> 'object' THEN
    RAISE EXCEPTION 'Provide a valid permission change map' USING ERRCODE = '22023';
  END IF;

  FOR v_perm, v_val IN SELECT key, value FROM jsonb_each(p_changes) LOOP
    IF jsonb_typeof(v_val) <> 'boolean' THEN
      RAISE EXCEPTION 'Permission value for % must be a boolean', v_perm USING ERRCODE = '22023';
    END IF;
    v_allowed := (v_val::text)::boolean;
    IF v_allowed AND public.is_admin_only_permission(v_perm) THEN
      RAISE EXCEPTION 'Administrative permission % cannot be assigned to non-Admin roles', v_perm USING ERRCODE = '42501';
    END IF;

    INSERT INTO public.role_permissions (role, permission, allowed)
    VALUES (v_role, v_perm, v_allowed)
    ON CONFLICT (role, permission) DO UPDATE SET allowed = EXCLUDED.allowed;
  END LOOP;

  -- Verify no allowed permission on this role is missing its prerequisite.
  FOR v_check_perm IN
    SELECT DISTINCT perm
    FROM (
      SELECT rp.permission AS perm
      FROM public.role_permissions rp
      WHERE rp.role = v_role AND rp.allowed = true
      UNION
      SELECT k AS perm
      FROM unnest(ARRAY[
        'projects.create','projects.archive','projects.delete',
        'tasks.assign','tasks.verify','reports.export','announcements.publish',
        'accounting.release_cash','accounting.settle_liquidation','accounting.post_journal'
      ]) AS k
      WHERE public.default_role_has_permission(v_base_role, k)
        AND NOT EXISTS (
          SELECT 1 FROM public.role_permissions rp
          WHERE rp.role = v_role AND rp.permission = k
        )
    ) effective_allowed
  LOOP
    FOREACH v_req IN ARRAY public.permission_prerequisites(v_check_perm) LOOP
      SELECT COALESCE(
        (SELECT rp.allowed FROM public.role_permissions rp WHERE rp.role = v_role AND rp.permission = v_req LIMIT 1),
        public.default_role_has_permission(v_base_role, v_req)
      ) INTO v_req_allowed;

      IF NOT COALESCE(v_req_allowed, false) THEN
        RAISE EXCEPTION 'Permission "%" requires "%" to be allowed', v_check_perm, v_req USING ERRCODE = '22023';
      END IF;
    END LOOP;
  END LOOP;
END;
$$;

-- Atomic Admin RPC: update per-user permission overrides (true, false, or null to reset).
CREATE OR REPLACE FUNCTION public.admin_set_user_permission_overrides(p_user_id uuid, p_changes jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_target record;
  v_perm text;
  v_val jsonb;
  v_allowed boolean;
  v_check_perm text;
  v_req text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only Admin can manage individual access' USING ERRCODE = '42501';
  END IF;

  SELECT p.id, p.role::text AS role
    INTO v_target
  FROM public.profiles p
  WHERE p.id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User account not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_target.role IN ('admin', 'super_admin') THEN
    RAISE EXCEPTION 'Admin core access cannot be overridden' USING ERRCODE = '42501';
  END IF;

  IF p_changes IS NULL OR jsonb_typeof(p_changes) <> 'object' THEN
    RAISE EXCEPTION 'Provide a valid override change map' USING ERRCODE = '22023';
  END IF;

  FOR v_perm, v_val IN SELECT key, value FROM jsonb_each(p_changes) LOOP
    IF jsonb_typeof(v_val) = 'null' THEN
      DELETE FROM public.user_permission_overrides
      WHERE user_id = p_user_id AND permission = v_perm;
    ELSIF jsonb_typeof(v_val) = 'boolean' THEN
      v_allowed := (v_val::text)::boolean;
      IF v_allowed AND public.is_admin_only_permission(v_perm) THEN
        RAISE EXCEPTION 'Administrative permission % cannot be assigned to non-Admin users', v_perm USING ERRCODE = '42501';
      END IF;
      INSERT INTO public.user_permission_overrides (user_id, permission, allowed, updated_at)
      VALUES (p_user_id, v_perm, v_allowed, now())
      ON CONFLICT (user_id, permission) DO UPDATE
        SET allowed = EXCLUDED.allowed, updated_at = now();
    ELSE
      RAISE EXCEPTION 'Override for % must be true, false, or null', v_perm USING ERRCODE = '22023';
    END IF;
  END LOOP;

  -- Verify effective user permissions satisfy all prerequisites.
  FOR v_check_perm IN
    SELECT k FROM unnest(ARRAY[
      'projects.create','projects.archive','projects.delete',
      'tasks.assign','tasks.verify','reports.export','announcements.publish',
      'accounting.release_cash','accounting.settle_liquidation','accounting.post_journal'
    ]) AS k
    WHERE public.raw_has_permission(p_user_id, k)
  LOOP
    FOREACH v_req IN ARRAY public.permission_prerequisites(v_check_perm) LOOP
      IF NOT public.raw_has_permission(p_user_id, v_req) THEN
        RAISE EXCEPTION 'Effective permission "%" requires "%" to be allowed', v_check_perm, v_req USING ERRCODE = '22023';
      END IF;
    END LOOP;
  END LOOP;
END;
$$;

-- Atomic Admin RPC: create or update a custom role and its permission rows together.
CREATE OR REPLACE FUNCTION public.admin_save_custom_role(
  p_key text,
  p_label text,
  p_description text,
  p_base_role text,
  p_permissions jsonb,
  p_is_new boolean DEFAULT false
)
RETURNS public.custom_roles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_key text := lower(btrim(COALESCE(p_key, '')));
  v_label text := btrim(COALESCE(p_label, ''));
  v_desc text := btrim(COALESCE(p_description, ''));
  v_saved public.custom_roles;
  v_perm text;
  v_val jsonb;
  v_allowed boolean;
  v_req text;
  v_req_allowed boolean;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only Admin can manage custom roles' USING ERRCODE = '42501';
  END IF;

  IF length(v_label) NOT BETWEEN 2 AND 80 THEN
    RAISE EXCEPTION 'Role name must be between 2 and 80 characters' USING ERRCODE = '22023';
  END IF;

  IF p_base_role NOT IN ('head', 'accounting_staff', 'member') THEN
    RAISE EXCEPTION 'Choose Head, Accounting Staff, or Member as the account type' USING ERRCODE = '22023';
  END IF;

  IF v_key = '' OR v_key IN ('admin', 'super_admin', 'head', 'accounting_staff', 'member', 'employee', 'dept_head', 'department_head', 'assistant_head', 'viewer') THEN
    RAISE EXCEPTION 'Choose a valid non-reserved custom role key' USING ERRCODE = '22023';
  END IF;

  IF p_permissions IS NULL OR jsonb_typeof(p_permissions) <> 'object' THEN
    RAISE EXCEPTION 'Provide a valid permission map for this role' USING ERRCODE = '22023';
  END IF;

  IF p_is_new THEN
    INSERT INTO public.custom_roles (key, label, description, base_role)
    VALUES (v_key, v_label, v_desc, p_base_role)
    RETURNING * INTO v_saved;
  ELSE
    UPDATE public.custom_roles
    SET label = v_label,
        description = v_desc,
        base_role = p_base_role,
        updated_at = now()
    WHERE key = v_key
    RETURNING * INTO v_saved;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Custom role "%" not found', v_key USING ERRCODE = 'P0002';
    END IF;
  END IF;

  DELETE FROM public.role_permissions WHERE role = v_key;

  FOR v_perm, v_val IN SELECT key, value FROM jsonb_each(p_permissions) LOOP
    IF jsonb_typeof(v_val) <> 'boolean' THEN
      RAISE EXCEPTION 'Permission value for % must be a boolean', v_perm USING ERRCODE = '22023';
    END IF;
    v_allowed := (v_val::text)::boolean;
    IF v_allowed AND public.is_admin_only_permission(v_perm) THEN
      RAISE EXCEPTION 'Administrative permission % cannot be assigned to custom roles', v_perm USING ERRCODE = '42501';
    END IF;

    INSERT INTO public.role_permissions (role, permission, allowed)
    VALUES (v_key, v_perm, v_allowed);
  END LOOP;

  -- Validate dependency consistency for all allowed permissions.
  FOR v_perm IN
    SELECT rp.permission FROM public.role_permissions rp
    WHERE rp.role = v_key AND rp.allowed = true
  LOOP
    FOREACH v_req IN ARRAY public.permission_prerequisites(v_perm) LOOP
      SELECT COALESCE(
        (SELECT rp.allowed FROM public.role_permissions rp WHERE rp.role = v_key AND rp.permission = v_req LIMIT 1),
        public.default_role_has_permission(p_base_role, v_req)
      ) INTO v_req_allowed;

      IF NOT COALESCE(v_req_allowed, false) THEN
        RAISE EXCEPTION 'Permission "%" requires "%" to be allowed', v_perm, v_req USING ERRCODE = '22023';
      END IF;
    END LOOP;
  END LOOP;

  RETURN v_saved;
END;
$$;

-- ============================================================================
-- 2. SLICE 2: DELEGATED PROJECT CREATION + OWNED PROJECT SCOPE + ACCOUNTING COUNTERSIGN
-- ============================================================================

CREATE OR REPLACE FUNCTION public.can_create_project_in_office(target_org uuid, caller_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT caller_id IS NOT NULL
    AND target_org IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      JOIN public.organizations o ON o.id = p.org_id
      WHERE p.id = caller_id
        AND p.is_active = true
        AND p.role IS NOT NULL
        AND p.role::text NOT IN ('admin', 'super_admin', 'viewer')
        AND p.org_id = target_org
        AND o.is_active = true
    )
    AND public.has_permission(caller_id, 'projects.create');
$$;

CREATE OR REPLACE FUNCTION public.can_configure_project(p_project uuid, p_actor uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_proj public.projects;
BEGIN
  IF p_project IS NULL OR p_actor IS NULL THEN
    RETURN false;
  END IF;

  SELECT * INTO v_proj FROM public.projects WHERE id = p_project;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF v_proj.source_collaboration_draft_id IS NOT NULL THEN
    RETURN public.phase2_is_office_head(p_actor, v_proj.org_id)
      AND public.can_manage_project(v_proj.id, p_actor);
  END IF;

  IF public.phase2_is_office_head(p_actor, v_proj.org_id)
     AND public.can_manage_project(v_proj.id, p_actor) THEN
    RETURN true;
  END IF;

  RETURN public.can_create_project_in_office(v_proj.org_id, p_actor)
    AND (
      v_proj.created_by = p_actor
      OR v_proj.owner_id = p_actor
      OR v_proj.project_lead_id = p_actor
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.can_certify_project_funding(p_office uuid, p_actor uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT p_office IS NOT NULL
    AND p_actor IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      JOIN public.organizations o ON o.id = p.org_id
      WHERE p.id = p_actor
        AND p.is_active = true
        AND p.role::text = 'accounting_staff'
        AND p.org_id = p_office
        AND o.is_active = true
    )
    AND (
      public.has_permission(p_actor, 'accounting.release_cash')
      OR public.has_permission(p_actor, 'accounting.settle_liquidation')
      OR public.has_permission(p_actor, 'accounting.post_journal')
      OR public.has_permission(p_actor, 'navigation.department_budgets')
    );
$$;

-- Update can_create_scoped_work so active users with projects.create in their own office pass RLS/RPC checks.
CREATE OR REPLACE FUNCTION public.can_create_scoped_work(target_org uuid, caller_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  caller_profile public.profiles;
BEGIN
  IF caller_id IS NULL OR target_org IS NULL THEN
    RETURN false;
  END IF;

  SELECT * INTO caller_profile
  FROM public.profiles
  WHERE id = caller_id AND is_active = true;

  IF NOT FOUND OR caller_profile.role IS NULL OR caller_profile.role::text IN ('admin', 'super_admin', 'viewer') THEN
    RETURN false;
  END IF;

  IF target_org <> caller_profile.org_id THEN
    RETURN false;
  END IF;

  IF caller_profile.role::text = 'head' THEN
    RETURN true;
  END IF;

  RETURN public.can_create_project_in_office(target_org, caller_id);
END;
$$;

-- Update can_manage_project so delegated project leads with projects.create can manage projects they lead/created.
CREATE OR REPLACE FUNCTION public.can_manage_project(target_project uuid, caller_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  project_row public.projects;
BEGIN
  IF caller_id IS NULL OR public.auth_role(caller_id) = 'admin' THEN
    RETURN false;
  END IF;

  SELECT * INTO project_row FROM public.projects WHERE id = target_project;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF project_row.source_collaboration_draft_id IS NOT NULL THEN
    RETURN public.can_manage_collaboration_project(target_project, caller_id);
  END IF;

  RETURN project_row.owner_id = caller_id
    OR project_row.created_by = caller_id
    OR (project_row.project_lead_id = caller_id AND public.can_create_project_in_office(project_row.org_id, caller_id))
    OR public.can_access_org(caller_id, project_row.org_id, 'manage');
END;
$$;

-- Update baseline_can_manage_task and can_manage_task so delegated project creators/leads can edit tasks inside their own project.
CREATE OR REPLACE FUNCTION eflow_phase6.baseline_can_manage_task(target_task uuid, caller_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  task_row public.tasks;
BEGIN
  IF caller_id IS NULL OR public.auth_role(caller_id) = 'admin' THEN
    RETURN false;
  END IF;

  SELECT * INTO task_row FROM public.tasks WHERE id = target_task AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF task_row.source_collaboration_draft_id IS NOT NULL THEN
    RETURN task_row.recommendation_lead_id = caller_id
      OR public.is_organization_approver(task_row.org_id, caller_id);
  END IF;

  RETURN task_row.created_by = caller_id
    OR task_row.recommendation_lead_id = caller_id
    OR (task_row.linked_project_id IS NOT NULL AND public.can_configure_project(task_row.linked_project_id, caller_id))
    OR public.can_access_org(caller_id, task_row.org_id, 'manage');
END;
$$;

CREATE OR REPLACE FUNCTION public.can_manage_task(target_task uuid, caller_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT CASE
    WHEN eflow_phase6.shared(t.linked_project_id) AND t.source_collaboration_draft_id IS NULL THEN
      eflow_phase6.head(t.linked_project_id, t.org_id, caller_id)
      OR (
        public.can_configure_project(t.linked_project_id, caller_id)
        AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id = t.linked_project_id AND p.org_id = t.org_id)
      )
    ELSE eflow_phase6.baseline_can_manage_task(target_task, caller_id)
  END
  FROM public.tasks t
  WHERE t.id = target_task AND t.deleted_at IS NULL;
$$;

-- Update create_project_with_details to enforce projects.create via can_create_project_in_office.
CREATE OR REPLACE FUNCTION public.create_project_with_details(p_payload jsonb)
RETURNS public.projects
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  caller uuid := auth.uid();
  caller_profile public.profiles;
  target_org uuid;
  selected_owner uuid;
  project_status text := COALESCE(NULLIF(trim(p_payload ->> 'status'), ''), 'planning');
  project_priority text := COALESCE(NULLIF(trim(p_payload ->> 'priority'), ''), 'medium');
  project_source text := COALESCE(NULLIF(trim(p_payload ->> 'source_type'), ''), 'standalone');
  created_project public.projects;
  member_value text;
  milestone_value jsonb;
BEGIN
  IF caller IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to create a project' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO caller_profile FROM public.profiles WHERE id = caller AND is_active;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'An active eFlow profile is required to create a project' USING ERRCODE = '42501';
  END IF;

  IF NULLIF(trim(p_payload ->> 'title'), '') IS NULL THEN
    RAISE EXCEPTION 'Project title is required' USING ERRCODE = '22023';
  END IF;
  IF project_status NOT IN ('planning', 'active', 'on_hold', 'completed', 'archived') THEN
    RAISE EXCEPTION 'Invalid project status' USING ERRCODE = '22023';
  END IF;
  IF project_priority NOT IN ('low', 'medium', 'high') THEN
    RAISE EXCEPTION 'Invalid project priority' USING ERRCODE = '22023';
  END IF;
  IF project_source NOT IN ('ai_pdf', 'manual', 'standalone') THEN
    RAISE EXCEPTION 'Invalid project source type' USING ERRCODE = '22023';
  END IF;

  target_org := COALESCE(NULLIF(p_payload ->> 'org_id', '')::uuid, caller_profile.org_id);
  IF NOT public.can_create_project_in_office(target_org, caller) THEN
    RAISE EXCEPTION 'You need the Create Projects permission in this office to create a project' USING ERRCODE = '42501';
  END IF;

  selected_owner := COALESCE(NULLIF(p_payload ->> 'owner_id', '')::uuid, caller);
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = selected_owner AND is_active) THEN
    RAISE EXCEPTION 'Project owner must be an active eFlow user' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.projects (
    title, description, org_id, owner_id, status, priority, start_date, target_date,
    created_by, proposal_id, proposal_title, program_id, program_title, source_type, source_file_name
  ) VALUES (
    trim(p_payload ->> 'title'), COALESCE(p_payload ->> 'description', ''), target_org,
    selected_owner, project_status, project_priority, NULLIF(p_payload ->> 'start_date', '')::date,
    NULLIF(p_payload ->> 'target_date', '')::date, caller, NULLIF(p_payload ->> 'proposal_id', ''),
    NULLIF(p_payload ->> 'proposal_title', ''), NULLIF(p_payload ->> 'program_id', ''),
    NULLIF(p_payload ->> 'program_title', ''), project_source, NULLIF(p_payload ->> 'source_file_name', '')
  ) RETURNING * INTO created_project;

  INSERT INTO public.project_members (project_id, user_id, role)
  VALUES (created_project.id, selected_owner, 'owner')
  ON CONFLICT (project_id, user_id) DO UPDATE SET role = EXCLUDED.role;

  FOR member_value IN SELECT value FROM jsonb_array_elements_text(COALESCE(p_payload -> 'member_ids', '[]'::jsonb)) LOOP
    IF member_value <> '' AND member_value::uuid <> selected_owner THEN
      IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = member_value::uuid AND is_active) THEN
        RAISE EXCEPTION 'Every project member must be an active eFlow user' USING ERRCODE = '22023';
      END IF;
      INSERT INTO public.project_members (project_id, user_id, role)
      VALUES (created_project.id, member_value::uuid, 'member')
      ON CONFLICT (project_id, user_id) DO NOTHING;
    END IF;
  END LOOP;

  FOR milestone_value IN SELECT value FROM jsonb_array_elements(COALESCE(p_payload -> 'milestones', '[]'::jsonb)) LOOP
    IF NULLIF(trim(milestone_value ->> 'title'), '') IS NOT NULL THEN
      INSERT INTO public.milestones (project_id, title, description, due_date, sort_order)
      VALUES (created_project.id, trim(milestone_value ->> 'title'), COALESCE(milestone_value ->> 'description', ''), NULLIF(milestone_value ->> 'due_date', '')::date, COALESCE((milestone_value ->> 'sort_order')::int, 0));
    END IF;
  END LOOP;

  RETURN created_project;
END;
$$;

-- Update eflow_project.create_draft_once to use can_create_project_in_office.
CREATE OR REPLACE FUNCTION eflow_project.create_draft_once(p_payload jsonb, p_key uuid)
RETURNS public.projects
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  actor uuid := auth.uid();
  receipt eflow_project.commands;
  project_row public.projects;
  payload jsonb := jsonb_build_object('operation', 'create_draft', 'details', p_payload);
BEGIN
  IF p_key IS NULL OR actor IS NULL
     OR NOT COALESCE(public.can_create_project_in_office((p_payload->>'org_id')::uuid, actor), false) THEN
    RAISE EXCEPTION 'You need the Create Projects permission in your active office to create a project draft' USING ERRCODE = '42501';
  END IF;

  IF p_payload->>'status' IS DISTINCT FROM 'planning'
     OR (p_payload->>'owner_id')::uuid IS DISTINCT FROM actor
     OR COALESCE(p_payload->'member_ids', '[]'::jsonb) <> '[]'::jsonb THEN
    RAISE EXCEPTION 'Invalid project draft creation request' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('project-draft:' || actor::text || ':' || p_key::text, 0));
  SELECT * INTO receipt FROM eflow_project.commands WHERE actor_id = actor AND request_id = p_key;
  IF FOUND THEN
    IF receipt.payload IS DISTINCT FROM payload THEN
      RAISE EXCEPTION 'Project draft request ID was reused with different details' USING ERRCODE = '22023';
    END IF;
    SELECT * INTO project_row FROM public.projects p
    WHERE p.id = (receipt.result->>'projectId')::uuid
      AND p.org_id = (p_payload->>'org_id')::uuid
      AND p.created_by = actor;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'The saved project draft is no longer available' USING ERRCODE = 'P0002';
    END IF;
    RETURN project_row;
  END IF;

  SELECT * INTO project_row FROM public.create_project_with_details(p_payload);
  INSERT INTO eflow_project.commands (actor_id, request_id, payload, result)
    VALUES (actor, p_key, payload, jsonb_build_object('projectId', project_row.id));
  INSERT INTO public.audit_events (actor_id, entity_type, entity_id, action, org_id, after_data)
    VALUES (actor, 'project', project_row.id::text, 'project.created', project_row.org_id,
      jsonb_build_object('title', project_row.title, 'status', project_row.status, 'priority', project_row.priority));
  RETURN project_row;
END;
$$;

-- Auto-assign project creator as initial project_lead_id so delegated creators own their draft cleanly.
CREATE OR REPLACE FUNCTION eflow_project.default_creator_lead()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF new.created_by = auth.uid()
     AND new.project_lead_id IS NULL
     AND public.can_create_project_in_office(new.org_id, auth.uid()) THEN
    new.project_lead_id := auth.uid();
  END IF;
  RETURN new;
END;
$$;

-- Draft visibility includes creator alongside project_lead_id and Office Head.
CREATE OR REPLACE FUNCTION eflow_publication.draft_manager(p_project uuid, p_actor uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT p_actor = auth.uid() AND EXISTS (
    SELECT 1
    FROM public.projects p
    JOIN public.profiles u ON u.id = p_actor AND u.is_active
    WHERE p.id = p_project
      AND p.publication_state = 'draft'
      AND p.status = 'planning'
      AND (
        public.phase2_is_office_head(p_actor, p.org_id)
        OR (
          (p.project_lead_id = p_actor OR p.created_by = p_actor)
          AND p.org_id = u.org_id
          AND u.role::text NOT IN ('admin', 'super_admin', 'viewer')
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION eflow_m7.project_visible(p_project uuid, p_actor uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT p_project IS NULL OR EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = p_project AND (
      p.publication_state = 'published'
      OR (
        p_actor = auth.uid()
        AND p.publication_state = 'draft'
        AND p.status = 'planning'
        AND EXISTS (
          SELECT 1
          FROM public.profiles u
          WHERE u.id = p_actor AND u.is_active AND (
            (u.role::text = 'head' AND u.org_id = p.org_id
             AND EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = p.org_id AND o.is_active AND o.head_user_id = p_actor))
            OR ((p.project_lead_id = p_actor OR p.created_by = p_actor) AND u.org_id = p.org_id
                AND u.role::text NOT IN ('admin', 'super_admin', 'viewer'))
          )
        )
      )
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_see_project(target_project uuid, caller_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_proj record;
  v_caller record;
  v_eligible boolean;
  v_open boolean;
  v_is_proj_member boolean;
  v_can_access_org boolean;
  v_phase6_access boolean;
  v_allowed boolean;
  v_joined_head boolean;
BEGIN
  IF target_project IS NULL OR caller_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT p.id, p.org_id, p.owner_id, p.created_by, p.project_lead_id, p.status,
         p.publication_state, p.source_collaboration_draft_id
    INTO v_proj
  FROM public.projects p
  WHERE p.id = target_project;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  SELECT pr.id, pr.role::text AS role, pr.is_active, pr.org_id,
         o.path::text AS org_path, o.is_active AS org_is_active,
         o.head_user_id AS org_head_user_id, u.email_confirmed_at
    INTO v_caller
  FROM public.profiles pr
  LEFT JOIN public.organizations o ON o.id = pr.org_id
  LEFT JOIN auth.users u ON u.id = pr.id
  WHERE pr.id = caller_id;
  IF NOT FOUND OR NOT v_caller.is_active OR v_caller.role IS NULL OR v_caller.role = 'admin' THEN
    RETURN false;
  END IF;

  IF v_proj.publication_state = 'draft' THEN
    IF caller_id = auth.uid() AND v_proj.status = 'planning' AND (
      (v_caller.role = 'head' AND v_caller.org_id = v_proj.org_id
       AND COALESCE(v_caller.org_is_active, false) AND v_caller.org_head_user_id = caller_id)
      OR ((v_proj.project_lead_id = caller_id OR v_proj.created_by = caller_id) AND v_caller.org_id = v_proj.org_id
          AND v_caller.role NOT IN ('admin', 'super_admin', 'viewer'))
    ) THEN
      RETURN true;
    END IF;
    RETURN false;
  END IF;

  IF v_proj.publication_state IS DISTINCT FROM 'published' THEN
    RETURN false;
  END IF;

  v_eligible := (v_caller.role IN ('head', 'member', 'accounting_staff') AND v_caller.email_confirmed_at IS NOT NULL);
  v_open := (v_proj.status NOT IN ('completed', 'archived') AND v_proj.source_collaboration_draft_id IS NULL);

  IF v_eligible AND EXISTS (
    SELECT 1 FROM public.project_access_grants g
    WHERE g.project_id = v_proj.id
      AND g.recipient = caller_id
      AND g.revoked_at IS NULL
      AND g.redeemed_at IS NOT NULL
      AND (g.access_end IS NULL OR g.access_end > now())
      AND ((g.engagement = 'Permanent' AND NOT g.until_close) OR v_open)
      AND NOT EXISTS (
        SELECT 1 FROM eflow_r9.removed r
        WHERE r.project_id = v_proj.id
          AND r.user_id = caller_id
          AND r.scope = COALESCE(g.office_id, '00000000-0000-0000-0000-000000000000'::uuid)
      )
  ) THEN
    RETURN true;
  END IF;

  v_allowed := NOT EXISTS (
    SELECT 1 FROM eflow_r9.removed r
    WHERE r.project_id = v_proj.id
      AND r.user_id = caller_id
      AND (r.scope = COALESCE(v_caller.org_id, '00000000-0000-0000-0000-000000000000'::uuid) OR v_caller.org_id IS NULL)
  ) AND NOT EXISTS (
    SELECT 1 FROM public.project_office_members m
    JOIN public.project_offices o ON o.id = m.project_office_id
    WHERE o.project_id = v_proj.id
      AND m.user_id = caller_id
      AND (v_caller.org_id IS NULL OR o.office_id = v_caller.org_id)
      AND (m.access_ended_at IS NOT NULL
        OR m.access_end <= now()
        OR ((m.engagement <> 'Permanent' OR m.until_close) AND NOT v_open))
  );

  v_joined_head := (
    v_caller.role = 'head'
    AND COALESCE(v_caller.org_is_active, false)
    AND v_caller.org_head_user_id = caller_id
    AND EXISTS (
      SELECT 1 FROM public.project_offices o
      WHERE o.project_id = v_proj.id
        AND o.office_id = v_caller.org_id
        AND o.invitation_status = 'joined'
        AND o.relationship_type IN ('lead', 'collaborating')
    )
  );

  IF NOT (v_allowed OR v_joined_head) THEN
    RETURN false;
  END IF;

  IF v_eligible AND EXISTS (
    SELECT 1 FROM public.project_guest_members m
    JOIN public.project_offices o ON o.project_id = m.project_id AND o.office_id = m.office_id
    WHERE m.project_id = v_proj.id
      AND m.user_id = caller_id
      AND m.ended_at IS NULL
      AND (m.access_end IS NULL OR m.access_end > now())
      AND (m.engagement = 'Permanent' OR v_proj.status NOT IN ('completed', 'archived'))
      AND o.invitation_status = 'joined'
      AND o.relationship_type IN ('lead', 'collaborating')
  ) THEN
    RETURN true;
  END IF;

  v_is_proj_member := EXISTS (
    SELECT 1 FROM public.project_members pm
    WHERE pm.project_id = v_proj.id AND pm.user_id = caller_id
  );

  v_can_access_org := (v_proj.org_id IS NOT NULL AND (
    (v_caller.role = 'head' AND v_caller.org_path IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.organizations to2
      WHERE to2.id = v_proj.org_id
        AND (to2.path::text = v_caller.org_path OR to2.path::text LIKE v_caller.org_path || '.%')
    ))
    OR EXISTS (
      SELECT 1 FROM public.user_org_scope_grants gr
      JOIN public.organizations go ON go.id = gr.org_id
      JOIN public.organizations to2 ON to2.id = v_proj.org_id
      WHERE gr.user_id = caller_id
        AND (gr.expires_at IS NULL OR gr.expires_at > now())
        AND (to2.path::text = go.path::text OR to2.path::text LIKE go.path::text || '.%')
        AND gr.access_level IN ('read', 'review', 'manage')
    )
  ));

  v_phase6_access := EXISTS (
    SELECT 1 FROM public.project_offices o
    WHERE o.project_id = v_proj.id
      AND o.invitation_status <> 'revoked'
      AND (
        (o.contact_user_id = caller_id AND o.invitation_status IN ('awaiting_head', 'joined'))
        OR (v_caller.role = 'head' AND v_caller.org_id = o.office_id
            AND COALESCE(v_caller.org_is_active, false) AND v_caller.org_head_user_id = caller_id)
        OR (o.invitation_status = 'joined' AND v_caller.org_id = o.office_id AND (
          EXISTS (SELECT 1 FROM public.project_office_members m WHERE m.project_office_id = o.id AND m.user_id = caller_id)
          OR (o.relationship_type = 'lead'
              AND NOT EXISTS (SELECT 1 FROM public.project_office_members m WHERE m.project_office_id = o.id AND m.user_id = caller_id))
        ))
      )
  );

  IF EXISTS (SELECT 1 FROM public.project_guest_members gm WHERE gm.project_id = v_proj.id AND gm.user_id = caller_id)
     AND NOT (v_proj.owner_id = caller_id OR v_is_proj_member OR v_can_access_org OR v_phase6_access) THEN
    RETURN false;
  END IF;

  IF v_proj.source_collaboration_draft_id IS NOT NULL THEN
    IF public.can_see_collaboration_project(v_proj.id, caller_id)
       OR public.is_collaboration_participant(v_proj.source_collaboration_draft_id, caller_id) THEN
      RETURN true;
    END IF;
  ELSIF v_proj.owner_id = caller_id
     OR v_proj.created_by = caller_id
     OR v_is_proj_member
     OR v_can_access_org
     OR EXISTS (
       SELECT 1 FROM public.tasks tk
       WHERE tk.linked_project_id = v_proj.id
         AND tk.deleted_at IS NULL
         AND (tk.assigned_to = caller_id
           OR tk.recommendation_lead_id = caller_id
           OR (tk.team_member_ids IS NOT NULL AND caller_id = ANY(tk.team_member_ids)))
     ) THEN
    RETURN true;
  END IF;

  IF v_phase6_access THEN
    RETURN true;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.project_office_identities i
    WHERE i.project_id = v_proj.id
      AND i.contact_user_id = caller_id
      AND i.contact_status = 'accepted'
      AND (i.project_office_id IS NULL
        OR EXISTS (SELECT 1 FROM public.project_offices o WHERE o.id = i.project_office_id AND o.invitation_status <> 'revoked'))
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.can_see_task(target_task uuid, caller_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  t record;
  v_proj record;
  v_caller record;
  v_eligible boolean;
  v_open boolean;
  v_can_see_proj boolean := false;
  v_can_access_org boolean := false;
  v_r8_task boolean := false;
BEGIN
  IF target_task IS NULL OR caller_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT tk.id, tk.linked_project_id, tk.org_id, tk.assigned_to, tk.created_by,
         tk.recommendation_lead_id, tk.reviewer_id, tk.backup_reviewer_id,
         tk.team_member_ids, tk.proposed_office_identity_id, tk.source_collaboration_draft_id
    INTO t
  FROM public.tasks tk
  WHERE tk.id = target_task AND tk.deleted_at IS NULL;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  SELECT pr.id, pr.role::text AS role, pr.is_active, pr.org_id,
         o.path::text AS org_path, o.is_active AS org_is_active,
         o.head_user_id AS org_head_user_id, u.email_confirmed_at
    INTO v_caller
  FROM public.profiles pr
  LEFT JOIN public.organizations o ON o.id = pr.org_id
  LEFT JOIN auth.users u ON u.id = pr.id
  WHERE pr.id = caller_id;
  IF NOT FOUND OR NOT v_caller.is_active OR v_caller.role IS NULL OR v_caller.role = 'admin' THEN
    RETURN false;
  END IF;

  IF t.linked_project_id IS NOT NULL THEN
    SELECT p.id, p.org_id, p.created_by, p.project_lead_id, p.status,
           p.publication_state, p.source_collaboration_draft_id
      INTO v_proj
    FROM public.projects p
    WHERE p.id = t.linked_project_id;
    IF NOT FOUND THEN
      RETURN false;
    END IF;

    IF v_proj.publication_state = 'draft' THEN
      RETURN caller_id = auth.uid() AND v_proj.status = 'planning' AND (
        (v_caller.role = 'head' AND v_caller.org_id = v_proj.org_id
         AND COALESCE(v_caller.org_is_active, false) AND v_caller.org_head_user_id = caller_id)
        OR ((v_proj.project_lead_id = caller_id OR v_proj.created_by = caller_id) AND v_caller.org_id = v_proj.org_id
            AND v_caller.role NOT IN ('admin', 'super_admin', 'viewer'))
      );
    END IF;

    IF v_proj.publication_state IS DISTINCT FROM 'published' THEN
      RETURN false;
    END IF;
  END IF;

  v_eligible := (v_caller.role IN ('head', 'member', 'accounting_staff') AND v_caller.email_confirmed_at IS NOT NULL);

  IF t.linked_project_id IS NOT NULL
     AND t.proposed_office_identity_id IS NULL
     AND t.source_collaboration_draft_id IS NULL
     AND v_eligible THEN
    v_open := (v_proj.status NOT IN ('completed', 'archived') AND v_proj.source_collaboration_draft_id IS NULL);
    IF EXISTS (
      SELECT 1 FROM public.project_access_grants g
      WHERE g.project_id = t.linked_project_id
        AND g.recipient = caller_id
        AND g.revoked_at IS NULL
        AND g.redeemed_at IS NOT NULL
        AND (g.access_end IS NULL OR g.access_end > now())
        AND ((g.engagement = 'Permanent' AND NOT g.until_close) OR v_open)
        AND NOT EXISTS (
          SELECT 1 FROM eflow_r9.removed r
          WHERE r.project_id = t.linked_project_id
            AND r.user_id = caller_id
            AND r.scope = COALESCE(g.office_id, '00000000-0000-0000-0000-000000000000'::uuid)
        )
    ) THEN
      RETURN true;
    END IF;
  END IF;

  IF t.linked_project_id IS NOT NULL THEN
    v_can_see_proj := public.can_see_project(t.linked_project_id, caller_id);
    IF t.source_collaboration_draft_id IS NULL THEN
      IF NOT v_can_see_proj THEN
        RETURN false;
      END IF;
      IF t.created_by = caller_id
         OR t.reviewer_id = caller_id
         OR t.backup_reviewer_id = caller_id
         OR NOT EXISTS (
           SELECT 1 FROM public.project_guest_members gm
           WHERE gm.project_id = t.linked_project_id AND gm.user_id = caller_id
         ) THEN
        RETURN true;
      END IF;
      IF eflow_r8.independent(t.linked_project_id, caller_id) THEN
        RETURN true;
      END IF;
      RETURN t.proposed_office_identity_id IS NULL
        AND v_eligible
        AND EXISTS (
          SELECT 1 FROM public.project_guest_members m
          JOIN public.project_offices o ON o.project_id = m.project_id AND o.office_id = m.office_id
          WHERE m.project_id = t.linked_project_id
            AND (t.org_id IS NULL OR m.office_id = t.org_id)
            AND m.user_id = caller_id
            AND m.ended_at IS NULL
            AND (m.access_end IS NULL OR m.access_end > now())
            AND (m.engagement = 'Permanent' OR v_proj.status NOT IN ('completed', 'archived'))
            AND o.invitation_status = 'joined'
            AND o.relationship_type IN ('lead', 'collaborating')
        );
    END IF;
  END IF;

  v_r8_task := (
    t.assigned_to = caller_id
    OR t.created_by = caller_id
    OR t.recommendation_lead_id = caller_id
    OR t.reviewer_id = caller_id
    OR t.backup_reviewer_id = caller_id
    OR (t.team_member_ids IS NOT NULL AND caller_id = ANY(t.team_member_ids))
    OR (t.linked_project_id IS NOT NULL AND v_can_see_proj)
  );

  IF NOT v_r8_task AND t.source_collaboration_draft_id IS NULL AND t.org_id IS NOT NULL THEN
    v_can_access_org := (
      (v_caller.role = 'head' AND v_caller.org_path IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.organizations to2
        WHERE to2.id = t.org_id
          AND (to2.path::text = v_caller.org_path OR to2.path::text LIKE v_caller.org_path || '.%')
      ))
      OR EXISTS (
        SELECT 1 FROM public.user_org_scope_grants gr
        JOIN public.organizations go ON go.id = gr.org_id
        JOIN public.organizations to2 ON to2.id = t.org_id
        WHERE gr.user_id = caller_id
          AND (gr.expires_at IS NULL OR gr.expires_at > now())
          AND (to2.path::text = go.path::text OR to2.path::text LIKE go.path::text || '.%')
          AND gr.access_level IN ('read', 'review', 'manage')
      )
    );
    v_r8_task := v_can_access_org;
  END IF;

  IF NOT v_r8_task THEN
    RETURN false;
  END IF;

  IF t.linked_project_id IS NULL
     OR t.created_by = caller_id
     OR t.reviewer_id = caller_id
     OR t.backup_reviewer_id = caller_id
     OR NOT EXISTS (
       SELECT 1 FROM public.project_guest_members gm
       WHERE gm.project_id = t.linked_project_id AND gm.user_id = caller_id
     ) THEN
    RETURN true;
  END IF;

  RETURN eflow_r8.independent(t.linked_project_id, caller_id);
END;
$$;

-- Allow financial governance notifications to reach Accounting Staff / Head even for draft projects.
CREATE OR REPLACE FUNCTION eflow_publication.suppress_draft_notice()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF new.type IN ('project_funding_request', 'project_funding_certification', 'project_funding_decided') THEN
    RETURN new;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.publication_state = 'draft'
      AND p.id IN (new.project_id, (SELECT t.linked_project_id FROM public.tasks t WHERE t.id = new.task_id))
  ) THEN
    RETURN null;
  END IF;
  RETURN new;
END;
$$;

-- Update project setup & metadata triggers + RPCs to use can_configure_project.
CREATE OR REPLACE FUNCTION eflow_project.save_details(p_project uuid, p_details jsonb)
RETURNS public.projects
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  p public.projects;
  leader uuid;
BEGIN
  SELECT * INTO p FROM public.projects WHERE id = p_project FOR UPDATE;
  IF p.id IS NULL OR auth.uid() IS NULL OR NOT public.can_configure_project(p.id, auth.uid()) THEN
    RAISE EXCEPTION 'You need project management access on this project to save project setup' USING ERRCODE = '42501';
  END IF;
  IF p.updated_at IS DISTINCT FROM (p_details->>'version')::timestamptz THEN
    RAISE EXCEPTION 'Project changed elsewhere. Reopen setup and review current details before saving' USING ERRCODE = '40001';
  END IF;
  leader := NULLIF(p_details->>'lead', '')::uuid;
  IF leader IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = leader AND is_active AND org_id = p.org_id AND role::text NOT IN ('admin', 'viewer', 'super_admin')
  ) THEN
    RAISE EXCEPTION 'Choose an active project lead from the implementing office' USING ERRCODE = '23514';
  END IF;
  IF length(btrim(p_details->>'title')) NOT BETWEEN 1 AND 200
     OR length(COALESCE(p_details->>'description', '')) > 12000
     OR length(COALESCE(p_details->>'scope', '')) > 12000 THEN
    RAISE EXCEPTION 'Enter a project title up to 200 characters; description and scope may each contain up to 12000 characters' USING ERRCODE = '23514';
  END IF;

  UPDATE public.projects
  SET title = btrim(p_details->>'title'),
      description = COALESCE(p_details->>'description', ''),
      scope = COALESCE(p_details->>'scope', ''),
      project_lead_id = leader,
      start_date = COALESCE(NULLIF(p_details->>'start', '')::date, start_date),
      target_date = COALESCE(NULLIF(p_details->>'end', '')::date, target_date),
      funding_not_required = COALESCE((p_details->>'noFunding')::boolean, false),
      updated_at = clock_timestamp()
  WHERE id = p.id
  RETURNING * INTO p;

  IF p.start_date IS NOT NULL AND p.target_date IS NOT NULL AND p.start_date > p.target_date THEN
    RAISE EXCEPTION 'Project target date must be on or after its start date' USING ERRCODE = '23514';
  END IF;

  IF p.project_lead_id IS NOT NULL THEN
    INSERT INTO public.project_office_members (project_office_id, user_id, selected_by)
      SELECT id, p.project_lead_id, auth.uid()
      FROM public.project_offices
      WHERE project_id = p.id AND office_id = p.org_id AND relationship_type = 'lead'
      ON CONFLICT DO NOTHING;
    INSERT INTO public.project_members (project_id, user_id, role)
      VALUES (p.id, p.project_lead_id, 'member')
      ON CONFLICT DO NOTHING;
  END IF;

  RETURN p;
END;
$$;

CREATE OR REPLACE FUNCTION eflow_project.guard_definition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF new.status = 'completed' AND old.status IS DISTINCT FROM new.status
     AND NOT public.phase2_is_office_head(auth.uid(), new.org_id) THEN
    RAISE EXCEPTION 'Only the appointed Head can approve project completion' USING ERRCODE = '42501';
  END IF;

  IF ROW(new.scope, new.project_lead_id, new.funding_not_required, new.setup_completed_at)
     IS DISTINCT FROM ROW(old.scope, old.project_lead_id, old.funding_not_required, old.setup_completed_at) THEN
    IF NOT (
      pg_catalog.current_setting('eflow.certifying_project_funding', true) = '1'
      AND ROW(new.scope, new.project_lead_id, new.setup_completed_at)
          IS NOT DISTINCT FROM ROW(old.scope, old.project_lead_id, old.setup_completed_at)
      AND new.funding_not_required = false
    ) THEN
      IF auth.uid() IS NULL OR NOT public.can_configure_project(old.id, auth.uid()) THEN
        RAISE EXCEPTION 'Only the Office Head or owning project creator may authorize project setup' USING ERRCODE = '42501';
      END IF;
    END IF;
    IF old.status IN ('completed', 'archived') THEN
      RAISE EXCEPTION 'Closed project setup is read-only' USING ERRCODE = '23514';
    END IF;
    IF new.project_lead_id IS DISTINCT FROM old.project_lead_id
       AND EXISTS (SELECT 1 FROM public.tasks WHERE linked_project_id = old.id AND status = 'for_review' AND deleted_at IS NULL) THEN
      RAISE EXCEPTION 'Resolve pending task reviews before changing the project lead' USING ERRCODE = '23514';
    END IF;
  END IF;

  IF new.funding_not_required AND EXISTS (
    SELECT 1 FROM eflow_project.funding WHERE project_id = new.id AND amount > 0
  ) THEN
    RAISE EXCEPTION 'Release existing project funding before declaring no funding required' USING ERRCODE = '23514';
  END IF;

  IF new.funding_not_required AND EXISTS (
    SELECT 1 FROM eflow_project.funding_requests WHERE project_id = new.id AND status IN ('pending', 'pending_accounting')
  ) THEN
    RAISE EXCEPTION 'Cancel or resolve open funding requests before declaring no funding required' USING ERRCODE = '23514';
  END IF;

  RETURN new;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_project_metadata_edit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF pg_catalog.current_setting('eflow.syncing_project_schedule', true) = '1'
     AND ROW(new.title, new.description, new.priority) IS NOT DISTINCT FROM ROW(old.title, old.description, old.priority)
     AND old.status NOT IN ('completed', 'archived') THEN
    RETURN new;
  END IF;

  IF auth.uid() IS NOT NULL AND ROW(new.title, new.description, new.priority, new.start_date, new.target_date)
      IS DISTINCT FROM ROW(old.title, old.description, old.priority, old.start_date, old.target_date) THEN
    IF old.status IN ('completed', 'archived') OR NOT (
      public.can_configure_project(old.id, auth.uid())
      OR (ROW(new.priority, new.start_date, new.target_date) IS NOT DISTINCT FROM ROW(old.priority, old.start_date, old.target_date)
        AND eflow_r9.can_edit_selected_project(old.id, old.org_id, auth.uid()))
    ) THEN
      RAISE EXCEPTION 'Project metadata is read-only for this account or lifecycle' USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN new;
END;
$$;

CREATE OR REPLACE FUNCTION eflow_project.finish_setup(p_project uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  p public.projects;
BEGIN
  SELECT * INTO p FROM public.projects WHERE id = p_project FOR UPDATE;
  IF p.id IS NULL OR auth.uid() IS NULL OR NOT public.can_configure_project(p.id, auth.uid()) THEN
    RAISE EXCEPTION 'Only the Office Head or project creator may finish setup' USING ERRCODE = '42501';
  END IF;
  UPDATE public.projects SET setup_completed_at = now(), updated_at = clock_timestamp() WHERE id = p.id;
  IF NOT eflow_project.ready(p.id) THEN
    IF NOT p.funding_not_required AND EXISTS (
      SELECT 1 FROM eflow_project.funding_requests WHERE project_id = p.id AND status = 'pending_accounting'
    ) THEN
      RAISE EXCEPTION 'Project funding is awaiting Accounting Staff certification before setup can finish' USING ERRCODE = '23514';
    ELSIF NOT p.funding_not_required AND EXISTS (
      SELECT 1 FROM eflow_project.funding_requests WHERE project_id = p.id AND status = 'pending'
    ) THEN
      RAISE EXCEPTION 'Project funding is awaiting Office Head endorsement and Accounting Staff certification' USING ERRCODE = '23514';
    END IF;
    RAISE EXCEPTION 'Provide title, description, scope, project lead, and certified funding or select No funding required' USING ERRCODE = '23514';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_project_setup_tasks(p_project_id uuid, p_request_id uuid, p_review jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO ''
AS $$
DECLARE
  project_row public.projects;
  result jsonb;
  was_saved boolean;
  source text := p_review->>'setupSource';
BEGIN
  SELECT * INTO project_row FROM public.projects WHERE id = p_project_id FOR UPDATE;
  IF NOT FOUND OR NOT public.can_configure_project(project_row.id, auth.uid()) THEN
    RAISE EXCEPTION 'You need project management access on this project to add setup tasks.' USING ERRCODE = '42501';
  END IF;
  IF source IS NULL OR source NOT IN ('template', 'ai')
     OR p_review->'offices' IS DISTINCT FROM '[]'::jsonb
     OR p_review->'applyProjectDetails' IS DISTINCT FROM 'false'::jsonb THEN
    RAISE EXCEPTION 'Invalid project task draft.' USING ERRCODE = '22023';
  END IF;
  SELECT EXISTS(SELECT 1 FROM public.project_import_batches WHERE id = p_request_id) INTO was_saved;
  result := public.phase5_import_project_work(p_project_id, p_request_id, p_review);
  IF NOT was_saved AND source = 'template' THEN
    UPDATE public.subtasks SET source = 'template'
      WHERE task_id IN (SELECT value::uuid FROM jsonb_each_text(result->'taskIds'));
    UPDATE public.tasks SET recommendation_source = NULL, recommendation_reasoning = NULL
      WHERE linked_project_id = p_project_id AND import_batch_id = p_request_id::text;
  END IF;
  RETURN result;
END;
$$;

-- Update PDF import & member staffing helpers for delegated project creators on their own projects.
CREATE OR REPLACE FUNCTION eflow_phase65.require_lead(p_project uuid, p_actor uuid)
RETURNS public.projects
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  p public.projects;
BEGIN
  SELECT * INTO p FROM public.projects WHERE id = p_project FOR UPDATE;
  IF p.id IS NULL OR p_actor IS NULL OR NOT public.can_configure_project(p.id, p_actor) THEN
    RAISE EXCEPTION 'Project configuration access is required for this operation' USING ERRCODE = '42501';
  END IF;
  IF p.status IN ('completed', 'archived') OR p.source_collaboration_draft_id IS NOT NULL THEN
    RAISE EXCEPTION 'Closed or governed project identities are read-only' USING ERRCODE = '22023';
  END IF;
  RETURN p;
END;
$$;

CREATE OR REPLACE FUNCTION public.phase6_set_members(p_id uuid, p_users uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  o public.project_offices;
  p public.projects;
  u uuid;
BEGIN
  SELECT * INTO o FROM public.project_offices WHERE id = p_id FOR UPDATE;
  SELECT * INTO p FROM public.projects WHERE id = o.project_id;
  IF o.id IS NULL
     OR NOT (
       public.phase2_is_office_head(auth.uid(), o.office_id)
       OR (o.relationship_type = 'lead' AND o.office_id = p.org_id AND public.can_configure_project(p.id, auth.uid()))
     )
     OR o.invitation_status <> 'joined'
     OR p.status IN ('completed', 'archived') THEN
    RAISE EXCEPTION 'Only the Office Head or owning project creator can select project members for this office' USING ERRCODE = '42501';
  END IF;
  IF p_users IS NULL OR cardinality(p_users) > 200 THEN
    RAISE EXCEPTION 'Invalid member selection' USING ERRCODE = '22023';
  END IF;
  FOREACH u IN ARRAY p_users LOOP
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = u AND org_id = o.office_id AND is_active AND role::text <> 'admin') THEN
      RAISE EXCEPTION 'Select active members of your own Office' USING ERRCODE = '42501';
    END IF;
  END LOOP;
  IF EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.linked_project_id = p.id AND t.org_id = o.office_id AND t.deleted_at IS NULL AND t.status NOT IN ('completed', 'cancelled')
      AND EXISTS (
        SELECT 1 FROM public.project_office_members m
        WHERE m.project_office_id = o.id AND NOT m.user_id = ANY(p_users)
          AND (m.user_id = t.assigned_to OR m.user_id = t.recommendation_lead_id OR m.user_id = ANY(COALESCE(t.team_member_ids, '{}'::uuid[])))
      )
  ) THEN
    RAISE EXCEPTION 'Reassign active work before removing its project members' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.project_office_members WHERE project_office_id = o.id AND NOT user_id = ANY(p_users)) THEN
    RAISE EXCEPTION 'Review removal in Members before ending selected project access';
  END IF;
  INSERT INTO public.project_office_members (project_office_id, user_id, selected_by)
    SELECT o.id, distinct_user, auth.uid() FROM (SELECT DISTINCT unnest(p_users) distinct_user) x
    ON CONFLICT DO NOTHING;
  PERFORM public.phase2_audit(auth.uid(), o.office_id, o.id, 'project_office_members_selected');
END;
$$;

CREATE OR REPLACE FUNCTION public.auto_assign_project_task(p_root uuid, p_revision integer, p_request uuid, p_lead uuid, p_people uuid[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  r jsonb;
  o public.project_offices;
  receipt eflow_r7.receipts;
  payload jsonb;
  people uuid[];
  roster uuid[];
  u uuid;
  v_allowed boolean := false;
BEGIN
  PERFORM eflow_r3.actor();
  PERFORM eflow_r7.lock_impact(p_root);
  r := eflow_r7.root(p_root);
  v_allowed := COALESCE(eflow_r7.head(p_root), false)
    OR (
      r->>'kind' = 'office'
      AND public.can_configure_project((r->>'project')::uuid, auth.uid())
      AND EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = (r->>'project')::uuid AND p.org_id = (r->>'office')::uuid
      )
    );
  IF r->>'kind' <> 'office' OR NOT v_allowed THEN
    RAISE EXCEPTION 'Project staffing access in your office is required to auto assign work' USING ERRCODE = '42501';
  END IF;
  IF p_request IS NULL OR p_lead IS NULL OR p_people IS NULL OR cardinality(p_people) NOT BETWEEN 1 AND 200 OR NOT p_lead = ANY(p_people) THEN
    RAISE EXCEPTION 'Choose a lead and task team' USING ERRCODE = '22023';
  END IF;
  SELECT array_agg(DISTINCT id ORDER BY id) INTO people FROM unnest(p_people) id;
  payload := jsonb_build_object('lead', p_lead, 'people', people);
  SELECT * INTO receipt FROM eflow_r7.receipts WHERE actor_id = auth.uid() AND request_id = p_request;
  IF FOUND THEN
    IF receipt.root_id <> p_root OR receipt.payload <> jsonb_build_object('command', 'root_lead', 'payload', payload) THEN
      RAISE EXCEPTION 'Request identity already used' USING ERRCODE = '23505';
    END IF;
    RETURN public.r7_work_tree(p_root);
  END IF;
  IF NOT (r->>'open')::bool OR r->>'status' NOT IN ('pending_assignment', 'todo') OR r->>'lead' IS NOT NULL THEN
    RAISE EXCEPTION 'Auto assign is for tasks that have not started and have no lead. Existing assignments are kept.' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM eflow_r7.nodes WHERE task_id = p_root AND lead_id IS NOT NULL) THEN
    RAISE EXCEPTION 'This task already has subtask leads. Choose its lead manually to review their assignments.' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements_text(r->'people') id WHERE NOT id::uuid = ANY(people)) THEN
    RAISE EXCEPTION 'Keep the existing task contributors' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO o FROM public.project_offices WHERE project_id = (r->>'project')::uuid AND office_id = (r->>'office')::uuid FOR UPDATE;
  IF o.id IS NULL OR o.invitation_status <> 'joined' OR o.relationship_type = 'observer' THEN
    RAISE EXCEPTION 'A joined participating Office is required' USING ERRCODE = '42501';
  END IF;
  FOREACH u IN ARRAY people LOOP
    IF NOT eflow_phase65.office_candidate(p_root, u) THEN
      RAISE EXCEPTION 'Choose people who joined the responsible project Office' USING ERRCODE = '42501';
    END IF;
    IF NOT COALESCE(eflow_r7.member(o.project_id, o.office_id, u), false) AND NOT (
      eflow_r9.allowed(o.project_id, u, o.office_id)
      AND EXISTS (SELECT 1 FROM public.profiles WHERE id = u AND org_id = o.office_id AND is_active AND role::text <> 'admin')
    ) THEN
      RAISE EXCEPTION 'A selected person is no longer available for this project' USING ERRCODE = '42501';
    END IF;
  END LOOP;
  SELECT COALESCE(array_agg(DISTINCT user_id), '{}'::uuid[]) INTO roster FROM public.project_office_members WHERE project_office_id = o.id;
  SELECT COALESCE(array_agg(DISTINCT id), '{}'::uuid[]) INTO roster
  FROM unnest(roster || ARRAY(
    SELECT p.id FROM public.profiles p
    WHERE p.id = ANY(people) AND p.org_id = o.office_id
      AND NOT EXISTS (
        SELECT 1 FROM public.project_guest_members gm
        WHERE gm.project_id = o.project_id AND gm.office_id = o.office_id AND gm.user_id = p.id
          AND gm.ended_at IS NULL AND (gm.access_end IS NULL OR gm.access_end > now())
      )
  )) id;
  PERFORM public.phase6_set_members(o.id, roster);
  PERFORM eflow_r7.command(p_root, p_revision, p_request, 'root_lead', payload);
  RETURN public.r7_work_tree(p_root);
END;
$$;

-- ============================================================================
-- 3. ANTI-CORRUPTION ACCOUNTING FUNDING COUNTERSIGN (OPTION 1)
-- ============================================================================

ALTER TABLE eflow_project.funding_requests
  ADD COLUMN IF NOT EXISTS head_approved_by uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS head_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS head_decision_reason text,
  ADD COLUMN IF NOT EXISTS accounting_decided_by uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS accounting_decided_at timestamptz,
  ADD COLUMN IF NOT EXISTS accounting_decision_reason text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'eflow_project.funding_requests'::regclass
      AND conname = 'funding_requests_status_check'
  ) THEN
    ALTER TABLE eflow_project.funding_requests
      ADD CONSTRAINT funding_requests_status_check
      CHECK (status IN ('pending', 'pending_accounting', 'approved', 'rejected', 'cancelled'));
  END IF;
END $$;

-- Private helper: validate funding lines against locked fiscal budgets and return total.
CREATE OR REPLACE FUNCTION eflow_project._validate_funding_lines(p_org_id uuid, p_lines jsonb)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  line jsonb;
  s public.office_budget_sections;
  b public.department_fiscal_budgets;
  amount numeric;
  total numeric := 0;
BEGIN
  IF p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'Select funding sources, amounts and a reason' USING ERRCODE = '23514';
  END IF;

  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_lines) item
    WHERE NULLIF(item->>'partitionId', '') IS NOT NULL
    GROUP BY item->>'partitionId'
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Use each budget source only once.' USING ERRCODE = '23514';
  END IF;

  FOR line IN SELECT value FROM jsonb_array_elements(p_lines) LOOP
    amount := (line->>'amount')::numeric;
    IF amount IS NULL OR amount <= 0 OR amount <> round(amount, 2) OR amount > 90000000000 THEN
      RAISE EXCEPTION 'Enter a positive amount in cents' USING ERRCODE = '23514';
    END IF;

    SELECT * INTO s FROM public.office_budget_sections WHERE id = (line->>'partitionId')::uuid AND NOT retired;
    SELECT * INTO b FROM public.department_fiscal_budgets WHERE id = s.fiscal_budget_id AND org_id = p_org_id AND status = 'locked';
    IF b.id IS NULL OR EXISTS (SELECT 1 FROM public.office_budget_sections WHERE parent_id = s.id AND NOT retired) THEN
      RAISE EXCEPTION 'Choose a released leaf funding account from this office and a locked fiscal year' USING ERRCODE = '23514';
    END IF;

    IF amount > s.amount - s.held_amount - eflow_budget.partition_committed(s.id) THEN
      RAISE EXCEPTION 'Funding source %: requested %, available %', s.name, amount, s.amount - s.held_amount - eflow_budget.partition_committed(s.id) USING ERRCODE = '23514';
    END IF;

    IF amount > b.approved_amount - eflow_budget.section_total(b.id, true) - (
      SELECT COALESCE(sum(bc.amount), 0) FROM public.budget_commitments bc WHERE fiscal_budget_id = b.id AND status = 'active'
    ) THEN
      RAISE EXCEPTION 'Office Budget has insufficient available funding' USING ERRCODE = '23514';
    END IF;

    total := total + amount;
  END LOOP;

  RETURN total;
END;
$$;

-- Private helper: atomically commit certified funding lines after Accounting Staff countersigns.
CREATE OR REPLACE FUNCTION eflow_project._commit_authorized_funding(
  p_project uuid,
  p_lines jsonb,
  p_reason text,
  p_key uuid,
  p_certifier uuid,
  p_head_approver uuid
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  p public.projects;
  line jsonb;
  s public.office_budget_sections;
  b public.department_fiscal_budgets;
  c uuid;
  amount numeric;
  total numeric := 0;
  payload jsonb;
BEGIN
  SELECT * INTO p FROM public.projects WHERE id = p_project FOR UPDATE;
  IF p.id IS NULL OR p.status IN ('completed', 'archived') THEN
    RAISE EXCEPTION 'Project is unavailable for funding commitment' USING ERRCODE = '23514';
  END IF;

  IF p.project_lead_id IS NULL OR btrim(p.description) = '' OR btrim(p.scope) = '' THEN
    RAISE EXCEPTION 'Save complete project details and scope before certifying funding' USING ERRCODE = '23514';
  END IF;

  PERFORM 1 FROM public.department_fiscal_budgets fb WHERE fb.org_id = p.org_id ORDER BY fb.id FOR UPDATE;
  total := eflow_project._validate_funding_lines(p.org_id, p_lines);

  FOR line IN SELECT value FROM jsonb_array_elements(p_lines) LOOP
    amount := (line->>'amount')::numeric;
    SELECT * INTO s FROM public.office_budget_sections WHERE id = (line->>'partitionId')::uuid AND NOT retired;
    SELECT * INTO b FROM public.department_fiscal_budgets WHERE id = s.fiscal_budget_id AND org_id = p.org_id AND status = 'locked';

    SELECT bc.id INTO c
    FROM public.budget_commitments bc
    JOIN eflow_project.funding pf ON pf.commitment_id = bc.id
    WHERE pf.project_id = p.id AND bc.fiscal_budget_id = b.id AND bc.status = 'active'
    LIMIT 1;

    IF c IS NULL THEN
      INSERT INTO public.budget_commitments (
        fiscal_budget_id, title, amount, created_by, funding_kind, authorization_key, authorization_payload
      ) VALUES (
        b.id, 'Project: ' || p.title, 0, p_certifier, 'direct_work', gen_random_uuid(),
        jsonb_build_object('projectId', p.id, 'headApprovedBy', p_head_approver, 'certifiedBy', p_certifier)
      ) RETURNING id INTO c;
    END IF;

    INSERT INTO eflow_project.funding (project_id, commitment_id, partition_id, fiscal_year, quarter, amount)
    VALUES (p.id, c, s.id, b.fiscal_year, NULL, amount)
    ON CONFLICT (project_id, partition_id) WHERE quarter IS NULL
    DO UPDATE SET amount = eflow_project.funding.amount + EXCLUDED.amount;

    UPDATE public.budget_commitments
    SET amount = (SELECT sum(pf.amount) FROM eflow_project.funding pf WHERE pf.commitment_id = c)
    WHERE id = c;

    INSERT INTO public.budget_ledger_entries (
      fiscal_budget_id, org_id, commitment_id, entry_type, amount, description, actor_id, reason, metadata
    ) VALUES (
      b.id, p.org_id, c, 'proposal_committed', amount,
      'Project funding certified: ' || p.title, p_certifier, p_reason,
      jsonb_build_object('projectId', p.id, 'partitionId', s.id, 'headApprovedBy', p_head_approver, 'certifiedBy', p_certifier)
    );
  END LOOP;

  PERFORM pg_catalog.set_config('eflow.certifying_project_funding', '1', true);
  UPDATE public.projects SET funding_not_required = false, updated_at = clock_timestamp() WHERE id = p.id;
  PERFORM pg_catalog.set_config('eflow.certifying_project_funding', '', true);

  payload := jsonb_build_object(
    'project', p_project,
    'lines', p_lines,
    'reason', p_reason,
    'headApprovedBy', p_head_approver,
    'certifiedBy', p_certifier,
    'authorized', total
  );
  INSERT INTO eflow_project.commands (actor_id, request_id, payload, result)
  VALUES (p_certifier, p_key, payload, jsonb_build_object('authorized', total))
  ON CONFLICT DO NOTHING;

  INSERT INTO public.audit_events (actor_id, entity_type, entity_id, action, org_id, after_data, reason)
  VALUES (p_certifier, 'project', p.id::text, 'project.funding_certified_by_accounting', p.org_id, payload, p_reason);

  RETURN total;
END;
$$;

-- Office Head funding submission now routes to Accounting Staff certification (Option 1 anti-corruption).
CREATE OR REPLACE FUNCTION eflow_project.authorize_funding(p_project uuid, p_lines jsonb, p_reason text, p_key uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  p public.projects;
  existing_req eflow_project.funding_requests;
  total numeric := 0;
  v_actor_name text;
BEGIN
  SELECT * INTO p FROM public.projects WHERE id = p_project FOR UPDATE;
  IF p.id IS NULL OR auth.uid() IS NULL OR NOT public.phase2_is_office_head(auth.uid(), p.org_id) OR p.status IN ('completed', 'archived') THEN
    RAISE EXCEPTION 'Only the appointed Head may endorse funding for an open project' USING ERRCODE = '42501';
  END IF;
  IF p_key IS NULL OR btrim(COALESCE(p_reason, '')) = '' THEN
    RAISE EXCEPTION 'Select funding sources, amounts and an authorization reason' USING ERRCODE = '23514';
  END IF;
  IF p.project_lead_id IS NULL OR btrim(p.description) = '' OR btrim(p.scope) = '' THEN
    RAISE EXCEPTION 'Save complete project details and scope before requesting funding certification' USING ERRCODE = '23514';
  END IF;

  SELECT * INTO existing_req FROM eflow_project.funding_requests WHERE id = p_key;
  IF FOUND THEN
    IF existing_req.actor_id <> auth.uid() OR existing_req.project_id <> p_project
       OR existing_req.lines <> p_lines OR existing_req.reason <> p_reason THEN
      RAISE EXCEPTION 'This request key belongs to different funding details' USING ERRCODE = '23514';
    END IF;
    SELECT COALESCE(sum((item->>'amount')::numeric), 0) INTO total FROM jsonb_array_elements(existing_req.lines) item;
    RETURN jsonb_build_object(
      'authorized', CASE WHEN existing_req.status = 'approved' THEN total ELSE 0 END,
      'requested', total,
      'status', existing_req.status,
      'requestId', existing_req.id
    );
  END IF;

  total := eflow_project._validate_funding_lines(p.org_id, p_lines);

  INSERT INTO eflow_project.funding_requests (
    id, project_id, actor_id, lines, reason, status,
    head_approved_by, head_approved_at, head_decision_reason
  ) VALUES (
    p_key, p.id, auth.uid(), p_lines, btrim(p_reason), 'pending_accounting',
    auth.uid(), now(), 'Endorsed by Office Head for Accounting Staff certification'
  );

  IF p.funding_not_required THEN
    PERFORM pg_catalog.set_config('eflow.certifying_project_funding', '1', true);
    UPDATE public.projects SET funding_not_required = false, updated_at = clock_timestamp() WHERE id = p.id;
    PERFORM pg_catalog.set_config('eflow.certifying_project_funding', '', true);
  END IF;

  SELECT COALESCE(full_name, 'Office Head') INTO v_actor_name FROM public.profiles WHERE id = auth.uid();

  INSERT INTO public.notifications (user_id, type, title, message, project_id, org_id, actor_id, actor_name)
  SELECT acc.id,
         'project_funding_certification',
         'Project funding certification needed',
         v_actor_name || ' submitted ₱' || to_char(total, 'FM999,999,999,990.00') || ' for "' || p.title || '". Accounting certification is required before funds are committed.',
         p.id,
         p.org_id,
         auth.uid(),
         v_actor_name
  FROM public.profiles acc
  WHERE acc.org_id = p.org_id
    AND acc.is_active = true
    AND acc.role::text = 'accounting_staff'
    AND acc.id <> auth.uid()
    AND acc.id IS DISTINCT FROM p.created_by
    AND acc.id IS DISTINCT FROM p.project_lead_id;

  INSERT INTO public.audit_events (actor_id, entity_type, entity_id, action, org_id, after_data, reason)
  VALUES (
    auth.uid(), 'project', p.id::text, 'project.funding_submitted_for_certification', p.org_id,
    jsonb_build_object('requestId', p_key, 'requested', total, 'lines', p_lines), btrim(p_reason)
  );

  RETURN jsonb_build_object(
    'authorized', 0,
    'requested', total,
    'status', 'pending_accounting',
    'requestId', p_key
  );
END;
$$;

-- Delegated project creator or project lead requests funding -> goes to Head first, then Accounting.
CREATE OR REPLACE FUNCTION eflow_project.request_funding(p_project uuid, p_lines jsonb, p_reason text, p_key uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  p public.projects;
  total numeric := 0;
  v_actor_name text;
  v_head_id uuid;
BEGIN
  SELECT * INTO p FROM public.projects WHERE id = p_project FOR UPDATE;
  IF p.id IS NULL OR auth.uid() IS NULL
     OR NOT (eflow_project.lead(p_project, auth.uid()) OR public.can_configure_project(p_project, auth.uid())) THEN
    RAISE EXCEPTION 'Current project lead or creator access required' USING ERRCODE = '42501';
  END IF;
  IF p.status IN ('completed', 'archived') THEN
    RAISE EXCEPTION 'Closed projects cannot request funding' USING ERRCODE = '23514';
  END IF;
  IF p_key IS NULL OR btrim(COALESCE(p_reason, '')) = '' THEN
    RAISE EXCEPTION 'Choose funding sources, amounts and a reason' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (
    SELECT 1 FROM eflow_project.funding_requests
    WHERE id = p_key
      AND (actor_id <> auth.uid() OR project_id <> p_project OR lines <> p_lines OR reason <> btrim(p_reason))
  ) THEN
    RAISE EXCEPTION 'Funding request terms changed' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM eflow_project.funding_requests WHERE id = p_key) THEN
    RETURN p_key;
  END IF;

  total := eflow_project._validate_funding_lines(p.org_id, p_lines);

  INSERT INTO eflow_project.funding_requests (id, project_id, actor_id, lines, reason, status)
  VALUES (p_key, p_project, auth.uid(), p_lines, btrim(p_reason), 'pending')
  ON CONFLICT DO NOTHING;

  IF p.funding_not_required THEN
    PERFORM pg_catalog.set_config('eflow.certifying_project_funding', '1', true);
    UPDATE public.projects SET funding_not_required = false, updated_at = clock_timestamp() WHERE id = p.id;
    PERFORM pg_catalog.set_config('eflow.certifying_project_funding', '', true);
  END IF;

  SELECT COALESCE(full_name, 'Project Lead') INTO v_actor_name FROM public.profiles WHERE id = auth.uid();
  SELECT head_user_id INTO v_head_id FROM public.organizations WHERE id = p.org_id;

  IF v_head_id IS NOT NULL AND v_head_id <> auth.uid() THEN
    INSERT INTO public.notifications (user_id, type, title, message, project_id, org_id, actor_id, actor_name)
    VALUES (
      v_head_id, 'project_funding_request', 'Project funding request',
      v_actor_name || ' requested ₱' || to_char(total, 'FM999,999,999,990.00') || ' for "' || p.title || '". Endorse it to forward to Accounting Staff for certification.',
      p.id, p.org_id, auth.uid(), v_actor_name
    );
  END IF;

  INSERT INTO public.audit_events (actor_id, entity_type, entity_id, action, org_id, after_data, reason)
  VALUES (
    auth.uid(), 'project', p.id::text, 'project.funding_requested', p.org_id,
    jsonb_build_object('requestId', p_key, 'requested', total, 'lines', p_lines), btrim(p_reason)
  );

  RETURN p_key;
END;
$$;

-- Office Head endorses (forwards to Accounting Staff certification) or declines a pending request.
CREATE OR REPLACE FUNCTION eflow_project.decide_funding(p_request uuid, p_approve boolean, p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  r eflow_project.funding_requests;
  p public.projects;
  total numeric := 0;
  v_head_name text;
BEGIN
  SELECT * INTO r FROM eflow_project.funding_requests WHERE id = p_request FOR UPDATE;
  SELECT * INTO p FROM public.projects WHERE id = r.project_id FOR UPDATE;
  IF p.id IS NULL OR auth.uid() IS NULL OR NOT public.phase2_is_office_head(auth.uid(), p.org_id) OR r.status <> 'pending' THEN
    RAISE EXCEPTION 'Pending funding request and appointed Head required' USING ERRCODE = '42501';
  END IF;
  IF NOT p_approve AND btrim(COALESCE(p_reason, '')) = '' THEN
    RAISE EXCEPTION 'Give a reason for declining funding' USING ERRCODE = '23514';
  END IF;

  SELECT COALESCE(full_name, 'Office Head') INTO v_head_name FROM public.profiles WHERE id = auth.uid();

  IF p_approve THEN
    total := eflow_project._validate_funding_lines(p.org_id, r.lines);
    UPDATE eflow_project.funding_requests
    SET status = 'pending_accounting',
        head_approved_by = auth.uid(),
        head_approved_at = now(),
        head_decision_reason = COALESCE(NULLIF(btrim(p_reason), ''), 'Endorsed by Office Head')
    WHERE id = r.id;

    INSERT INTO public.notifications (user_id, type, title, message, project_id, org_id, actor_id, actor_name)
    SELECT acc.id,
           'project_funding_certification',
           'Project funding certification needed',
           v_head_name || ' endorsed ₱' || to_char(total, 'FM999,999,999,990.00') || ' for "' || p.title || '". Accounting certification is required before funds are committed.',
           p.id, p.org_id, auth.uid(), v_head_name
    FROM public.profiles acc
    WHERE acc.org_id = p.org_id
      AND acc.is_active = true
      AND acc.role::text = 'accounting_staff'
      AND acc.id NOT IN (r.actor_id, auth.uid())
      AND acc.id IS DISTINCT FROM p.created_by
      AND acc.id IS DISTINCT FROM p.project_lead_id;

    INSERT INTO public.audit_events (actor_id, entity_type, entity_id, action, org_id, after_data, reason)
    VALUES (
      auth.uid(), 'project', p.id::text, 'project.funding_endorsed_by_head', p.org_id,
      jsonb_build_object('requestId', r.id, 'requested', total), COALESCE(NULLIF(btrim(p_reason), ''), 'Endorsed by Office Head')
    );
  ELSE
    UPDATE eflow_project.funding_requests
    SET status = 'rejected',
        head_approved_by = auth.uid(),
        head_approved_at = now(),
        head_decision_reason = btrim(p_reason)
    WHERE id = r.id;

    IF r.actor_id <> auth.uid() THEN
      INSERT INTO public.notifications (user_id, type, title, message, project_id, org_id, actor_id, actor_name)
      VALUES (
        r.actor_id, 'project_funding_decided', 'Project funding request declined',
        v_head_name || ' declined the funding request for "' || p.title || '": ' || btrim(p_reason),
        p.id, p.org_id, auth.uid(), v_head_name
      );
    END IF;

    INSERT INTO public.audit_events (actor_id, entity_type, entity_id, action, org_id, reason)
    VALUES (auth.uid(), 'project', p.id::text, 'project.funding_request_decided', p.org_id, btrim(p_reason));
  END IF;
END;
$$;

-- Accounting Staff countersign / certification RPC (maker-checker enforced).
CREATE OR REPLACE FUNCTION eflow_project.certify_funding(p_request uuid, p_approve boolean, p_reason text DEFAULT '')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  r eflow_project.funding_requests;
  p public.projects;
  total numeric := 0;
  v_actor uuid := auth.uid();
  v_actor_name text;
  v_notify_id uuid;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO r FROM eflow_project.funding_requests WHERE id = p_request FOR UPDATE;
  IF r.id IS NULL THEN
    RAISE EXCEPTION 'Funding request not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO p FROM public.projects WHERE id = r.project_id FOR UPDATE;
  IF p.id IS NULL OR p.status IN ('completed', 'archived') THEN
    RAISE EXCEPTION 'Project is closed or unavailable' USING ERRCODE = '23514';
  END IF;

  IF r.status <> 'pending_accounting' THEN
    RAISE EXCEPTION 'Only Head-endorsed requests awaiting Accounting certification can be certified' USING ERRCODE = '23514';
  END IF;

  IF NOT public.can_certify_project_funding(p.org_id, v_actor) THEN
    RAISE EXCEPTION 'Only active Accounting Staff in this office may certify project funding' USING ERRCODE = '42501';
  END IF;

  -- Strict anti-corruption separation of duties: no self-certification.
  IF v_actor = r.actor_id
     OR v_actor = r.head_approved_by
     OR v_actor = p.created_by
     OR v_actor = p.project_lead_id THEN
    RAISE EXCEPTION 'Independent Accounting Staff must certify project funding; creators, project leads, and endorsing Heads cannot self-certify.' USING ERRCODE = '42501';
  END IF;

  IF NOT p_approve AND btrim(COALESCE(p_reason, '')) = '' THEN
    RAISE EXCEPTION 'Enter a reason when declining funding certification' USING ERRCODE = '23514';
  END IF;

  SELECT COALESCE(full_name, 'Accounting Staff') INTO v_actor_name FROM public.profiles WHERE id = v_actor;

  IF p_approve THEN
    total := eflow_project._commit_authorized_funding(
      p.id, r.lines, r.reason, r.id, v_actor, COALESCE(r.head_approved_by, r.actor_id)
    );

    UPDATE eflow_project.funding_requests
    SET status = 'approved',
        accounting_decided_by = v_actor,
        accounting_decided_at = now(),
        accounting_decision_reason = COALESCE(NULLIF(btrim(p_reason), ''), 'Certified by Accounting Staff')
    WHERE id = r.id;

    FOR v_notify_id IN
      SELECT DISTINCT uid FROM unnest(ARRAY[r.actor_id, r.head_approved_by, p.project_lead_id]) uid
      WHERE uid IS NOT NULL AND uid <> v_actor
    LOOP
      INSERT INTO public.notifications (user_id, type, title, message, project_id, org_id, actor_id, actor_name)
      VALUES (
        v_notify_id, 'project_funding_decided', 'Project funding certified',
        v_actor_name || ' certified ₱' || to_char(total, 'FM999,999,999,990.00') || ' for "' || p.title || '". You can now finish setup and build tasks.',
        p.id, p.org_id, v_actor, v_actor_name
      );
    END LOOP;

    RETURN jsonb_build_object('status', 'approved', 'authorized', total);
  ELSE
    UPDATE eflow_project.funding_requests
    SET status = 'rejected',
        accounting_decided_by = v_actor,
        accounting_decided_at = now(),
        accounting_decision_reason = btrim(p_reason)
    WHERE id = r.id;

    INSERT INTO public.audit_events (actor_id, entity_type, entity_id, action, org_id, after_data, reason)
    VALUES (
      v_actor, 'project', p.id::text, 'project.funding_certification_declined', p.org_id,
      jsonb_build_object('requestId', r.id), btrim(p_reason)
    );

    FOR v_notify_id IN
      SELECT DISTINCT uid FROM unnest(ARRAY[r.actor_id, r.head_approved_by, p.project_lead_id]) uid
      WHERE uid IS NOT NULL AND uid <> v_actor
    LOOP
      INSERT INTO public.notifications (user_id, type, title, message, project_id, org_id, actor_id, actor_name)
      VALUES (
        v_notify_id, 'project_funding_decided', 'Project funding certification declined',
        v_actor_name || ' declined funding certification for "' || p.title || '": ' || btrim(p_reason),
        p.id, p.org_id, v_actor, v_actor_name
      );
    END LOOP;

    RETURN jsonb_build_object('status', 'rejected', 'authorized', 0);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.certify_project_funding(p_request uuid, p_approve boolean, p_reason text DEFAULT '')
RETURNS jsonb
LANGUAGE sql
SET search_path TO ''
AS $$
  SELECT eflow_project.certify_funding(p_request, p_approve, p_reason);
$$;

-- Allow requester or Office Head to withdraw an open pending funding request.
CREATE OR REPLACE FUNCTION public.cancel_project_funding_request(p_request uuid, p_reason text DEFAULT '')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  r eflow_project.funding_requests;
  p public.projects;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO r FROM eflow_project.funding_requests WHERE id = p_request FOR UPDATE;
  IF r.id IS NULL THEN
    RAISE EXCEPTION 'Funding request not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO p FROM public.projects WHERE id = r.project_id FOR UPDATE;
  IF p.id IS NULL OR r.status NOT IN ('pending', 'pending_accounting') THEN
    RAISE EXCEPTION 'Only open funding requests can be cancelled' USING ERRCODE = '23514';
  END IF;

  IF auth.uid() <> r.actor_id AND NOT public.phase2_is_office_head(auth.uid(), p.org_id) THEN
    RAISE EXCEPTION 'Only the requester or Office Head may cancel this funding request' USING ERRCODE = '42501';
  END IF;

  UPDATE eflow_project.funding_requests
  SET status = 'cancelled'
  WHERE id = r.id;

  INSERT INTO public.audit_events (actor_id, entity_type, entity_id, action, org_id, after_data, reason)
  VALUES (
    auth.uid(), 'project', p.id::text, 'project.funding_request_cancelled', p.org_id,
    jsonb_build_object('requestId', r.id, 'previousStatus', r.status),
    COALESCE(NULLIF(btrim(p_reason), ''), 'Funding request withdrawn')
  );
END;
$$;

-- Scoped read RPC so Accounting Staff can certify pending funding for draft/open projects without exposing draft tasks.
CREATE OR REPLACE FUNCTION public.list_pending_project_funding_certifications(p_org_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_org uuid;
  v_is_certifier boolean;
  v_is_head boolean;
BEGIN
  IF v_uid IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT COALESCE(p_org_id, pr.org_id) INTO v_org
  FROM public.profiles pr
  WHERE pr.id = v_uid AND pr.is_active = true;

  IF v_org IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  v_is_certifier := public.can_certify_project_funding(v_org, v_uid);
  v_is_head := public.phase2_is_office_head(v_uid, v_org);

  IF NOT (v_is_certifier OR v_is_head) THEN
    RETURN '[]'::jsonb;
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', fr.id,
        'projectId', p.id,
        'projectTitle', p.title,
        'projectScope', p.scope,
        'projectStatus', p.status,
        'publicationState', p.publication_state,
        'orgId', p.org_id,
        'requestedBy', fr.actor_id,
        'requestedByName', COALESCE(req_p.full_name, 'Staff'),
        'headApprovedBy', fr.head_approved_by,
        'headApprovedByName', COALESCE(head_p.full_name, ''),
        'headApprovedAt', fr.head_approved_at,
        'reason', fr.reason,
        'status', fr.status,
        'createdAt', fr.created_at,
        'totalAmount', COALESCE((
          SELECT sum((l->>'amount')::numeric) FROM jsonb_array_elements(fr.lines) l
        ), 0),
        'lines', COALESCE((
          SELECT jsonb_agg(
            jsonb_build_object(
              'partitionId', (l->>'partitionId')::uuid,
              'sourceName', COALESCE(s.name, 'Budget source'),
              'fiscalYear', b.fiscal_year,
              'amount', (l->>'amount')::numeric,
              'available', CASE WHEN s.id IS NOT NULL THEN s.amount - s.held_amount - eflow_budget.partition_committed(s.id) ELSE 0 END
            )
          )
          FROM jsonb_array_elements(fr.lines) l
          LEFT JOIN public.office_budget_sections s ON s.id = NULLIF(l->>'partitionId', '')::uuid
          LEFT JOIN public.department_fiscal_budgets b ON b.id = s.fiscal_budget_id
        ), '[]'::jsonb),
        'canCertify', (
          v_is_certifier
          AND fr.status = 'pending_accounting'
          AND v_uid IS DISTINCT FROM fr.actor_id
          AND v_uid IS DISTINCT FROM fr.head_approved_by
          AND v_uid IS DISTINCT FROM p.created_by
          AND v_uid IS DISTINCT FROM p.project_lead_id
        )
      )
      ORDER BY fr.created_at DESC
    )
    FROM eflow_project.funding_requests fr
    JOIN public.projects p ON p.id = fr.project_id
    LEFT JOIN public.profiles req_p ON req_p.id = fr.actor_id
    LEFT JOIN public.profiles head_p ON head_p.id = fr.head_approved_by
    WHERE p.org_id = v_org
      AND p.status NOT IN ('completed', 'archived')
      AND fr.status = 'pending_accounting'
  ), '[]'::jsonb);
END;
$$;

-- Update eflow_project.snapshot to separate canConfigure from canAuthorize and expose certification status cleanly.
CREATE OR REPLACE FUNCTION eflow_project.snapshot(p_project uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  p public.projects;
  v_uid uuid := auth.uid();
  v_is_head boolean := false;
  v_is_lead boolean := false;
  v_can_configure boolean := false;
  v_can_certify boolean := false;
  v_eligible boolean := false;
  funds jsonb;
  sources jsonb;
  requests jsonb;
  total numeric;
  allocated numeric;
  released numeric;
  spent numeric;
  returned numeric;
  outstanding numeric;
BEGIN
  SELECT * INTO p FROM public.projects WHERE id = p_project;
  IF p.id IS NULL OR v_uid IS NULL OR NOT public.can_see_project(p.id, v_uid) THEN
    RAISE EXCEPTION 'Current project access required' USING ERRCODE = '42501';
  END IF;

  v_is_head := public.phase2_is_office_head(v_uid, p.org_id);
  v_is_lead := eflow_project.lead(p.id, v_uid);
  v_can_configure := public.can_configure_project(p.id, v_uid);
  v_can_certify := public.can_certify_project_funding(p.org_id, v_uid);
  v_eligible := eflow_r3.eligible(v_uid);

  SELECT COALESCE(jsonb_agg(to_jsonb(f) || jsonb_build_object(
    'name', s.name,
    'available', f.amount - COALESCE((
      SELECT sum(l.amount)
      FROM public.work_budget_allocation_lines l
      JOIN public.work_budget_allocations a ON a.id = l.allocation_id
      WHERE l.project_funding_id = f.id AND a.subtask_id IS NULL AND a.status = 'approved'
    ), 0)
  ) ORDER BY f.fiscal_year, f.quarter, s.name), '[]')
    INTO funds
  FROM eflow_project.funding f
  JOIN public.office_budget_sections s ON s.id = f.partition_id
  JOIN public.budget_commitments c ON c.id = f.commitment_id
  WHERE f.project_id = p.id AND f.amount > 0 AND c.status = 'active';

  SELECT COALESCE(sum((x->>'amount')::numeric), 0),
         COALESCE(sum((x->>'amount')::numeric - (x->>'available')::numeric), 0)
    INTO total, allocated
  FROM jsonb_array_elements(funds) x;

  SELECT COALESCE(sum(r.released_amount), 0),
         COALESCE(sum(r.actual_spent), 0),
         COALESCE(sum(r.returned_amount) FILTER (WHERE r.status = 'settled'), 0),
         COALESCE(sum(r.released_amount) FILTER (WHERE r.status <> 'settled'), 0)
    INTO released, spent, returned, outstanding
  FROM public.petty_cash_requests r
  JOIN public.tasks t ON t.id = r.task_id
  WHERE t.linked_project_id = p.id;

  IF v_is_head OR v_is_lead OR v_can_configure THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', s.id, 'name', s.name, 'year', b.fiscal_year,
      'available', s.amount - s.held_amount - eflow_budget.partition_committed(s.id)
    ) ORDER BY b.fiscal_year, s.position), '[]')
      INTO sources
    FROM public.office_budget_sections s
    JOIN public.department_fiscal_budgets b ON b.id = s.fiscal_budget_id
    WHERE b.org_id = p.org_id AND b.status = 'locked' AND NOT s.retired
      AND NOT EXISTS (SELECT 1 FROM public.office_budget_sections child WHERE child.parent_id = s.id AND NOT child.retired);

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', r.id, 'purpose', r.purpose, 'amount', r.requested_amount, 'status', r.status,
      'requester', pr.full_name,
      'canReview', r.status = 'pending_department_approval' AND eflow_project.reviewer(t.id, r.requester_id) = v_uid
    ) ORDER BY r.created_at DESC), '[]')
      INTO requests
    FROM public.petty_cash_requests r
    JOIN public.tasks t ON t.id = r.task_id
    LEFT JOIN public.profiles pr ON pr.id = r.requester_id
    WHERE t.linked_project_id = p.id;
  END IF;

  RETURN jsonb_build_object(
    'project', to_jsonb(p),
    'ready', eflow_project.ready(p.id),
    'canConfigure', v_can_configure,
    'canAuthorize', v_is_head,
    'canCertify', v_can_certify,
    'canAllocateTask', v_is_lead AND v_eligible,
    'canAllocate', v_is_lead OR v_is_head OR v_can_configure,
    'funds', funds,
    'sources', COALESCE(sources, '[]'),
    'requests', COALESCE(requests, '[]'),
    'total', total,
    'allocated', allocated,
    'unallocated', total - allocated,
    'released', released,
    'spent', spent,
    'returned', returned,
    'outstanding', outstanding,
    'canExtendTaskFunding', true,
    'taskFunding', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'sourceId', l.project_funding_id,
        'fiscalYear', (SELECT f.fiscal_year FROM eflow_project.funding f WHERE f.id = l.project_funding_id),
        'id', l.id, 'taskId', t.id, 'task', t.title, 'source', s.name, 'amount', l.amount,
        'available', public.task_budget_line_available(l.id, NULL)
      ))
      FROM public.work_budget_allocation_lines l
      JOIN public.work_budget_allocations a ON a.id = l.allocation_id
      JOIN public.tasks t ON t.id = a.task_id
      JOIN public.office_budget_sections s ON s.id = l.budget_partition_id
      WHERE t.linked_project_id = p.id AND a.subtask_id IS NULL AND a.status = 'approved'
        AND l.project_funding_id IS NOT NULL AND l.amount > 0
        AND public.can_see_task(t.id, v_uid)
    ), '[]'),
    'liquidations', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', liq.id, 'purpose', r.purpose, 'spent', liq.declared_spent,
        'canReview', r.status = 'pending_leader_liquidation_review'
                     AND liq.status = 'pending_leader_review'
                     AND eflow_project.reviewer(t.id, r.cash_recipient_id) = v_uid
      ))
      FROM public.petty_cash_liquidations liq
      JOIN public.petty_cash_requests r ON r.id = liq.request_id
      JOIN public.tasks t ON t.id = r.task_id
      WHERE t.linked_project_id = p.id AND (v_is_lead OR v_is_head)
    ), '[]'),
    'fundingRequests', COALESCE((
      SELECT jsonb_agg(
        to_jsonb(fr) || jsonb_build_object(
          'actorName', COALESCE(req_p.full_name, 'Staff'),
          'headApprovedByName', COALESCE(head_p.full_name, ''),
          'totalAmount', COALESCE((SELECT sum((l->>'amount')::numeric) FROM jsonb_array_elements(fr.lines) l), 0),
          'canEndorse', (v_is_head AND fr.status = 'pending'),
          'canCancel', (fr.status IN ('pending', 'pending_accounting') AND (fr.actor_id = v_uid OR v_is_head)),
          'canCertify', (
            v_can_certify
            AND fr.status = 'pending_accounting'
            AND v_uid IS DISTINCT FROM fr.actor_id
            AND v_uid IS DISTINCT FROM fr.head_approved_by
            AND v_uid IS DISTINCT FROM p.created_by
            AND v_uid IS DISTINCT FROM p.project_lead_id
          )
        )
        ORDER BY fr.created_at DESC
      )
      FROM eflow_project.funding_requests fr
      LEFT JOIN public.profiles req_p ON req_p.id = fr.actor_id
      LEFT JOIN public.profiles head_p ON head_p.id = fr.head_approved_by
      WHERE fr.project_id = p.id
        AND fr.status IN ('pending', 'pending_accounting')
        AND (fr.actor_id = v_uid OR v_is_head OR v_can_configure OR v_can_certify)
    ), '[]')
  );
END;
$$;

-- Update project deletion guards so pending_accounting also blocks premature deletion.
CREATE OR REPLACE FUNCTION eflow_project.project_deletion_blockers(p_project_id uuid)
RETURNS text[]
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
  WITH project_tasks AS (
    SELECT id, status, deleted_at FROM public.tasks WHERE linked_project_id = p_project_id
  ), task_cash AS (
    SELECT r.status, r.actual_spent
    FROM project_tasks t JOIN public.petty_cash_requests r ON r.task_id = t.id
  )
  SELECT array_remove(ARRAY[
    CASE WHEN EXISTS (SELECT 1 FROM project_tasks WHERE deleted_at IS NULL)
      THEN 'This project still has tasks, including any cancelled or archived tasks.' END,
    CASE WHEN EXISTS (SELECT 1 FROM eflow_project.funding WHERE project_id = p_project_id AND amount > 0)
      OR EXISTS (
        SELECT 1 FROM public.budget_commitments c
        WHERE c.authorization_payload->>'projectId' = p_project_id::text
          AND c.status = 'active' AND c.amount > 0
      )
      OR EXISTS (
        SELECT 1 FROM project_tasks t
        JOIN public.work_budget_allocations a ON a.task_id = t.id
        JOIN public.budget_commitments c ON c.id = a.commitment_id
        WHERE a.status = 'approved' AND a.amount > 0 AND c.status = 'active'
      )
      THEN 'This project still has committed funds. Return unused funds in Project settings → Project budget.' END,
    CASE WHEN EXISTS (SELECT 1 FROM eflow_project.funding_requests WHERE project_id = p_project_id AND status IN ('pending', 'pending_accounting'))
      OR EXISTS (SELECT 1 FROM project_tasks t JOIN public.work_budget_allocations a ON a.task_id = t.id WHERE a.status = 'pending')
      OR EXISTS (SELECT 1 FROM task_cash WHERE status NOT IN ('settled', 'rejected', 'cancelled'))
      THEN 'This project has open funding or cash requests. Resolve them before deleting it.' END,
    CASE WHEN EXISTS (
        SELECT 1 FROM public.projects WHERE id = p_project_id AND (completed_at IS NOT NULL OR status = 'completed')
      )
      OR EXISTS (
        SELECT 1 FROM public.audit_events
        WHERE entity_type = 'project' AND entity_id = p_project_id::text AND action = 'project.completed'
      )
      OR EXISTS (SELECT 1 FROM project_tasks WHERE status = 'completed')
      OR EXISTS (
        SELECT 1 FROM project_tasks t JOIN public.task_status_history h ON h.task_id = t.id
        WHERE h.from_status = 'completed' OR h.to_status = 'completed'
      )
      OR EXISTS (SELECT 1 FROM project_tasks t JOIN public.task_submissions s ON s.task_id = t.id WHERE s.status = 'approved')
      OR EXISTS (
        SELECT 1 FROM project_tasks t JOIN public.subtasks s ON s.task_id = t.id
        WHERE s.status = 'completed' OR s.is_completed OR s.completed_at IS NOT NULL
      )
      OR EXISTS (SELECT 1 FROM project_tasks t JOIN public.subtask_submissions s ON s.task_id = t.id WHERE s.status = 'approved')
      THEN 'This project has completed work and must be kept for its history.' END,
    CASE WHEN EXISTS (SELECT 1 FROM task_cash WHERE actual_spent > 0)
      THEN 'This project has spending history and must be kept for its records.' END
  ], NULL);
$$;

CREATE OR REPLACE FUNCTION eflow_project.detach_funding_before_project_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM eflow_project.funding f
    WHERE f.project_id = old.id AND f.amount > 0
  ) THEN
    RAISE EXCEPTION 'This project still has funding. Return unused funds in Project settings → Project budget before deleting it. Archive the project to keep any spending history together.'
      USING ERRCODE = '23514';
  END IF;

  IF EXISTS (
    SELECT 1 FROM eflow_project.funding_requests r
    WHERE r.project_id = old.id AND r.status IN ('pending', 'pending_accounting')
  ) THEN
    RAISE EXCEPTION 'Resolve pending funding requests in Project settings → Project budget before deleting this project.'
      USING ERRCODE = '23514';
  END IF;

  UPDATE eflow_project.funding
  SET project_id = NULL, deleted_project_id = old.id
  WHERE project_id = old.id;

  UPDATE eflow_project.funding_requests
  SET project_id = NULL, deleted_project_id = old.id
  WHERE project_id = old.id;

  RETURN old;
END;
$$;

-- ============================================================================
-- 4. READINESS, ACTIVATION & PUBLICATION FOR DELEGATED CREATORS + ACCOUNTING CHECK
-- ============================================================================

CREATE OR REPLACE FUNCTION public.phase7_review_project(p_project uuid, p_kind text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  p public.projects;
BEGIN
  SELECT * INTO p FROM public.projects WHERE id = p_project FOR UPDATE;
  IF p.id IS NULL OR NOT public.can_configure_project(p.id, auth.uid()) THEN
    RAISE EXCEPTION 'Only the Office Head or owning project creator can review readiness' USING ERRCODE = '42501';
  END IF;
  IF p.status IN ('completed', 'archived') OR p.source_collaboration_draft_id IS NOT NULL OR p_kind NOT IN ('structure', 'dates', 'budget') THEN
    RAISE EXCEPTION 'Readiness review is unavailable' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.project_readiness_reviews (project_id, review_kind, fingerprint, reviewed_by)
  VALUES (p.id, p_kind, eflow_phase7.fingerprint(p.id, p_kind), auth.uid())
  ON CONFLICT (project_id, review_kind) DO UPDATE
    SET fingerprint = EXCLUDED.fingerprint, reviewed_by = EXCLUDED.reviewed_by, reviewed_at = now();
  INSERT INTO public.audit_events (actor_id, entity_type, entity_id, action, org_id, after_data)
  VALUES (auth.uid(), 'project', p.id::text, 'project.readiness_review', p.org_id, jsonb_build_object('kind', p_kind));
END;
$$;

CREATE OR REPLACE FUNCTION eflow_phase65.baseline_readiness(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  p public.projects;
  checks jsonb := '[]';
  k text;
  label text;
  n int;
  good boolean;
  governed boolean;
  v_has_funding boolean;
  v_pending_accounting boolean;
BEGIN
  SELECT * INTO p FROM public.projects WHERE id = p_id;
  IF p.id IS NULL THEN
    RAISE EXCEPTION 'Project not found' USING ERRCODE = 'P0002';
  END IF;
  governed := p.source_collaboration_draft_id IS NOT NULL;

  FOREACH k IN ARRAY ARRAY['structure', 'dates', 'budget'] LOOP
    label := CASE k
      WHEN 'structure' THEN 'Project structure reviewed'
      WHEN 'dates' THEN 'Project dates confirmed'
      ELSE 'Budget information reviewed'
    END;
    good := governed OR EXISTS (
      SELECT 1 FROM public.project_readiness_reviews r
      WHERE r.project_id = p.id
        AND r.review_kind = k
        AND r.fingerprint = eflow_phase7.fingerprint(p.id, k)
        AND public.can_configure_project(p.id, r.reviewed_by)
    );
    checks := checks || jsonb_build_array(jsonb_build_object(
      'key', k,
      'label', label,
      'ok', good,
      'detail', CASE
        WHEN governed THEN 'Use the existing proposal governance review.'
        WHEN good THEN 'Current revision reviewed.'
        ELSE 'Project review is needed for this revision.'
      END
    ));
  END LOOP;

  -- Option 1 anti-corruption funding certification check.
  v_has_funding := EXISTS (
    SELECT 1 FROM eflow_project.funding f
    JOIN public.budget_commitments c ON c.id = f.commitment_id
    WHERE f.project_id = p.id AND f.amount > 0 AND c.status = 'active'
  );
  v_pending_accounting := EXISTS (
    SELECT 1 FROM eflow_project.funding_requests fr
    WHERE fr.project_id = p.id AND fr.status = 'pending_accounting'
  );
  good := governed OR p.funding_not_required OR v_has_funding;
  checks := checks || jsonb_build_array(jsonb_build_object(
    'key', 'funding_certification',
    'label', 'Project funding certified',
    'ok', good,
    'detail', CASE
      WHEN governed THEN 'Use the existing proposal governance review.'
      WHEN p.funding_not_required THEN 'No funding required for this project.'
      WHEN v_has_funding THEN 'Project funding certified and reserved.'
      WHEN v_pending_accounting THEN 'Awaiting independent Accounting Staff certification before activation.'
      ELSE 'Submit project funding for Accounting certification, or choose No funding required.'
    END
  ));

  SELECT count(*) INTO n FROM public.tasks WHERE linked_project_id = p.id AND deleted_at IS NULL AND status <> 'cancelled';
  checks := checks || jsonb_build_array(jsonb_build_object('key', 'work', 'label', 'Delivery work exists', 'ok', n > 0, 'detail', n || ' required tasks'));

  good := p.start_date IS NOT NULL AND p.target_date IS NOT NULL AND p.target_date >= p.start_date;
  checks := checks || jsonb_build_array(jsonb_build_object('key', 'schedule', 'label', 'Project schedule is valid', 'ok', good, 'detail', 'Set both project dates in the Timeline view.'));

  SELECT count(*) INTO n FROM public.project_offices WHERE project_id = p.id AND invitation_status IN ('pending', 'awaiting_head');
  checks := checks || jsonb_build_array(jsonb_build_object('key', 'invitations', 'label', 'Office invitations accepted', 'ok', n = 0, 'detail', n || ' Offices awaiting acceptance or Head confirmation'));

  SELECT count(*) INTO n FROM public.tasks t
  WHERE t.linked_project_id = p.id AND t.deleted_at IS NULL AND t.status <> 'cancelled'
    AND (t.org_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.project_offices o
      WHERE o.project_id = p.id AND o.office_id = t.org_id AND o.invitation_status = 'joined' AND o.relationship_type IN ('lead', 'collaborating')
    ));
  checks := checks || jsonb_build_array(jsonb_build_object('key', 'responsibilities', 'label', 'Responsible Offices confirmed', 'ok', governed OR n = 0, 'detail', n || ' tasks need a joined responsible Office'));

  SELECT count(*) INTO n FROM public.tasks t
  WHERE t.linked_project_id = p.id AND t.deleted_at IS NULL AND t.status NOT IN ('completed', 'cancelled')
    AND (
      t.assigned_to IS NULL
      OR NOT EXISTS (SELECT 1 FROM public.profiles u WHERE u.id = t.assigned_to AND u.is_active AND u.org_id = t.org_id AND u.role::text <> 'admin')
      OR (
        NOT governed AND NOT EXISTS (
          SELECT 1 FROM public.project_offices o
          WHERE o.project_id = p.id AND o.office_id = t.org_id AND o.invitation_status = 'joined' AND o.relationship_type IN ('lead', 'collaborating')
            AND (o.relationship_type = 'lead' OR public.phase2_is_office_head(t.assigned_to, t.org_id) OR EXISTS (
              SELECT 1 FROM public.project_office_members m WHERE m.project_office_id = o.id AND m.user_id = t.assigned_to
            ))
        )
      )
    );
  checks := checks || jsonb_build_array(jsonb_build_object('key', 'staffing', 'label', 'Required task owners assigned', 'ok', n = 0, 'detail', n || ' tasks need eligible owners selected by their own Office'));

  good := NOT EXISTS (SELECT 1 FROM jsonb_array_elements(checks) c WHERE NOT (c->>'ok')::boolean);
  RETURN jsonb_build_object(
    'projectId', p.id,
    'checks', checks,
    'ready', good,
    'canActivate', good AND p.status IN ('planning', 'on_hold'),
    'stage', CASE
      WHEN p.status IN ('completed', 'archived') THEN 'Closed'
      WHEN good AND p.status = 'active' THEN 'Active'
      WHEN good THEN 'Ready'
      WHEN v_pending_accounting THEN 'Awaiting Accounting certification'
      WHEN p.status = 'on_hold' THEN 'Revision review'
      WHEN EXISTS (SELECT 1 FROM public.project_offices o WHERE o.project_id = p.id AND o.invitation_status IN ('pending', 'awaiting_head')) THEN 'Office coordination'
      ELSE 'Planning'
    END,
    'governed', governed
  );
END;
$$;

CREATE OR REPLACE FUNCTION eflow_publication.guard_project()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  readiness jsonb;
BEGIN
  IF tg_op = 'INSERT' THEN
    IF new.source_collaboration_draft_id IS NOT NULL THEN
      IF NOT COALESCE(public.phase2_is_office_head(auth.uid(), new.org_id), false) THEN
        RAISE EXCEPTION 'Only the owning Office Head can publish' USING ERRCODE = '42501';
      END IF;
      new.publication_state := 'published';
      new.published_at := now();
      new.published_by := auth.uid();
    ELSE
      IF new.status IS DISTINCT FROM 'planning' OR NOT COALESCE(public.can_create_project_in_office(new.org_id, auth.uid()), false) THEN
        RAISE EXCEPTION 'You need the Create Projects permission in your active office to create a Planning project' USING ERRCODE = '42501';
      END IF;
      new.publication_state := 'draft';
      new.published_at := NULL;
      new.published_by := NULL;
    END IF;
    RETURN new;
  END IF;

  IF ROW(new.published_at, new.published_by) IS DISTINCT FROM ROW(old.published_at, old.published_by) THEN
    RAISE EXCEPTION 'Publication history cannot be edited' USING ERRCODE = '42501';
  END IF;

  IF old.publication_state = 'published' THEN
    IF new.publication_state IS DISTINCT FROM 'published' THEN
      RAISE EXCEPTION 'Published projects cannot return to a private draft' USING ERRCODE = '23514';
    END IF;
    IF old.status = 'on_hold' AND new.status = 'completed' THEN
      RAISE EXCEPTION 'Reactivate this project before completing it' USING ERRCODE = '23514';
    END IF;
    RETURN new;
  END IF;

  IF new.status = 'active' THEN
    IF NOT COALESCE(public.can_configure_project(old.id, auth.uid()), false) THEN
      RAISE EXCEPTION 'Only the Office Head or owning project creator can activate this project' USING ERRCODE = '42501';
    END IF;
    IF ROW(new.title, new.description, new.scope, new.org_id, new.project_lead_id, new.start_date, new.target_date, new.funding_not_required)
       IS DISTINCT FROM ROW(old.title, old.description, old.scope, old.org_id, old.project_lead_id, old.start_date, old.target_date, old.funding_not_required) THEN
      RAISE EXCEPTION 'Save and review project changes before activation' USING ERRCODE = '23514';
    END IF;
    readiness := eflow_phase7.readiness(old.id);
    IF NOT eflow_project.ready(old.id) OR NOT COALESCE((readiness->>'canActivate')::boolean, false) THEN
      RAISE EXCEPTION 'Project readiness is incomplete' USING ERRCODE = '23514';
    END IF;
    new.publication_state := 'published';
    new.published_at := now();
    new.published_by := auth.uid();
  ELSIF new.status IS DISTINCT FROM 'planning' OR new.publication_state IS DISTINCT FROM 'draft' THEN
    RAISE EXCEPTION 'Private projects must remain in Planning until activation' USING ERRCODE = '23514';
  END IF;

  RETURN new;
END;
$$;

CREATE OR REPLACE FUNCTION eflow_phase7.guard_project()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  syncing boolean := pg_catalog.current_setting('eflow.syncing_project_schedule', true) = '1';
BEGIN
  IF tg_op = 'UPDATE' AND auth.uid() IS NOT NULL AND new.source_collaboration_draft_id IS DISTINCT FROM old.source_collaboration_draft_id THEN
    RAISE EXCEPTION 'Project governance identity is immutable' USING ERRCODE = '42501';
  END IF;
  IF new.source_collaboration_draft_id IS NOT NULL THEN
    RETURN new;
  END IF;
  IF tg_op = 'INSERT' THEN
    IF new.status = 'active' THEN
      RAISE EXCEPTION 'Create the project in Planning, then review readiness' USING ERRCODE = '22023';
    END IF;
    RETURN new;
  END IF;
  IF (NOT syncing OR new.description IS DISTINCT FROM old.description)
     AND ROW(new.description, new.start_date, new.target_date) IS DISTINCT FROM ROW(old.description, old.start_date, old.target_date)
     AND old.status = 'active' THEN
    new.status := 'on_hold';
  END IF;
  IF old.status = 'archived' AND new.status = 'active' AND new.archived_at IS NULL THEN
    IF NOT (
      (public.phase2_is_office_head(auth.uid(), new.org_id) AND public.can_manage_project(old.id, auth.uid()))
      OR (public.can_configure_project(old.id, auth.uid()) AND public.has_permission(auth.uid(), 'projects.archive'))
    ) THEN
      RAISE EXCEPTION 'Only the Office Head or an authorized project manager can restore this project' USING ERRCODE = '42501';
    END IF;
    IF NOT (eflow_phase7.readiness(old.id)->>'ready')::boolean THEN
      new.status := 'planning';
    END IF;
  END IF;
  IF new.status = 'active' AND old.status <> 'active' THEN
    IF old.status NOT IN ('planning', 'on_hold') AND NOT (old.status = 'archived' AND new.archived_at IS NULL) THEN
      RAISE EXCEPTION 'Use the existing archive restore workflow to reopen a closed project' USING ERRCODE = '22023';
    END IF;
    IF ROW(new.description, new.org_id, new.start_date, new.target_date, new.source_collaboration_draft_id)
       IS DISTINCT FROM ROW(old.description, old.org_id, old.start_date, old.target_date, old.source_collaboration_draft_id) THEN
      RAISE EXCEPTION 'Save material changes and review them before activation' USING ERRCODE = '22023';
    END IF;
    IF NOT public.can_configure_project(old.id, auth.uid()) THEN
      RAISE EXCEPTION 'Only the Office Head or owning project creator can activate this project' USING ERRCODE = '42501';
    END IF;
    IF NOT (eflow_phase7.readiness(old.id)->>'ready')::boolean THEN
      RAISE EXCEPTION 'Project readiness is incomplete' USING ERRCODE = '22023';
    END IF;
  END IF;
  RETURN new;
END;
$$;

CREATE OR REPLACE FUNCTION public.phase7_activate_project(p_project uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  p public.projects;
  r jsonb;
BEGIN
  IF NOT eflow_project.ready(p_project) THEN
    RAISE EXCEPTION 'Finish project details and certified funding setup before activation' USING ERRCODE = '23514';
  END IF;
  SELECT * INTO p FROM public.projects WHERE id = p_project FOR UPDATE;
  IF p.id IS NULL OR auth.uid() IS NULL OR NOT public.can_configure_project(p.id, auth.uid()) THEN
    RAISE EXCEPTION 'Only the Office Head or owning project creator can activate this project' USING ERRCODE = '42501';
  END IF;
  IF p.source_collaboration_draft_id IS NOT NULL THEN
    RAISE EXCEPTION 'Use the existing proposal approval workflow' USING ERRCODE = '22023';
  END IF;
  IF p.status = 'active' THEN
    RETURN;
  END IF;
  r := eflow_phase7.readiness(p.id);
  IF NOT (r->>'canActivate')::boolean THEN
    RAISE EXCEPTION 'Project readiness is incomplete' USING ERRCODE = '22023', DETAIL = (r->'checks')::text;
  END IF;
  UPDATE public.projects SET status = 'active', updated_at = now() WHERE id = p.id;
  INSERT INTO public.audit_events (actor_id, entity_type, entity_id, action, org_id, after_data)
  VALUES (auth.uid(), 'project', p.id::text, 'project.activated', p.org_id, r);
END;
$$;

CREATE OR REPLACE FUNCTION public.publish_project(p_project uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  p public.projects;
BEGIN
  SELECT * INTO p FROM public.projects WHERE id = p_project FOR UPDATE;
  IF p.id IS NULL OR NOT COALESCE(public.can_configure_project(p.id, auth.uid()), false) THEN
    RAISE EXCEPTION 'Only the Office Head or owning project creator can publish' USING ERRCODE = '42501';
  END IF;
  IF p.publication_state = 'draft' THEN
    PERFORM public.phase7_activate_project(p_project);
  END IF;
END;
$$;

-- ============================================================================
-- 5. LEAST-PRIVILEGE EXECUTE GRANTS
-- ============================================================================

REVOKE ALL ON FUNCTION eflow_project._validate_funding_lines(uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION eflow_project._commit_authorized_funding(uuid, jsonb, text, uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION eflow_project.certify_funding(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION eflow_project.certify_funding(uuid, boolean, text) TO authenticated;

REVOKE ALL ON FUNCTION public.is_admin_only_permission(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin_only_permission(text) TO authenticated;
REVOKE ALL ON FUNCTION public.permission_prerequisites(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.permission_prerequisites(text) TO authenticated;
REVOKE ALL ON FUNCTION public.default_role_has_permission(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.default_role_has_permission(text, text) TO authenticated;
REVOKE ALL ON FUNCTION public.raw_has_permission(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.raw_has_permission(uuid, text) TO authenticated;
REVOKE ALL ON FUNCTION public.has_permission(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_set_role_permissions(text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_role_permissions(text, jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_set_user_permission_overrides(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_user_permission_overrides(uuid, jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_save_custom_role(text, text, text, text, jsonb, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_save_custom_role(text, text, text, text, jsonb, boolean) TO authenticated;

REVOKE ALL ON FUNCTION public.can_create_project_in_office(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_create_project_in_office(uuid, uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.can_configure_project(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_configure_project(uuid, uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.can_certify_project_funding(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_certify_project_funding(uuid, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.certify_project_funding(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.certify_project_funding(uuid, boolean, text) TO authenticated;
REVOKE ALL ON FUNCTION public.cancel_project_funding_request(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_project_funding_request(uuid, text) TO authenticated;
REVOKE ALL ON FUNCTION public.list_pending_project_funding_certifications(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_pending_project_funding_certifications(uuid) TO authenticated;
