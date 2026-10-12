-- NW4.1: change only the starting point of supported Office subitem review.
-- Existing chain/member/Head checks, personal routing and legacy fallback stay
-- authoritative. No pending or historical submission/evidence rows are updated.
begin;
do $$
declare
 definition text;
 anchor constant text := 'r:=eflow_r7.root(n.task_id);v_id:=n.parent_subtask_id;';
 replacement constant text := 'r:=eflow_r7.root(n.task_id);v_id:=case when r->>''kind''=''office'' and not exists(select 1 from public.tasks t where t.id=n.task_id and t.proposed_office_identity_id is not null) then n.id else n.parent_subtask_id end;';
begin
 select pg_get_functiondef('eflow_r7.reviewer(uuid,uuid)'::regprocedure) into definition;
 if strpos(definition,anchor)=0 and (length(definition)-length(replace(definition,replacement,'')))/length(replacement)=1 then
  return; -- Exact correction already installed; preserve its definition/ACL.
 end if;
 if (length(definition)-length(replace(definition,anchor,'')))/length(anchor) <> 1 then
  raise exception 'NW4.1 reviewer prerequisite changed; review effective definition';
 end if;
 definition:=replace(definition,anchor,replacement);
 execute definition;
end $$;
notify pgrst, 'reload schema';
commit;
