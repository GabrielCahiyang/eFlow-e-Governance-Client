-- Include all active, eligible, unremoved Lead Office employees in the
-- project Members directory (r7_project_members -> eflow_r8.baseline_project_members)
-- and grant them baseline project visibility (eflow_phase6.access) without
-- requiring manual "+ Add people" selection or prior task assignment.
begin;

create or replace function eflow_r8.baseline_project_members(p_project uuid)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to ''
as $function$
declare v_members jsonb;v_offices jsonb;begin
 if not eflow_r7.reader() then raise exception 'Verified current read access required' using errcode='42501';end if;
 if exists(select 1 from public.personal_projects where id=p_project) then
  if not eflow_r3.project_access(p_project) then raise exception 'Personal project access denied' using errcode='42501';end if;
  select coalesce(jsonb_agg(to_jsonb(m)||jsonb_build_object('name',p.full_name,'office',p.org_id,'can_read',eflow_r3.eligible(p.id) and m.state='active' and m.access_ended_at is null and (m.access_end is null or m.access_end>now()) and (m.engagement='Permanent' or (select status='active' from public.personal_projects where id=p_project)),'eligible',eflow_r7.member(p_project,null,p.id),'responsibilities',
   coalesce((select jsonb_agg(jsonb_build_object('root',t.id,'title',t.title,'role',case when t.lead_id=p.id then 'Task Lead' else 'Independent reviewer' end)) from public.personal_tasks t where t.project_id=p_project and (t.lead_id=p.id or t.reviewer_id=p.id)),'[]'::jsonb)||
   coalesce((select jsonb_agg(jsonb_build_object('root',t.id,'node',n.id,'title',t.title||' / '||n.title,'role',case when n.lead_id=p.id then 'Subitem Lead' else 'Subitem contributor' end)) from public.personal_subtasks n join public.personal_tasks t on t.id=n.task_id where t.project_id=p_project and (n.lead_id=p.id or p.id=any(n.assigned_to_ids))),'[]'::jsonb)) order by p.full_name),'[]') into v_members from public.personal_project_members m join public.profiles p on p.id=m.user_id where m.project_id=p_project;
  return jsonb_build_object('kind','personal','members',v_members,'offices','[]'::jsonb,'can_select',exists(select 1 from public.personal_projects p where p.id=p_project and eflow_r3.personal_owner(p.workspace_id)));
 end if;
 if not public.can_see_project(p_project,auth.uid()) then raise exception 'Project access denied' using errcode='42501';end if;
 with combined as (
  select
   m.project_office_id,
   m.user_id,
   m.selected_by,
   m.created_at,
   m.engagement,
   m.access_end,
   m.until_close,
   m.access_ended_at,
   m.can_edit,
   p.full_name as name,
   o.office_id as office,
   org.name as office_name,
   case when o.relationship_type='observer' then 'viewer' else 'member' end as access,
   o.invitation_status as state,
   (
    eflow_r3.eligible(p.id)
    and p.org_id=o.office_id
    and o.invitation_status='joined'
    and m.access_ended_at is null
    and (m.access_end is null or m.access_end>now())
    and (m.engagement='Permanent' or (select status not in ('completed','archived') from public.projects where id=p_project))
   ) as can_read,
   eflow_r7.member(p_project,o.office_id,p.id) as eligible
  from public.project_office_members m
  join public.project_offices o on o.id=m.project_office_id
  join public.organizations org on org.id=o.office_id
  join public.profiles p on p.id=m.user_id
  where o.project_id=p_project
  union all
  select
   o.id as project_office_id,
   p.id as user_id,
   null::uuid as selected_by,
   o.joined_at as created_at,
   'Permanent'::text as engagement,
   null::timestamptz as access_end,
   false as until_close,
   null::timestamptz as access_ended_at,
   false as can_edit,
   p.full_name as name,
   o.office_id as office,
   org.name as office_name,
   'member'::text as access,
   o.invitation_status as state,
   true as can_read,
   true as eligible
  from public.project_offices o
  join public.organizations org on org.id=o.office_id
  join public.profiles p on p.org_id=o.office_id
  where o.project_id=p_project
    and o.relationship_type='lead'
    and o.invitation_status='joined'
    and eflow_r3.eligible(p.id)
    and eflow_r9.allowed(p_project,p.id,o.office_id)
    and not exists(
     select 1 from public.project_office_members m
     where m.project_office_id=o.id and m.user_id=p.id
    )
 )
 select coalesce(jsonb_agg(jsonb_build_object(
  'project_office_id',c.project_office_id,
  'user_id',c.user_id,
  'selected_by',c.selected_by,
  'created_at',c.created_at,
  'engagement',c.engagement,
  'access_end',c.access_end,
  'until_close',c.until_close,
  'access_ended_at',c.access_ended_at,
  'can_edit',c.can_edit,
  'name',c.name,
  'office',c.office,
  'office_name',c.office_name,
  'access',c.access,
  'state',c.state,
  'can_read',c.can_read,
  'eligible',c.eligible,
  'responsibilities',
   coalesce((select jsonb_agg(jsonb_build_object('root',t.id,'title',t.title,'role',case when coalesce(t.assigned_to,t.recommendation_lead_id)=c.user_id then 'Task Lead' else 'Contributor' end)) from public.tasks t where t.linked_project_id=p_project and t.deleted_at is null and (coalesce(t.assigned_to,t.recommendation_lead_id)=c.user_id or c.user_id=any(coalesce(t.team_member_ids,'{}'::uuid[])))),'[]'::jsonb)||
   coalesce((select jsonb_agg(jsonb_build_object('root',t.id,'node',n.id,'title',t.title||' / '||n.title,'role',case when n.lead_id=c.user_id then 'Subitem Lead' else 'Subitem contributor' end)) from public.subtasks n join public.tasks t on t.id=n.task_id where t.linked_project_id=p_project and t.deleted_at is null and (n.lead_id=c.user_id or c.user_id=any(n.assigned_to_ids))),'[]'::jsonb)
 ) order by c.office_name,c.name),'[]') into v_members from combined c;
 select coalesce(jsonb_agg(to_jsonb(o)||jsonb_build_object('name',org.name,'can_select',eflow_phase6.head(o.project_id,o.office_id,auth.uid()),'eligible_count',(select count(*) from public.profiles p where p.org_id=o.office_id and eflow_r3.eligible(p.id)))),'[]') into v_offices from public.project_offices o join public.organizations org on org.id=o.office_id where o.project_id=p_project;
 return jsonb_build_object('kind','office','members',v_members,'offices',v_offices);
end $function$;

create or replace function eflow_r7.project_members(p_project uuid)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to ''
as $function$
declare result jsonb;extra jsonb;begin
 result:=eflow_r9.baseline_project_members(p_project);
 result:=result||jsonb_build_object('timezone',eflow_r9.snapshot(p_project)->>'timezone');
 select coalesce(jsonb_agg(jsonb_build_object('user_id',g.recipient,'name',u.full_name,'office',g.office_id,'office_name','Project share','engagement',g.engagement,'access_end',g.access_end,'until_close',g.until_close,'access_ended_at',g.revoked_at,'eligible',eflow_r9.granted(p_project,g.recipient,true,g.office_id),'can_read',eflow_r9.granted(p_project,g.recipient,false,g.office_id),'access',g.access,'state','share','grant_id',g.id,'responsibilities','[]'::jsonb) order by u.full_name),'[]') into extra from (select distinct on (recipient,office_id) * from public.project_access_grants g where g.project_id=p_project and g.revoked_at is null and g.redeemed_at is not null order by recipient,office_id,eflow_r9.grant_valid(g,true) desc,eflow_r9.grant_valid(g) desc,created_at desc,id) g join public.profiles u on u.id=g.recipient where g.project_id=p_project and not exists(select 1 from jsonb_array_elements(result->'members') m where m->>'user_id'=g.recipient::text and (m->>'office')::uuid is not distinct from g.office_id);
 result:=jsonb_set(result,'{members}',(select coalesce(jsonb_agg(m||jsonb_build_object('eligible',eflow_r7.member(p_project,(m->>'office')::uuid,(m->>'user_id')::uuid) or (m->>'access'='member' and m->>'state'='joined' and m->>'access_ended_at' is null and eflow_r7.office_assignable(p_project,(m->>'office')::uuid,(m->>'user_id')::uuid)),'can_read',coalesce((m->>'can_read')::boolean,false) or eflow_r9.granted(p_project,(m->>'user_id')::uuid),'state',case when exists(select 1 from public.project_invitation_requests r where r.project_id=p_project and r.accepted_by=(m->>'user_id')::uuid and r.state='accepted' and r.kind='personal') then 'guest' else m->>'state' end)),'[]') from jsonb_array_elements(result->'members') m));
 return jsonb_set(result,'{members}',result->'members'||extra);
end $function$;

create or replace function eflow_phase6.access(p_project uuid, p_user uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to ''
as $function$
 select exists(select 1 from public.profiles p where p.id=p_user and p.is_active and p.role<>'admin') and exists(
 select 1 from public.project_offices o where o.project_id=p_project and o.invitation_status<>'revoked' and (
  o.contact_user_id=p_user and o.invitation_status in ('awaiting_head','joined')
  or public.phase2_is_office_head(p_user,o.office_id)
  or o.invitation_status='joined' and (
    exists(select 1 from public.project_office_members m join public.profiles p on p.id=m.user_id
      where m.project_office_id=o.id and m.user_id=p_user and p.org_id=o.office_id and p.is_active)
    or (
      o.relationship_type='lead'
      and exists(select 1 from public.profiles p where p.id=p_user and p.org_id=o.office_id and p.is_active and p.role<>'admin')
      and not exists(select 1 from public.project_office_members m where m.project_office_id=o.id and m.user_id=p_user)
    )
  )));
$function$;

commit;
