-- NW2.2: supported Office own-node Lead execution. Keep installed R7/R9
-- overlays, private evidence seals, reviewer policy and legacy branches intact.
begin;
set local lock_timeout = '10s';

-- Rewrite only reviewed assignment expressions in effective definitions.
-- CREATE OR REPLACE retains signatures, defaults, search paths and ACLs.
-- Fail setup if an anchor is absent/ambiguous; never guess a replacement body.
do $$
declare sig text; before_text text; after_text text; definition text;
begin
 for sig,before_text,after_text in select * from (values
  ('eflow_r7.node_work(uuid,uuid)',
   $before$p_user=any(coalesce(n.assigned_to_ids,'{}'::uuid[]))$before$,
   $after$(p_user=any(coalesce(n.assigned_to_ids,'{}'::uuid[]))
    or n.kind='office' and r->>'kind'='office' and n.lead_id=p_user
     and eflow_r7.chain(n.task_id,n.id))$after$),
  ('public.save_subtask_progress(uuid,integer,text,text,text,text,text,text)',
   $before$subtask_row.assigned_to = caller
    or caller = any(coalesce(subtask_row.assigned_to_ids, '{}'::uuid[]))$before$,
   $after$case when eflow_r7.root(subtask_row.task_id)->>'kind'='office' then
    coalesce(eflow_r7.node_work(p_subtask_id,caller),false)
   else subtask_row.assigned_to = caller
    or caller = any(coalesce(subtask_row.assigned_to_ids, '{}'::uuid[])) end$after$),
  ('public.submit_subtask_for_review(uuid,jsonb)',
   $before$subtask_row.assigned_to = caller
    or caller = any(coalesce(subtask_row.assigned_to_ids, '{}'::uuid[]))$before$,
   $after$case when eflow_r7.root(subtask_row.task_id)->>'kind'='office' then
    coalesce(eflow_r7.node_work(p_subtask_id,caller),false)
   else subtask_row.assigned_to = caller
    or caller = any(coalesce(subtask_row.assigned_to_ids, '{}'::uuid[])) end$after$),
  ('public.guard_subtask_contributor_update()',
   $before$old.assigned_to = caller
    or caller = any(coalesce(old.assigned_to_ids, '{}'::uuid[]))$before$,
   $after$case when eflow_r7.root(old.task_id)->>'kind'='office' then
    coalesce(eflow_r7.node_work(old.id,caller),false)
   else old.assigned_to = caller
    or caller = any(coalesce(old.assigned_to_ids, '{}'::uuid[])) end$after$),
  ('eflow_evidence.can_upload(text)',
   $before$(coalesce(s.assigned_to = auth.uid(), false)
      or coalesce(to_jsonb(s.assigned_to_ids), '[]'::jsonb) ? auth.uid()::text)$before$,
   $after$(case when eflow_r7.root(s.task_id)->>'kind'='office' then
      coalesce(eflow_r7.node_work(s.id,auth.uid()),false)
     else coalesce(s.assigned_to = auth.uid(), false)
      or coalesce(to_jsonb(s.assigned_to_ids), '[]'::jsonb) ? auth.uid()::text end)$after$),
  ('eflow_evidence.guard_attempt()',
   $before$coalesce(s.assigned_to = auth.uid(), false) or coalesce(to_jsonb(s.assigned_to_ids), '[]'::jsonb) ? auth.uid()::text$before$,
   $after$case when eflow_r7.root(s.task_id)->>'kind'='office' then
      coalesce(eflow_r7.node_work(s.id,auth.uid()),false)
     else coalesce(s.assigned_to = auth.uid(), false) or coalesce(to_jsonb(s.assigned_to_ids), '[]'::jsonb) ? auth.uid()::text end$after$),
  ('eflow_evidence.guard_progress()',
   $before$coalesce(s.assigned_to = auth.uid(), false) or coalesce(to_jsonb(s.assigned_to_ids), '[]'::jsonb) ? auth.uid()::text$before$,
   $after$case when eflow_r7.root(s.task_id)->>'kind'='office' then
      coalesce(eflow_r7.node_work(s.id,auth.uid()),false)
     else coalesce(s.assigned_to = auth.uid(), false) or coalesce(to_jsonb(s.assigned_to_ids), '[]'::jsonb) ? auth.uid()::text end$after$)
 ) as changes(signature,assignment_before,assignment_after)
 loop
  if to_regprocedure(sig) is null then raise exception 'NW2.2 prerequisite function missing: %',sig; end if;
  definition := replace(pg_get_functiondef(sig::regprocedure),chr(13),'');
  before_text := replace(before_text,chr(13),'');
  after_text := replace(after_text,chr(13),'');
  if (length(definition)-length(replace(definition,before_text,'')))/length(before_text)<>1 then
   raise exception 'NW2.2 assignment anchor changed: %; inspect effective baseline',sig;
  end if;
  execute replace(definition,before_text,after_text);
 end loop;
end $$;

commit;
