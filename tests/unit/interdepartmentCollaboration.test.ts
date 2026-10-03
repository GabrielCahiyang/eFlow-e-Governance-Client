import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildCollaborationSnapshot,
  calculateCollaborationReadiness,
  defaultParticipationRole,
  evaluateRevisionMateriality,
  getCollaborationCandidateEmployees,
  normalizeCollaborationParticipationRole,
  summarizeRevisionDiff,
  notifyCollaborationDraftsChanged,
  subscribeToLocalCollaborationDraftChanges,
  isExternalReviewParticipant,
  isActiveCollaborationDraft,
  withSynchronizedProposalBudget,
} from "../../src/app/features/interdepartment-collaboration";
import type { Organization } from "../../src/app/types";

const ownerOrg = "11111111-1111-4111-8111-111111111111";
const participantOrg = "22222222-2222-4222-8222-222222222222";
const boardOrg = "33333333-3333-4333-8333-333333333333";

function organization(id: string, org_type: Organization["org_type"]): Organization {
  return { id, name: org_type, slug: org_type, parent_id: null, path: id, org_type, description: "", head_user_id: null, assistant_head_user_id: null, is_active: true, created_at: "", updated_at: "" };
}

function snapshot() {
  return buildCollaborationSnapshot({
    title: "OCEDSIPP",
    ownerOrgId: ownerOrg,
    planningAnchor: new Date("2026-08-21T00:00:00Z").getTime(),
    organizations: [
      { orgId: ownerOrg, participationRole: "owner", staffingEnabled: true },
      { orgId: participantOrg, participationRole: "participant", staffingEnabled: true },
      { orgId: boardOrg, participationRole: "governance", staffingEnabled: false },
    ],
    tasks: [{
      key: "task-a", proposalTitle: "OCEDSIPP", proposalId: "proposal", programIdx: 0, projectIdx: 0,
      activityIdx: 0, taskIdx: 0, programId: "program", programTitle: "Program", projectId: "project",
      projectTitle: "Project", activityId: "activity", activityTitle: "Activity", activitySchedule: "Month 2",
      title: "Economic diagnostic", description: "Analyze the local economy", deadline: "Month 2", priority: "high",
      requiredSkills: ["data_analysis"], assignedMemberIds: ["employee-a"], leadMemberId: "employee-a",
      burnoutWarning: false, reasoning: "Skill fit", enabled: true, primaryOrgId: participantOrg,
    }],
  });
}

describe("inter-office collaboration domain", () => {
  it("invalidates the draft portfolio immediately after local mutations", () => {
    let refreshes = 0;
    const unsubscribe = subscribeToLocalCollaborationDraftChanges(() => { refreshes += 1; });
    notifyCollaborationDraftsChanged();
    unsubscribe();
    notifyCollaborationDraftsChanged();
    expect(refreshes).toBe(1);
  });

  it("removes published proposals from active draft and review lists", () => {
    expect(isActiveCollaborationDraft({ status: "ready_to_commit" })).toBe(true);
    expect(isActiveCollaborationDraft({ status: "committed" })).toBe(false);
    expect(isActiveCollaborationDraft({ status: "archived" })).toBe(false);
  });

  it("keeps governance out of staffing and expands only approved pools", () => {
    const employees = [
      { id: "a", name: "Owner", jobTitle: "", jobDescription: "", currentWorkload: 0, department: ownerOrg },
      { id: "b", name: "Participant", jobTitle: "", jobDescription: "", currentWorkload: 0, department: participantOrg },
      { id: "c", name: "Board", jobTitle: "", jobDescription: "", currentWorkload: 0, department: boardOrg },
    ];
    expect(getCollaborationCandidateEmployees(employees, snapshot().organizations).map((item) => item.id)).toEqual(["a", "b"]);
    expect(defaultParticipationRole(organization(boardOrg, "board"))).toBe("governance");
    expect(defaultParticipationRole(organization(participantOrg, "department"))).toBe("participant");
  });

  it("never presents the owning organization as its own reviewer", () => {
    const participants = snapshot().organizations.map((item) => ({ draftId: "draft", orgId: item.orgId, participationRole: item.participationRole, staffingEnabled: item.staffingEnabled }));
    expect(participants.filter(isExternalReviewParticipant).map((item) => item.orgId)).toEqual([participantOrg, boardOrg]);
  });

  it("normalizes relative schedules and explicit responsibility", () => {
    const result = snapshot();
    expect(result.tasks[0].deadline).toBe("2026-10-21");
    expect(result.tasks[0].activityPrimaryOrgId).toBe(participantOrg);
    expect(result.tasks[0].primaryOrgId).toBe(participantOrg);
  });

  it("always includes the proposed Task Leader in the proposed team", () => {
    const base = snapshot();
    const result = buildCollaborationSnapshot({
      title: base.title,
      ownerOrgId: ownerOrg,
      organizations: base.organizations,
      tasks: base.tasks.map((task) => ({
        ...task,
        assignedMemberIds: ["employee-b"],
        leadMemberId: "employee-a",
      })),
    });

    expect(result.tasks[0].assignedMemberIds).toEqual(["employee-b", "employee-a"]);
    expect(result.tasks[0].leadMemberId).toBe("employee-a");
  });

  it("makes every task inherit its activity responsibility", () => {
    const base = snapshot();
    const inherited = buildCollaborationSnapshot({
      title: base.title,
      ownerOrgId: ownerOrg,
      organizations: base.organizations,
      tasks: base.tasks.map((task) => ({
        ...task,
        activityPrimaryOrgId: ownerOrg,
        activitySupportingOrgIds: [participantOrg],
        primaryOrgId: participantOrg,
        supportingOrgIds: [boardOrg],
      })),
    });
    expect(inherited.tasks[0].primaryOrgId).toBe(ownerOrg);
    expect(inherited.tasks[0].supportingOrgIds).toEqual([participantOrg]);
  });

  it("invalidates old-revision approvals and blocks open changes", () => {
    const participants = snapshot().organizations.map((item) => ({ draftId: "draft", orgId: item.orgId, participationRole: item.participationRole, staffingEnabled: item.staffingEnabled }));
    const approvals = participants.map((item, index) => ({ id: String(index), draftId: "draft", revisionId: index === 1 ? "old" : "current", organizationId: item.orgId, decision: "approved" as const, approvedBy: "head", createdAt: 1 }));
    expect(calculateCollaborationReadiness({ currentRevisionId: "current", participants, approvals, changeRequests: [] })).toMatchObject({ ready: false, approvedCount: 1, requiredCount: 2 });
    const currentApprovals = participants.map((item, index) => ({ ...approvals[index], revisionId: "current" }));
    expect(calculateCollaborationReadiness({ currentRevisionId: "current", participants, approvals: currentApprovals, changeRequests: [{ id: "change", draftId: "draft", revisionId: "current", requestedBy: "head", requestingOrgId: participantOrg, targetType: "task", targetKey: "task-a", reason: "Replace staff", proposedChange: {}, status: "open", createdAt: 1 }] }).ready).toBe(false);
  });

  it("summarizes substantive staffing revisions", () => {
    const before = snapshot();
    const after = { ...before, tasks: before.tasks.map((task) => ({ ...task, assignedMemberIds: ["employee-b"], leadMemberId: "employee-b" })) };
    expect(summarizeRevisionDiff(before, after)).toContain("Task staffing changed");
    expect(evaluateRevisionMateriality(before, after)).toMatchObject({ material: true, reasons: ["staffing"] });
  });

  it("preserves approvals for editorial revisions and invalidates them for material changes", () => {
    const before = snapshot();
    const editorial = { ...before, title: "OCEDSIPP (edited)", description: "Clearer description" };
    const responsibility = {
      ...before,
      tasks: before.tasks.map((task) => ({ ...task, primaryOrgId: ownerOrg, activityPrimaryOrgId: ownerOrg })),
    };
    expect(evaluateRevisionMateriality(before, editorial)).toEqual({ material: false, reasons: [] });
    expect(evaluateRevisionMateriality(before, responsibility)).toMatchObject({ material: true, reasons: ["responsibility"] });
  });

  it("rebuilds the proposal header budget from edited task budgets", () => {
    const before = snapshot();
    const tasks = before.tasks.map((task) => ({
      ...task,
      budgetDecision: "funded" as const,
      budgetLines: [{ id: "line-1", expenseClass: "MOOE", category: "Supplies", particular: "Paper", quantity: 2, unit: "ream", unitCost: 250, amount: 0, fundSource: "General Fund", position: 0 }],
    }));
    const result = withSynchronizedProposalBudget(before, tasks);
    expect(result.budget?.totalAmount).toBe(500);
    expect(result.budget?.taskBudgets[0]).toMatchObject({ taskKey: "task-a", totalAmount: 500 });
  });

  it("normalizes the legacy consulted role into a non-blocking observer", () => {
    expect(normalizeCollaborationParticipationRole("consulted")).toBe("observer");
  });
});

describe("collaboration migration contracts", () => {
  const migrationNames = ["organizations", "drafts", "security", "runtime", "commit", "owner_auto_accept"];
  const migrations = migrationNames.map((name, index) => readFileSync(`supabase/migrations/2026082100000${index}_collaboration_${name}.sql`, "utf8")).join("\n");
  it("keeps view and mutation authority separate", () => {
    expect(migrations).toContain("can_see_collaboration_project");
    expect(migrations).toContain("can_manage_collaboration_project");
    expect(migrations).toContain("public.auth_role(caller_id) <> 'super_admin'");
  });
  it("uses one atomic commit function and guarded governance routing", () => {
    expect(migrations).toContain("commit_collaboration_draft");
    expect(migrations).toContain("review_route_mode = 'governance'");
    expect(migrations).toContain("Task Leader cannot review their own Task");
    expect(migrations).toContain("save_collaboration_staffing_revision");
    expect(migrations).toContain("autosave_collaboration_draft");
  });
  it("repairs unpublished office revisions whose Task Leader is missing from the team", () => {
    const repair = readFileSync("supabase/migrations/20260824000005_normalize_proposal_task_leader_membership.sql", "utf8");
    expect(repair).toContain("normalize_collaboration_task_teams");
    expect(repair).toContain("jsonb_build_array(task_item ->> 'leadMemberId')");
    expect(repair).toContain("participant.participation_role <> 'owner'");
    expect(repair).toContain("draft.status not in ('committed', 'archived', 'deleted')");
  });
  it("publishes the latest autosaved office snapshot instead of a stale revision", () => {
    const migration = readFileSync("supabase/migrations/20260824000006_publish_latest_department_proposal_revision.sql", "utf8");
    const service = readFileSync("src/app/features/interdepartment-collaboration/services/collaborationCommitService.ts", "utf8");
    expect(migration).toContain("current_revision.snapshot is distinct from draft_row.working_snapshot");
    expect(migration).toContain("draft_row.working_snapshot");
    expect(migration).toContain("public.save_collaboration_revision");
    expect(migration).toContain("public.commit_collaboration_draft");
    expect(service).toContain('supabase.rpc("publish_department_proposal"');
  });
  it("auto-accepts the owner organization and blocks manual owner decisions", () => {
    expect(migrations).toContain("auto_accept_collaboration_owner");
    expect(migrations).toContain("guard_collaboration_owner_decision");
    expect(migrations).toContain("participating.participation_role <> 'owner'");
  });
  it("keeps AI staffing owner-only and source PDF changes audited", () => {
    const backend = readFileSync("server/services/collaboration_ai.py", "utf8");
    expect(backend).toContain("Only the owning office may request AI staffing recommendations.");
    expect(backend).toContain('draft.get("status") != "draft"');
    expect(migrations).toContain("collaboration.source_document_attached");
  });
  it("allows zero-cost publication before budget lookup and carries editorial approvals", () => {
    const zeroCost = readFileSync("supabase/migrations/20260928000001_allow_zero_cost_proposals.sql", "utf8");
    const approvalStability = readFileSync("supabase/migrations/20260928000002_collaboration_role_and_approval_stability.sql", "utf8");
    expect(zeroCost).toContain("if proposal_total = 0 then");
    expect(zeroCost.indexOf("if proposal_total = 0 then")).toBeLessThan(zeroCost.indexOf("from public.department_fiscal_budgets"));
    expect(approvalStability).toContain("collaboration_revision_is_material");
    expect(approvalStability).toContain("and not material_change");
    expect(approvalStability).toContain("approval.decision = 'approved'");
    expect(approvalStability).toContain("then 'observer'");
  });
  it("accepts observer organizations when collaboration drafts are created or autosaved", () => {
    const creationFix = readFileSync("supabase/migrations/20260928000006_fix_collaboration_draft_creation_roles.sql", "utf8");
    const autosaveFix = readFileSync("supabase/migrations/20260928000007_fix_autosave_observer_role.sql", "utf8");
    expect(creationFix).toContain("additional_role not in ('participant', 'governance', 'observer')");
    expect(creationFix).toContain("additional_role in ('governance', 'observer') then false");
    expect(creationFix).toContain("target_role not in ('participant', 'governance', 'observer')");
    expect(creationFix).not.toContain("Additional organizations must be participants or governance'");
    expect(autosaveFix).toContain("target_role not in ('participant', 'governance', 'observer')");
    expect(autosaveFix).toContain("target_role in ('governance', 'observer') then false");
  });
  it("records funding and requester offices while routing fiscal approval to the fund owner", () => {
    const migration = readFileSync("supabase/migrations/20260928000003_petty_cash_funding_requester_orgs.sql", "utf8");
    expect(migration).toContain("funding_org_id uuid");
    expect(migration).toContain("requester_org_id uuid");
    expect(migration).toContain("new.org_id := new.funding_org_id");
    expect(migration).toContain("organization_approver_ids(fiscal.org_id)");
    expect(migration).not.toContain("organization_approver_ids(task_row.org_id)");
  });
});
