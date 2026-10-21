-- Additive project-local PDF import. Existing import and finance APIs are unchanged.
create function public.import_project_pdf_work(p_project_id uuid,p_request_id uuid,p_review jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare p public.projects; result jsonb; item jsonb; line jsonb; keys text[];seen text[]:='{}';line_keys text[]:='{}';fingerprint text;amount numeric;total numeric:=0;expected numeric;
begin
 select * into p from public.projects where id=p_project_id for update;
 if not found or auth.uid() is null or not public.can_manage_project(p.id,auth.uid()) or not public.can_create_scoped_work(p.org_id,auth.uid()) then
  raise exception 'Only the responsible Office Head can import project work' using errcode='42501';end if;
 -- Reuse the canonical receipt check; a retry never reapplies an old estimate
 -- over a later manual edit. Concurrent calls serialize on the project lock.
 if exists(select 1 from public.project_import_batches where id=p_request_id) then
  return public.phase65_import_project_work(p_project_id,p_request_id,p_review);
 end if;
 if p.status in ('completed','archived') then raise exception 'Closed project structure is read-only' using errcode='22023';end if;
 if p_review ? 'taskBudgets' then
  if jsonb_typeof(p_review->'taskBudgets') is distinct from 'array' or jsonb_array_length(p_review->'taskBudgets')>100
   or jsonb_typeof(p_review->'sourceBudgetTotal') is distinct from 'number' then raise exception 'Invalid source budget' using errcode='22023';end if;
  expected:=(p_review->>'sourceBudgetTotal')::numeric;
  if not eflow_validation.valid_decimal(expected,0,1000000000000,2) then raise exception 'Invalid source budget total' using errcode='22023';end if;
  select array_agg(t->>'key') into keys from jsonb_array_elements(p_review->'groups') g cross join lateral jsonb_array_elements(g->'tasks') t;
  for item in select value from jsonb_array_elements(p_review->'taskBudgets') loop
   if nullif(item->>'key','') is null or not (item->>'key'=any(keys)) or item->>'key'=any(seen)
    or jsonb_typeof(item->'lines') is distinct from 'array' or jsonb_array_length(item->'lines')>500
    or coalesce(item->>'decision','') not in ('funded','missing','no_cost') then raise exception 'Invalid task budget reference' using errcode='22023';end if;
   seen:=array_append(seen,item->>'key');
   if (item->>'decision'='funded') is distinct from (jsonb_array_length(item->'lines')>0) then raise exception 'Funded tasks need source cost lines' using errcode='22023';end if;
   perform eflow_validation.assert_budget_lines(item->'lines');
   for line in select value from jsonb_array_elements(item->'lines') loop
    if jsonb_typeof(line->'amount') is distinct from 'number' or length(btrim(coalesce(line->>'particular',''))) not between 1 and 2000
     or length(btrim(coalesce(line->>'fundSource',''))) not between 1 and 200 then raise exception 'Invalid source cost line' using errcode='22023';end if;
    amount:=(line->>'amount')::numeric;
    if round(coalesce((line->>'quantity')::numeric,1)*coalesce((line->>'unitCost')::numeric,amount),2)<>amount then raise exception 'Source quantity and price do not match the amount' using errcode='22023';end if;
    fingerprint:=jsonb_build_array(line->>'particular',line->>'fundSource',amount)::text;
    if fingerprint=any(line_keys) then raise exception 'A source cost was counted more than once' using errcode='22023';end if;
    line_keys:=array_append(line_keys,fingerprint);total:=total+amount;
   end loop;
  end loop;
  if cardinality(seen) is distinct from cardinality(keys) or total<>expected then raise exception 'Task budgets do not match the source total' using errcode='22023';end if;
 elsif p_review ? 'sourceBudgetTotal' then raise exception 'Source task budgets are missing' using errcode='22023';
 end if;
 result:=public.phase65_import_project_work(p_project_id,p_request_id,p_review);
 for item in select value from jsonb_array_elements(coalesce(p_review->'taskBudgets','[]')) loop
  select coalesce(sum((value->>'amount')::numeric),0) into amount from jsonb_array_elements(item->'lines');
  perform public.phase3_patch_task((result->'taskIds'->>(item->>'key'))::uuid,jsonb_build_object('budget_impact',amount));
 end loop;
 return result;
end $$;
revoke all on function public.import_project_pdf_work(uuid,uuid,jsonb) from public,anon;
grant execute on function public.import_project_pdf_work(uuid,uuid,jsonb) to authenticated;
