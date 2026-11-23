-- Match public.can_see_project for draft projects so Accounting Staff
-- reviewing pending/authorized/approved funding requests can also view the
-- project's drafted tasks (read-only) in the Main table.

CREATE OR REPLACE FUNCTION public.can_see_task(target_task uuid, caller_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
        OR (v_caller.role = 'accounting_staff' AND v_caller.org_id = v_proj.org_id
            AND EXISTS (
              SELECT 1
              FROM eflow_project.funding_requests fr
              WHERE fr.project_id = v_proj.id
                AND fr.status IN ('pending_accounting', 'authorized', 'approved')
            ))
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
$function$;
