begin;
set local lock_timeout='10s';
-- Publication records retain the actor UUID even if that profile is removed.
-- SET NULL would both erase provenance and hit the immutable-history guard.
-- Account deletion remains governed by its existing foreign keys and rules.
alter table public.projects drop constraint projects_published_by_fkey;
commit;
