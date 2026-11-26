-- Upgrade eflow_seal.dossier(p_id) so every sealed project archive and public
-- transparency record (EflowPublic & EflowWeb preview) contains the complete,
-- verified operational, financial, petty cash, supplemental funding, budget return,
-- activity, field history, ledger, journal, and audit trail dataset.

CREATE OR REPLACE FUNCTION eflow_seal.dossier(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  result jsonb;
  ids text;
  requests text;
  allocations text;
  liquidations text;
  assignments text;
  office_cash_ids text;
  funding_req_ids text;
  commitment_ids text;
  journal_ids text;
  entities text;
  v_closeout jsonb;
BEGIN
  ids := format('select id from public.tasks where linked_project_id=%L::uuid', p_id);
  requests := 'select id from public.petty_cash_requests where task_id in (' || ids || ')';
  allocations := 'select id from public.work_budget_allocations where task_id in (' || ids || ')';
  liquidations := 'select id from public.petty_cash_liquidations where request_id in (' || requests || ')';
  assignments := 'select id from public.work_cash_assignments where task_id in (' || ids || ')';
  office_cash_ids := 'select distinct office_cash_request_id from public.work_cash_assignments where task_id in (' || ids || ') and office_cash_request_id is not null';
  funding_req_ids := format('select id from eflow_project.funding_requests where project_id=%L::uuid', p_id);
  commitment_ids := format('select distinct commitment_id from eflow_project.funding where project_id=%L::uuid and commitment_id is not null', p_id);

  journal_ids :=
    'select id from public.general_journal_entries where source_id::text in ('
    || 'select id::text from public.petty_cash_requests where task_id in (' || ids || ')'
    || ' union select id::text from public.petty_cash_liquidations where request_id in (' || requests || ')'
    || ' union select id::text from public.petty_cash_releases where request_id in (' || requests || ')'
    || ' union select id::text from public.work_cash_assignments where task_id in (' || ids || ')'
    || ' union select office_cash_request_id::text from public.work_cash_assignments where task_id in (' || ids || ') and office_cash_request_id is not null'
    || ')';
  journal_ids :=
    'with recursive related(id) as ((' || journal_ids || ') union select j.id from public.general_journal_entries j join related r on j.source_id=r.id) select id from related';

  entities := format(
    'select %L::text as id'
    || ' union select id::text from public.tasks where linked_project_id=%L::uuid'
    || ' union select id::text from public.subtasks where task_id in (%s)'
    || ' union select id::text from public.petty_cash_requests where id in (%s)'
    || ' union select id::text from public.petty_cash_liquidations where id in (%s)'
    || ' union select id::text from public.petty_cash_releases where request_id in (%s)'
    || ' union select id::text from public.work_budget_allocations where id in (%s)'
    || ' union select id::text from public.work_cash_assignments where id in (%s)'
    || ' union select office_cash_request_id::text from public.work_cash_assignments where task_id in (%s) and office_cash_request_id is not null'
    || ' union select id::text from eflow_project.funding_requests where project_id=%L::uuid'
    || ' union select id::text from public.milestones where project_id=%L::uuid',
    p_id::text, p_id, ids, requests, liquidations, requests, allocations, assignments, ids, p_id, p_id
  );

  SELECT jsonb_build_object(
    'schema_version', 1,
    'project', (to_jsonb(p) - ARRAY['archive_reminded_at', 'archive_blocked_at']) || jsonb_build_object(
      'project_lead_name', COALESCE(lead_u.full_name, ''),
      'owner_name', COALESCE(owner_u.full_name, ''),
      'created_by_name', COALESCE(creator_u.full_name, '')
    ),
    'office', jsonb_build_object('id', o.id, 'name', o.name)
  )
  INTO result
  FROM public.projects p
  JOIN public.organizations o ON o.id = p.org_id
  LEFT JOIN public.profiles lead_u ON lead_u.id = p.project_lead_id
  LEFT JOIN public.profiles owner_u ON owner_u.id = p.owner_id
  LEFT JOIN public.profiles creator_u ON creator_u.id = p.created_by
  WHERE p.id = p_id;

  IF result IS NULL THEN
    RAISE EXCEPTION 'Project not found.' USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(p.financial_closeout_snapshot, eflow_project.financial_closeout_summary(p.id))
  INTO v_closeout
  FROM public.projects p
  WHERE p.id = p_id;

  RETURN eflow_seal.public_fields(
    result || jsonb_build_object(
      'financial_closeout', COALESCE(v_closeout, '{}'::jsonb),
      'groups', eflow_seal.rows(format('select * from public.project_groups where project_id=%L::uuid', p_id)),
      'members', eflow_seal.rows(format(
        'select m.user_id,m.role,u.full_name from public.project_members m left join public.profiles u on u.id=m.user_id where m.project_id=%L::uuid',
        p_id
      )),
      'project_guests', eflow_seal.rows(format(
        'select m.user_id,m.office_id,m.engagement,m.access_end,m.until_close,m.ended_at,u.full_name from public.project_guest_members m left join public.profiles u on u.id=m.user_id where m.project_id=%L::uuid',
        p_id
      )),
      'offices', eflow_seal.rows(format(
        'select po.*, org.name as office_name from public.project_offices po left join public.organizations org on org.id=po.office_id where po.project_id=%L::uuid',
        p_id
      )),
      'participating_offices', eflow_seal.rows(format(
        'select po.*, org.name as office_name from public.project_organizations po left join public.organizations org on org.id=po.organization_id where po.project_id=%L::uuid',
        p_id
      )),
      'office_work', eflow_seal.rows(format('select * from public.project_office_work where project_id=%L::uuid', p_id)),
      'office_people', eflow_seal.rows(format('select * from public.project_office_people where project_id=%L::uuid', p_id)),
      'office_identities', eflow_seal.rows(format(
        'select id,display_name,canonical_office_id,relationship_type,contact_status from public.project_office_identities where project_id=%L::uuid',
        p_id
      )),
      'office_members', eflow_seal.rows(format(
        'select m.*,u.full_name from public.project_office_members m join public.project_offices o on o.id=m.project_office_id left join public.profiles u on u.id=m.user_id where o.project_id=%L::uuid',
        p_id
      )),
      'milestones', eflow_seal.rows(format('select * from public.milestones where project_id=%L::uuid', p_id)),
      'milestone_offices', eflow_seal.rows(format(
        'select o.*, org.name as office_name from public.milestone_organizations o join public.milestones m on m.id=o.milestone_id left join public.organizations org on org.id=o.organization_id where m.project_id=%L::uuid',
        p_id
      )),
      'tasks', eflow_seal.rows(
        'select t.id,t.title,t.description,t.status,t.priority,t.percent_complete,t.assigned_to,t.assignee_name,'
        || 't.team_member_ids,t.team_member_names,t.deadline,t.due_date,t.start_date,t.dependency_ids,t.group_id,'
        || 't.workspace_position,t.reviewer_id,rev.full_name as reviewer_name,t.backup_reviewer_id,'
        || 't.acceptance_criteria,t.definition_of_done,t.budget_impact,t.cancellation_reason,t.cancelled_at,'
        || 't.created_at,t.updated_at,t.deleted_at,'
        || 'round(coalesce((select sum(a.amount) from public.work_budget_allocations a where a.task_id=t.id and a.subtask_id is null and a.status=''approved''),0),2) as allocated_amount,'
        || 'round(coalesce((select sum(r.actual_spent) from public.petty_cash_requests r where r.task_id=t.id and r.status=''settled''),0),2) as actual_spent,'
        || 'round(coalesce((select sum(rc.amount) from public.work_cash_assignment_receipts rc join public.work_cash_assignments w on w.id=rc.assignment_id where w.task_id=t.id and w.source_kind=''office_petty_cash'' and w.status=''active'' and w.receipt_review_status=''approved'' and rc.deleted_at is null),0),2) as office_petty_cash_spent'
        || ' from public.tasks t left join public.profiles rev on rev.id=t.reviewer_id where t.id in (' || ids || ')'
      ),
      'subtasks', eflow_seal.rows(
        'select s.*, t.title as task_title,'
        || 'coalesce(lead_u.full_name, ass_u.full_name) as assignee_name,'
        || 'comp_u.full_name as completed_by_name,'
        || 'round(coalesce((select sum(a.amount) from public.work_budget_allocations a where a.subtask_id=s.id and a.status=''approved''),0),2) as budget_cap,'
        || 'round(coalesce((select sum(r.actual_spent) from public.petty_cash_requests r where r.subtask_id=s.id and r.status=''settled''),0),2) as actual_spent,'
        || 'round(coalesce((select sum(rc.amount) from public.work_cash_assignment_receipts rc join public.work_cash_assignments w on w.id=rc.assignment_id where w.subtask_id=s.id and w.source_kind=''office_petty_cash'' and w.status=''active'' and w.receipt_review_status=''approved'' and rc.deleted_at is null),0),2) as office_petty_cash_spent'
        || ' from public.subtasks s'
        || ' join public.tasks t on t.id=s.task_id'
        || ' left join public.profiles lead_u on lead_u.id=s.lead_id'
        || ' left join public.profiles ass_u on ass_u.id=s.assigned_to'
        || ' left join public.profiles comp_u on comp_u.id=s.completed_by'
        || ' where s.task_id in (' || ids || ')'
      ),
      'task_submissions', eflow_seal.rows('select * from public.task_submissions where task_id in (' || ids || ')'),
      'subtask_submissions', eflow_seal.rows('select * from public.subtask_submissions where task_id in (' || ids || ')'),
      'task_updates', eflow_seal.rows('select * from public.task_progress_updates where task_id in (' || ids || ')'),
      'subtask_updates', eflow_seal.rows('select * from public.subtask_progress_updates where task_id in (' || ids || ')'),
      'status_history', eflow_seal.rows(
        'select h.*, t.title as task_title from public.task_status_history h join public.tasks t on t.id=h.task_id where h.task_id in (' || ids || ')'
      ),
      'task_activities', eflow_seal.rows(
        'select ta.*, t.title as task_title from public.task_activities ta join public.tasks t on t.id=ta.task_id where ta.task_id in (' || ids || ')'
      ),
      'project_field_history', eflow_seal.rows(format(
        'select fh.*, t.title as task_title from public.project_field_history fh left join public.tasks t on t.id=fh.task_id where fh.project_id=%L::uuid',
        p_id
      )),
      'comments', eflow_seal.rows(
        'select c.*, t.title as task_title from public.task_comments c join public.tasks t on t.id=c.task_id where c.task_id in (' || ids || ')'
      ),
      'comment_files', eflow_seal.rows('select a.* from public.task_comment_attachments a join public.task_comments c on c.id=a.comment_id where c.task_id in (' || ids || ')'),
      'task_files', eflow_seal.rows('select * from public.task_attachments where task_id in (' || ids || ')'),
      'subtask_files', eflow_seal.rows('select * from public.subtask_submission_attachments where task_id in (' || ids || ')'),
      'library_files', eflow_seal.rows(format('select * from public.project_library_files where project_id=%L::uuid and state=''ready''', p_id)),
      'library_links', eflow_seal.rows(format('select l.* from public.project_library_links l join public.project_library_files f on f.id=l.file_id where f.project_id=%L::uuid and f.state=''ready''', p_id)),
      'funding', COALESCE((
        SELECT jsonb_agg(
          to_jsonb(f) || jsonb_build_object(
            'account_name', COALESCE(s.name, cs->>'name', ''),
            'budget_before_activation', COALESCE((cs->>'budgetBeforeActivation')::numeric, f.amount),
            'supplemental_added', COALESCE((cs->>'supplementalAdded')::numeric, 0),
            'total_certified', COALESCE((cs->>'totalCertified')::numeric, f.amount),
            'actual_spent', COALESCE((cs->>'actualSpent')::numeric, 0),
            'returned_to_office', COALESCE((cs->>'returnedToOfficeBudget')::numeric, 0),
            'unreturned_balance', COALESCE((cs->>'unreturnedBalance')::numeric, 0),
            'last_returned_at', cs->>'lastReturnedAt',
            'last_returned_by_name', COALESCE(cs->>'lastReturnedByName', '')
          )
          ORDER BY f.fiscal_year, f.quarter NULLS FIRST, COALESCE(s.name, ''), f.id
        )
        FROM eflow_project.funding f
        LEFT JOIN public.office_budget_sections s ON s.id = f.partition_id
        LEFT JOIN LATERAL (
          SELECT item AS cs
          FROM jsonb_array_elements(COALESCE(v_closeout->'sources', '[]'::jsonb)) item
          WHERE item->>'sourceId' = f.id::text
          LIMIT 1
        ) matched ON true
        WHERE f.project_id = p_id
      ), '[]'::jsonb),
      'funding_requests', eflow_seal.rows(format(
        'select fr.id,fr.project_id,fr.actor_id,req_u.full_name as actor_name,fr.reason,fr.status,fr.created_at,'
        || 'fr.head_approved_by,head_u.full_name as head_approved_by_name,fr.head_approved_at,fr.head_decision_reason,'
        || 'fr.accounting_decided_by,acc_u.full_name as accounting_decided_by_name,fr.accounting_decided_at,fr.accounting_decision_reason,'
        || '(p.published_at is not null and coalesce(fr.accounting_decided_at, fr.created_at) > p.published_at) as is_supplemental,'
        || 'round(coalesce((select sum((ln->>''amount'')::numeric) from jsonb_array_elements(fr.lines) ln),0),2) as total_amount,'
        || 'coalesce((select jsonb_agg(jsonb_build_object('
        ||   '''partition_id'', ln->>''partitionId'','
        ||   '''account_name'', coalesce(sec.name, ''Office Budget account''),'
        ||   '''fiscal_year'', fb.fiscal_year,'
        ||   '''amount'', (ln->>''amount'')::numeric'
        || ')) from jsonb_array_elements(fr.lines) ln'
        || ' left join public.office_budget_sections sec on sec.id=(ln->>''partitionId'')::uuid'
        || ' left join public.department_fiscal_budgets fb on fb.id=sec.fiscal_budget_id), ''[]''::jsonb) as enriched_lines'
        || ' from eflow_project.funding_requests fr'
        || ' join public.projects p on p.id=fr.project_id'
        || ' left join public.profiles req_u on req_u.id=fr.actor_id'
        || ' left join public.profiles head_u on head_u.id=fr.head_approved_by'
        || ' left join public.profiles acc_u on acc_u.id=fr.accounting_decided_by'
        || ' where fr.project_id=%L::uuid',
        p_id
      )),
      'allocations', eflow_seal.rows(
        'select a.*, t.title as task_title, sub.title as subtask_title, req_u.full_name as requested_by_name, dec_u.full_name as decided_by_name'
        || ' from public.work_budget_allocations a'
        || ' join public.tasks t on t.id=a.task_id'
        || ' left join public.subtasks sub on sub.id=a.subtask_id'
        || ' left join public.profiles req_u on req_u.id=a.requested_by'
        || ' left join public.profiles dec_u on dec_u.id=a.decided_by'
        || ' where a.id in (' || allocations || ')'
      ),
      'allocation_lines', eflow_seal.rows(
        'select l.*, s.name as account_name from public.work_budget_allocation_lines l left join public.office_budget_sections s on s.id=l.budget_partition_id where l.allocation_id in (' || allocations || ')'
      ),
      'cash_requests', eflow_seal.rows(
        'select r.*, t.title as task_title, sub.title as subtask_title,'
        || 'req_u.full_name as requester_name, rec_u.full_name as cash_recipient_name,'
        || 'app_u.full_name as approved_by_name, set_u.full_name as settled_by_name'
        || ' from public.petty_cash_requests r'
        || ' join public.tasks t on t.id=r.task_id'
        || ' left join public.subtasks sub on sub.id=r.subtask_id'
        || ' left join public.profiles req_u on req_u.id=r.requester_id'
        || ' left join public.profiles rec_u on rec_u.id=r.cash_recipient_id'
        || ' left join public.profiles app_u on app_u.id=r.approved_by'
        || ' left join public.profiles set_u on set_u.id=r.settled_by'
        || ' where r.id in (' || requests || ')'
      ),
      'cash_releases', eflow_seal.rows(
        'select rel.*, r.request_number, t.title as task_title,'
        || 'rec_u.full_name as recipient_name, by_u.full_name as released_by_name, ack_u.full_name as acknowledged_by_name'
        || ' from public.petty_cash_releases rel'
        || ' join public.petty_cash_requests r on r.id=rel.request_id'
        || ' join public.tasks t on t.id=r.task_id'
        || ' left join public.profiles rec_u on rec_u.id=rel.recipient_id'
        || ' left join public.profiles by_u on by_u.id=rel.released_by'
        || ' left join public.profiles ack_u on ack_u.id=rel.acknowledged_by'
        || ' where rel.request_id in (' || requests || ')'
      ),
      'liquidations', eflow_seal.rows(
        'select liq.*, r.request_number, t.title as task_title,'
        || 'sub_u.full_name as submitted_by_name, dec_u.full_name as decided_by_name, dept_u.full_name as department_decided_by_name,'
        || 'ret_u.full_name as cash_return_received_by_name, rd.received_at as cash_return_received_at, rd.receive_reference as cash_return_reference'
        || ' from public.petty_cash_liquidations liq'
        || ' join public.petty_cash_requests r on r.id=liq.request_id'
        || ' join public.tasks t on t.id=r.task_id'
        || ' left join eflow_work_clearance.return_decisions rd on rd.liquidation_id=liq.id'
        || ' left join public.profiles sub_u on sub_u.id=liq.submitted_by'
        || ' left join public.profiles dec_u on dec_u.id=liq.decided_by'
        || ' left join public.profiles dept_u on dept_u.id=liq.department_decided_by'
        || ' left join public.profiles ret_u on ret_u.id=rd.received_by'
        || ' where liq.id in (' || liquidations || ')'
      ),
      'receipts', eflow_seal.rows(
        'select rc.*, liq.liquidation_number, r.request_number, t.title as task_title, cu.full_name as created_by_name'
        || ' from public.petty_cash_receipts rc'
        || ' join public.petty_cash_liquidations liq on liq.id=rc.liquidation_id'
        || ' join public.petty_cash_requests r on r.id=liq.request_id'
        || ' join public.tasks t on t.id=r.task_id'
        || ' left join public.profiles cu on cu.id=rc.created_by'
        || ' where rc.liquidation_id in (' || liquidations || ')'
      ),
      'receipt_items', eflow_seal.rows('select i.* from public.petty_cash_receipt_items i join public.petty_cash_receipts r on r.id=i.receipt_id where r.liquidation_id in (' || liquidations || ')'),
      'request_files', eflow_seal.rows('select * from public.petty_cash_request_attachments where request_id in (' || requests || ')'),
      'work_cash_assignments', eflow_seal.rows(
        'select w.*, t.title as task_title, sub.title as subtask_title,'
        || 'ab.full_name as assigned_by_name, sb.full_name as receipt_submitted_by_name, acc.full_name as accounting_decided_by_name,'
        || 'oc.purpose as office_cash_purpose, oc.status as office_cash_status, oc.amount as office_cash_total_amount,'
        || 'oc.spent as office_cash_total_spent, oc.returned_amount as office_cash_returned_amount,'
        || 'oc.refund_receipt_number as office_cash_refund_receipt, oc.cash_return_receive_reference as office_cash_return_reference,'
        || 'oc_u.full_name as office_cash_requester_name,'
        || 'round(coalesce((select sum(rc.amount) from public.work_cash_assignment_receipts rc where rc.assignment_id=w.id and rc.deleted_at is null),0),2) as receipts_total'
        || ' from public.work_cash_assignments w'
        || ' join public.tasks t on t.id=w.task_id'
        || ' left join public.subtasks sub on sub.id=w.subtask_id'
        || ' left join public.profiles ab on ab.id=w.assigned_by'
        || ' left join public.profiles sb on sb.id=w.receipt_submitted_by'
        || ' left join public.profiles acc on acc.id=w.accounting_decided_by'
        || ' left join eflow_office_cash.requests oc on oc.id=w.office_cash_request_id'
        || ' left join public.profiles oc_u on oc_u.id=oc.requester'
        || ' where w.id in (' || assignments || ')'
      ),
      'work_cash_assignment_receipts', eflow_seal.rows(
        'select rc.*, w.source_kind, w.task_id, w.subtask_id, t.title as task_title, sub.title as subtask_title, up.full_name as uploaded_by_name'
        || ' from public.work_cash_assignment_receipts rc'
        || ' join public.work_cash_assignments w on w.id=rc.assignment_id'
        || ' join public.tasks t on t.id=w.task_id'
        || ' left join public.subtasks sub on sub.id=w.subtask_id'
        || ' left join public.profiles up on up.id=rc.uploaded_by'
        || ' where rc.assignment_id in (' || assignments || ') and rc.deleted_at is null'
      ),
      'office_petty_cash_events', eflow_seal.rows(
        'select e.*, u.full_name as actor_name from eflow_office_cash.events e left join public.profiles u on u.id=e.actor where e.request in (' || office_cash_ids || ')'
      ),
      'budget_ledger', eflow_seal.rows(format(
        'select ble.*, u.full_name as actor_name from public.budget_ledger_entries ble'
        || ' left join public.profiles u on u.id=ble.actor_id'
        || ' where ble.task_id in (%s)'
        || ' or ble.petty_cash_request_id in (%s)'
        || ' or ble.commitment_id in (%s)'
        || ' or ble.metadata->>''projectId'' = %L'
        || ' or ble.retained_project_id = %L::uuid',
        ids, requests, commitment_ids, p_id::text, p_id
      )),
      'journal_entries', eflow_seal.rows(
        'select j.*, u.full_name as posted_by_name from public.general_journal_entries j left join public.profiles u on u.id=j.posted_by where j.id in (' || journal_ids || ')'
      ),
      'journal_lines', eflow_seal.rows('select * from public.general_journal_lines where journal_entry_id in (' || journal_ids || ')'),
      'audit', eflow_seal.rows(
        'select id,actor_name,entity_type,entity_id,action,reason,before_data,after_data,created_at from public.audit_events where entity_id in (' || entities || ')'
      )
    )
  );
END;
$function$;
