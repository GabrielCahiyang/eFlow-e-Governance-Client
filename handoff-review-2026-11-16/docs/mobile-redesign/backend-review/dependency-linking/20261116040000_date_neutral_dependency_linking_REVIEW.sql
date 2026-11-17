-- REVIEW ONLY. Not applied by the agent. Stage and obtain explicit production approval.
-- No records, execution rules, own-schedule bounds, RLS, grants or receipts are rewritten.
begin;
do $review$
declare patch record;dependency record;source text;anchor text;
begin
 for dependency in select * from (values ('m7_start_subtask(uuid,uuid)','f1048dc09d64f2b25033bdd64ca3e9e7'),
('eflow_m7.guard_root_start()','5e745d1e4f8fc1b3e7da973e88a08eb9'),
('eflow_m7.validate_subtask_date_range()','e4ed2d6fa524fbfc101643658798818f'),
('eflow_r7.subtask_dependencies_ready(uuid,uuid[])','4b4481f40a3d279807f710c964595e8c'),
('eflow_schedule.guard_task()','ee25d67a0e463a7f31340636d5d055b3'),
('eflow_schedule.guard_web_subtask_parent()','f6f9e269deabb4c3e8b41861ebb26ce4'),
('guard_task_dependency_completion()','84ef464f593cf723e9609451232c1345')) reviewed(signature,hash) loop
  if to_regprocedure(dependency.signature) is null or md5(pg_get_functiondef(to_regprocedure(dependency.signature)))<>dependency.hash then
   raise exception 'Dependency-linking prerequisite differs: %. Stop for review.',dependency.signature;
  end if;
 end loop;
 for patch in select * from (values ('eflow_project.guard_dependencies()','cceff20012ac4d14b410a337b91e4a96',' if new.start_date is not null and exists(select 1 from public.tasks t where t.id=any(new.dependency_ids) and t.status<>''completed'' and coalesce(t.due_date::date,(nullif(t.deadline,'''')::timestamptz at time zone ''Asia/Manila'')::date)>new.start_date::date) then raise exception ''Task start date is earlier than a prerequisite due date. Adjust the schedule first'' using errcode=''23514'';end if;'),
('eflow_r7.guard_subtask_dependency_write()','b4d5670273b17c2bc3395144404452bc',' if tg_op=''UPDATE'' and new.status<>''cancelled'' and new.start_date is not null and
   (new.start_date is distinct from old.start_date or new.dependency_ids is distinct from old.dependency_ids) and exists(
   select 1 from public.subtasks s where s.id=any(new.dependency_ids)
    and s.status<>''completed'' and s.due_date>new.start_date
 ) then
  raise exception ''The subtask starts before a prerequisite is due. Adjust the schedule first.'' using errcode=''23514'';
 end if;'),
('eflow_r7.check_subtask_dependency_graph()','8ba90e82a783f141a4a9e3b05a9d0cc4','or s.status<>''completed'' and s.due_date>d.start_date')) reviewed(signature,hash,anchor) loop
  if to_regprocedure(patch.signature) is null or md5(pg_get_functiondef(to_regprocedure(patch.signature)))<>patch.hash then
   raise exception 'Dependency-linking baseline differs: %. Stop for review.',patch.signature;
  end if;
  source:=replace(pg_get_functiondef(to_regprocedure(patch.signature)),E'\r','');
  anchor:=replace(patch.anchor,E'\r','');
  if (length(source)-length(replace(source,anchor,'')))/length(anchor)<>1 then
   raise exception 'Dependency-linking date anchor differs: %. Stop for review.',patch.signature;
  end if;
  execute replace(source,anchor,'');
 end loop;
end $review$;
commit;
