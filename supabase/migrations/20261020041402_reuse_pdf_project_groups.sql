-- Reuse project-local PDF groups and acknowledge repeated source work without overwriting it.
CREATE OR REPLACE FUNCTION public.import_project_pdf_work(p_project_id uuid, p_request_id uuid, p_review jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare p public.projects; result jsonb; item jsonb; line jsonb; keys text[];seen text[]:='{}';line_keys text[]:='{}';fingerprint text;amount numeric;total numeric:=0;expected numeric;quantity numeric;unit_cost numeric; empty_group uuid; receipt public.project_import_batches; canonical_review jsonb;
 source_group jsonb; source_task jsonb; resolved_groups jsonb:='[]'; mapped_tasks jsonb:='{}'; mapped_groups jsonb:='[]';
 matched_group uuid; matched_task public.tasks; existing_count int:=0; requested_count int:=0; reused_groups int:=0;
 prior_imports_only boolean:=true; source_keys text[]:='{}'; group_names text[]:='{}'; task_names text[]; collision_title text;
 original_hash text;
begin
 select * into p from public.projects where id=p_project_id for update;
 if not found or auth.uid() is null or not public.can_manage_project(p.id,auth.uid()) or not public.can_create_scoped_work(p.org_id,auth.uid()) then
  raise exception 'Only the responsible Office Head can import project work' using errcode='42501';end if;
 -- Reuse the canonical receipt check; a retry never reapplies an old estimate
 -- over a later manual edit. Concurrent calls serialize on the project lock.
 select * into receipt from public.project_import_batches where id=p_request_id;
 if found then
  if receipt.project_id<>p.id or receipt.created_by<>auth.uid() then raise exception 'This import reference belongs to another request' using errcode='22023';end if;
  if receipt.review ? 'pdfOriginalReviewHash' then
   if receipt.review->>'pdfOriginalReviewHash' is distinct from encode(sha256(convert_to(p_review::text,'UTF8')),'hex') then
    raise exception 'This import reference was already used for another review' using errcode='22023';end if;
  elsif receipt.review is distinct from p_review then
   raise exception 'This import reference was already used for another review' using errcode='22023';
  end if;
  if coalesce((receipt.result->>'alreadyImported')::boolean,false) then return receipt.result;end if;
  result:=public.phase65_import_project_work(p_project_id,p_request_id,receipt.review);
  if receipt.review ? 'pdfOriginalReviewHash' then
   return result||jsonb_build_object('reusedGroupCount',(select count(*) from jsonb_array_elements(receipt.review->'groups') as saved_group(value) where nullif(saved_group.value->>'existingGroupId','') is not null));
  end if;
  return result;
 end if;
 if p.status in ('completed','archived') then raise exception 'Closed project structure is read-only' using errcode='22023';end if;
 if p_review ? 'taskBudgets' then
  if jsonb_typeof(p_review->'taskBudgets') is distinct from 'array' or jsonb_array_length(p_review->'taskBudgets')>100
   or jsonb_typeof(p_review->'sourceBudgetTotal') is distinct from 'number' then raise exception 'Invalid source budget' using errcode='22023';end if;
  expected:=(p_review->>'sourceBudgetTotal')::numeric;
  if (expected::text in ('NaN','Infinity','-Infinity') or expected<0 or expected>1000000000000 or expected<>round(expected,2)) then raise exception 'Invalid source budget total' using errcode='22023';end if;
  select array_agg(t->>'key') into keys from jsonb_array_elements(p_review->'groups') g cross join lateral jsonb_array_elements(g->'tasks') t;
  for item in select value from jsonb_array_elements(p_review->'taskBudgets') loop
   if nullif(item->>'key','') is null or not (item->>'key'=any(keys)) or item->>'key'=any(seen)
    or jsonb_typeof(item->'lines') is distinct from 'array' or jsonb_array_length(item->'lines')>500
    or coalesce(item->>'decision','') not in ('funded','missing','no_cost') then raise exception 'Invalid task budget reference' using errcode='22023';end if;
   seen:=array_append(seen,item->>'key');
   if (item->>'decision'='funded') is distinct from (jsonb_array_length(item->'lines')>0) then raise exception 'Funded tasks need source cost lines' using errcode='22023';end if;
   for line in select value from jsonb_array_elements(item->'lines') loop
    if jsonb_typeof(line->'amount') is distinct from 'number' or length(btrim(coalesce(line->>'particular',''))) not between 1 and 2000
     or length(btrim(coalesce(line->>'fundSource',''))) not between 1 and 200 then raise exception 'Invalid source cost line' using errcode='22023';end if;
    if (line ? 'quantity' and jsonb_typeof(line->'quantity') is distinct from 'number') or (line ? 'unitCost' and jsonb_typeof(line->'unitCost') is distinct from 'number') then raise exception 'Invalid source quantity or unit cost' using errcode='22023';end if;
    amount:=(line->>'amount')::numeric;quantity:=coalesce((line->>'quantity')::numeric,1);unit_cost:=coalesce((line->>'unitCost')::numeric,amount);
    if amount<=0 or amount>9999999999 or amount<>round(amount,2) or quantity<=0 or quantity>90071992547409 or quantity<>round(quantity,2) or unit_cost<=0 or unit_cost>9999999999 or unit_cost<>round(unit_cost,2) then raise exception 'Invalid source amount, quantity or unit cost' using errcode='22023';end if;
    if round(coalesce((line->>'quantity')::numeric,1)*coalesce((line->>'unitCost')::numeric,amount),2)<>amount then raise exception 'Source quantity and price do not match the amount' using errcode='22023';end if;
    fingerprint:=jsonb_build_array(line->>'particular',line->>'fundSource',amount)::text;
    if fingerprint=any(line_keys) then raise exception 'A source cost was counted more than once' using errcode='22023';end if;
    line_keys:=array_append(line_keys,fingerprint);total:=total+amount;
   end loop;
  end loop;
  if cardinality(seen) is distinct from cardinality(keys) or total<>expected then raise exception 'Task budgets do not match the source total' using errcode='22023';end if;
 elsif p_review ? 'sourceBudgetTotal' then raise exception 'Source task budgets are missing' using errcode='22023';
 end if;
 -- Match destinations under the project lock, including case/spacing variants.
 -- Do not rename groups or overwrite existing work to make an import fit.
 if p_request_id is null or p_review ? 'pdfOriginalReviewHash' or p_review->>'schemaVersion' is distinct from '1'
  or jsonb_typeof(p_review->'groups') is distinct from 'array' or jsonb_array_length(p_review->'groups') not between 1 and 30
  or jsonb_typeof(p_review->'offices') is distinct from 'array' or jsonb_array_length(p_review->'offices')>100
  or octet_length(p_review::text)>2000000 then raise exception 'Invalid reviewed project import' using errcode='22023';end if;
 for source_group in select value from jsonb_array_elements(p_review->'groups') loop
  if length(btrim(coalesce(source_group->>'title',''))) not between 1 and 120 or jsonb_typeof(source_group->'tasks') is distinct from 'array'
   or jsonb_array_length(source_group->'tasks') not between 1 and 100 then raise exception 'Each group needs a title and tasks' using errcode='22023';end if;
  if eflow_validation.normalized_work_name(source_group->>'title')=any(group_names) then raise exception 'The PDF contains repeated group names. Use a distinct name for each group.' using errcode='22023';end if;
  group_names:=array_append(group_names,eflow_validation.normalized_work_name(source_group->>'title'));
  matched_group:=nullif(source_group->>'existingGroupId','')::uuid;
  if matched_group is null then
   select g.id into matched_group from public.project_groups g where g.project_id=p.id
    and eflow_validation.normalized_work_name(g.title)=eflow_validation.normalized_work_name(source_group->>'title');
  elsif not exists(select 1 from public.project_groups g where g.id=matched_group and g.project_id=p.id) then
   raise exception 'Choose a group in this project' using errcode='22023';
  end if;
  if matched_group is not null then
   source_group:=jsonb_set(source_group,'{existingGroupId}',to_jsonb(matched_group::text));
   mapped_groups:=mapped_groups||to_jsonb(matched_group::text);reused_groups:=reused_groups+1;
  end if;
  task_names:='{}';
  for source_task in select value from jsonb_array_elements(source_group->'tasks') loop
   requested_count:=requested_count+1;
   if length(coalesce(source_task->>'key','')) not between 1 and 80 or source_task->>'key'=any(source_keys)
    or length(btrim(coalesce(source_task->>'title',''))) not between 1 and 300 then raise exception 'PDF tasks need unique references and valid names' using errcode='22023';end if;
   if eflow_validation.normalized_work_name(source_task->>'title')=any(task_names) then raise exception 'The PDF contains repeated task names in one group. No work was added.' using errcode='22023';end if;
   task_names:=array_append(task_names,eflow_validation.normalized_work_name(source_task->>'title'));
   source_keys:=array_append(source_keys,source_task->>'key');
   select * into matched_task from public.tasks t where (t.group_id=matched_group or (t.group_id is null and t.linked_project_id=p.id and exists(select 1 from public.project_groups g where g.id=matched_group and g.is_default))) and t.deleted_at is null
    and eflow_validation.normalized_work_name(t.title)=eflow_validation.normalized_work_name(source_task->>'title');
   if found then
    existing_count:=existing_count+1;collision_title:=matched_task.title;
    mapped_tasks:=mapped_tasks||jsonb_build_object(source_task->>'key',matched_task.id);
    prior_imports_only:=prior_imports_only and exists(select 1 from public.project_import_batches b
     where b.project_id=p.id and b.id::text=matched_task.import_batch_id
      and nullif(b.review->>'sourceName','') is not null and b.review->>'sourceName'=p_review->>'sourceName');
   end if;
  end loop;
  resolved_groups:=resolved_groups||jsonb_build_array(source_group);
 end loop;
 if requested_count>100 then raise exception 'Import up to 100 tasks at once' using errcode='22023';end if;
 if existing_count=requested_count and prior_imports_only and jsonb_array_length(p_review->'offices')=0
  and not coalesce((p_review->>'applyProjectDetails')::boolean,false) then
  -- A fresh upload of work from this PDF is a no-op, with its own durable
  -- receipt. Keep current people, schedules, review state and budget edits.
  result:=jsonb_build_object('taskCount',0,'subitemCount',0,'groupCount',0,'taskIds',mapped_tasks,'groupIds',mapped_groups,
   'alreadyImported',true,'existingTaskCount',existing_count,'reusedGroupCount',reused_groups);
  insert into public.project_import_batches(id,project_id,created_by,review,result) values(p_request_id,p.id,auth.uid(),p_review,result);
 else
  if existing_count>0 then raise exception 'A task named "%" already exists in this project. No work was added. Open the existing task, or use a new project for a separate copy.',collision_title using errcode='22023';end if;
  original_hash:=encode(sha256(convert_to(p_review::text,'UTF8')),'hex');
  canonical_review:=jsonb_set(p_review,'{groups}',resolved_groups)||jsonb_build_object('pdfOriginalReviewHash',original_hash);
  result:=public.phase65_import_project_work(p_project_id,p_request_id,canonical_review);
  result:=result||jsonb_build_object('reusedGroupCount',reused_groups);
 for item in select value from jsonb_array_elements(coalesce(p_review->'taskBudgets','[]')) loop
  select coalesce(sum((value->>'amount')::numeric),0) into amount from jsonb_array_elements(item->'lines');
  perform public.phase3_patch_task((result->'taskIds'->>(item->>'key'))::uuid,jsonb_build_object('budget_impact',amount));
 end loop;
 end if;
 -- Remove only the original, genuinely empty default, after a successful import.
 -- A retry returns the existing receipt above and never runs cleanup again.
 if requested_count>0 then
  for empty_group in select g.id from public.project_groups g
   where g.project_id=p_project_id and g.is_default
    and not exists(select 1 from public.tasks t where t.deleted_at is null
     and (t.group_id=g.id or (t.group_id is null and t.linked_project_id=g.project_id)))
  loop perform public.delete_empty_project_group(empty_group);end loop;
 end if;
 return result;
end $function$;
