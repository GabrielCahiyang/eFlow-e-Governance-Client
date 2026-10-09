begin;
set local lock_timeout = '10s';

-- Preserve installed publication migrations, columns, receipts and actors.
-- Manual Office creation follows the refinement workflow immediately; its
-- existing activation/governance checks remain the authority for delivery.
do $$ declare definition text; begin
  select pg_get_functiondef('eflow_publication.baseline_readiness(uuid)'::regprocedure) into definition;
  execute replace(definition, 'FUNCTION eflow_publication.baseline_readiness(', 'FUNCTION eflow_phase7.readiness(');
end $$;

create or replace function eflow_publication.guard_project()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.publication_state := 'published';
    if new.source_collaboration_draft_id is null then
      -- No Head-publication event occurred. Do not fabricate its provenance.
      new.published_at := null;
      new.published_by := null;
    else
      -- Governed proposal commitment retains its existing owning-Head boundary.
      if not public.phase2_is_office_head(auth.uid(), new.org_id) then
        raise exception 'Only the owning Office Head can publish' using errcode = '42501';
      end if;
      new.published_at := now();
      new.published_by := auth.uid();
    end if;
    return new;
  end if;
  if row(new.published_at, new.published_by) is distinct from row(old.published_at, old.published_by) then
    raise exception 'Publication history cannot be edited' using errcode = '42501';
  end if;
  -- Legacy publication metadata does not introduce a second project lifecycle.
  new.publication_state := 'published';
  return new;
end $$;
revoke all on function eflow_publication.guard_project() from public, anon, authenticated;

alter table public.projects alter column publication_state set default 'published';
-- Existing drafts become ordinary planning projects, retaining status, work,
-- timestamps, provenance, evidence and every accepted publication audit record.
do $$ declare touch_mode "char"; begin
  select tgenabled into touch_mode from pg_trigger
    where tgrelid = 'public.projects'::regclass and tgname = 'projects_touch';
  if touch_mode is not null then
    alter table public.projects disable trigger projects_touch;
  end if;
  update public.projects set publication_state = 'published' where publication_state = 'draft';
  if touch_mode = 'O' then alter table public.projects enable trigger projects_touch;
  elsif touch_mode = 'A' then alter table public.projects enable always trigger projects_touch;
  elsif touch_mode = 'R' then alter table public.projects enable replica trigger projects_touch;
  end if;
end $$;
notify pgrst, 'reload schema';
commit;
