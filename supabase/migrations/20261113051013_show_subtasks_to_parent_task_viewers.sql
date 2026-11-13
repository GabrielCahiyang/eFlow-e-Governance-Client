begin;

-- Subtasks inherit read access from the parent Task in both workspaces.
-- CREATE OR REPLACE keeps the grants and references used by existing policies.
create or replace function eflow_m7.node_visible(p_root uuid,p_node uuid,p_actor uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select public.can_see_task(p_root,p_actor) and exists(
  select 1 from public.subtasks s where s.task_id=p_root and s.id=p_node
 );
$$;

create or replace function eflow_m7.personal_node_visible(p_root uuid,p_node uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select eflow_r7.read_root(p_root) and exists(
  select 1 from public.personal_subtasks s where s.task_id=p_root and s.id=p_node
 );
$$;

do $migration$
begin
 -- A readable row must not advertise execution before it activates. Add the
 -- check independently of the existing appointment, dependency and hold gates.
 perform eflow_m7.replace_body_part(
  'eflow_r7.operation_capabilities(uuid,uuid)',
  '/* NW5.1 history capability */',
  $body$if reason is null and p_node is not null and action in ('execute','submit') and
   not (case when r->>'kind'='office' then eflow_m7.node_activated(p_root,p_node)
             else eflow_m7.personal_node_activated(p_root,p_node) end)
  then reason := 'lifecycle_blocked'; end if;

  /* NW5.1 history capability */$body$);
end $migration$;

notify pgrst, 'reload schema';
commit;
