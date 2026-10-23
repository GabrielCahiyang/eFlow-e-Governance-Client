-- Exact reviewed functions from captured live definitions; no historical push.
begin;
revoke all on function public.schedule_petty_cash_releases(uuid,uuid) from public,anon,authenticated;
grant execute on function public.schedule_petty_cash_releases(uuid,uuid) to service_role;
CREATE OR REPLACE FUNCTION public.run_department_budget_maintenance()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare changed int := 0; expired_count int := 0; caller uuid:=auth.uid(); caller_profile public.profiles;
begin
  if caller is null then
    if current_setting('role',true)='service_role' or (session_user in ('postgres','supabase_admin') and coalesce(current_setting('role',true),'none') not in ('anon','authenticated')) then null;
    else raise exception 'Sign in before budget maintenance' using errcode='42501';end if;
  else
    select * into caller_profile from public.profiles where id=caller and is_active for share;
    if not found then raise exception 'Current work access required' using errcode='42501';end if;
  end if;
  with expired as (
    update public.petty_cash_requests request
    set status = 'expired', updated_at = now()
    where (caller is null or caller_profile.role='admin' or request.org_id=caller_profile.org_id) and request.status in (
      'pending', 'pending_leader_review', 'leader_changes_requested',
      'pending_department_approval', 'department_changes_requested'
    )
      and request.reservation_expires_at is not null
      and request.reservation_expires_at < now()
    returning request.*
  ), notified as (
    insert into public.notifications(user_id, type, title, message, task_id, financial_record_id, financial_record_type)
    select expired.requester_id, 'petty_cash_request_expired', 'Cash-request reservation expired',
      'The temporary reservation expired. Submit a new request if the purchase is still needed.',
      expired.task_id, expired.id, 'petty_cash_request' from expired
    returning 1
  ) select count(*) into expired_count from notified;

  with overdue as (
    update public.petty_cash_requests request set status = 'overdue_liquidation', updated_at = now()
    where (caller is null or caller_profile.role='admin' or request.org_id=caller_profile.org_id) and request.status in ('released', 'changes_requested')
      and request.liquidation_due_at < now()
    returning request.*
  ), notified as (
    insert into public.notifications(user_id, type, title, message, task_id, financial_record_id, financial_record_type)
    select overdue.cash_recipient_id, 'petty_cash_liquidation_overdue', 'Cash liquidation is overdue',
      'Submit the required receipts and return any unused cash immediately.', overdue.task_id, overdue.id, 'petty_cash_request'
    from overdue returning 1
  ) select count(*) into changed from notified;
  return changed + expired_count;
end;
$function$
;
revoke all on function public.run_department_budget_maintenance() from public,anon;
grant execute on function public.run_department_budget_maintenance() to authenticated,service_role;
CREATE OR REPLACE FUNCTION public.create_org_chat_channel()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  INSERT INTO public.chat_channels (channel_type, org_id, name)
  VALUES ('org', NEW.id, NEW.name || ' Chat')
  ON CONFLICT (org_id) WHERE org_id IS NOT NULL DO NOTHING; -- ✓ Fixed conflict target
  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.sync_task_subtask_counts()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE affected_task_id UUID;
BEGIN
  affected_task_id := COALESCE(NEW.task_id, OLD.task_id);
  UPDATE public.tasks SET
    subtask_count = (SELECT COUNT(*) FROM public.subtasks WHERE task_id = affected_task_id),
    subtask_completed_count = (SELECT COUNT(*) FROM public.subtasks WHERE task_id = affected_task_id AND is_completed)
  WHERE id = affected_task_id;
  RETURN COALESCE(NEW, OLD);
END;
$function$
;
alter function public.create_org_chat_channel() set search_path='';
alter function public.prevent_self_privilege_escalation() set search_path='';
alter function public.update_updated_at() set search_path='';
alter function public.sync_task_subtask_counts() set search_path='';
alter function public.set_user_preferences_updated_at() set search_path='';
alter function public.touch_updated_at() set search_path='';
alter function public.collaboration_storage_draft_id(object_name text) set search_path='';
alter function public.is_channel_member(p_channel uuid, caller uuid) set search_path='';
alter function public.ensure_org_chat_channel() set search_path='';
commit;
