-- Allow office Accounting Staff to view draft/planning projects in their office
-- when a funding request is awaiting Accounting certification (or already certified/approved)
-- so clicking "Open project" from Project funding approvals opens the project instead of "Project unavailable".

CREATE OR REPLACE FUNCTION eflow_m7.project_visible(p_project uuid, p_actor uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
            OR (u.role::text = 'accounting_staff' AND u.org_id = p.org_id
                AND EXISTS (
                  SELECT 1
                  FROM eflow_project.funding_requests fr
                  WHERE fr.project_id = p.id
                    AND fr.status IN ('pending_accounting', 'authorized', 'approved')
                ))
          )
        )
      )
    )
  );
$function$;

CREATE OR REPLACE FUNCTION public.can_see_project(target_project uuid, caller_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
      OR (v_caller.role = 'accounting_staff' AND v_caller.org_id = v_proj.org_id
          AND EXISTS (
            SELECT 1
            FROM eflow_project.funding_requests fr
            WHERE fr.project_id = v_proj.id
              AND fr.status IN ('pending_accounting', 'authorized', 'approved')
          ))
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
$function$;
