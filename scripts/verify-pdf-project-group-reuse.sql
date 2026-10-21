-- Run on the hosted target with a SQL operator. Everything, including receipts,
-- is rolled back. Mutations run under authenticated RLS with a real Head identity.
begin;
do $$
declare h public.profiles; p uuid:=gen_random_uuid();p2 uuid:=gen_random_uuid();g uuid;root uuid;
 batch uuid:=gen_random_uuid();repeat_batch uuid:=gen_random_uuid();r jsonb;repeat_result jsonb;bad jsonb;blocked boolean;
 review jsonb:='{"schemaVersion":1,"sourceName":"rollback-source.pdf","offices":[],"applyProjectDetails":false,"groups":[{"key":"g","title":"Planning Work","existingGroupId":"","color":"#00838f","tasks":[{"key":"task-1","title":"Kick Off Meeting","description":"Facilitated discussion","priority":"medium","estimatedHours":4,"officeKey":"","dependencies":[],"subitems":[],"sourceQuote":"Kick Off Meeting"}]}],"sourceBudgetTotal":100,"taskBudgets":[{"key":"task-1","decision":"funded","lines":[{"particular":"Meeting materials","fundSource":"LEDIPO","quantity":1,"unitCost":100,"amount":100}]}]}';
begin
 select * into h from public.profiles p where p.is_active and p.role='head' and public.phase2_is_office_head(p.id,p.org_id) order by p.id limit 1;
 if h.id is null then raise exception 'No appointed Head for test';end if;
 perform set_config('request.jwt.claim.sub',h.id::text,true);
 execute 'set local role authenticated';
 insert into public.projects(id,title,org_id,owner_id,created_by) values(p,'Rollback PDF group reuse',h.org_id,h.id,h.id),(p2,'Rollback PDF scope',h.org_id,h.id,h.id);
 insert into public.project_groups(project_id,title,color,position) values(p,'  PLANNING   WORK  ','#00838f',1) returning id into g;
 r:=public.import_project_pdf_work(p,batch,review);
 root:=(r->'taskIds'->>'task-1')::uuid;
 if (r->>'taskCount')::int<>1 or (r->>'groupCount')::int<>0 or (r->>'reusedGroupCount')::int<>1 then raise exception 'Existing group was not reused';end if;
 if (select count(*) from public.project_groups where project_id=p)<>1 or (select group_id from public.tasks where id=root)<>g then raise exception 'Wrong destination or empty default retained';end if;
 if public.import_project_pdf_work(p,batch,review)<>r then raise exception 'Reused-group retry receipt changed';end if;
 perform public.phase3_patch_task(root,'{"budget_impact":75}'::jsonb);
 bad:=jsonb_set(review,'{sourceName}','"different-source.pdf"');blocked:=false;
 begin perform public.import_project_pdf_work(p,batch,bad);exception when sqlstate '22023' then blocked:=true;end;
 if not blocked then raise exception 'Changed retry terms were accepted';end if;
 -- New upload / AI metadata differences must not duplicate or overwrite work.
 bad:=jsonb_set(review,'{groups,0,tasks,0,priority}','"high"');
 repeat_result:=public.import_project_pdf_work(p,repeat_batch,bad);
 if not (repeat_result->>'alreadyImported')::bool or (repeat_result->>'existingTaskCount')::int<>1 or (repeat_result->>'taskCount')::int<>0 then raise exception 'Existing PDF work was not recognized';end if;
 if (select count(*) from public.tasks where linked_project_id=p and deleted_at is null)<>1 or (select budget_impact from public.tasks where id=root)<>75 or (select priority from public.tasks where id=root)<>'medium' then raise exception 'Existing work or edits were changed';end if;
 if public.import_project_pdf_work(p,repeat_batch,bad)<>repeat_result then raise exception 'Already-imported receipt changed on retry';end if;
 -- Partial conflicts are actionable rollbacks, never an endless raw unique error.
 bad:=jsonb_set(review,'{groups,0,tasks}',(review#>'{groups,0,tasks}')||jsonb_build_array((review#>'{groups,0,tasks,0}')||'{"key":"task-2","title":"New source work"}'::jsonb));
 bad:=jsonb_set(bad,'{taskBudgets}',(bad->'taskBudgets')||'[{"key":"task-2","decision":"missing","lines":[]}]'::jsonb);
 blocked:=false;begin perform public.import_project_pdf_work(p,gen_random_uuid(),bad);exception when sqlstate '22023' then blocked:=true;end;
 if not blocked or exists(select 1 from public.tasks where linked_project_id=p and title='New source work') then raise exception 'Partial conflict was not atomic';end if;
 -- A group ID from another project cannot be used as a destination.
 bad:=jsonb_set(review,'{groups,0,existingGroupId}',to_jsonb(g::text));blocked:=false;
 begin perform public.import_project_pdf_work(p2,gen_random_uuid(),bad);exception when sqlstate '22023' then blocked:=true;end;
 if not blocked then raise exception 'Cross-project group accepted';end if;
 -- A matching name in another project does not cause a collision here.
 r:=public.import_project_pdf_work(p2,gen_random_uuid(),review);
 if (r->>'taskCount')::int<>1 or (r->>'groupCount')::int<>1 or (r->>'reusedGroupCount')::int<>0 then raise exception 'Project scope was not isolated';end if;
 if (select budget_impact from public.tasks where id=(r->'taskIds'->>'task-1')::uuid)<>100 then raise exception 'New-task budget not saved';end if;
end $$;
select 'PASS: normalized group reuse, authenticated RLS, empty-default cleanup, same-batch receipt, changed-retry denial, fresh-upload deduplication, edit preservation, partial-conflict rollback and cross-project isolation' checks;
rollback;
