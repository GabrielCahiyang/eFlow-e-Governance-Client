-- The public portal subscribes to project_seal_certificates so a newly
-- confirmed Amoy seal appears without a manual refresh. The table is already
-- world-readable (seal_public_read), so publishing its changes exposes nothing new.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'project_seal_certificates'
     ) then
    alter publication supabase_realtime add table public.project_seal_certificates;
  end if;
end $$;
