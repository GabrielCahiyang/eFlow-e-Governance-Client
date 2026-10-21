-- Source drafts follow their owning account; office joins use project-key lookups.
begin;
alter table public.project_pdf_import_sessions drop constraint project_pdf_import_sessions_actor_id_fkey;
alter table public.project_pdf_import_sessions add constraint project_pdf_import_sessions_actor_id_fkey foreign key(actor_id) references public.profiles(id) on delete cascade;
create index if not exists project_office_work_project_idx on public.project_office_work(project_id);
create index if not exists project_office_people_project_idx on public.project_office_people(project_id);
commit;
