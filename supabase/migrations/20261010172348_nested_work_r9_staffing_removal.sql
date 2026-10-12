begin;

-- NW5.1: exact UPDATE permissions, created only by the private confirmed R9
-- removal path after current authority/fingerprint validation under its locks.
-- Neither a client-set GUC nor R9's older generic mutation marker grants this.
create table if not exists eflow_r9.staffing_removals (
 tx xid8 not null, actor uuid not null, project_id uuid not null,
 office_id uuid, removed_user uuid not null, request_id uuid not null, fingerprint text not null,
 relation_name text not null, row_id uuid not null,
 before_row jsonb not null, after_row jsonb not null,
 primary key(tx,relation_name,row_id)
);
alter table eflow_r9.staffing_removals enable row level security;
revoke all on eflow_r9.staffing_removals from public,anon,authenticated,service_role;

create or replace function eflow_r9.staffing_removal_allowed(p_table text,p_old jsonb,p_new jsonb)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from eflow_r9.staffing_removals m
  where m.tx=pg_catalog.pg_current_xact_id() and m.actor=auth.uid()
   and m.relation_name=p_table and m.row_id=(p_old->>'id')::uuid
   and eflow_r9.person_head(m.project_id,m.office_id)
   and m.before_row=p_old-'updated_at' and m.after_row=p_new-'updated_at')
$$;

create or replace function eflow_r9.guard_staffing_removal()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from eflow_r9.staffing_removals where tx=pg_catalog.pg_current_xact_id()) then
  if tg_op<>'UPDATE' then
   raise exception 'Confirmed member removal permits only its exact current staffing cleanup' using errcode='42501';
  end if;
  if not eflow_r9.staffing_removal_allowed(tg_table_name,to_jsonb(old),to_jsonb(new)) then
   raise exception 'Confirmed member removal cannot change work facts or unrelated staffing' using errcode='42501';
  end if;
 end if;
 if tg_op='DELETE' then return old;end if;return new;
end $$;

create or replace function eflow_r9.lock_removal_work(p_project uuid,p_office uuid)
returns void language plpgsql security definer set search_path='' as $$
declare r record;
begin
 -- Caller already holds the original R9 project advisory lock. Acquire root
 -- completion serialization before root/item rows, as NW4.2 approval does.
 perform 1 from public.projects where id=p_project for update;
 perform 1 from public.personal_projects where id=p_project for update;
 for r in select id from public.tasks where linked_project_id=p_project and org_id=p_office
  union all select id from public.personal_tasks where project_id=p_project order by id loop
  perform eflow_r7.lock_completion(r.id);
  perform 1 from public.tasks where id=r.id for update;
  perform 1 from public.personal_tasks where id=r.id for update;
 end loop;
 perform 1 from public.subtasks n join public.tasks t on t.id=n.task_id
  where t.linked_project_id=p_project and t.org_id=p_office order by n.id for update of n;
 perform 1 from public.personal_subtasks n join public.personal_tasks t on t.id=n.task_id
  where t.project_id=p_project order by n.id for update of n;
 perform 1 from public.project_office_members m join public.project_offices o on o.id=m.project_office_id
  where o.project_id=p_project and o.office_id=p_office order by m.user_id for update of m;
 perform 1 from public.personal_project_members where project_id=p_project order by user_id for update;
end $$;

create or replace function eflow_r9.clear_removed_staff(p_project uuid,p_user uuid,p_office uuid,p_request uuid,p_fingerprint text)
returns void language plpgsql security definer set search_path='' as $$
declare v jsonb; roots uuid[];v_nodes uuid[];clear_leads uuid[];r record;a jsonb;b jsonb;
begin
 perform eflow_r3.actor();
 if p_request is null or not eflow_r9.person_head(p_project,p_office) then
  raise exception 'Current confirmed removal authority required' using errcode='42501';end if;
 v:=eflow_r9.preview(p_project,p_user,p_office);
 if v->>'fingerprint' is distinct from p_fingerprint then
  raise exception 'Membership or assignments changed. Refresh the impact preview before confirming.' using errcode='40001';end if;
 v:=v-'fingerprint';
 select coalesce(array_agg((x->>'id')::uuid),'{}') into roots from jsonb_array_elements(v->'tasks') x
  where coalesce((x->>'lead')::uuid,(x->>'recommendation_lead')::uuid)=p_user;
 select coalesce(array_agg((x->>'id')::uuid),'{}') into v_nodes from jsonb_array_elements(v->'nodes') x;
 select coalesce(array_agg(id),'{}') into clear_leads from eflow_r7.nodes
  where id=any(v_nodes) and (lead_id=p_user or task_id=any(roots) or id in
   (with recursive below as (select id from eflow_r7.nodes where lead_id=p_user
    union select c.id from eflow_r7.nodes c join below b on c.parent_subtask_id=b.id) select id from below));
 -- Copy every work fact unchanged. Only the exact R9 staffing deltas are
 -- projected. Stored reviewer IDs/names/decisions are deliberately untouched.
 for r in select * from (
  select 'subtasks' relation_name,to_jsonb(n) j from public.subtasks n where id=any(v_nodes)
  union all select 'personal_subtasks',to_jsonb(n) from public.personal_subtasks n where id=any(v_nodes)
  union all select 'tasks',to_jsonb(t) from public.tasks t where linked_project_id=p_project and org_id=p_office
   and id in(select (x->>'id')::uuid from jsonb_array_elements(v->'tasks') x)
  union all select 'personal_tasks',to_jsonb(t) from public.personal_tasks t where project_id=p_project
   and id in(select (x->>'id')::uuid from jsonb_array_elements(v->'tasks') x)
  ) affected order by relation_name,j->>'id'
 loop
  a:=r.j-'updated_at';b:=a;
  if r.relation_name in ('subtasks','personal_subtasks') then
   b:=b||jsonb_build_object('assigned_to_ids',array_remove(array(select x::uuid from jsonb_array_elements_text(a->'assigned_to_ids') x),p_user),
    'lead_id',case when (a->>'id')::uuid=any(clear_leads) then null else (a->>'lead_id')::uuid end);
   if r.relation_name='subtasks' and (a->>'assigned_to')::uuid=p_user then b:=b||jsonb_build_object('assigned_to',null);end if;
  elsif r.relation_name='tasks' then
   b:=b||jsonb_build_object('assigned_to',case when (a->>'id')::uuid=any(roots) then null else (a->>'assigned_to')::uuid end,
    'recommendation_lead_id',case when (a->>'id')::uuid=any(roots) or (a->>'recommendation_lead_id')::uuid=p_user then null else (a->>'recommendation_lead_id')::uuid end,
    'assignee_name',case when (a->>'id')::uuid=any(roots) then '' else a->>'assignee_name' end);
   if a->'team_member_ids' @> jsonb_build_array(p_user) then
    b:=b||jsonb_build_object('team_member_ids',array(select x::uuid from jsonb_array_elements_text(a->'team_member_ids') x where x::uuid<>p_user),
     'team_member_names',array(select a->'team_member_names'->>(pos::int-1) from jsonb_array_elements_text(a->'team_member_ids') with ordinality x(uid,pos) where uid::uuid<>p_user order by pos));
   end if;
  else
   b:=b||jsonb_build_object('lead_id',case when (a->>'lead_id')::uuid=p_user then null else (a->>'lead_id')::uuid end);
   if b<>a then b:=b||jsonb_build_object('revision',(a->>'revision')::integer+1);end if;
  end if;
  if b<>a then insert into eflow_r9.staffing_removals values(pg_catalog.pg_current_xact_id(),auth.uid(),p_project,p_office,p_user,p_request,p_fingerprint,r.relation_name,(a->>'id')::uuid,a,b);end if;
 end loop;
 insert into eflow_r9.mutations values(txid_current(),p_project);
 for r in select * from eflow_r9.staffing_removals where tx=pg_catalog.pg_current_xact_id() order by relation_name,row_id loop
  if r.relation_name='subtasks' then
   update public.subtasks set assigned_to=(r.after_row->>'assigned_to')::uuid,
    assigned_to_ids=array(select x::uuid from jsonb_array_elements_text(r.after_row->'assigned_to_ids') x),lead_id=(r.after_row->>'lead_id')::uuid where id=r.row_id;
  elsif r.relation_name='personal_subtasks' then
   update public.personal_subtasks set assigned_to_ids=array(select x::uuid from jsonb_array_elements_text(r.after_row->'assigned_to_ids') x),lead_id=(r.after_row->>'lead_id')::uuid where id=r.row_id;
  elsif r.relation_name='tasks' then
   update public.tasks set assigned_to=(r.after_row->>'assigned_to')::uuid,recommendation_lead_id=(r.after_row->>'recommendation_lead_id')::uuid,
    assignee_name=r.after_row->>'assignee_name',team_member_ids=array(select x::uuid from jsonb_array_elements_text(r.after_row->'team_member_ids') x),
    team_member_names=array(select x from jsonb_array_elements_text(r.after_row->'team_member_names') x) where id=r.row_id;
  else
   update public.personal_tasks set lead_id=(r.after_row->>'lead_id')::uuid,revision=(r.after_row->>'revision')::integer where id=r.row_id;
  end if;
 end loop;
 -- Verify the persisted rows too, including any trigger effects. An unexpected
 -- side effect rolls back the entire removal, membership, audit and receipt.
 for r in select * from eflow_r9.staffing_removals where tx=pg_catalog.pg_current_xact_id() loop
  execute format('select to_jsonb(t)-''updated_at'' from public.%I t where id=$1',r.relation_name) into b using r.row_id;
  if b is distinct from r.after_row then raise exception 'Member removal changed protected work facts' using errcode='42501',
   detail=r.relation_name||': '||(select string_agg(k,', ' order by k) from jsonb_object_keys(r.after_row) k where r.after_row->k is distinct from b->k);end if;
 end loop;
 delete from eflow_r9.staffing_removals where tx=pg_catalog.pg_current_xact_id();
 delete from eflow_r9.mutations where tx=txid_current() and project_id=p_project;
 insert into eflow_r7.tree_state(root_id,revision) select id,2 from public.tasks where linked_project_id=p_project and org_id=p_office
  union all select id,2 from public.personal_tasks where project_id=p_project on conflict(root_id) do update set revision=eflow_r7.tree_state.revision+1;
 insert into eflow_r9.events(project_id,actor,action,details) values(p_project,auth.uid(),'assignments_cleared',v);
end $$;

revoke all on function eflow_r9.staffing_removal_allowed(text,jsonb,jsonb),eflow_r9.guard_staffing_removal(),eflow_r9.lock_removal_work(uuid,uuid),eflow_r9.clear_removed_staff(uuid,uuid,uuid,uuid,text) from public,anon,authenticated,service_role;

do $$declare d text;n text;begin
 select pg_get_functiondef('eflow_r9.remove_person(uuid,uuid,uuid,text,uuid)'::regprocedure) into d;
 if strpos(d,'/* NW5.1 confirmed staffing */')=0 then
  if strpos(d,'v:=eflow_r9.preview(p_project,p_user,p_office);')=0 or strpos(d,'perform eflow_r9.clear_staff(p_project,p_user,p_office);')=0 then raise exception 'Unexpected R9 removal definition';end if;
  d:=replace(d,'v:=eflow_r9.preview(p_project,p_user,p_office);','/* NW5.1 confirmed staffing */ perform eflow_r9.lock_removal_work(p_project,p_office); v:=eflow_r9.preview(p_project,p_user,p_office);');
  d:=replace(d,'perform eflow_r9.clear_staff(p_project,p_user,p_office);','perform eflow_r9.clear_removed_staff(p_project,p_user,p_office,p_request,p_fingerprint);');execute d;
 end if;
 select pg_get_functiondef('public.guard_subtask_mutation()'::regprocedure) into d;
 if strpos(d,'/* NW5.1 exact R9 UPDATE */')=0 then
  d:=overlay(d placing 'begin /* NW5.1 exact R9 UPDATE */ if tg_op=''UPDATE'' and eflow_r9.staffing_removal_allowed(tg_table_name,to_jsonb(old),to_jsonb(new)) then return new;end if;' from strpos(lower(d),'begin') for 5);execute d;
 end if;
 -- These existing INVOKER triggers otherwise reroute/revalidate historical
 -- reviewer metadata merely because a current staffing column is updated.
 -- Keep their normal routing/validation bodies and invoker security unchanged.
 -- API roles cannot execute the predicate; nested IF avoids calling it at all
 -- in their direct writes. Other definer RPCs have no exact removal capability.
 foreach n in array array['public.route_organization_leadership_review()','public.validate_task_reviewers()'] loop
  select pg_get_functiondef(n::regprocedure) into d;
  if strpos(d,'/* NW5.1 preserve historical reviewers */')=0 then
   d:=overlay(d placing 'begin /* NW5.1 preserve historical reviewers */ if tg_op=''UPDATE'' then if pg_catalog.has_function_privilege(current_user,''eflow_r9.staffing_removal_allowed(text,jsonb,jsonb)'',''EXECUTE'') then if eflow_r9.staffing_removal_allowed(tg_table_name,to_jsonb(old),to_jsonb(new)) then return new;end if;end if;end if;' from strpos(lower(d),'begin') for 5);execute d;
  end if;
 end loop;
 -- The existing AFTER staffing hook normally rebuilds channel membership.
 -- In a removal it must clear only the departing person's derived current
 -- task access, retaining other participants and all chat/activity history.
 select pg_get_functiondef('public.sync_task_chat_channel()'::regprocedure) into d;
 if strpos(d,'/* NW5.1 current chat access only */')=0 then
  d:=overlay(d placing 'begin /* NW5.1 current chat access only */ if tg_op=''UPDATE'' and eflow_r9.staffing_removal_allowed(tg_table_name,to_jsonb(old),to_jsonb(new)) then delete from public.chat_channel_members c using public.chat_channels h,eflow_r9.staffing_removals m where c.channel_id=h.id and h.task_id=new.id and m.tx=pg_catalog.pg_current_xact_id() and m.relation_name=tg_table_name and m.row_id=new.id and c.user_id=m.removed_user;return new;end if;' from strpos(lower(d),'begin') for 5);execute d;
 end if;
 foreach n in array array['tasks','subtasks','personal_tasks','personal_subtasks'] loop
  execute format('drop trigger if exists a0_nw51_staffing_boundary on public.%I',n);
  execute format('create trigger a0_nw51_staffing_boundary before insert or update or delete on public.%I for each row execute function eflow_r9.guard_staffing_removal()',n);
 end loop;
end $$;
commit;
