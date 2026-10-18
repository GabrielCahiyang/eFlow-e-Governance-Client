-- Additive validation and invitation retention. Existing authority and financial writers remain in place.
create schema if not exists eflow_validation;
revoke all on schema eflow_validation from public,anon,authenticated;
grant usage on schema eflow_validation to authenticated,service_role;

create function eflow_validation.valid_decimal(v numeric,minimum numeric,maximum numeric,places integer)
returns boolean language sql immutable set search_path='' as $$
 select coalesce(v is not null and v::text not in ('NaN','Infinity','-Infinity') and v between minimum and maximum and v=round(v,places),false)
$$;

create function eflow_validation.normalized_work_name(v text) returns text language sql immutable strict set search_path='' as $$
 select lower(btrim(regexp_replace(replace(normalize(v,NFC),U&'\00A0',' '),'[[:space:]]+',' ','g')))
$$;
grant execute on function eflow_validation.normalized_work_name(text) to authenticated,service_role;
create unique index eflow_unique_group_name on public.project_groups(project_id,eflow_validation.normalized_work_name(title));
create unique index eflow_unique_task_name on public.tasks(group_id,eflow_validation.normalized_work_name(title)) where deleted_at is null and group_id is not null;
create unique index eflow_unique_subitem_name on public.subtasks(task_id,parent_subtask_id,eflow_validation.normalized_work_name(title)) nulls not distinct;
create unique index eflow_unique_personal_task_name on public.personal_tasks(project_id,eflow_validation.normalized_work_name(title));
create unique index eflow_unique_personal_subitem_name on public.personal_subtasks(task_id,parent_subtask_id,eflow_validation.normalized_work_name(title)) nulls not distinct;

create function eflow_validation.announcement_dates() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.expires_at is not null and (tg_op='INSERT' or new.expires_at is distinct from old.expires_at or new.published_at is distinct from old.published_at or (new.status='published' and old.status is distinct from 'published')) then
  if not isfinite(new.expires_at) or new.expires_at<=clock_timestamp() or (new.status='published' and new.published_at is not null and new.expires_at<=new.published_at) then raise exception 'Expiration date cannot be in the past or before publication.' using errcode='22023';end if;
 end if;
 return new;
end $$;
create trigger eflow_validate_announcement_dates before insert or update on public.announcements for each row execute function eflow_validation.announcement_dates();

create function eflow_validation.recurring_template() returns trigger language plpgsql security definer set search_path='' as $$
declare item jsonb; repeat_value numeric;
begin
 repeat_value:=(new.recurrence_rule->>'interval')::numeric;
 if not eflow_validation.valid_decimal(repeat_value,1,365,0) or (new.recurrence_rule->>'frequency') not in ('daily','weekly','monthly') or new.recurrence_rule->>'frequency' is null then raise exception 'Repeat interval must be a whole number from 1 to 365 with a valid frequency.' using errcode='22023';end if;
 if nullif(btrim(new.title),'') is null or char_length(new.title)>200 or char_length(new.description)>20000 then raise exception 'Template title is required (up to 200 characters); description allows 20,000.' using errcode='22023';end if;
 if jsonb_typeof(new.acceptance_criteria) is distinct from 'array' or jsonb_array_length(new.acceptance_criteria)>100 then raise exception 'Use up to 100 acceptance criteria.' using errcode='22023';end if;
 for item in select value from jsonb_array_elements(new.acceptance_criteria) loop
  if jsonb_typeof(item)<>'string' or char_length(btrim(item#>>'{}')) not between 1 and 1000 then raise exception 'Each criterion must contain 1 to 1,000 characters.' using errcode='22023';end if;
 end loop;
 if new.assignee_id is not null and new.assignee_id=new.reviewer_id then raise exception 'The task owner cannot also review recurring work.' using errcode='22023';end if;
 if tg_op='INSERT' and (new.next_run_at is null or not isfinite(new.next_run_at) or new.next_run_at<=clock_timestamp()) then raise exception 'Choose a first run in the future.' using errcode='22023';end if;
 return new;
end $$;
create trigger eflow_validate_recurring_template before insert or update of title,description,acceptance_criteria,recurrence_rule,assignee_id,reviewer_id on public.task_templates for each row execute function eflow_validation.recurring_template();

create function eflow_validation.assert_budget_lines(lines jsonb) returns void language plpgsql set search_path='' as $$
declare item jsonb;q numeric;cost numeric;total numeric;
begin
 if jsonb_typeof(lines) is distinct from 'array' then raise exception 'Budget lines must be an array.' using errcode='22023';end if;
 for item in select value from jsonb_array_elements(lines) loop
  q:=case when item?'quantity' then (item->>'quantity')::numeric else 1 end;
  cost:=case when item?'unitCost' then (item->>'unitCost')::numeric else (item->>'amount')::numeric end;
  if not eflow_validation.valid_decimal(q,.01,90071992547409,2) or not eflow_validation.valid_decimal(cost,.01,9999999999,2) then raise exception 'Budget quantity and unit cost must be positive, finite and within their limits, with up to two decimal places.' using errcode='22023';end if;
  total:=round(q*cost,2);
  if not eflow_validation.valid_decimal(total,.01,9999999999,2) then raise exception 'Computed budget line total exceeds its allowed amount.' using errcode='22023';end if;
  if item?'amount' and not eflow_validation.valid_decimal((item->>'amount')::numeric,.01,9999999999,2) then raise exception 'Budget line amount must be a positive amount with at most two decimal places.' using errcode='22023';end if;
 end loop;
end $$;
create function eflow_validation.proposal_budget() returns trigger language plpgsql security definer set search_path='' as $$
declare snapshot jsonb;item jsonb;
begin
 if new.status='committed' and old.status is distinct from 'committed' then
  select r.snapshot into snapshot from public.proposal_collaboration_revisions r where r.id=new.current_revision_id and r.draft_id=new.id;
  if snapshot->'budget'->'lines' is not null then perform eflow_validation.assert_budget_lines(snapshot->'budget'->'lines');end if;
  for item in select value from jsonb_array_elements(coalesce(snapshot->'budget'->'taskBudgets','[]')) loop
   if item->>'decision'='funded' then perform eflow_validation.assert_budget_lines(item->'lines');end if;
  end loop;
 end if;
 return new;
end $$;
create trigger aaa_validate_proposal_budget before update of status on public.proposal_collaboration_drafts for each row execute function eflow_validation.proposal_budget();

alter table public.managed_account_invite_details add column retention_purged_at timestamptz;
create function eflow_activation.purge_abandoned_details() returns integer language plpgsql security definer set search_path='' as $$
declare invitation public.user_invitations; changed integer:=0;
begin
 for invitation in select i.* from public.user_invitations i join public.managed_account_invite_details d on d.invitation_id=i.id
  where i.invitation_type='managed_account' and d.retention_purged_at is null and d.reconciliation_claim is null
   and i.acceptance_claim is null and i.accepted_by is null
   and ((i.status='revoked' and i.revoked_at<now()-interval '90 days') or (i.status in ('pending','expired') and i.expires_at<now()-interval '90 days'))
  order by i.id for update of i skip locked
 loop
  update public.user_invitations set status=case when status='pending' then 'expired' else status end where id=invitation.id;
  update public.managed_account_invite_details set full_name='Removed after retention',skills='{}',employee_notes=null,request_payload='{}',retention_purged_at=clock_timestamp()
   where invitation_id=invitation.id and retention_purged_at is null;
  perform eflow_activation.audit(null,invitation,'account.activation_details_purged');changed:=changed+1;
 end loop;
 delete from eflow_activation.request_limits where window_start<now()-interval '1 day';
 return changed;
end $$;
revoke all on function eflow_activation.purge_abandoned_details() from public,anon,authenticated;
grant execute on function eflow_activation.purge_abandoned_details() to service_role;
revoke all on all functions in schema eflow_validation from public,anon,authenticated;
grant execute on function eflow_validation.normalized_work_name(text) to authenticated,service_role;
-- The daily scheduler below uses the same reviewed retention function.

CREATE OR REPLACE FUNCTION public.set_proposal_governance_configuration(p_draft_id uuid, p_organizations jsonb, p_assignments jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  caller uuid := auth.uid();
  draft_row public.proposal_collaboration_drafts;
  item jsonb;
  target_org uuid;
  target_user uuid;
  target_role text;
begin
  if not public.can_manage_collaboration_draft(p_draft_id, caller) then
    raise exception 'Only the owning organization may configure proposal governance' using errcode = '42501';
  end if;
  select * into draft_row from public.proposal_collaboration_drafts where id = p_draft_id for update;
  if draft_row.status in ('committed', 'archived', 'deleted') then
    raise exception 'Governance configuration is locked after publication' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(p_organizations, '[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_assignments, '[]'::jsonb)) <> 'array' then
    raise exception 'Governance configuration must be arrays' using errcode = '22023';
  end if;

  for item in select value from jsonb_array_elements(p_organizations) loop
    if not eflow_validation.valid_decimal(coalesce((item->>'reviewDeadlineDays')::numeric,5),1,90,0)
       or not eflow_validation.valid_decimal(coalesce((item->>'quorumCount')::numeric,1),1,2147483647,0)
       or not eflow_validation.valid_decimal(coalesce((item->>'sequence')::numeric,1),1,2147483647,0) then
      raise exception 'Review deadline must be a whole number from 1 to 90; quorum and sequence must be positive whole numbers.' using errcode='22023';
    end if;
    target_org := nullif(item ->> 'orgId', '')::uuid;
    if target_org is null or not exists (
      select 1 from public.proposal_collaboration_orgs participant
      where participant.draft_id = p_draft_id and participant.org_id = target_org
    ) then raise exception 'Governance organization is not part of this proposal' using errcode = '22023'; end if;
    update public.proposal_collaboration_orgs set
      approval_policy = case when item ->> 'approvalPolicy' in ('one_of', 'all', 'quorum') then item ->> 'approvalPolicy' else 'one_of' end,
      quorum_count = greatest(1, coalesce(nullif(item ->> 'quorumCount', '')::int, 1)),
      approval_sequence = greatest(1, coalesce(nullif(item ->> 'sequence', '')::int, 1)),
      review_deadline_days = greatest(1, least(90, coalesce(nullif(item ->> 'reviewDeadlineDays', '')::int, 5)))
    where draft_id = p_draft_id and org_id = target_org;
  end loop;

  delete from public.proposal_governance_assignments where draft_id = p_draft_id;
  for item in select value from jsonb_array_elements(p_assignments) loop
    target_org := nullif(item ->> 'organizationId', '')::uuid;
    target_user := nullif(item ->> 'userId', '')::uuid;
    target_role := item ->> 'role';
    if target_role not in ('primary_approver', 'backup_approver', 'liaison', 'technical_reviewer', 'observer') then
      raise exception 'Invalid governance assignment role' using errcode = '22023';
    end if;
    if not exists (
      select 1 from public.proposal_collaboration_orgs participant
      where participant.draft_id = p_draft_id and participant.org_id = target_org
    ) or not exists (
      select 1 from public.profiles profile
      where profile.id = target_user and profile.is_active
        and (profile.org_id = target_org or public.is_organization_member(target_org, profile.id))
    ) then raise exception 'Governance assignee must be an active member of the selected organization' using errcode = '22023'; end if;
    insert into public.proposal_governance_assignments (
      draft_id, organization_id, user_id, assignment_role, assigned_by
    ) values (p_draft_id, target_org, target_user, target_role, caller);
  end loop;

  insert into public.audit_events (actor_id, actor_name, entity_type, entity_id, action, after_data, org_id)
  values (caller, coalesce((select full_name from public.profiles where id = caller), 'Owner'),
    'collaboration_draft', p_draft_id::text, 'governance.configuration_updated',
    jsonb_build_object('organizationCount', jsonb_array_length(p_organizations), 'assignmentCount', jsonb_array_length(p_assignments)),
    draft_row.owner_org_id);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.eflow_manage_managed_activation(p_actor uuid, p_id uuid, p_action text, p_hash text DEFAULT NULL::text, p_ttl integer DEFAULT 24)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare i public.user_invitations; d public.managed_account_invite_details; prior_claim text;
begin
 perform eflow_activation.require_admin(p_actor);
 perform pg_advisory_xact_lock(hashtextextended('eflow.activation.actor:'||p_actor::text,0));
 select * into i from public.user_invitations where id=p_id and invitation_type='managed_account';
 i:=eflow_activation.lock_invite(i.token_hash);
 perform eflow_activation.require_admin(p_actor,i.office_id);
 if p_action='approve' then
  select * into d from public.managed_account_invite_details where invitation_id=i.id for update;
  if i.status<>'accepted' or d.requested_privileged_role is null then raise exception 'Verify the email before approving this account.' using errcode='22023';end if;
  if d.approved_at is not null then return eflow_activation.safe_row(i);end if;
  perform 1 from public.profiles where id=i.accepted_by and not is_active and role='member' and org_id=i.office_id for update;
  if not found then raise exception 'This account changed. Review it before approval.' using errcode='22023';end if;
  if d.requested_privileged_role='head' then
   perform pg_advisory_xact_lock(hashtextextended('eflow.office_leadership',0));
   perform 1 from public.organizations where id=i.office_id and head_user_id is null for update;
   if not found then raise exception 'This office already has a Head. Review its leadership first.' using errcode='22023';end if;
   update public.profiles set is_active=true where id=i.accepted_by;
   prior_claim:=current_setting('request.jwt.claim.sub',true);
   perform set_config('request.jwt.claim.sub',p_actor::text,true);
   perform public.set_organization_leadership(i.office_id,i.accepted_by,null);
   perform set_config('request.jwt.claim.sub',coalesce(prior_claim,''),true);
  else update public.profiles set role='admin',is_active=true where id=i.accepted_by;end if;
  update public.managed_account_invite_details set approved_by=p_actor,approved_at=now() where invitation_id=i.id;
 elsif p_action='revoke' then
  if i.status='accepted' then raise exception 'This account is activated. Use account deactivation instead.' using errcode='22023';end if;
  update public.user_invitations set status='revoked',revoked_at=coalesce(revoked_at,now()),acceptance_claim=null,acceptance_claimed_at=null where id=i.id returning * into i;
 elsif p_action='resend' then
  if not exists(select 1 from public.profiles where id=i.invited_by and role='admin' and is_active)
   or exists(select 1 from public.managed_account_invite_details where invitation_id=i.id and retention_purged_at is not null) then
   raise exception 'Revoke this invitation and create a new one. Its original authority or retained details are no longer available.' using errcode='22023';end if;
  if i.status not in ('pending','expired') then raise exception 'This invitation can no longer be resent.' using errcode='22023';end if;
  if i.acceptance_claimed_at>now()-interval '5 minutes' then raise exception 'Activation is in progress. Please wait.' using errcode='54000';end if;
  if i.send_count>=6 or i.last_sent_at>now()-interval '1 minute' then raise exception 'Please wait before resending.' using errcode='54000';end if;
  if p_ttl not between 1 and 168 then raise exception 'Invalid expiry.';end if;
  update public.user_invitations set token_hash=p_hash,expires_at=now()+make_interval(hours=>p_ttl),status='pending',acceptance_claim=null,acceptance_claimed_at=null,email_delivery_status='queued',updated_at=now() where id=i.id returning * into i;
 else raise exception 'Invalid activation action.' using errcode='22023';end if;
 perform eflow_activation.audit(p_actor,i,'account.activation_'||p_action);
 return eflow_activation.safe_row(i)||case when p_action='resend' then jsonb_build_object('token_hash',i.token_hash) else '{}'::jsonb end;
end $function$
;

CREATE OR REPLACE FUNCTION eflow_activation.safe_row(i user_invitations)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select jsonb_build_object('invitation_id',i.id,'email',i.email,'full_name',d.full_name,'office_id',i.office_id,'office_name',o.name,
 'account_role',i.account_role,'requested_privileged_role',d.requested_privileged_role,'source_mode',d.source_mode,
 'status',case when i.status='pending' and i.expires_at<=now() then 'expired' else i.status end,
 'email_delivery_status',i.email_delivery_status,'expires_at',i.expires_at,'created_at',i.created_at,'last_sent_at',i.last_sent_at,
 'requires_reinvite',d.retention_purged_at is not null or not exists(select 1 from public.profiles p where p.id=i.invited_by and p.role='admin' and p.is_active),
 'needs_reconciliation',d.reconciliation_claim is not null,
 'awaiting_authority',i.status='accepted' and d.requested_privileged_role is not null and d.approved_at is null)
 from public.managed_account_invite_details d join public.organizations o on o.id=i.office_id where d.invitation_id=i.id;
$function$
;

do $schedule$
begin
 if exists(select 1 from pg_available_extensions where name='pg_cron') then
  create extension if not exists pg_cron with schema pg_catalog;
  perform cron.schedule('eflow-managed-activation-retention','15 18 * * *','select eflow_activation.purge_abandoned_details()');
 end if;
end $schedule$;

CREATE OR REPLACE FUNCTION eflow_budget.submit_items(p_request uuid, p_spent numeric, p_note text, p_receipts jsonb, p_key uuid, p_refund_number text, p_refund_date date)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r public.petty_cash_requests;li public.petty_cash_liquidations;rc jsonb;item jsonb;receipt_id uuid;source public.work_budget_allocation_lines;
  s public.office_budget_sections;total numeric;receipt_total numeric:=0;item_total numeric;pos integer;amt numeric;quantity numeric;payload jsonb;paths text[]:='{}';authorized record;
begin /* NW5.2 shared writer lock */ perform eflow_r7.lock_impact((select task_id from public.petty_cash_requests where id=p_request));
  select * into r from public.petty_cash_requests where id=p_request for update;
  if r.id is null or auth.uid() is null or (r.requester_id<>auth.uid() and r.cash_recipient_id<>auth.uid())
    or not exists(select 1 from public.profiles where id=auth.uid() and is_active and role not in ('admin','super_admin','viewer')) then raise exception 'Only the active cash recipient can submit purchased items' using errcode='42501';end if;
  if p_key is null then raise exception 'A liquidation idempotency key is required' using errcode='22023';end if;
  payload:=jsonb_build_object('spent',p_spent,'note',p_note,'receipts',p_receipts,'refundNumber',p_refund_number,'refundDate',p_refund_date);
  select * into li from public.petty_cash_liquidations where request_id=r.id and idempotency_key=p_key;
  if li.id is not null then
    if li.itemized_payload is distinct from payload then raise exception 'Liquidation key belongs to different receipt items' using errcode='22023';end if;return li.id;
  end if;
  if p_receipts is null or jsonb_typeof(p_receipts)<>'array' or jsonb_array_length(p_receipts) not between 1 and 100 or not eflow_budget.valid_money(p_spent,true) then raise exception 'Use a valid itemized receipt package' using errcode='22023';end if;
  for rc in select value from jsonb_array_elements(p_receipts) loop
    if not eflow_budget.valid_money((rc->>'amount')::numeric,true) or nullif(btrim(rc->>'filePath'),'') is null or (rc->>'filePath')=any(paths)
       or rc->'items' is null or jsonb_typeof(rc->'items')<>'array' or jsonb_array_length(rc->'items')>100 then raise exception 'Each receipt needs one unique evidence path and valid purchased items' using errcode='22023';end if;
    if left(rc->>'filePath',length(r.org_id::text||'/'||r.id::text||'/'))<>r.org_id::text||'/'||r.id::text||'/'
      or not exists(select 1 from storage.objects o where o.bucket_id='budget-receipts' and o.name=rc->>'filePath' and o.owner_id=auth.uid()::text) then
      raise exception 'Receipt evidence must be an uploaded file owned by this recipient in this cash request' using errcode='42501';end if;
    paths:=array_append(paths,rc->>'filePath');total:=0;
    for item in select value from jsonb_array_elements(rc->'items') loop
      amt:=(item->>'amount')::numeric;quantity:=(item->>'quantity')::numeric;
      if not eflow_budget.valid_money(amt) or quantity is null or quantity::text in ('NaN','Infinity','-Infinity') or quantity<=0 or quantity>9007199254740 or quantity<>round(quantity,3)
        or nullif(btrim(item->>'unit'),'') is null or nullif(btrim(item->>'particular'),'') is null or nullif(btrim(item->>'purpose'),'') is null then raise exception 'Each item needs quantity, unit, particulars, purpose and a positive line amount' using errcode='22023';end if;
      if not exists(select 1 from public.petty_cash_request_lines where request_id=r.id and allocation_line_id=(item->>'allocationLineId')::uuid) then raise exception 'Purchased item uses an unauthorized funding account' using errcode='42501';end if;
      total:=total+amt;
    end loop;
    if total is distinct from (rc->>'amount')::numeric then raise exception 'Item totals must equal each receipt total' using errcode='22023';end if;
    receipt_total:=receipt_total+total;
  end loop;
  if receipt_total is distinct from p_spent then raise exception 'Receipt totals must equal declared spending exactly' using errcode='22023';end if;
  for authorized in select * from eflow_budget.authorized_cash_lines(r.id) loop
    select coalesce(sum((it.value->>'amount')::numeric),0) into item_total from jsonb_array_elements(p_receipts) rc,
      lateral jsonb_array_elements(rc.value->'items') it where (it.value->>'allocationLineId')::uuid=authorized.allocation_line_id;
    if item_total>authorized.amount then raise exception 'Spending exceeds this account authorization; obtain reauthorization first' using errcode='22023';end if;
  end loop;
  -- The established command preserves release acknowledgment, receipt limits,
  -- refund, evidence guards, reviewer routing and immutable receipt history.
  li.id:=public.submit_accounting_cash_liquidation(p_request,p_spent,p_note,p_receipts,p_key,p_refund_number,p_refund_date);
  for rc in select value from jsonb_array_elements(p_receipts) loop
    select id into strict receipt_id from public.petty_cash_receipts where liquidation_id=li.id and file_path=rc->>'filePath';
    pos:=0;
    for item in select value from jsonb_array_elements(rc->'items') loop
      select * into source from public.work_budget_allocation_lines where id=(item->>'allocationLineId')::uuid;
      select * into s from public.office_budget_sections where id=source.budget_partition_id;
      insert into public.petty_cash_receipt_items(receipt_id,allocation_line_id,quantity,unit,particular,purpose,amount,position,account_name,account_label)
      values(receipt_id,source.id,(item->>'quantity')::numeric,btrim(item->>'unit'),btrim(item->>'particular'),btrim(item->>'purpose'),(item->>'amount')::numeric,pos,coalesce(s.name,source.category),s.account_code);
      pos:=pos+1;
    end loop;
  end loop;
  update public.petty_cash_liquidations set itemized_payload=payload where id=li.id;
  return li.id;
end $function$
;

CREATE OR REPLACE FUNCTION public.submit_task_progress(p_task_id uuid, p_percent_complete integer DEFAULT NULL::integer, p_blocker_category text DEFAULT NULL::text, p_blocker text DEFAULT NULL::text, p_next_step text DEFAULT NULL::text, p_note text DEFAULT NULL::text, p_attachment_path text DEFAULT NULL::text, p_attachment_name text DEFAULT NULL::text)
 RETURNS task_progress_updates
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  caller uuid := auth.uid();
  caller_name text;
  t public.tasks;
  progress public.task_progress_updates;
begin
  if caller is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if p_percent_complete is not null
     and (p_percent_complete < 0 or p_percent_complete > 99) then
    raise exception 'Progress must be a whole number from 0 to 99; completion requires approval'
      using errcode = '22023';
  end if;

  select full_name
    into caller_name
  from public.profiles
  where id = caller;

  select *
    into t
  from public.tasks
  where id = p_task_id
    and deleted_at is null
  for update;
  if not found then raise exception 'Task not found'; end if;

  if t.archived_at is not null then
    raise exception 'Archived tasks cannot receive progress'
      using errcode = '22023';
  end if;
  if not public.can_contribute_task(t.id, caller) then
    raise exception 'Only a task participant may post progress'
      using errcode = '42501';
  end if;
  if t.status not in ('todo', 'in_progress') then
    raise exception 'Resume or reopen this task before posting progress'
      using errcode = '22023';
  end if;

  if t.status = 'todo' and coalesce(p_percent_complete, 0) > 0 then
    perform public.transition_task_status(
      p_task_id,
      'in_progress',
      null,
      'Work started with a progress update'
    );
  end if;

  insert into public.task_progress_updates (
    task_id,
    author_id,
    author_name,
    percent_complete,
    blocker_category,
    blocker,
    next_step,
    note,
    attachment_path,
    attachment_name
  )
  values (
    p_task_id,
    caller,
    coalesce(caller_name, 'User'),
    p_percent_complete,
    nullif(btrim(p_blocker_category), ''),
    nullif(btrim(p_blocker), ''),
    nullif(btrim(p_next_step), ''),
    nullif(btrim(p_note), ''),
    p_attachment_path,
    p_attachment_name
  )
  returning * into progress;

  update public.tasks
  set
    percent_complete = coalesce(p_percent_complete, percent_complete),
    last_activity_at = now()
  where id = p_task_id;

  insert into public.audit_events (
    actor_id,
    actor_name,
    entity_type,
    entity_id,
    action,
    after_data,
    metadata,
    org_id
  )
  values (
    caller,
    coalesce(caller_name, 'User'),
    'task',
    p_task_id::text,
    'progress.updated',
    jsonb_build_object(
      'percentComplete',
      p_percent_complete,
      'blocker',
      nullif(btrim(p_blocker), '')
    ),
    jsonb_build_object('progressId', progress.id),
    t.org_id
  );

  return progress;
end;
$function$
;

