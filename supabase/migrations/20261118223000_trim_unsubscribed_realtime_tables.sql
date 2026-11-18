-- Remove tables from supabase_realtime that have no Realtime postgres_changes
-- subscribers across EflowWeb, EflowMobile, or EflowPublic. All 50 remaining
-- published tables have active feature listeners in one or more of the apps.
do $$
declare
  tbl text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach tbl in array array['project_members', 'proposal_collaboration_commit_projects']
    loop
      if exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = tbl
      ) then
        execute format('alter publication supabase_realtime drop table public.%I', tbl);
      end if;
    end loop;
  end if;
end $$;
