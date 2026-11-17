-- REVIEW ONLY. NOT APPLIED. Stage and obtain explicit production approval first.
-- No data, function signatures, owners, ACLs or historical receipts are changed.
begin;
set local lock_timeout = '10s';
do $review$
declare dependency record; patch record; definition text;
begin
 -- Verify every baseline before replacing any function. Any mismatch rolls back.
 for dependency in select * from (values
  ('eflow_publication.guard_active_subtask_staffing()','38461f2eb5715bfc0306abf620811655'),
  ('eflow_r7.operation_capabilities(uuid,uuid)','6bcf672b11eddc52970d0b005a29eb56'),
  ('eflow_r7.command(uuid,integer,uuid,text,jsonb)','de5545a802178c113db8493bb23297d3'),
  ('eflow_publication.root_contributor_change_locked(uuid)','4b459c336ff5dd3e660984b532644085'),
  ('eflow_publication.guard_active_root_contributor_change()','225b5048d84ada91a6d5678cd2e88a3c')
 ) as reviewed(signature,hash) loop
  if to_regprocedure(dependency.signature) is null
   or md5(pg_get_functiondef(to_regprocedure(dependency.signature))) <> dependency.hash then
   raise exception 'Installed staffing function differs: %. Stop for review.', dependency.signature;
  end if;
 end loop;
 for dependency in select * from (values
  ('eflow_publication.guard_active_subtask_staffing()','38461f2eb5715bfc0306abf620811655'),
  ('eflow_r7.operation_capabilities(uuid,uuid)','6bcf672b11eddc52970d0b005a29eb56'),
  ('eflow_r7.command(uuid,integer,uuid,text,jsonb)','de5545a802178c113db8493bb23297d3'),
  ('eflow_publication.root_contributor_change_locked(uuid)','4b459c336ff5dd3e660984b532644085'),
  ('eflow_publication.guard_active_root_contributor_change()','225b5048d84ada91a6d5678cd2e88a3c')
 ) as reviewed(signature,hash) loop
  -- Normalize body newlines after the original-byte hash check for SQL Editor pasting.
  definition:=replace(pg_get_functiondef(to_regprocedure(dependency.signature)),chr(13)||chr(10),chr(10));
  for patch in select * from (values
  ('eflow_publication.guard_active_subtask_staffing()','declare project_status text; project_lead uuid;
','declare project_status text; project_lead uuid; task_lead uuid;
'),
  ('eflow_publication.guard_active_subtask_staffing()',' select p.status,p.project_lead_id into project_status,project_lead
',' select p.status,p.project_lead_id,coalesce(t.assigned_to,t.recommendation_lead_id) into project_status,project_lead,task_lead
'),
  ('eflow_publication.guard_active_subtask_staffing()',' if project_status=''active'' and project_lead=auth.uid() then
',' if project_status=''active'' and project_lead=auth.uid() and task_lead is distinct from auth.uid() then
  if tg_op=''UPDATE'' then
   if coalesce(old.lead_id,old.assigned_to)=auth.uid()
    and row(new.task_id,new.lead_id,new.assigned_to) is not distinct from row(old.task_id,old.lead_id,old.assigned_to)
   then return new;end if;
  end if;
'),
  ('eflow_r7.operation_capabilities(uuid,uuid)','     and eflow_publication.subtask_staffing_locked(p_root) then reason:=''active_subtask_staffing_locked'';
','     and eflow_publication.subtask_staffing_locked(p_root)
     and (r->>''lead'')::uuid is distinct from auth.uid()
     and (action=''appoint_lead'' or n.lead_id is distinct from auth.uid()) then reason:=''active_subtask_staffing_locked'';
'),
  ('eflow_r7.command(uuid,integer,uuid,text,jsonb)',' if p_command=''contributors'' and coalesce(eflow_publication.root_contributor_change_locked(p_root),false) then raise exception ''Root task contributors are read-only for the Task Lead after the project becomes active'' using errcode=''42501'';end if; if not coalesce((r->>''open'')::boolean,false) then raise exception ''Closed or unresolved work is read-only'' using errcode=''42501'';end if;
',' if p_command=''contributors'' and coalesce(eflow_publication.root_contributor_change_locked(p_root),false) then raise exception ''Only the Task Lead, Project Lead or responsible Office Head can change Task contributors'' using errcode=''42501'';end if; if not coalesce((r->>''open'')::boolean,false) then raise exception ''Closed or unresolved work is read-only'' using errcode=''42501'';end if;
'),
  ('eflow_publication.root_contributor_change_locked(uuid)','  and coalesce(t.assigned_to,t.recommendation_lead_id)=auth.uid()
','  and coalesce(t.assigned_to,t.recommendation_lead_id) is distinct from auth.uid()
'),
  ('eflow_publication.guard_active_root_contributor_change()','  and coalesce(old.assigned_to,old.recommendation_lead_id)=auth.uid()
','  and coalesce(old.assigned_to,old.recommendation_lead_id) is distinct from auth.uid()
'),
  ('eflow_publication.guard_active_root_contributor_change()','  raise exception ''Root task contributors are read-only for the Task Lead after the project becomes active''
','  raise exception ''Only the Task Lead, Project Lead or responsible Office Head can change Task contributors''
')
  ) as edits(signature,anchor,replacement) where signature=dependency.signature loop
   -- SQL Editor/file copies may use CRLF inside these string literals too.
   patch.anchor:=replace(patch.anchor,chr(13)||chr(10),chr(10));
   patch.replacement:=replace(patch.replacement,chr(13)||chr(10),chr(10));
   if length(definition)-length(replace(definition,patch.anchor,'')) <> length(patch.anchor) then
    raise exception 'Staffing patch anchor differs: %. Stop for review.',dependency.signature;
   end if;
   definition:=replace(definition,patch.anchor,patch.replacement);
  end loop;
  execute definition;
 end loop;
end $review$;
commit;
