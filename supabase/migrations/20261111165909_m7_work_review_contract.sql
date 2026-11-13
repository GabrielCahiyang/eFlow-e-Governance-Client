begin;
create table eflow_m7.work_proposals (
 id uuid primary key,
 root_id uuid not null,
 node_id uuid,
 author_id uuid not null references public.profiles(id),
 reviewer_id uuid not null references public.profiles(id),
 kind text not null check (kind in ('progress','completion')),
 submitted_as_lead boolean not null,
 terms jsonb not null,
 baseline jsonb not null,
 supersedes uuid references eflow_m7.work_proposals(id),
 state text not null default 'pending' check (state in ('pending','approved','changes_requested')),
 submitted_at timestamptz not null default clock_timestamp(),
 decided_at timestamptz,
 decision_note text,
 decision_request uuid,
 check (author_id <> reviewer_id),
 check ((state='pending')=(decided_at is null)),
 unique(supersedes),
 unique(reviewer_id,decision_request)
);
alter table eflow_m7.work_proposals enable row level security;
create unique index m7_one_pending_work_proposal on eflow_m7.work_proposals
 (root_id,coalesce(node_id,root_id),author_id) where state='pending';
create index m7_work_proposal_scope on eflow_m7.work_proposals
 (root_id,node_id,submitted_at desc,id);
create table eflow_m7.applying_work_proposal (
 tx bigint not null, proposal_id uuid not null references eflow_m7.work_proposals(id), primary key(tx,proposal_id)
);
alter table eflow_m7.applying_work_proposal enable row level security;

create function eflow_m7.node_activated(p_root uuid,p_node uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists (
  select 1 from public.tasks t join public.subtasks s on s.task_id=t.id
  where t.id=p_root and s.id=p_node and t.deleted_at is null
   and t.status not in ('todo','pending_assignment')
   and (s.start_date is null or s.started_at is not null or s.status in ('completed','for_review'))
 );
$$;
create function eflow_m7.personal_node_activated(p_root uuid,p_node uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.personal_tasks t join public.personal_subtasks s on s.task_id=t.id
  where t.id=p_root and s.id=p_node and t.status<>'todo'
   and (s.start_date is null or s.started_at is not null or s.status in ('completed','for_review')));
$$;
revoke all on function eflow_m7.personal_node_activated(uuid,uuid) from public,anon,authenticated,service_role;
create function eflow_m7.work_baseline(p_root uuid,p_node uuid)
returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce((select jsonb_build_object(
  'revision',coalesce((select s.revision from eflow_r7.tree_state s where s.root_id=t.id),1),
  'rootStatus',t.status,'rootProgress',t.percent_complete,'lastActivity',t.last_activity_at,
  'nodeStatus',n.status,'nodeProgress',n.percent_complete
 )
 from public.tasks t left join public.subtasks n on n.task_id=t.id and n.id=p_node
 where t.id=p_root),(
  select jsonb_build_object('revision',coalesce((select s.revision from eflow_r7.tree_state s where s.root_id=t.id),1),
   'rootRevision',t.revision,'rootStatus',t.status,'nodeStatus',n.status,'nodeProgress',n.percent_complete)
  from public.personal_tasks t join public.personal_subtasks n on n.task_id=t.id and n.id=p_node
  where t.id=p_root));
$$;
create function eflow_m7.work_scope_open(p_root uuid,p_node uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select coalesce(eflow_r7.read_root(p_root),false) and coalesce(eflow_r3.eligible(auth.uid()),false)
 and (exists (
  select 1 from public.tasks t join public.projects p on p.id=t.linked_project_id
  where t.id=p_root and t.deleted_at is null and t.archived_at is null
    and t.status in ('in_progress','changes_requested') and p.status in ('active','on_hold')
    and (p_node is null or eflow_m7.node_activated(t.id,p_node) and exists(
      select 1 from public.subtasks s where s.id=p_node and s.task_id=t.id and s.status not in ('for_review','completed')
    ))
 ) or exists(
  select 1 from public.personal_tasks t join public.personal_projects p on p.id=t.project_id
  join public.personal_subtasks s on s.task_id=t.id and s.id=p_node
  where t.id=p_root and p.status='active' and t.status='in_progress'
   and eflow_m7.personal_node_activated(t.id,s.id) and s.status not in ('for_review','completed')
 ));
$$;
create function eflow_m7.work_reviewer(p_root uuid,p_node uuid,p_author uuid,p_kind text)
returns uuid language plpgsql stable security definer set search_path='' as $$
declare t public.tasks; n public.subtasks; chosen uuid;
 personal public.personal_tasks; child public.personal_subtasks;
begin
 if not coalesce(eflow_r3.eligible(p_author),false) then return null; end if;
 select * into personal from public.personal_tasks where id=p_root;
 if found then
  if p_node is null or not eflow_r7.member(personal.project_id,null,p_author) or personal.lead_id=p_author then return null; end if;
  select * into child from public.personal_subtasks where id=p_node and task_id=p_root;
  if not found then return null; end if;
  if child.lead_id=p_author and p_kind='completion' then chosen:=personal.lead_id;
  elsif child.lead_id is distinct from p_author and p_author=any(child.assigned_to_ids) then
   chosen:=case when eflow_r7.member(personal.project_id,null,child.lead_id) then child.lead_id else eflow_r7.reviewer(child.id,p_author) end;
  end if;
  if chosen is null or chosen=p_author or not eflow_r7.member(personal.project_id,null,chosen) then return null; end if;
  return chosen;
 end if;
 if not public.can_see_task(p_root,p_author) then return null; end if;
 select * into t from public.tasks where id=p_root;
 if p_node is null then
  if p_author=t.assigned_to or not coalesce(p_author=any(t.team_member_ids),false) then return null; end if;
  chosen:=t.assigned_to;
 else
  select * into n from public.subtasks where task_id=p_root and id=p_node;
  if n.id is null or p_author=t.assigned_to then return null; end if;
  if p_author=n.lead_id then
   if p_kind<>'completion' then return null; end if;
   chosen:=t.assigned_to;
  elsif coalesce(p_author=any(n.assigned_to_ids),false) then
   chosen:=eflow_r7.reviewer(n.id,p_author);
  end if;
 end if;
 if chosen is null or chosen=p_author or not eflow_r7.member(t.linked_project_id,t.org_id,chosen)
    or not public.can_see_task(t.id,chosen) then return null; end if;
 return chosen;
end $$;

create function eflow_m7.is_subtask_lead(p_root uuid,p_node uuid,p_author uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from eflow_r7.nodes n where n.task_id=p_root and n.id=p_node and n.lead_id=p_author);
$$;
revoke all on function eflow_m7.is_subtask_lead(uuid,uuid,uuid) from public,anon,authenticated,service_role;
create function eflow_m7.log_proposal(p_work eflow_m7.work_proposals,p_action text)
returns void language plpgsql security definer set search_path='' as $$
begin
 insert into public.audit_events(actor_id,entity_type,entity_id,action,org_id,after_data,reason)
 values(auth.uid(),case when p_work.node_id is null then 'task' else 'subtask' end,
  coalesce(p_work.node_id,p_work.root_id)::text,p_action,
  (select org_id from public.tasks where id=p_work.root_id),
  jsonb_build_object('submissionId',p_work.id,'rootId',p_work.root_id,'authorId',p_work.author_id,
   'reviewerId',p_work.reviewer_id,'state',p_work.state,'supersedes',p_work.supersedes),
  p_work.decision_note);
end $$;

-- Isolate pending attachments from the legacy task-attachment read policy.
insert into storage.buckets(id,name,public,file_size_limit)
 values('m7-work-evidence','m7-work-evidence',false,26214400);
create function eflow_m7.proposal_file_scope(p_name text)
returns table(author uuid,root uuid,node uuid,request uuid)
language plpgsql immutable set search_path='' as $$
declare parts text[]:=string_to_array(p_name,'/');
 pattern constant text:='^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$';
begin
 if cardinality(parts)=5 and parts[1]~pattern and parts[2]~pattern and
    (parts[3]='root' or parts[3]~pattern) and parts[4]~pattern and
    parts[5]~'^[0-9A-Za-z_.-]{1,255}$' and parts[5] not in ('.','..') then
  return query select parts[1]::uuid,parts[2]::uuid,nullif(parts[3],'root')::uuid,parts[4]::uuid;
 end if;
end $$;
create function eflow_m7.proposal_file_upload(p_name text,p_owner text)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from eflow_m7.proposal_file_scope(p_name) f
  where f.author=auth.uid() and p_owner=f.author::text and eflow_m7.work_scope_open(f.root,f.node)
   and (eflow_m7.work_reviewer(f.root,f.node,f.author,'progress') is not null
     or eflow_m7.work_reviewer(f.root,f.node,f.author,'completion') is not null)
   and not exists(select 1 from eflow_m7.work_proposals p where p.id=f.request));
$$;
create function eflow_m7.proposal_file_read(p_name text,p_owner text)
returns boolean language sql stable security definer set search_path='' as $$
 select coalesce(eflow_r3.eligible(auth.uid()),false) and exists(
  select 1 from eflow_m7.proposal_file_scope(p_name) f where f.author::text=p_owner and (
   f.author=auth.uid() and eflow_r7.read_root(f.root)
   or exists(select 1 from eflow_m7.work_proposals p
    where p.id=f.request and p.root_id=f.root and p.node_id is not distinct from f.node and p.author_id=f.author
      and eflow_r7.read_root(p.root_id)
      and (p.node_id is null or eflow_m7.node_activated(p.root_id,p.node_id) or eflow_m7.personal_node_activated(p.root_id,p.node_id))
      and (p.state='pending' and eflow_m7.work_reviewer(p.root_id,p.node_id,p.author_id,p.kind)=auth.uid()
        or p.state<>'pending' and p.reviewer_id=auth.uid())
      and exists(select 1 from jsonb_array_elements(coalesce(p.terms->'attachments','[]')) a where a->>'filePath'=p_name)
   )
  ));
$$;
create function eflow_m7.proposal_file_discard(p_name text,p_owner text)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from eflow_m7.proposal_file_scope(p_name) f
  where f.author=auth.uid() and p_owner=f.author::text
  and not exists(select 1 from eflow_m7.work_proposals p where p.id=f.request));
$$;

create policy m7_evidence_read on storage.objects for select to authenticated
 using(bucket_id='m7-work-evidence' and eflow_m7.proposal_file_read(name,owner_id));
create policy m7_evidence_read_scope on storage.objects as restrictive for select to authenticated,anon
 using(bucket_id<>'m7-work-evidence' or eflow_m7.proposal_file_read(name,owner_id));
create policy m7_evidence_upload on storage.objects for insert to authenticated
 with check(bucket_id='m7-work-evidence' and eflow_m7.proposal_file_upload(name,owner_id));
create policy m7_evidence_upload_scope on storage.objects as restrictive for insert to authenticated,anon
 with check(bucket_id<>'m7-work-evidence' or eflow_m7.proposal_file_upload(name,owner_id));
create policy m7_evidence_immutable on storage.objects as restrictive for update to authenticated,anon
 using(bucket_id<>'m7-work-evidence') with check(bucket_id<>'m7-work-evidence');
create policy m7_evidence_discard on storage.objects for delete to authenticated
 using(bucket_id='m7-work-evidence' and eflow_m7.proposal_file_discard(name,owner_id));
create policy m7_evidence_discard_scope on storage.objects as restrictive for delete to authenticated,anon
 using(bucket_id<>'m7-work-evidence' or eflow_m7.proposal_file_discard(name,owner_id));
revoke all on function eflow_m7.proposal_file_scope(text),eflow_m7.proposal_file_upload(text,text),
 eflow_m7.proposal_file_read(text,text),eflow_m7.proposal_file_discard(text,text) from public,anon,authenticated,service_role;
grant usage on schema eflow_m7 to anon;
grant execute on function eflow_m7.proposal_file_upload(text,text),eflow_m7.proposal_file_read(text,text),
 eflow_m7.proposal_file_discard(text,text) to authenticated,anon;

create function eflow_m7.check_proposal_files(p_work jsonb,p_author uuid,p_root uuid,p_node uuid,p_request uuid)
returns void language plpgsql security definer set search_path='' as $$
declare files jsonb:=coalesce(p_work->'attachments','[]'); attachment jsonb;
 object_size bigint; object_mime text;
begin
 if jsonb_typeof(files)<>'array' or jsonb_array_length(files)>10
    or exists(select 1 from jsonb_array_elements(files) f group by f->>'filePath' having count(*)>1)
 then raise exception 'Choose up to ten unique evidence files' using errcode='22023'; end if;
 for attachment in select value from jsonb_array_elements(files) loop
  if jsonb_typeof(attachment)<>'object' or length(coalesce(attachment->>'fileName','')) not between 1 and 255
   or not exists(select 1 from eflow_m7.proposal_file_scope(attachment->>'filePath') f
    where f.author=p_author and f.root=p_root and f.node is not distinct from p_node and f.request=p_request)
  then raise exception 'Evidence does not belong to this work request' using errcode='42501'; end if;
  select (o.metadata->>'size')::bigint,o.metadata->>'mimetype' into object_size,object_mime
   from storage.objects o where o.bucket_id='m7-work-evidence'
    and o.name=attachment->>'filePath' and o.owner_id=p_author::text for share;
  if not found or object_size is null or object_size not between 1 and 26214400
     or object_size is distinct from (attachment->>'fileSize')::bigint
     or object_mime is distinct from attachment->>'mimeType'
     or not coalesce((public.get_task_evidence_rules()->'allowedMimeTypes') ? object_mime,false)
  then raise exception 'Evidence could not be verified' using errcode='22023'; end if;
 end loop;
end $$;
revoke all on function eflow_m7.check_proposal_files(jsonb,uuid,uuid,uuid,uuid) from public,anon,authenticated,service_role;

create function eflow_m7.propose_work(p_root uuid,p_node uuid,p_request uuid,p_kind text,p_terms jsonb,p_supersedes uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare existing eflow_m7.work_proposals; chosen uuid; actor uuid:=auth.uid();
 note text; progress integer;
begin
 if not coalesce(eflow_r7.read_root(p_root),false) or not coalesce(eflow_r3.eligible(actor),false) then
  raise exception 'Current work scope required' using errcode='42501';
 end if;
 if p_request is null or p_kind is null or p_kind not in ('progress','completion') or p_terms is null
    or jsonb_typeof(p_terms)<>'object' or exists(select 1 from jsonb_object_keys(p_terms) k where k not in ('note','progress','blocker','attachments')) then
  raise exception 'Choose valid work submission terms' using errcode='22023';
 end if;
 note:=nullif(btrim(p_terms->>'note'),'');
 if note is null or length(note)>3000 or length(coalesce(p_terms->>'blocker',''))>3000 then
  raise exception 'Enter a work note of up to 3000 characters' using errcode='22023';
 end if;
 progress:=(p_terms->>'progress')::integer;
 if progress is not null and progress not between 0 and 99 or p_kind='progress' and progress is null and p_node is null then
  raise exception 'Enter progress from 0 to 99' using errcode='22023';
 end if;
 perform eflow_r7.lock_impact(p_root);
 perform 1 from public.tasks where id=p_root for update;
 perform 1 from public.personal_tasks where id=p_root for update;
 if not coalesce(eflow_r7.read_root(p_root),false) or not coalesce(eflow_r3.eligible(actor),false) then
  raise exception 'Current work scope required' using errcode='42501';
 end if;
 select * into existing from eflow_m7.work_proposals where id=p_request;
 if found then
  if existing.author_id is distinct from actor or existing.root_id is distinct from p_root or existing.node_id is distinct from p_node
     or existing.kind is distinct from p_kind or existing.terms is distinct from p_terms or existing.supersedes is distinct from p_supersedes then
   raise exception 'Work submission identity already in use' using errcode='23505';
  end if;
  return to_jsonb(existing);
 end if;
 if not eflow_m7.work_scope_open(p_root,p_node) then raise exception 'Current work scope required' using errcode='42501'; end if;
 chosen:=eflow_m7.work_reviewer(p_root,p_node,actor,p_kind);
 if chosen is null then raise exception 'No eligible Lead can review this submission' using errcode='42501'; end if;
 if p_supersedes is not null and not exists(
  select 1 from eflow_m7.work_proposals p where p.id=p_supersedes and p.author_id=actor and p.root_id=p_root
   and p.node_id is not distinct from p_node and p.kind=p_kind and p.state='changes_requested'
 ) then raise exception 'Choose the returned submission for this work' using errcode='42501'; end if;
 perform eflow_m7.check_proposal_files(p_terms,actor,p_root,p_node,p_request);
 insert into eflow_m7.work_proposals(id,root_id,node_id,author_id,reviewer_id,kind,submitted_as_lead,terms,baseline,supersedes)
 values(p_request,p_root,p_node,actor,chosen,p_kind,eflow_m7.is_subtask_lead(p_root,p_node,actor),
   p_terms,eflow_m7.work_baseline(p_root,p_node),p_supersedes) returning * into existing;
 perform eflow_m7.log_proposal(existing,'work.proposed');
 insert into public.notifications(user_id,type,title,message,task_id,actor_id,work_node_id,entity_type,project_id)
 select chosen,'approval_needed','Work awaiting Lead review','Open the work to review the submission.',p_root,actor,p_node,
  case when exists(select 1 from public.personal_tasks where id=p_root) then 'm7_personal_work_proposal' else 'm7_work_proposal' end,
  (select project_id from public.personal_tasks where id=p_root);
 return to_jsonb(existing);
end $$;

create function eflow_m7.decide_work(p_proposal uuid,p_request uuid,p_approve boolean,p_note text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare work eflow_m7.work_proposals; actor uuid:=auth.uid(); note text:=nullif(btrim(p_note),'');
 progress integer;
begin
 if actor is null or p_request is null or p_approve is null or (not p_approve and note is null) or length(note)>3000 then
  raise exception 'Choose a review decision and enter a reason for requested changes' using errcode='22023';
 end if;
 select * into work from eflow_m7.work_proposals where id=p_proposal and (
  state='pending' and eflow_m7.work_reviewer(root_id,node_id,author_id,kind)=actor
  or state<>'pending' and reviewer_id=actor
 );
 if not found or not coalesce(eflow_r7.read_root(work.root_id),false) or not eflow_r3.eligible(actor) then
  raise exception 'Current assigned review required' using errcode='42501';
 end if;
 perform eflow_r7.lock_impact(work.root_id);
 perform 1 from public.tasks where id=work.root_id for update;
 perform 1 from public.personal_tasks where id=work.root_id for update;
 select * into work from eflow_m7.work_proposals where id=p_proposal for update;
 if work.author_id=actor or work.state<>'pending' and work.reviewer_id is distinct from actor then raise exception 'Independent Lead review required' using errcode='42501'; end if;
 if work.decision_request=p_request then
  if work.state is distinct from (case when p_approve then 'approved' else 'changes_requested' end)
     or work.decision_note is distinct from note then raise exception 'Review request terms changed' using errcode='23505'; end if;
  return to_jsonb(work);
 end if;
 if work.state<>'pending' or not eflow_m7.work_scope_open(work.root_id,work.node_id)
    or eflow_m7.work_reviewer(work.root_id,work.node_id,work.author_id,work.kind) is distinct from actor
    or work.submitted_as_lead is distinct from eflow_m7.is_subtask_lead(work.root_id,work.node_id,work.author_id) then
  raise exception 'Review access or work state changed' using errcode='42501';
 end if;
 if work.reviewer_id is distinct from actor then
  update eflow_m7.work_proposals set reviewer_id=actor where id=work.id returning * into work;
  perform eflow_m7.log_proposal(work,'work.proposal_rerouted');
 end if;
 if p_approve then
  if work.baseline is distinct from eflow_m7.work_baseline(work.root_id,work.node_id) then
   raise exception 'Work changed after submission. Return it for a current update.' using errcode='40001';
  end if;
  perform eflow_m7.check_proposal_files(work.terms,work.author_id,work.root_id,work.node_id,work.id);
  insert into eflow_m7.applying_work_proposal values(txid_current(),work.id);
  progress:=(work.terms->>'progress')::integer;
  if exists(select 1 from public.personal_tasks where id=work.root_id) then
   perform eflow_r7.command(work.root_id,(work.baseline->>'revision')::integer,work.id,
    case when work.kind='completion' and work.submitted_as_lead then 'submit' else 'progress' end,
    jsonb_build_object('id',work.node_id,'note',work.terms->>'note','progress',
     coalesce(progress,(select s.percent_complete from public.personal_subtasks s where s.id=work.node_id))));
  elsif work.kind='completion' and work.submitted_as_lead then
   perform eflow_r7.complete_subitem(work.node_id,jsonb_build_object('id',work.id,'note',work.terms->>'note'));
  elsif work.node_id is null then
   perform public.submit_task_progress(work.root_id,progress,null,work.terms->>'blocker',null,work.terms->>'note',null,null);
  elsif progress is not null then
   perform public.save_subtask_progress(work.node_id,progress,null,work.terms->>'blocker',null,work.terms->>'note',null,null);
  else
   perform public.save_subtask_work_update(work.node_id,
    case when nullif(btrim(work.terms->>'blocker'),'') is null then 'in_progress' else 'stuck' end,
    work.terms->>'blocker',work.terms->>'note',null,null,null);
  end if;
  delete from eflow_m7.applying_work_proposal where tx=txid_current() and proposal_id=work.id;
 end if;
 update eflow_m7.work_proposals set state=case when p_approve then 'approved' else 'changes_requested' end,
  decided_at=clock_timestamp(),decision_note=note,decision_request=p_request where id=work.id returning * into work;
 perform eflow_m7.log_proposal(work,case when p_approve then 'work.proposal_approved' else 'work.proposal_changes_requested' end);
 insert into public.notifications(user_id,type,title,message,task_id,actor_id,work_node_id,entity_type,project_id)
 select work.author_id,'status_change',case when p_approve then 'Work update accepted' else 'Changes requested' end,
  'Open the work to see the Lead decision.',work.root_id,actor,work.node_id,
  case when exists(select 1 from public.personal_tasks where id=work.root_id) then 'm7_personal_work_proposal' else 'm7_work_proposal' end,
  (select project_id from public.personal_tasks where id=work.root_id);
 return to_jsonb(work);
end $$;

create function eflow_m7.work_proposal_context(p_root uuid,p_node uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=auth.uid(); open_scope boolean:=eflow_m7.work_scope_open(p_root,p_node);
begin
 if actor is null or not eflow_r7.read_root(p_root) or not eflow_r3.eligible(actor) then
  raise exception 'Current work scope required' using errcode='42501';
 end if;
 return jsonb_build_object(
  'canProposeProgress',open_scope and eflow_m7.work_reviewer(p_root,p_node,actor,'progress') is not null,
  'canProposeCompletion',open_scope and eflow_m7.work_reviewer(p_root,p_node,actor,'completion') is not null,
  'items',coalesce((select jsonb_agg(to_jsonb(x)||jsonb_build_object('canDecide',open_scope and x.state='pending'
   and eflow_m7.work_reviewer(x.root_id,x.node_id,x.author_id,x.kind)=actor)
   order by x.submitted_at desc,x.id) from (
    select * from eflow_m7.work_proposals w where w.root_id=p_root and w.node_id is not distinct from p_node
     and (w.author_id=actor or (w.state='pending' and eflow_m7.work_reviewer(w.root_id,w.node_id,w.author_id,w.kind)=actor) or (w.state<>'pending' and w.reviewer_id=actor))
    order by w.submitted_at desc,w.id limit 30
   ) x),'[]'::jsonb)
 );
end $$;

create function eflow_m7.require_progress_authority(p_root uuid,p_node uuid)
returns void language plpgsql security definer set search_path='' as $$
declare t public.tasks; n public.subtasks; actor uuid:=auth.uid();
begin
 select * into t from public.tasks where id=p_root;
 if exists(select 1 from eflow_m7.applying_work_proposal a join eflow_m7.work_proposals w on w.id=a.proposal_id
  where a.tx=txid_current() and w.root_id=p_root and w.node_id is not distinct from p_node and w.reviewer_id=actor)
 then return; end if;
 if actor is null or not eflow_r3.eligible(actor) or not public.can_see_task(p_root,actor) then
  raise exception 'Current work scope required' using errcode='42501';
 end if;
 if t.linked_project_id is null or t.source_collaboration_draft_id is not null then return; end if;
 if p_node is not null then
  select * into n from public.subtasks where id=p_node and task_id=p_root;
  if n.id is null or not eflow_m7.node_activated(p_root,p_node) then raise exception 'This subtask has not started' using errcode='42501'; end if;
 end if;
 if t.assigned_to is distinct from actor and n.lead_id is distinct from actor then
  raise exception 'Contributor changes must be submitted for Lead review' using errcode='42501';
 end if;
end $$;

-- Keep existing writer, evidence, descendant and audit checks. Reject legacy
-- contributor writes and legacy direct completion from a different Subtask Lead.
do $migration$
begin
 perform eflow_m7.replace_body_part('public.submit_task_progress(uuid,integer,text,text,text,text,text,text)',
  '  if caller is null then', '  perform eflow_r7.lock_impact(p_task_id); perform eflow_m7.require_progress_authority(p_task_id,null); if caller is null then');
 perform eflow_m7.replace_body_part('public.save_subtask_progress(uuid,integer,text,text,text,text,text,text)',
  '/* NW4.2 completion serialization */', 'perform eflow_m7.require_progress_authority((select task_id from public.subtasks where id=p_subtask_id),p_subtask_id); /* NW4.2 completion serialization */');
 perform eflow_m7.replace_body_part('public.save_subtask_work_update(uuid,text,text,text,text,text,text)',
  '/* NW4.2 completion serialization */', 'perform eflow_m7.require_progress_authority((select task_id from public.subtasks where id=p_subtask_id),p_subtask_id); /* NW4.2 completion serialization */');
 perform eflow_m7.replace_body_part('eflow_r7.command(uuid,integer,uuid,text,jsonb)',
  $old$if v_kind<>'personal' then raise exception 'Use the existing Office evidence workflow';end if;$old$,
  $new$if v_kind<>'personal' then raise exception 'Use the existing Office evidence workflow';end if;
  if not eflow_m7.personal_node_activated(p_root,v_id) then raise exception 'This subtask has not started' using errcode='42501'; end if;
  if not exists(select 1 from eflow_m7.applying_work_proposal a join eflow_m7.work_proposals w on w.id=a.proposal_id
   where a.tx=txid_current() and w.root_id=p_root and w.node_id=v_id and w.reviewer_id=auth.uid()) then
   if p_command='progress' and n.lead_id is distinct from auth.uid() and (r->>'lead')::uuid is distinct from auth.uid()
      or p_command='submit' and (n.lead_id is distinct from auth.uid() or (r->>'lead')::uuid is distinct from auth.uid())
   then raise exception 'Submit this work for the appointed Lead to review' using errcode='42501'; end if;
  end if;$new$);
 perform eflow_m7.replace_body_part('eflow_r7.complete_subitem(uuid,jsonb)',
  ' previous_status:=s.status;', $body$
 if r is not null and (not eflow_m7.node_activated(root_id,p_subtask_id) or t.assigned_to is distinct from caller
    or (s.lead_id is distinct from caller and not exists(
     select 1 from eflow_m7.applying_work_proposal a join eflow_m7.work_proposals w on w.id=a.proposal_id
     where a.tx=txid_current() and w.id=(p_completion->>'id')::uuid and w.node_id=s.id
      and w.root_id=t.id and w.reviewer_id=caller and w.submitted_as_lead and w.kind='completion'
    ))) then raise exception 'Submit this subtask for the appointed Task Lead to review' using errcode='42501'; end if;
 previous_status:=s.status;$body$);
 perform eflow_m7.replace_body_part('eflow_r7.complete_subitem(uuid,jsonb)',
  '''subtask.completed_directly''', $body$case when exists(select 1 from eflow_m7.applying_work_proposal where tx=txid_current() and proposal_id=v_request)
  then 'subtask.completed_after_lead_review' else 'subtask.completed_directly' end$body$);
end $migration$;

create function public.m7_work_proposals(p_root uuid,p_node uuid default null)
returns jsonb language sql stable security invoker set search_path='' as $$
 select eflow_m7.work_proposal_context(p_root,p_node);
$$;
create function public.m7_propose_work(p_root uuid,p_node uuid,p_request uuid,p_kind text,p_terms jsonb,p_supersedes uuid default null)
returns jsonb language sql security invoker set search_path='' as $$
 select eflow_m7.propose_work(p_root,p_node,p_request,p_kind,p_terms,p_supersedes);
$$;
create function public.m7_decide_work(p_proposal uuid,p_request uuid,p_approve boolean,p_note text default null)
returns jsonb language sql security invoker set search_path='' as $$
 select eflow_m7.decide_work(p_proposal,p_request,p_approve,p_note);
$$;

revoke all on function eflow_m7.node_activated(uuid,uuid),eflow_m7.work_baseline(uuid,uuid),eflow_m7.work_scope_open(uuid,uuid),
 eflow_m7.work_reviewer(uuid,uuid,uuid,text),eflow_m7.log_proposal(eflow_m7.work_proposals,text),eflow_m7.require_progress_authority(uuid,uuid),
 eflow_m7.work_proposal_context(uuid,uuid),eflow_m7.propose_work(uuid,uuid,uuid,text,jsonb,uuid),eflow_m7.decide_work(uuid,uuid,boolean,text),
 public.m7_work_proposals(uuid,uuid),public.m7_propose_work(uuid,uuid,uuid,text,jsonb,uuid),public.m7_decide_work(uuid,uuid,boolean,text)
 from public,anon,authenticated,service_role;
grant execute on function eflow_m7.work_proposal_context(uuid,uuid),eflow_m7.propose_work(uuid,uuid,uuid,text,jsonb,uuid),
 eflow_m7.decide_work(uuid,uuid,boolean,text),public.m7_work_proposals(uuid,uuid),public.m7_propose_work(uuid,uuid,uuid,text,jsonb,uuid),
 public.m7_decide_work(uuid,uuid,boolean,text) to authenticated;
notify pgrst, 'reload schema';
commit;
