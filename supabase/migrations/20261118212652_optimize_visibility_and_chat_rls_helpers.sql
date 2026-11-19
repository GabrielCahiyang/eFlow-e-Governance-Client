-- Migration 1: Flatten visibility and chat RLS helpers without changing semantics or ACLs
SET lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.can_see_project(target_project uuid, caller_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_proj record;
  v_caller record;
  v_eligible boolean;
  v_open boolean;
  v_is_proj_member boolean;
  v_can_access_org boolean;
  v_phase6_access boolean;
  v_allowed boolean;
  v_joined_head boolean;
begin
  if target_project is null or caller_id is null then
    return false;
  end if;

  select p.id, p.org_id, p.owner_id, p.project_lead_id, p.status,
         p.publication_state, p.source_collaboration_draft_id
    into v_proj
  from public.projects p
  where p.id = target_project;
  if not found then
    return false;
  end if;

  select pr.id, pr.role, pr.is_active, pr.org_id,
         o.path::text as org_path, o.is_active as org_is_active,
         o.head_user_id as org_head_user_id, u.email_confirmed_at
    into v_caller
  from public.profiles pr
  left join public.organizations o on o.id = pr.org_id
  left join auth.users u on u.id = pr.id
  where pr.id = caller_id;
  if not found or not v_caller.is_active or v_caller.role is null or v_caller.role = 'admin' then
    return false;
  end if;

  -- Draft visibility: only active draft manager matching auth.uid()
  if v_proj.publication_state = 'draft' then
    if caller_id = auth.uid() and v_proj.status = 'planning' and (
      (v_caller.role = 'head' and v_caller.org_id = v_proj.org_id
       and coalesce(v_caller.org_is_active, false) and v_caller.org_head_user_id = caller_id)
      or (v_proj.project_lead_id = caller_id and v_caller.org_id = v_proj.org_id
          and v_caller.role not in ('admin', 'super_admin', 'viewer'))
    ) then
      return true;
    end if;
    return false;
  end if;

  if v_proj.publication_state is distinct from 'published' then
    return false;
  end if;

  v_eligible := (v_caller.role in ('head', 'member', 'accounting_staff') and v_caller.email_confirmed_at is not null);
  v_open := (v_proj.status not in ('completed', 'archived') and v_proj.source_collaboration_draft_id is null);

  -- Explicit valid share grant overrides office removal/member block
  if v_eligible and exists (
    select 1 from public.project_access_grants g
    where g.project_id = v_proj.id
      and g.recipient = caller_id
      and g.revoked_at is null
      and g.redeemed_at is not null
      and (g.access_end is null or g.access_end > now())
      and ((g.engagement = 'Permanent' and not g.until_close) or v_open)
      and not exists (
        select 1 from eflow_r9.removed r
        where r.project_id = v_proj.id
          and r.user_id = caller_id
          and r.scope = coalesce(g.office_id, '00000000-0000-0000-0000-000000000000'::uuid)
      )
  ) then
    return true;
  end if;

  v_allowed := not exists (
    select 1 from eflow_r9.removed r
    where r.project_id = v_proj.id
      and r.user_id = caller_id
      and (r.scope = coalesce(v_caller.org_id, '00000000-0000-0000-0000-000000000000'::uuid) or v_caller.org_id is null)
  ) and not exists (
    select 1 from public.project_office_members m
    join public.project_offices o on o.id = m.project_office_id
    where o.project_id = v_proj.id
      and m.user_id = caller_id
      and (v_caller.org_id is null or o.office_id = v_caller.org_id)
      and (m.access_ended_at is not null
        or m.access_end <= now()
        or ((m.engagement <> 'Permanent' or m.until_close) and not v_open))
  );

  v_joined_head := (
    v_caller.role = 'head'
    and coalesce(v_caller.org_is_active, false)
    and v_caller.org_head_user_id = caller_id
    and exists (
      select 1 from public.project_offices o
      where o.project_id = v_proj.id
        and o.office_id = v_caller.org_id
        and o.invitation_status = 'joined'
        and o.relationship_type in ('lead', 'collaborating')
    )
  );

  if not (v_allowed or v_joined_head) then
    return false;
  end if;

  -- Active approved guest member
  if v_eligible and exists (
    select 1 from public.project_guest_members m
    join public.project_offices o on o.project_id = m.project_id and o.office_id = m.office_id
    where m.project_id = v_proj.id
      and m.user_id = caller_id
      and m.ended_at is null
      and (m.access_end is null or m.access_end > now())
      and (m.engagement = 'Permanent' or v_proj.status not in ('completed', 'archived'))
      and o.invitation_status = 'joined'
      and o.relationship_type in ('lead', 'collaborating')
  ) then
    return true;
  end if;

  v_is_proj_member := exists (
    select 1 from public.project_members pm
    where pm.project_id = v_proj.id and pm.user_id = caller_id
  );

  v_can_access_org := (v_proj.org_id is not null and (
    (v_caller.role = 'head' and v_caller.org_path is not null and exists (
      select 1 from public.organizations to2
      where to2.id = v_proj.org_id
        and (to2.path::text = v_caller.org_path or to2.path::text like v_caller.org_path || '.%')
    ))
    or exists (
      select 1 from public.user_org_scope_grants gr
      join public.organizations go on go.id = gr.org_id
      join public.organizations to2 on to2.id = v_proj.org_id
      where gr.user_id = caller_id
        and (gr.expires_at is null or gr.expires_at > now())
        and (to2.path::text = go.path::text or to2.path::text like go.path::text || '.%')
        and gr.access_level in ('read', 'review', 'manage')
    )
  ));

  v_phase6_access := exists (
    select 1 from public.project_offices o
    where o.project_id = v_proj.id
      and o.invitation_status <> 'revoked'
      and (
        (o.contact_user_id = caller_id and o.invitation_status in ('awaiting_head', 'joined'))
        or (v_caller.role = 'head' and v_caller.org_id = o.office_id
            and coalesce(v_caller.org_is_active, false) and v_caller.org_head_user_id = caller_id)
        or (o.invitation_status = 'joined' and v_caller.org_id = o.office_id and (
          exists (select 1 from public.project_office_members m where m.project_office_id = o.id and m.user_id = caller_id)
          or (o.relationship_type = 'lead'
              and not exists (select 1 from public.project_office_members m where m.project_office_id = o.id and m.user_id = caller_id))
        ))
      )
  );

  -- Guest isolation gate (r8.independent)
  if exists (select 1 from public.project_guest_members gm where gm.project_id = v_proj.id and gm.user_id = caller_id)
     and not (v_proj.owner_id = caller_id or v_is_proj_member or v_can_access_org or v_phase6_access) then
    return false;
  end if;

  if v_proj.source_collaboration_draft_id is not null then
    if public.can_see_collaboration_project(v_proj.id, caller_id)
       or public.is_collaboration_participant(v_proj.source_collaboration_draft_id, caller_id) then
      return true;
    end if;
  elsif v_proj.owner_id = caller_id
     or v_is_proj_member
     or v_can_access_org
     or exists (
       select 1 from public.tasks tk
       where tk.linked_project_id = v_proj.id
         and tk.deleted_at is null
         and (tk.assigned_to = caller_id
           or tk.recommendation_lead_id = caller_id
           or (tk.team_member_ids is not null and caller_id = any(tk.team_member_ids)))
     ) then
    return true;
  end if;

  if v_phase6_access then
    return true;
  end if;

  return exists (
    select 1 from public.project_office_identities i
    where i.project_id = v_proj.id
      and i.contact_user_id = caller_id
      and i.contact_status = 'accepted'
      and (i.project_office_id is null
        or exists (select 1 from public.project_offices o where o.id = i.project_office_id and o.invitation_status <> 'revoked'))
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.can_see_task(target_task uuid, caller_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  t record;
  v_proj record;
  v_caller record;
  v_eligible boolean;
  v_open boolean;
  v_can_see_proj boolean := false;
  v_can_access_org boolean := false;
  v_r8_task boolean := false;
begin
  if target_task is null or caller_id is null then
    return false;
  end if;

  select tk.id, tk.linked_project_id, tk.org_id, tk.assigned_to, tk.created_by,
         tk.recommendation_lead_id, tk.reviewer_id, tk.backup_reviewer_id,
         tk.team_member_ids, tk.proposed_office_identity_id, tk.source_collaboration_draft_id
    into t
  from public.tasks tk
  where tk.id = target_task and tk.deleted_at is null;
  if not found then
    return false;
  end if;

  select pr.id, pr.role, pr.is_active, pr.org_id,
         o.path::text as org_path, o.is_active as org_is_active,
         o.head_user_id as org_head_user_id, u.email_confirmed_at
    into v_caller
  from public.profiles pr
  left join public.organizations o on o.id = pr.org_id
  left join auth.users u on u.id = pr.id
  where pr.id = caller_id;
  if not found or not v_caller.is_active or v_caller.role is null or v_caller.role = 'admin' then
    return false;
  end if;

  if t.linked_project_id is not null then
    select p.id, p.org_id, p.project_lead_id, p.status,
           p.publication_state, p.source_collaboration_draft_id
      into v_proj
    from public.projects p
    where p.id = t.linked_project_id;
    if not found then
      return false;
    end if;

    if v_proj.publication_state = 'draft' then
      return caller_id = auth.uid() and v_proj.status = 'planning' and (
        (v_caller.role = 'head' and v_caller.org_id = v_proj.org_id
         and coalesce(v_caller.org_is_active, false) and v_caller.org_head_user_id = caller_id)
        or (v_proj.project_lead_id = caller_id and v_caller.org_id = v_proj.org_id
            and v_caller.role not in ('admin', 'super_admin', 'viewer'))
      );
    end if;

    if v_proj.publication_state is distinct from 'published' then
      return false;
    end if;
  end if;

  v_eligible := (v_caller.role in ('head', 'member', 'accounting_staff') and v_caller.email_confirmed_at is not null);

  if t.linked_project_id is not null
     and t.proposed_office_identity_id is null
     and t.source_collaboration_draft_id is null
     and v_eligible then
    v_open := (v_proj.status not in ('completed', 'archived') and v_proj.source_collaboration_draft_id is null);
    if exists (
      select 1 from public.project_access_grants g
      where g.project_id = t.linked_project_id
        and g.recipient = caller_id
        and g.revoked_at is null
        and g.redeemed_at is not null
        and (g.access_end is null or g.access_end > now())
        and ((g.engagement = 'Permanent' and not g.until_close) or v_open)
        and not exists (
          select 1 from eflow_r9.removed r
          where r.project_id = t.linked_project_id
            and r.user_id = caller_id
            and r.scope = coalesce(g.office_id, '00000000-0000-0000-0000-000000000000'::uuid)
        )
    ) then
      return true;
    end if;
  end if;

  if t.linked_project_id is not null then
    v_can_see_proj := public.can_see_project(t.linked_project_id, caller_id);
    if t.source_collaboration_draft_id is null then
      if not v_can_see_proj then
        return false;
      end if;
      -- Here caller is active non-admin and can see the linked project, so eflow_r8.baseline_can_see_task is true.
      if t.created_by = caller_id
         or t.reviewer_id = caller_id
         or t.backup_reviewer_id = caller_id
         or not exists (
           select 1 from public.project_guest_members gm
           where gm.project_id = t.linked_project_id and gm.user_id = caller_id
         ) then
        return true;
      end if;
      if eflow_r8.independent(t.linked_project_id, caller_id) then
        return true;
      end if;
      return t.proposed_office_identity_id is null
        and v_eligible
        and exists (
          select 1 from public.project_guest_members m
          join public.project_offices o on o.project_id = m.project_id and o.office_id = m.office_id
          where m.project_id = t.linked_project_id
            and (t.org_id is null or m.office_id = t.org_id)
            and m.user_id = caller_id
            and m.ended_at is null
            and (m.access_end is null or m.access_end > now())
            and (m.engagement = 'Permanent' or v_proj.status not in ('completed', 'archived'))
            and o.invitation_status = 'joined'
            and o.relationship_type in ('lead', 'collaborating')
        );
    end if;
  end if;

  -- Standalone task or collaboration task branch
  v_r8_task := (
    t.assigned_to = caller_id
    or t.created_by = caller_id
    or t.recommendation_lead_id = caller_id
    or t.reviewer_id = caller_id
    or t.backup_reviewer_id = caller_id
    or (t.team_member_ids is not null and caller_id = any(t.team_member_ids))
    or (t.linked_project_id is not null and v_can_see_proj)
  );

  if not v_r8_task and t.source_collaboration_draft_id is null and t.org_id is not null then
    v_can_access_org := (
      (v_caller.role = 'head' and v_caller.org_path is not null and exists (
        select 1 from public.organizations to2
        where to2.id = t.org_id
          and (to2.path::text = v_caller.org_path or to2.path::text like v_caller.org_path || '.%')
      ))
      or exists (
        select 1 from public.user_org_scope_grants gr
        join public.organizations go on go.id = gr.org_id
        join public.organizations to2 on to2.id = t.org_id
        where gr.user_id = caller_id
          and (gr.expires_at is null or gr.expires_at > now())
          and (to2.path::text = go.path::text or to2.path::text like go.path::text || '.%')
          and gr.access_level in ('read', 'review', 'manage')
      )
    );
    v_r8_task := v_can_access_org;
  end if;

  if not v_r8_task then
    return false;
  end if;

  if t.linked_project_id is null
     or t.created_by = caller_id
     or t.reviewer_id = caller_id
     or t.backup_reviewer_id = caller_id
     or not exists (
       select 1 from public.project_guest_members gm
       where gm.project_id = t.linked_project_id and gm.user_id = caller_id
     ) then
    return true;
  end if;

  return eflow_r8.independent(t.linked_project_id, caller_id);
end;
$function$;

CREATE OR REPLACE FUNCTION eflow_m7.project_visible(p_project uuid, p_actor uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select p_project is null or exists (
    select 1 from public.projects p
    where p.id = p_project and (
      p.publication_state = 'published'
      or (
        p_actor = auth.uid()
        and p.publication_state = 'draft'
        and p.status = 'planning'
        and exists (
          select 1 from public.profiles u
          where u.id = p_actor and u.is_active and (
            (u.role = 'head' and u.org_id = p.org_id
             and exists (select 1 from public.organizations o where o.id = p.org_id and o.is_active and o.head_user_id = p_actor))
            or (p.project_lead_id = p_actor and u.org_id = p.org_id
                and u.role not in ('admin', 'super_admin', 'viewer'))
          )
        )
      )
    )
  );
$function$;

CREATE OR REPLACE FUNCTION eflow_m7.node_visible(p_root uuid, p_node uuid, p_actor uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1 from public.subtasks s
    join public.tasks t on t.id = s.task_id
    where t.id = p_root and s.id = p_node and t.deleted_at is null and (
      coalesce(t.assigned_to, t.recommendation_lead_id) = p_actor
      or t.status::text in ('in_progress', 'for_review', 'changes_requested', 'completed')
      or exists (select 1 from public.task_status_history h where h.task_id = t.id and h.to_status::text = 'in_progress')
    )
  ) and coalesce(public.can_see_task(p_root, p_actor), false);
$function$;

CREATE OR REPLACE FUNCTION eflow_m7.can_view_linked_work(p_task uuid, p_node uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select case
    when p_node is not null then eflow_m7.node_visible(p_task, p_node, auth.uid())
    when p_task is not null then coalesce(public.can_see_task(p_task, auth.uid()), false)
    else true
  end;
$function$;

CREATE OR REPLACE FUNCTION public.is_channel_member(p_channel uuid, caller uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select caller is not null and exists (
    select 1 from public.chat_channels c
    join public.profiles p on p.id = caller and p.is_active
    left join public.tasks t on t.id = c.task_id
    left join public.projects pr on pr.id = coalesce(c.project_id, t.linked_project_id)
    left join public.organizations channel_org on channel_org.id = c.org_id
    left join public.organizations actor_org on actor_org.id = p.org_id
    where c.id = p_channel
      and (pr.id is null or pr.publication_state is distinct from 'draft')
      and (
        (c.channel_type = 'org' and (
          channel_org.path::text = actor_org.path::text
          or starts_with(actor_org.path::text, channel_org.path::text || '.')
        ))
        or (c.channel_type = 'project' and pr.id is not null and (
          p.id in (pr.owner_id, pr.project_lead_id)
          or exists (select 1 from public.project_members m where m.project_id = pr.id and m.user_id = p.id)
          or exists (select 1 from public.project_offices po join public.project_office_members pm on pm.project_office_id = po.id
                     where po.project_id = pr.id and pm.user_id = p.id)
        ) and public.can_see_project(pr.id, p.id))
        or (c.channel_type in ('task', 'direct')
          and exists (select 1 from public.chat_channel_members m where m.channel_id = c.id and m.user_id = p.id)
          and (c.channel_type <> 'task' or (t.id is not null and t.deleted_at is null and public.can_see_task(t.id, p.id))))
      )
  );
$function$;

CREATE OR REPLACE FUNCTION public.list_message_conversations()
 RETURNS TABLE(channel_id uuid, channel_type text, task_id uuid, org_id uuid, project_id uuid, name text, project_title text, last_message text, last_message_at timestamp with time zone, unread boolean, is_lead boolean, other_user_id uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with actor as (
    select p.id as uid, p.org_id, ao.path::text as org_path
    from public.profiles p
    left join public.organizations ao on ao.id = p.org_id
    where p.id = auth.uid() and p.is_active
  ), visible_channels as (
    select c.id, c.channel_type, c.task_id, c.org_id, c.project_id, c.name, c.created_at,
           m.last_read_at, t.project_title, t.recommendation_lead_id, t.assigned_to,
           a.uid
    from actor a
    join public.chat_channels c on true
    left join public.chat_channel_members m on m.channel_id = c.id and m.user_id = a.uid
    left join public.tasks t on t.id = c.task_id
    left join public.projects pr on pr.id = coalesce(c.project_id, t.linked_project_id)
    left join public.organizations co on co.id = c.org_id
    where (m.channel_id is not null or c.channel_type in ('org', 'project'))
      and (pr.id is null or pr.publication_state is distinct from 'draft')
      and (
        (c.channel_type = 'org' and (
          co.path::text = a.org_path
          or starts_with(a.org_path, co.path::text || '.')
        ))
        or (c.channel_type = 'project' and pr.id is not null and (
          a.uid in (pr.owner_id, pr.project_lead_id)
          or exists (select 1 from public.project_members pm where pm.project_id = pr.id and pm.user_id = a.uid)
          or exists (select 1 from public.project_offices po join public.project_office_members pom on pom.project_office_id = po.id
                     where po.project_id = pr.id and pom.user_id = a.uid)
        ) and public.can_see_project(pr.id, a.uid))
        or (c.channel_type in ('task', 'direct')
          and m.channel_id is not null
          and (c.channel_type <> 'task' or (t.id is not null and t.deleted_at is null and public.can_see_task(t.id, a.uid))))
      )
  )
  select vc.id, vc.channel_type, vc.task_id, vc.org_id, vc.project_id,
    coalesce(nullif(person.full_name, ''), nullif(vc.name, ''), 'Conversation'),
    vc.project_title,
    case when latest.image_path is not null and latest.content = '' then 'Sent an image' else latest.content end,
    latest.created_at,
    coalesce(incoming.created_at > coalesce(vc.last_read_at, vc.created_at), false),
    coalesce(coalesce(vc.recommendation_lead_id, vc.assigned_to) = vc.uid, false),
    person.id
  from visible_channels vc
  left join lateral (
    select p.id, p.full_name
    from public.chat_channel_members cm
    join public.profiles p on p.id = cm.user_id
    where vc.channel_type = 'direct' and cm.channel_id = vc.id and p.id <> vc.uid
    order by p.id limit 1
  ) person on true
  left join lateral (
    select msg.content, msg.created_at, msg.image_path
    from public.chat_messages msg
    where msg.channel_id = vc.id
    order by msg.created_at desc, msg.id desc limit 1
  ) latest on true
  left join lateral (
    select msg.created_at
    from public.chat_messages msg
    where msg.channel_id = vc.id
      and msg.sender_id is distinct from vc.uid
      and msg.created_at > coalesce(vc.last_read_at, vc.created_at)
    order by msg.created_at desc limit 1
  ) incoming on true
  order by coalesce(latest.created_at, vc.created_at) desc, vc.id;
$function$;

CREATE OR REPLACE FUNCTION eflow_project.snapshot(p_project uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  p public.projects;
  v_uid uuid := auth.uid();
  v_is_head boolean := false;
  v_is_lead boolean := false;
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
begin
  select * into p from public.projects where id = p_project;
  if p.id is null or v_uid is null or not public.can_see_project(p.id, v_uid) then
    raise exception 'Current project access required' using errcode = '42501';
  end if;

  v_is_head := public.phase2_is_office_head(v_uid, p.org_id);
  v_is_lead := eflow_project.lead(p.id, v_uid);
  v_eligible := eflow_r3.eligible(v_uid);

  select coalesce(jsonb_agg(to_jsonb(f) || jsonb_build_object(
    'name', s.name,
    'available', f.amount - coalesce((
      select sum(l.amount)
      from public.work_budget_allocation_lines l
      join public.work_budget_allocations a on a.id = l.allocation_id
      where l.project_funding_id = f.id and a.subtask_id is null and a.status = 'approved'
    ), 0)
  ) order by f.fiscal_year, f.quarter, s.name), '[]')
    into funds
  from eflow_project.funding f
  join public.office_budget_sections s on s.id = f.partition_id
  join public.budget_commitments c on c.id = f.commitment_id
  where f.project_id = p.id and f.amount > 0 and c.status = 'active';

  select coalesce(sum((x->>'amount')::numeric), 0),
         coalesce(sum((x->>'amount')::numeric - (x->>'available')::numeric), 0)
    into total, allocated
  from jsonb_array_elements(funds) x;

  select coalesce(sum(r.released_amount), 0),
         coalesce(sum(r.actual_spent), 0),
         coalesce(sum(r.returned_amount) filter (where r.status = 'settled'), 0),
         coalesce(sum(r.released_amount) filter (where r.status <> 'settled'), 0)
    into released, spent, returned, outstanding
  from public.petty_cash_requests r
  join public.tasks t on t.id = r.task_id
  where t.linked_project_id = p.id;

  if v_is_head or v_is_lead then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', s.id, 'name', s.name, 'year', b.fiscal_year,
      'available', s.amount - s.held_amount - eflow_budget.partition_committed(s.id)
    ) order by b.fiscal_year, s.position), '[]')
      into sources
    from public.office_budget_sections s
    join public.department_fiscal_budgets b on b.id = s.fiscal_budget_id
    where b.org_id = p.org_id and b.status = 'locked' and not s.retired
      and not exists (select 1 from public.office_budget_sections child where child.parent_id = s.id and not child.retired);

    select coalesce(jsonb_agg(jsonb_build_object(
      'id', r.id, 'purpose', r.purpose, 'amount', r.requested_amount, 'status', r.status,
      'requester', pr.full_name,
      'canReview', r.status = 'pending_department_approval' and eflow_project.reviewer(t.id, r.requester_id) = v_uid
    ) order by r.created_at desc), '[]')
      into requests
    from public.petty_cash_requests r
    join public.tasks t on t.id = r.task_id
    left join public.profiles pr on pr.id = r.requester_id
    where t.linked_project_id = p.id;
  end if;

  return jsonb_build_object(
    'project', to_jsonb(p),
    'ready', eflow_project.ready(p.id),
    'canAuthorize', v_is_head,
    'canAllocateTask', v_is_lead and v_eligible,
    'canAllocate', v_is_lead or v_is_head,
    'funds', funds,
    'sources', coalesce(sources, '[]'),
    'requests', coalesce(requests, '[]'),
    'total', total,
    'allocated', allocated,
    'unallocated', total - allocated,
    'released', released,
    'spent', spent,
    'returned', returned,
    'outstanding', outstanding,
    'canExtendTaskFunding', true,
    'taskFunding', coalesce((
      select jsonb_agg(jsonb_build_object(
        'sourceId', l.project_funding_id,
        'fiscalYear', (select f.fiscal_year from eflow_project.funding f where f.id = l.project_funding_id),
        'id', l.id, 'taskId', t.id, 'task', t.title, 'source', s.name, 'amount', l.amount,
        'available', public.task_budget_line_available(l.id, null)
      ))
      from public.work_budget_allocation_lines l
      join public.work_budget_allocations a on a.id = l.allocation_id
      join public.tasks t on t.id = a.task_id
      join public.office_budget_sections s on s.id = l.budget_partition_id
      where t.linked_project_id = p.id and a.subtask_id is null and a.status = 'approved'
        and l.project_funding_id is not null and l.amount > 0
        and public.can_see_task(t.id, v_uid)
    ), '[]'),
    'liquidations', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', liq.id, 'purpose', r.purpose, 'spent', liq.declared_spent,
        'canReview', r.status = 'pending_leader_liquidation_review'
                     and liq.status = 'pending_leader_review'
                     and eflow_project.reviewer(t.id, r.cash_recipient_id) = v_uid
      ))
      from public.petty_cash_liquidations liq
      join public.petty_cash_requests r on r.id = liq.request_id
      join public.tasks t on t.id = r.task_id
      where t.linked_project_id = p.id and (v_is_lead or v_is_head)
    ), '[]'),
    'fundingRequests', coalesce((
      select jsonb_agg(to_jsonb(fr))
      from eflow_project.funding_requests fr
      where fr.project_id = p.id and fr.status = 'pending'
        and (fr.actor_id = v_uid or v_is_head)
    ), '[]')
  );
end;
$function$;

CREATE OR REPLACE FUNCTION eflow_m7.finance_link_visible(p_task uuid, p_node uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select (p_task is null and p_node is null) or exists (
    select 1 from public.tasks t
    left join public.projects pr on pr.id = t.linked_project_id
    where t.id = p_task
      and (t.linked_project_id is null or pr.publication_state = 'published' or (
        pr.publication_state = 'draft' and pr.status = 'planning'
        and exists (
          select 1 from public.profiles u
          where u.id = auth.uid() and u.is_active and (
            (u.role = 'head' and u.org_id = pr.org_id
             and exists (select 1 from public.organizations o where o.id = pr.org_id and o.is_active and o.head_user_id = u.id))
            or (pr.project_lead_id = u.id and u.org_id = pr.org_id
                and u.role not in ('admin', 'super_admin', 'viewer'))
          )
        )
      ))
      and (
        p_node is null
        or t.assigned_to = auth.uid()
        or (
          t.deleted_at is null
          and t.status not in ('todo', 'pending_assignment')
          and exists (
            select 1 from public.subtasks s
            where s.id = p_node and s.task_id = t.id
              and (s.started_at is not null or s.status in ('in_progress', 'stuck', 'changes_requested', 'for_review', 'completed'))
          )
        )
      )
  );
$function$;

RESET lock_timeout;
