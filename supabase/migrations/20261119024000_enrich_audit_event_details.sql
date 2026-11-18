-- Enrich administrative audit_events with human-readable target labels, change summaries,
-- complete activation before/after diffs, and a backfill for historical records.

ALTER TABLE public.audit_events
  ADD COLUMN IF NOT EXISTS target_label text,
  ADD COLUMN IF NOT EXISTS change_summary text;

CREATE OR REPLACE FUNCTION eflow_activation.audit(
  p_actor uuid,
  i public.user_invitations,
  p_action text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_name text;
  v_office_name text;
  v_details public.managed_account_invite_details;
  v_target_profile public.profiles;
  v_target_name text;
  v_effective_role text;
  v_role_title text;
  v_entity_id text;
  v_before jsonb;
  v_after jsonb;
  v_reason text;
  v_summary text;
  v_meta jsonb;
BEGIN
  IF p_actor IS NOT NULL THEN
    SELECT coalesce(nullif(btrim(full_name), ''), nullif(btrim(email), ''), 'System')
    INTO v_actor_name
    FROM public.profiles
    WHERE id = p_actor;
  END IF;
  v_actor_name := coalesce(nullif(btrim(v_actor_name), ''), 'System');

  SELECT name INTO v_office_name
  FROM public.organizations
  WHERE id = i.office_id;

  SELECT * INTO v_details
  FROM public.managed_account_invite_details
  WHERE invitation_id = i.id;

  IF i.accepted_by IS NOT NULL THEN
    SELECT * INTO v_target_profile
    FROM public.profiles
    WHERE id = i.accepted_by;
  END IF;

  v_target_name := coalesce(
    nullif(btrim(v_target_profile.full_name), ''),
    nullif(btrim(v_details.full_name), ''),
    i.email
  );
  v_effective_role := coalesce(
    nullif(btrim(v_details.requested_privileged_role), ''),
    nullif(btrim(i.account_role), ''),
    'member'
  );
  v_role_title := CASE v_effective_role
    WHEN 'head' THEN 'Office Head'
    WHEN 'admin' THEN 'Administrator'
    WHEN 'accounting_staff' THEN 'Accounting Staff'
    ELSE 'Member'
  END;
  v_entity_id := coalesce(i.accepted_by, i.id)::text;

  v_meta := jsonb_strip_nulls(jsonb_build_object(
    'invitation_id', i.id,
    'accepted_by', i.accepted_by,
    'email', i.email,
    'full_name', coalesce(nullif(btrim(v_target_profile.full_name), ''), nullif(btrim(v_details.full_name), '')),
    'account_role', i.account_role,
    'requested_privileged_role', v_details.requested_privileged_role,
    'custom_role_key', v_details.custom_role_key,
    'office_name', v_office_name
  ));

  IF p_action = 'account.activation_approve' THEN
    v_before := jsonb_strip_nulls(jsonb_build_object(
      'full_name', v_target_name,
      'email', i.email,
      'role', 'member',
      'is_active', false,
      'status', 'pending_approval'
    )) || CASE WHEN v_effective_role = 'head' THEN jsonb_build_object('headUserId', NULL) ELSE '{}'::jsonb END;
    v_after := jsonb_strip_nulls(jsonb_build_object(
      'full_name', v_target_name,
      'email', i.email,
      'role', v_effective_role,
      'is_active', true,
      'status', 'approved',
      'assignedOffice', v_office_name
    )) || CASE WHEN v_effective_role = 'head' THEN jsonb_build_object('headUserId', coalesce(i.accepted_by::text, v_target_name)) ELSE '{}'::jsonb END;
    v_reason := format('Approved %s as %s%s.', v_target_name, v_role_title, CASE WHEN v_office_name IS NOT NULL THEN ' of ' || v_office_name ELSE '' END);
    v_summary := format('Approved role: Member -> %s · Account active: No -> Yes', v_role_title);
  ELSIF p_action = 'account.activation_completed' THEN
    v_before := jsonb_strip_nulls(jsonb_build_object(
      'full_name', v_target_name,
      'email', i.email,
      'status', 'pending_activation',
      'is_active', false
    ));
    v_after := jsonb_strip_nulls(jsonb_build_object(
      'full_name', v_target_name,
      'email', i.email,
      'role', coalesce(i.account_role, 'member'),
      'requested_role', v_details.requested_privileged_role,
      'assignedOffice', v_office_name,
      'status', 'activated',
      'is_active', (v_details.requested_privileged_role IS NULL)
    ));
    v_reason := format('%s verified their email and activated their account%s.', v_target_name, CASE WHEN v_office_name IS NOT NULL THEN ' in ' || v_office_name ELSE '' END);
    v_summary := 'Workflow status: Pending Activation -> Activated';
  ELSIF p_action = 'account.activation_staged' THEN
    v_before := jsonb_build_object('status', 'not_invited');
    v_after := jsonb_strip_nulls(jsonb_build_object(
      'full_name', v_target_name,
      'email', i.email,
      'role', v_effective_role,
      'assignedOffice', v_office_name,
      'status', 'pending_activation'
    ));
    v_reason := format('Created %s invitation for %s%s.', v_role_title, v_target_name, CASE WHEN v_office_name IS NOT NULL THEN ' in ' || v_office_name ELSE '' END);
    v_summary := format('Invited %s (%s)%s', v_target_name, v_role_title, CASE WHEN v_office_name IS NOT NULL THEN ' · ' || v_office_name ELSE '' END);
  ELSIF p_action = 'account.activation_email_attempted' THEN
    v_before := jsonb_build_object('emailDeliveryStatus', 'queued');
    v_after := jsonb_strip_nulls(jsonb_build_object(
      'emailDeliveryStatus', 'email_sent',
      'email', i.email,
      'full_name', v_target_name,
      'assignedOffice', v_office_name
    ));
    v_reason := format('Sent account activation link to %s (%s).', v_target_name, i.email);
    v_summary := format('Activation email sent to %s', i.email);
  ELSIF p_action = 'account.activation_revoke' THEN
    v_before := jsonb_strip_nulls(jsonb_build_object('email', i.email, 'full_name', v_target_name, 'status', 'pending_activation'));
    v_after := jsonb_strip_nulls(jsonb_build_object('email', i.email, 'full_name', v_target_name, 'status', 'revoked', 'assignedOffice', v_office_name));
    v_reason := format('Revoked pending invitation for %s (%s).', v_target_name, i.email);
    v_summary := format('Status: Pending Activation -> Revoked (%s)', i.email);
  ELSIF p_action = 'account.activation_resend' THEN
    v_before := jsonb_build_object('status', 'pending_activation');
    v_after := jsonb_strip_nulls(jsonb_build_object('status', 'resent', 'email', i.email, 'full_name', v_target_name, 'assignedOffice', v_office_name));
    v_reason := format('Resent fresh activation link to %s (%s).', v_target_name, i.email);
    v_summary := format('Resent activation link to %s', i.email);
  ELSIF p_action = 'account.activation_deleted' THEN
    v_before := jsonb_strip_nulls(jsonb_build_object('full_name', v_target_name, 'email', i.email, 'status', 'revoked', 'assignedOffice', v_office_name));
    v_after := jsonb_build_object('status', 'deleted');
    v_reason := format('Deleted revoked invitation for %s (%s).', v_target_name, i.email);
    v_summary := format('Deleted revoked invitation (%s)', i.email);
  ELSE
    v_before := jsonb_build_object('status', i.status);
    v_after := jsonb_strip_nulls(jsonb_build_object('full_name', v_target_name, 'email', i.email, 'status', i.status));
    v_reason := format('Updated account invitation for %s.', v_target_name);
    v_summary := format('%s (%s)', p_action, v_target_name);
  END IF;

  INSERT INTO public.audit_events (
    actor_id,
    actor_name,
    entity_type,
    entity_id,
    target_label,
    action,
    reason,
    change_summary,
    before_data,
    after_data,
    org_id,
    metadata
  ) VALUES (
    p_actor,
    v_actor_name,
    'user',
    v_entity_id,
    v_target_name,
    p_action,
    v_reason,
    v_summary,
    v_before,
    v_after,
    i.office_id,
    v_meta
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.eflow_enrich_audit_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_name text;
  v_office_name text;
  v_before_head_name text;
  v_after_head_name text;
  v_target_uid uuid;
  v_target_name text;
  v_perm text;
BEGIN
  IF (new.actor_name IS NULL OR btrim(new.actor_name) = '' OR new.actor_name = 'System')
     AND new.actor_id IS NOT NULL THEN
    SELECT coalesce(nullif(btrim(full_name), ''), nullif(btrim(email), ''))
    INTO v_actor_name
    FROM public.profiles
    WHERE id = new.actor_id;
    IF v_actor_name IS NOT NULL THEN
      new.actor_name := v_actor_name;
    END IF;
  END IF;

  IF new.action = 'organization.leadership_changed' THEN
    SELECT name INTO v_office_name
    FROM public.organizations
    WHERE id = coalesce(new.org_id, CASE WHEN new.entity_id ~* '^[0-9a-f-]{36}$' THEN new.entity_id::uuid END);

    IF (new.before_data->>'headUserId') ~* '^[0-9a-f-]{36}$' THEN
      SELECT full_name INTO v_before_head_name
      FROM public.profiles
      WHERE id = (new.before_data->>'headUserId')::uuid;
    END IF;
    IF (new.after_data->>'headUserId') ~* '^[0-9a-f-]{36}$' THEN
      SELECT full_name INTO v_after_head_name
      FROM public.profiles
      WHERE id = (new.after_data->>'headUserId')::uuid;
    END IF;

    new.target_label := coalesce(nullif(btrim(new.target_label), ''), v_office_name, 'Organization');
    new.reason := coalesce(
      nullif(btrim(new.reason), ''),
      CASE
        WHEN v_before_head_name IS NULL AND v_after_head_name IS NOT NULL THEN
          format('Assigned %s as Office Head of %s.', v_after_head_name, new.target_label)
        WHEN v_before_head_name IS NOT NULL AND v_after_head_name IS NULL THEN
          format('Removed %s as Office Head of %s.', v_before_head_name, new.target_label)
        WHEN v_before_head_name IS NOT NULL AND v_after_head_name IS NOT NULL THEN
          format('Changed Office Head of %s from %s to %s.', new.target_label, v_before_head_name, v_after_head_name)
        ELSE
          format('Updated Office leadership for %s.', new.target_label)
      END
    );
    new.change_summary := coalesce(
      nullif(btrim(new.change_summary), ''),
      format('Office Head: %s -> %s', coalesce(v_before_head_name, 'None (Unassigned)'), coalesce(v_after_head_name, 'None (Unassigned)'))
    );
  ELSIF new.action IN ('access.user_permission_overrides.insert', 'access.user_permission_overrides.delete') THEN
    BEGIN
      v_target_uid := coalesce(
        nullif(new.after_data->>'user_id', ''),
        nullif(new.before_data->>'user_id', ''),
        nullif(split_part(new.entity_id, ':', 1), '')
      )::uuid;
    EXCEPTION WHEN others THEN
      v_target_uid := NULL;
    END;
    v_perm := coalesce(
      new.after_data->>'permission',
      new.before_data->>'permission',
      nullif(split_part(new.entity_id, ':', 2), '')
    );
    IF v_target_uid IS NOT NULL THEN
      SELECT full_name INTO v_target_name FROM public.profiles WHERE id = v_target_uid;
    END IF;
    new.target_label := coalesce(
      nullif(btrim(new.target_label), ''),
      trim(both ' ·' from coalesce(v_target_name, '') || CASE WHEN v_perm IS NOT NULL THEN ' · ' || v_perm ELSE '' END)
    );
    new.reason := coalesce(
      nullif(btrim(new.reason), ''),
      CASE
        WHEN new.action LIKE '%.insert' THEN
          format('Set permission %s for %s to %s.', coalesce(v_perm, 'access'), coalesce(v_target_name, 'user'), CASE WHEN coalesce((new.after_data->>'allowed')::boolean, false) THEN 'Allowed' ELSE 'Denied' END)
        ELSE
          format('Removed permission override %s for %s.', coalesce(v_perm, 'access'), coalesce(v_target_name, 'user'))
      END
    );
    new.change_summary := coalesce(
      nullif(btrim(new.change_summary), ''),
      format('%s: %s', coalesce(v_perm, 'Permission'), CASE WHEN new.action LIKE '%.insert' THEN CASE WHEN coalesce((new.after_data->>'allowed')::boolean, false) THEN 'Allowed' ELSE 'Denied' END ELSE 'Removed' END)
    );
  END IF;

  RETURN new;
END;
$$;

REVOKE ALL ON FUNCTION public.eflow_enrich_audit_event() FROM public, anon, authenticated;

DROP TRIGGER IF EXISTS trg_eflow_enrich_audit_event ON public.audit_events;
CREATE TRIGGER trg_eflow_enrich_audit_event
  BEFORE INSERT ON public.audit_events
  FOR EACH ROW
  EXECUTE FUNCTION public.eflow_enrich_audit_event();

-- Backfill existing historical administrative audit rows cleanly so prior approvals (including Gabriel Head)
-- show full before/after changes, actor names, and human-readable target labels.
WITH completed_actors AS (
  SELECT DISTINCT ON (coalesce(metadata->>'invitation_id', entity_id))
    coalesce(metadata->>'invitation_id', entity_id) AS inv_id,
    actor_id AS user_id
  FROM public.audit_events
  WHERE action = 'account.activation_completed'
    AND actor_id IS NOT NULL
  ORDER BY coalesce(metadata->>'invitation_id', entity_id), created_at DESC
),
leadership_matches AS (
  SELECT
    ev.id AS approve_event_id,
    lead.before_data->>'headUserId' AS prev_head_id,
    lead.after_data->>'headUserId' AS new_head_id
  FROM public.audit_events ev
  JOIN public.audit_events lead
    ON lead.action = 'organization.leadership_changed'
   AND lead.org_id IS NOT DISTINCT FROM ev.org_id
   AND abs(extract(epoch FROM (lead.created_at - ev.created_at))) <= 5
  WHERE ev.action = 'account.activation_approve'
),
resolved_activation AS (
  SELECT
    ev.id AS event_id,
    ev.action,
    ev.actor_id,
    coalesce(
      nullif(btrim(ap.full_name), ''),
      nullif(btrim(ev.actor_name), ''),
      'System'
    ) AS resolved_actor_name,
    coalesce(
      i.accepted_by::text,
      lm.new_head_id,
      ca.user_id::text,
      ev.entity_id
    ) AS resolved_entity_id,
    coalesce(
      nullif(btrim(tp.full_name), ''),
      nullif(btrim(d.full_name), ''),
      i.email,
      ev.metadata->>'full_name',
      ev.metadata->>'email',
      'Invited User'
    ) AS resolved_target_name,
    coalesce(o.name, ev.metadata->>'office_name', 'LEDIPO') AS office_name,
    coalesce(
      CASE WHEN lm.new_head_id IS NOT NULL THEN 'head' END,
      d.requested_privileged_role,
      tp.role,
      i.account_role,
      'member'
    ) AS resolved_role,
    i.email AS inv_email,
    coalesce(i.id::text, ev.metadata->>'invitation_id', ev.entity_id) AS inv_id,
    coalesce(i.accepted_by::text, lm.new_head_id, ca.user_id::text) AS accepted_uid,
    lm.prev_head_id,
    lm.new_head_id
  FROM public.audit_events ev
  LEFT JOIN public.profiles ap ON ap.id = ev.actor_id
  LEFT JOIN public.user_invitations i
    ON i.id::text = coalesce(ev.metadata->>'invitation_id', ev.entity_id)
  LEFT JOIN public.managed_account_invite_details d ON d.invitation_id = i.id
  LEFT JOIN completed_actors ca ON ca.inv_id = coalesce(ev.metadata->>'invitation_id', ev.entity_id)
  LEFT JOIN leadership_matches lm ON lm.approve_event_id = ev.id
  LEFT JOIN public.profiles tp
    ON tp.id::text = coalesce(i.accepted_by::text, lm.new_head_id, ca.user_id::text, ev.entity_id)
  LEFT JOIN public.organizations o ON o.id = coalesce(ev.org_id, i.office_id)
  WHERE ev.action LIKE 'account.activation_%'
)
UPDATE public.audit_events ae
SET
  actor_name = ra.resolved_actor_name,
  entity_id = ra.resolved_entity_id,
  target_label = ra.resolved_target_name,
  metadata = coalesce(ae.metadata, '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
    'invitation_id', ra.inv_id,
    'accepted_by', ra.accepted_uid,
    'email', ra.inv_email,
    'full_name', ra.resolved_target_name,
    'office_name', ra.office_name,
    'requested_privileged_role', CASE WHEN ra.resolved_role IN ('head', 'admin') THEN ra.resolved_role ELSE NULL END
  )),
  reason = coalesce(
    nullif(btrim(ae.reason), ''),
    CASE ra.action
      WHEN 'account.activation_approve' THEN
        format(
          'Approved %s as %s of %s.',
          ra.resolved_target_name,
          CASE ra.resolved_role WHEN 'head' THEN 'Office Head' WHEN 'admin' THEN 'Administrator' ELSE 'Member' END,
          ra.office_name
        )
      WHEN 'account.activation_completed' THEN
        format('%s verified their email and completed account activation in %s.', ra.resolved_target_name, ra.office_name)
      WHEN 'account.activation_email_attempted' THEN
        format('Sent account activation link to %s%s.', ra.resolved_target_name, CASE WHEN ra.inv_email IS NOT NULL THEN ' (' || ra.inv_email || ')' ELSE '' END)
      WHEN 'account.activation_staged' THEN
        format('Created account invitation for %s in %s.', ra.resolved_target_name, ra.office_name)
      WHEN 'account.activation_revoke' THEN
        format('Revoked pending activation invitation for %s.', ra.resolved_target_name)
      WHEN 'account.activation_deleted' THEN
        format('Deleted revoked activation invitation for %s.', ra.resolved_target_name)
      ELSE ae.reason
    END
  ),
  change_summary = coalesce(
    nullif(btrim(ae.change_summary), ''),
    CASE ra.action
      WHEN 'account.activation_approve' THEN
        format(
          'Approved role: Member -> %s · Account active: No -> Yes',
          CASE ra.resolved_role WHEN 'head' THEN 'Office Head' WHEN 'admin' THEN 'Administrator' ELSE 'Member' END
        )
      WHEN 'account.activation_completed' THEN 'Workflow status: Pending Activation -> Activated'
      WHEN 'account.activation_email_attempted' THEN 'Email delivery: Queued -> Email Sent'
      WHEN 'account.activation_staged' THEN format('Status: Not Invited -> Pending Activation (%s)', ra.office_name)
      WHEN 'account.activation_revoke' THEN 'Workflow status: Pending Activation -> Revoked'
      WHEN 'account.activation_deleted' THEN 'Workflow status: Revoked -> Deleted'
      ELSE ae.change_summary
    END
  ),
  before_data = coalesce(
    ae.before_data,
    CASE ra.action
      WHEN 'account.activation_approve' THEN
        jsonb_strip_nulls(jsonb_build_object(
          'full_name', ra.resolved_target_name,
          'email', ra.inv_email,
          'role', 'member',
          'is_active', false,
          'status', 'pending_approval'
        )) || CASE WHEN ra.resolved_role = 'head' THEN jsonb_build_object('headUserId', ra.prev_head_id) ELSE '{}'::jsonb END
      WHEN 'account.activation_completed' THEN
        jsonb_strip_nulls(jsonb_build_object('full_name', ra.resolved_target_name, 'status', 'pending_activation', 'is_active', false))
      WHEN 'account.activation_email_attempted' THEN
        jsonb_build_object('emailDeliveryStatus', 'queued')
      WHEN 'account.activation_staged' THEN
        jsonb_build_object('status', 'not_invited')
      WHEN 'account.activation_revoke' THEN
        jsonb_strip_nulls(jsonb_build_object('full_name', ra.resolved_target_name, 'status', 'pending_activation'))
      ELSE NULL
    END
  ),
  after_data = coalesce(
    ae.after_data,
    CASE ra.action
      WHEN 'account.activation_approve' THEN
        jsonb_strip_nulls(jsonb_build_object(
          'full_name', ra.resolved_target_name,
          'email', ra.inv_email,
          'role', ra.resolved_role,
          'is_active', true,
          'assignedOffice', ra.office_name,
          'status', 'approved'
        )) || CASE WHEN ra.resolved_role = 'head' THEN jsonb_build_object('headUserId', coalesce(ra.new_head_id, ra.accepted_uid, ra.resolved_target_name)) ELSE '{}'::jsonb END
      WHEN 'account.activation_completed' THEN
        jsonb_strip_nulls(jsonb_build_object('full_name', ra.resolved_target_name, 'status', 'activated', 'assignedOffice', ra.office_name))
      WHEN 'account.activation_email_attempted' THEN
        jsonb_strip_nulls(jsonb_build_object('emailDeliveryStatus', 'email_sent', 'email', ra.inv_email, 'full_name', ra.resolved_target_name, 'assignedOffice', ra.office_name))
      WHEN 'account.activation_staged' THEN
        jsonb_strip_nulls(jsonb_build_object('status', 'pending_activation', 'full_name', ra.resolved_target_name, 'assignedOffice', ra.office_name))
      WHEN 'account.activation_revoke' THEN
        jsonb_strip_nulls(jsonb_build_object('full_name', ra.resolved_target_name, 'status', 'revoked', 'assignedOffice', ra.office_name))
      ELSE NULL
    END
  )
FROM resolved_activation ra
WHERE ae.id = ra.event_id;

UPDATE public.audit_events ae
SET
  target_label = coalesce(
    ae.target_label,
    (SELECT name FROM public.organizations WHERE id = coalesce(ae.org_id, CASE WHEN ae.entity_id ~* '^[0-9a-f-]{36}$' THEN ae.entity_id::uuid END))
  ),
  reason = coalesce(
    nullif(btrim(ae.reason), ''),
    CASE
      WHEN (ae.before_data->>'headUserId') IS NULL AND (ae.after_data->>'headUserId') IS NOT NULL THEN
        format(
          'Assigned %s as Office Head of %s.',
          coalesce((SELECT full_name FROM public.profiles WHERE id::text = ae.after_data->>'headUserId'), 'selected member'),
          coalesce((SELECT name FROM public.organizations WHERE id = coalesce(ae.org_id, CASE WHEN ae.entity_id ~* '^[0-9a-f-]{36}$' THEN ae.entity_id::uuid END)), 'Organization')
        )
      WHEN (ae.before_data->>'headUserId') IS NOT NULL AND (ae.after_data->>'headUserId') IS NULL THEN
        format(
          'Removed %s as Office Head of %s.',
          coalesce((SELECT full_name FROM public.profiles WHERE id::text = ae.before_data->>'headUserId'), 'previous head'),
          coalesce((SELECT name FROM public.organizations WHERE id = coalesce(ae.org_id, CASE WHEN ae.entity_id ~* '^[0-9a-f-]{36}$' THEN ae.entity_id::uuid END)), 'Organization')
        )
      ELSE
        format(
          'Changed Office Head of %s from %s to %s.',
          coalesce((SELECT name FROM public.organizations WHERE id = coalesce(ae.org_id, CASE WHEN ae.entity_id ~* '^[0-9a-f-]{36}$' THEN ae.entity_id::uuid END)), 'Organization'),
          coalesce((SELECT full_name FROM public.profiles WHERE id::text = ae.before_data->>'headUserId'), 'previous head'),
          coalesce((SELECT full_name FROM public.profiles WHERE id::text = ae.after_data->>'headUserId'), 'selected member')
        )
    END
  ),
  change_summary = coalesce(
    nullif(btrim(ae.change_summary), ''),
    format(
      'Office Head: %s -> %s',
      coalesce((SELECT full_name FROM public.profiles WHERE id::text = ae.before_data->>'headUserId'), 'None (Unassigned)'),
      coalesce((SELECT full_name FROM public.profiles WHERE id::text = ae.after_data->>'headUserId'), 'None (Unassigned)')
    )
  )
WHERE ae.action = 'organization.leadership_changed';

UPDATE public.audit_events ae
SET
  target_label = coalesce(
    nullif(btrim(ae.target_label), ''),
    trim(both ' ·' from coalesce(
      (SELECT full_name FROM public.profiles WHERE id::text = coalesce(ae.after_data->>'user_id', ae.before_data->>'user_id', split_part(ae.entity_id, ':', 1))),
      'User'
    ) || ' · ' || coalesce(ae.after_data->>'permission', ae.before_data->>'permission', split_part(ae.entity_id, ':', 2), 'access'))
  ),
  reason = coalesce(
    nullif(btrim(ae.reason), ''),
    CASE
      WHEN ae.action LIKE '%.insert' THEN
        format(
          'Set permission %s for %s to %s.',
          coalesce(ae.after_data->>'permission', split_part(ae.entity_id, ':', 2), 'access'),
          coalesce((SELECT full_name FROM public.profiles WHERE id::text = coalesce(ae.after_data->>'user_id', split_part(ae.entity_id, ':', 1))), 'User'),
          CASE WHEN coalesce((ae.after_data->>'allowed')::boolean, false) THEN 'Allowed' ELSE 'Denied' END
        )
      ELSE
        format(
          'Removed permission override %s for %s.',
          coalesce(ae.before_data->>'permission', split_part(ae.entity_id, ':', 2), 'access'),
          coalesce((SELECT full_name FROM public.profiles WHERE id::text = coalesce(ae.before_data->>'user_id', split_part(ae.entity_id, ':', 1))), 'User')
        )
    END
  ),
  change_summary = coalesce(
    nullif(btrim(ae.change_summary), ''),
    format(
      '%s: %s',
      coalesce(ae.after_data->>'permission', ae.before_data->>'permission', split_part(ae.entity_id, ':', 2), 'Permission'),
      CASE WHEN ae.action LIKE '%.insert' THEN CASE WHEN coalesce((ae.after_data->>'allowed')::boolean, false) THEN 'Allowed' ELSE 'Denied' END ELSE 'Removed' END
    )
  )
WHERE ae.action IN ('access.user_permission_overrides.insert', 'access.user_permission_overrides.delete');
