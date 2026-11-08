export const ids = {
  head: "00000000-0000-4000-8000-000000000001",
  lead: "00000000-0000-4000-8000-000000000002",
  member: "00000000-0000-4000-8000-000000000003",
  accountant: "00000000-0000-4000-8000-000000000004",
  office: "10000000-0000-4000-8000-000000000001",
  project: "20000000-0000-4000-8000-000000000001",
  group: "30000000-0000-4000-8000-000000000001",
  task: "40000000-0000-4000-8000-000000000001",
  subtask: "50000000-0000-4000-8000-000000000001",
  source: "70000000-0000-4000-8000-000000000001",
  budget: "71000000-0000-4000-8000-000000000001",
  request: "72000000-0000-4000-8000-000000000001",
  liquidation: "73000000-0000-4000-8000-000000000001",
  release: "74000000-0000-4000-8000-000000000001",
  allocation: "76000000-0000-4000-8000-000000000001",
  line: "77000000-0000-4000-8000-000000000001",
  identity: "91000000-0000-4000-8000-000000000001",
};
export type Row = Record<string, unknown>;
const now = "2026-11-09T04:00:00Z";

export function sampleRecords(scene: string) {
  const settled = ["task-review", "return-funding", "complete", "archived"].includes(scene);
  const accounting = ["release", "settlement"].includes(scene);
  const working = ["subtasks", "request-cash", "receipts"].includes(scene);
  const actor = scene === "accept-invite" ? ids.member : accounting ? ids.accountant : working ? ids.lead : ids.head;
  const role = accounting ? "accounting_staff" : working || scene === "accept-invite" ? "member" : "head";
  const profile = (id: string, full_name: string, role: string) => ({
    id, full_name, role, email: full_name.split(" ")[0].toLowerCase() + "@example.test",
    org_id: ids.office, is_active: true, created_at: now, updated_at: now, skills: {},
  });
  const profiles = [
    profile(ids.head, "Maria Cruz", "head"), profile(ids.lead, "Paolo Reyes", "member"),
    profile(ids.member, "Lia Santos", "member"), profile(ids.accountant, "Nia Garcia", "accounting_staff"),
  ];
  const office = { id: ids.office, name: "Planning Office", slug: "planning_office", path: "planning_office", org_type: "department", is_active: true, head_user_id: ids.head };
  const project: Row = { id: ids.project, title: "Community Services Seminar", description: "Host a seminar for frontline staff.", scope: "Materials, registration, and delivery.",
    org_id: ids.office, owner_id: ids.head, created_by: ids.head, project_lead_id: ids.head, status: scene === "archived" ? "archived" : scene === "activate" ? "planning" : "active",
    start_date: "2026-11-09", target_date: "2026-11-27", funding_not_required: false, priority: "medium", created_at: now, updated_at: now };
  const task: Row = { id: ids.task, title: "Prepare seminar materials", description: "Prepare registration kits and printed materials.", org_id: ids.office,
    linked_project_id: ids.project, project_id: ids.project, group_id: ids.group, workspace_position: 0,
    status: scene === "task-review" ? "for_review" : ["complete", "archived", "return-funding"].includes(scene) ? "completed" : "in_progress",
    assigned_to: ids.lead, assignee_name: "Paolo Reyes", team_member_ids: [ids.lead, ids.member], team_member_names: ["Paolo Reyes", "Lia Santos"],
    reviewer_id: ids.head, created_by: ids.head, priority: "medium", estimated_hours: 8, budget_impact: 10000,
    start_date: "2026-11-10", deadline: "2026-11-19", due_date: "2026-11-19", created_at: now, updated_at: now, subtask_count: 1,
    latest_submission: { id: "submission-1", submitterId: ids.lead, submitterName: "Paolo Reyes", completionNote: "Seminar kits and printed materials are ready.", submittedAt: Date.parse(now), attempt: 1 } };
  const subtask: Row = { id: ids.subtask, task_id: ids.task, title: "Prepare and check the registration kits", lead_id: ids.member, assigned_to_ids: [ids.member],
    parent_subtask_id: null, status: settled ? "completed" : "in_progress", percent_complete: 0, is_standalone: true, due_date: "2026-11-18", position: 0, sibling_order: 0, created_by: ids.lead, created_at: now, updated_at: now };
  const request: Row = { id: ids.request, request_number: 1, fiscal_budget_id: ids.budget, org_id: ids.office, funding_org_id: ids.office, requester_org_id: ids.office,
    requester_id: ids.lead, cash_recipient_id: ids.lead, task_leader_id: ids.lead, task_id: ids.task, allocation_id: ids.allocation, allocation_line_id: ids.line,
    requested_amount: 4000, approved_amount: 4000, released_amount: scene === "authorize" ? 0 : 4000,
    status: settled ? "settled" : scene === "authorize" ? "pending_department_approval" : scene === "release" ? "scheduled_for_release" : scene === "receipts" || scene === "request-cash" ? "released" : "pending_department_settlement",
    purpose: "Registration kits and printing", liquidation_due_at: new Date(Date.now() + 15 * 86400000).toISOString(),
    created_at: now, updated_at: now, actual_spent: settled ? 3500 : 0, returned_amount: settled ? 500 : 0,
    funding_lines_payload: { lines: [{ allocationLineId: ids.line, amount: 4000 }] } };
  const liquidation: Row = { id: ids.liquidation, request_id: ids.request, version: 1, declared_spent: 3500, returned_amount: 500, status: settled ? "settled" : "pending_department_settlement",
    note: "Registration kits and printing. Unused cash returned.", submitted_by: ids.lead, submitted_at: now,
    department_decided_at: now, department_decided_by: ids.head, liquidation_number: "LIQ-2026-00001-01", refund_receipt_number: "OR-RETURN-500" };
  const release: Row = { id: ids.release, request_id: ids.request, org_id: ids.office, scheduled_date: "2026-01-01", amount: 4000, status: scene === "release" ? "scheduled" : "released",
    recipient_id: ids.lead, created_at: now, voucher_number: "DV-2026-00001-A1B2", acknowledged_by: ids.lead, acknowledged_at: now };
  const identity = { id: ids.identity, project_id: ids.project, display_name: "Community Training Center", canonical_office_id: null, project_office_id: null,
    relationship_type: "collaborating", contact_email: "", contact_user_id: null, contact_status: "none", provenance: { source: "manual" }, created_at: now };
  const memberRows = profiles.map(p => ({ id: p.id, project_id: ids.project, project_office_id: "lead-office", office_id: ids.office, user_id: p.id, is_active: true, active: true }));
  const tables: Record<string, unknown> = {
    profiles, organizations: [office], projects: [project], tasks: [task], subtasks: [subtask],
    project_groups: [{ id: ids.group, project_id: ids.project, title: "Preparation", color: "#0b7f78", position: 0, is_default: false, created_at: now }],
    project_offices: [{ id: "lead-office", project_id: ids.project, office_id: ids.office, relationship_type: "lead", invitation_status: "joined" }],
    project_office_members: memberRows, project_office_identities: [identity],
    department_fiscal_budgets: [{ id: ids.budget, fiscal_year: 2026, status: "locked", approved_amount: 100000 }],
    budget_commitments: [{ id: "commitment-1", fiscal_budget_id: ids.budget, title: "Seminar funding", amount: 40000, status: "active", funding_kind: "direct_work", created_by: ids.head }],
    work_budget_allocations: [{ id: ids.allocation, task_id: ids.task, commitment_id: "commitment-1", status: "approved", amount: 10000 }],
    work_budget_allocation_lines: [{ id: ids.line, allocation_id: ids.allocation, amount: 10000, category: "Supplies", particular: "Registration materials" }],
    petty_cash_requests: [request], petty_cash_releases: [release], petty_cash_liquidations: scene === "receipts" || scene === "request-cash" ? [] : [liquidation],
    petty_cash_request_lines: [{ request_id: ids.request, allocation_line_id: ids.line, amount: 4000 }],
    petty_cash_receipts: [{ id: "receipt-1", liquidation_id: ids.liquidation, vendor: "Seminar Supplies", receipt_number: "INV-12", receipt_date: "2026-11-09", amount: 3500, file_name: "seminar-supplies.pdf", file_path: "sample/receipt.pdf" }],
    task_submissions: [{ id: "submission-1", task_id: ids.task, submitter_id: ids.lead, completion_note: "Seminar materials prepared and checked.", submitted_at: now, status: "pending", attempt: 1 }],
    accounting_accounts: [{ code: "101", title: "Cash", classification: "asset", normal_balance: "debit" }, { code: "105", title: "Member advances", classification: "asset", normal_balance: "debit" }, { code: "501", title: "Supplies expense", classification: "expense", normal_balance: "debit" }],
  };
  if (!["authorize", "release", "receipts", "settlement", "task-review", "return-funding", "complete", "archived"].includes(scene)) {
    tables.petty_cash_requests = [];
    tables.petty_cash_releases = [];
    tables.petty_cash_liquidations = [];
  }
  return { scene, actor, role, profiles, office, project, task, subtask, request, liquidation, release, identity, tables, memberRows };
}
export type SampleRecords = ReturnType<typeof sampleRecords>;

