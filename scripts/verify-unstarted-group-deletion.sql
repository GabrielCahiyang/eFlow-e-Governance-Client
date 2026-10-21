-- Self-contained hosted acceptance; all fixtures and mutations roll back.
begin;
do $$
declare h public.profiles;m uuid;p uuid:=gen_random_uuid();g uuid;empty_g uuid;
 t1 public.tasks;t2 public.tasks;s1 uuid:=gen_random_uuid();s2 uuid:=gen_random_uuid();
 snap jsonb;blocked boolean;before_items jsonb;answer uuid[];
begin
 select * into h from public.profiles where role='head' and is_active order by id limit 1;
 select id into m from public.profiles where role='member' and is_active order by id limit 1;
 if h.id is null or m is null then raise exception 'Active Head and Member required';end if;
 perform set_config('request.jwt.claim.sub',h.id::text,true);
 insert into public.projects(id,title,org_id,owner_id,created_by) values(p,'Rollback unstarted group QA',h.org_id,h.id,h.id);
 select id into g from public.project_groups where project_id=p and is_default;
 t1:=public.phase3_create_task(p,g,'Unstarted assigned task');
 t2:=public.phase3_create_task(p,g,'Unstarted pending task');
 snap:=public.r7_work_tree(t1.id);
 perform public.auto_assign_project_task(t1.id,(snap->>'revision')::int,gen_random_uuid(),h.id,array[h.id]);
 snap:=public.r7_work_tree(t1.id);
 perform public.r7_work_command(t1.id,(snap->>'revision')::int,gen_random_uuid(),'create',jsonb_build_object('id',s1,'title','Unstarted child','lead',h.id,'people',array[h.id]));
 snap:=public.r7_work_tree(t1.id);
 perform public.r7_work_command(t1.id,(snap->>'revision')::int,gen_random_uuid(),'create',jsonb_build_object('id',s2,'parent',s1,'title','Unstarted grandchild','lead',h.id,'people',array[h.id]));
 update public.tasks set budget_impact=1000000,estimated_hours=40 where id=t1.id;
 -- A started descendant must block the entire group, with no partial removal.
 blocked:=false;
 begin
  perform public.save_subtask_work_update(s2,'in_progress');
  begin perform public.delete_project_group(g);exception when sqlstate '22023' then blocked:=true;end;
  if not blocked or not exists(select 1 from public.tasks where id=t2.id and deleted_at is null)
   or not exists(select 1 from public.project_groups where id=g) then raise exception 'Started subitem allowed deletion or caused partial writes';end if;
  raise exception 'Rollback test progress' using errcode='PT001';
 exception when sqlstate 'PT001' then null;end;
 blocked:=false;
 begin
  perform public.transition_task_status(t1.id,'in_progress',null,null);
  begin perform public.delete_project_group(g);exception when sqlstate '22023' then blocked:=true;end;
  if not blocked then raise exception 'In progress task allowed group deletion';end if;
  raise exception 'Rollback test status' using errcode='PT001';
 exception when sqlstate 'PT001' then null;end;
 blocked:=false;
 begin
  update public.tasks set archived_at=now() where id=t1.id;
  begin perform public.delete_project_group(g);exception when sqlstate '22023' then blocked:=true;end;
  if not blocked then raise exception 'Archived task allowed group deletion';end if;
  raise exception 'Rollback test archive' using errcode='PT001';
 exception when sqlstate 'PT001' then null;end;
 -- Import cleanup must retain its strict empty-only contract.
 blocked:=false;begin perform public.delete_empty_project_group(g);exception when sqlstate '22023' then blocked:=true;end;
 if not blocked then raise exception 'Empty-only import cleanup removed populated work';end if;
 perform set_config('request.jwt.claim.sub',m::text,true);
 blocked:=false;begin perform public.delete_project_group(g);exception when sqlstate '42501' then blocked:=true;end;
 if not blocked then raise exception 'Member deleted the group';end if;
 perform set_config('request.jwt.claim.sub',h.id::text,true);
 select jsonb_agg(to_jsonb(s) order by s.id) into before_items from public.subtasks s where task_id=t1.id;
 -- Delete the populated default and last group as the actual client role.
 set local role authenticated;
 perform public.delete_project_group(g);
 reset role;
 set constraints all immediate;
 if exists(select 1 from public.project_groups where id=g) then raise exception 'Group remains';end if;
 if (select count(*) from public.tasks where id in(t1.id,t2.id) and deleted_at is not null and group_id is null)<>2 then raise exception 'Tasks not removed with history retained';end if;
 if before_items is distinct from (select jsonb_agg(to_jsonb(s) order by s.id) from public.subtasks s where task_id=t1.id) then raise exception 'Descendant history changed';end if;
 if (select count(*) from public.audit_events where action='task.deleted' and entity_id in(t1.id::text,t2.id::text))<>2 then raise exception 'Task audit receipt missing';end if;
 if not exists(select 1 from public.audit_events where action='project_group.deleted' and entity_id=g::text and after_data->>'removedTaskCount'='2') then raise exception 'Group audit impact missing';end if;
 insert into public.project_groups(project_id,title,color,position) values(p,'Empty group','#087f8c',1) returning id into empty_g;
 perform public.delete_project_group(empty_g);
 if exists(select 1 from public.project_groups where id=empty_g) then raise exception 'Empty deletion failed';end if;
end $$;
select 'PASS: populated default/last group, assigned and pending tasks, nested descendants, estimates, preserved audit/history, empty deletion, Member denial, started task/subitem and archived protections, strict import cleanup' as checks;
rollback;
