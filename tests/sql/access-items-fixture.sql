-- Extra domain columns for the actual installed helpers/RPCs under test.
create role service_role;
alter table profiles add column skills jsonb default '{}', add column updated_at timestamptz default now();
alter table organizations add column is_active boolean default true, add column updated_at timestamptz default now();
alter table audit_events add column org_id uuid;
alter table projects add column org_id uuid, add column owner_id uuid, add column created_by uuid, add column source_collaboration_draft_id uuid, add column archived_at timestamptz, add column status text;
alter table tasks add column org_id uuid, add column deleted_at timestamptz, add column status text, add column reviewer_id uuid, add column backup_reviewer_id uuid, add column assigned_to uuid, add column recommendation_lead_id uuid, add column team_member_ids jsonb default '[]', add column created_by uuid, add column linked_project_id uuid, add column source_collaboration_draft_id uuid;
create table project_members(project_id uuid, user_id uuid);
alter table projects enable row level security;
alter table tasks enable row level security;
create policy fixture_project_read on projects for select to authenticated using (true);
create policy fixture_task_read on tasks for select to authenticated using (true);
-- Deliberately permissive existing reads demonstrate that the new restrictive
-- policies still deny ungranted custom Items.
insert into projects(id,title,owner_id,org_id) values ('20000000-0000-0000-0000-000000000001','Scope example','00000000-0000-0000-0000-000000000009','10000000-0000-0000-0000-000000000002');
update organizations set head_user_id = '00000000-0000-0000-0000-000000000004';
insert into organizations(id, name, path) values ('10000000-0000-0000-0000-000000000002', 'Vacant department', 'vacant');
-- No collaboration drafts in this fixture; collaboration behavior stays in its
-- own regression suite. These prevent unresolved references in compiled SQL.
create function can_see_collaboration_project(uuid, uuid) returns boolean language sql as $$ select false $$;
create function can_manage_collaboration_project(uuid, uuid) returns boolean language sql as $$ select false $$;
create function is_collaboration_participant(uuid, uuid) returns boolean language sql as $$ select false $$;
