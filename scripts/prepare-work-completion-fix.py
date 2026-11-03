from pathlib import Path
import re
root=Path(__file__).resolve().parent.parent
base=root/'.codex-tmp/work-completion-baseline'
def source(name):
    return re.sub(r'\n\s*\n+', '\n', (base/(name+'.sql')).read_text(encoding='utf-8')).strip()
submit=source('public.submit_task_for_review')
submit=submit.replace("t.status <> 'in_progress'", "t.status not in ('todo','in_progress','changes_requested')")
submit=submit.replace('Only in-progress work can be submitted', 'This task is no longer open for submission')
submit=submit.replace('if not (t.assigned_to = caller or t.recommendation_lead_id = caller) then', 'if coalesce(t.assigned_to, t.recommendation_lead_id) is distinct from caller then')
needle="  submission_id := case"
assert needle in submit
submit=submit.replace(needle,"""  -- Starting and submitting share the task lock and transaction. A contributor
  -- starting work or a delayed client render cannot race a second start RPC.
  if not coalesce(eflow_r3.eligible(caller),false) then
    raise exception 'Your current work access could not be verified' using errcode='42501';
  end if;
  if t.status <> 'in_progress' then
    perform public.transition_task_status(p_task_id,'in_progress',null,'Work submitted by task lead');
  end if;
"""+needle)
upload=source('eflow_evidence.can_upload')
upload=upload.replace("return t.status = 'in_progress'", "return t.status in ('todo','in_progress','changes_requested')")
caps="coalesce((eflow_r7.operation_capabilities(ctx.task_id,ctx.subtask_id)->'execute'->>'allowed')::boolean,false)"
upload=upload.replace('not eflow_r7.node_work(ctx.subtask_id,auth.uid())', 'not '+caps)
upload=upload.replace('coalesce(eflow_r7.node_work(s.id,auth.uid()),false)', "coalesce((eflow_r7.operation_capabilities(s.task_id,s.id)->'execute'->>'allowed')::boolean,false)")
assert 'node_work' not in upload
guard=source('eflow_evidence.guard_progress')
guard=guard.replace("perform eflow_evidence.seal_file(new.attachment_path, t.id, s.id, 'progress', 'progress', new.id);", """-- Direct completion stores files under its immutable request UUID, while
    -- ordinary updates use /progress/. Both retain the same evidence sealing.
    if eflow_r7.internal(s.task_id) and s.status='completed'
       and s.completed_by=auth.uid() and new.percent_complete=100 then
      perform eflow_evidence.seal_file(new.attachment_path,t.id,s.id,
        (select ctx.attempt from eflow_evidence.path_context(new.attachment_path) ctx), 'progress',new.id);
    else
      perform eflow_evidence.seal_file(new.attachment_path,t.id,s.id,'progress','progress',new.id);
    end if;""")
notify="""CREATE OR REPLACE FUNCTION public.notify_subtask_progress_leader()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
declare s public.subtasks;t public.tasks;recipient uuid;details text;finished boolean;blocked boolean;
begin
 select * into s from public.subtasks where id=new.subtask_id;
 select * into t from public.tasks where id=new.task_id and deleted_at is null;
 if s.id is null or t.id is null then return new;end if;
 recipient:=public.resolve_subtask_reviewer(t,new.author_id);
 if recipient is null or recipient=new.author_id then return new;end if;
 finished:=s.status='completed' and s.completed_by=new.author_id and new.percent_complete=100;
 -- Extra evidence rows belong to the same completion, not another update.
 if finished and new.attachment_path is not null and
   (select ctx.attempt from eflow_evidence.path_context(new.attachment_path) ctx) is distinct from new.id::text then return new;end if;
 blocked:=nullif(btrim(new.blocker),'') is not null and coalesce(new.blocker_category,'None')<>'None';
 details:=concat_ws(' · ',nullif(btrim(new.note),''),
   case when blocked then 'Blocker: '||btrim(new.blocker) end,
   case when nullif(btrim(new.next_step),'') is not null then 'Next: '||btrim(new.next_step) end,
   case when nullif(btrim(new.attachment_name),'') is not null then 'Attachment: '||new.attachment_name end);
 insert into public.notifications(user_id,type,title,message,task_id,task_title,actor_id,actor_name,status_from,status_to,reason,project_id,org_id,entity_type,work_node_id)
 values(recipient,'status_change',case when finished then 'Subtask completed' when blocked then 'Subtask blocker reported' else 'Subtask work updated' end,
 coalesce(new.author_name,'A team member')||case when finished then ' completed "' when blocked then ' reported a blocker on "' else ' updated "' end||s.title||'".'||case when details<>'' then ' '||details else '' end,
 t.id,t.title,new.author_id,coalesce(new.author_name,'Team member'),'',case when finished then 'completed' else s.status end,details,t.linked_project_id,t.org_id,'subtask',s.id);
 return new;
end $function$;
"""
out=root/'supabase/migrations/20261102190846_work_completion_and_update_notifications.sql'
out.write_text('-- Fix canonical lead submission, atomic start/submit, contextual lead evidence and status-based notifications.\n-- Existing signatures, grants, review/dependency/finance guards and historical records are preserved.\n'+submit+';\n\n'+upload+';\n\n'+guard+';\n\n'+notify+"\nNOTIFY pgrst, 'reload schema';\n",encoding='utf-8')
print(out.name)
