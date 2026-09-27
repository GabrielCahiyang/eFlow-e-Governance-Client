-- Allow projects to be deleted cleanly even when committed from a collaboration proposal draft.
-- Updates proposal_collaboration_commit_projects.project_id from ON DELETE RESTRICT to ON DELETE CASCADE.

alter table public.proposal_collaboration_commit_projects
  drop constraint if exists proposal_collaboration_commit_projects_project_id_fkey,
  add constraint proposal_collaboration_commit_projects_project_id_fkey
    foreign key (project_id)
    references public.projects(id)
    on delete cascade;
