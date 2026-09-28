import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { calculateCollaborationReadiness, isExternalReviewParticipant } from "../../src/app/features/interdepartment-collaboration";
import type { CollaborationParticipant } from "../../src/app/features/interdepartment-collaboration";

const participant = (orgId: string, participationRole: CollaborationParticipant["participationRole"]): CollaborationParticipant => ({
  draftId: "draft", orgId, participationRole, staffingEnabled: participationRole === "participant",
  approvalPolicy: "one_of", quorumCount: 1, sequence: 1, reviewDeadlineDays: 5,
});

describe("proposal governance lifecycle", () => {
  it("gates only required participant and governance organizations", () => {
    const participants = [participant("owner", "owner"), participant("delivery", "participant"), participant("board", "governance"), participant("observer", "observer")];
    expect(participants.filter(isExternalReviewParticipant).map((item) => item.orgId)).toEqual(["delivery", "board"]);
    expect(calculateCollaborationReadiness({
      currentRevisionId: "revision", participants,
      approvals: ["delivery", "board"].map((organizationId, index) => ({ id: String(index), draftId: "draft", revisionId: "revision", organizationId, decision: "approved" as const, approvedBy: "reviewer", createdAt: 1 })),
      changeRequests: [],
    })).toMatchObject({ ready: true, requiredCount: 2, approvedCount: 2 });
  });

  it("archives linked tasks and projects in one audited database operation", () => {
    const sql = readFileSync("supabase/migrations/20260822000002_governance_delivery_lifecycle.sql", "utf8");
    const archive = sql.slice(sql.indexOf("create or replace function public.archive_proposal_delivery"));
    expect(archive).toContain("update public.tasks set archived_at = now()");
    expect(archive).toContain("update public.projects set status = 'archived'");
    expect(archive).toContain("set status = 'archived', archived_at = now()");
    expect(archive).toContain("proposal.delivery_archived");
  });

  it("supports named rosters, quorum, sequential approval, recusal, task routing, closeout, and packets", () => {
    const lifecycle = readFileSync("supabase/migrations/20260822000002_governance_delivery_lifecycle.sql", "utf8");
    const routing = readFileSync("supabase/migrations/20260822000003_governance_approval_routing.sql", "utf8");
    const taskRoutes = readFileSync("supabase/migrations/20260822000004_task_governance_routes_and_storage.sql", "utf8");
    const packet = readFileSync("src/app/features/interdepartment-collaboration/services/governanceDecisionPacket.ts", "utf8");
    expect(lifecycle).toContain("proposal_governance_assignments");
    expect(lifecycle).toContain("recuse_and_delegate_collaboration_review");
    expect(lifecycle).toContain("request_proposal_closeout");
    expect(lifecycle).toContain("decide_proposal_closeout");
    expect(routing).toContain("approval_sequence < participant.approval_sequence");
    expect(routing).toContain("participant.approval_policy = 'quorum'");
    expect(taskRoutes).toContain("governanceOrgId");
    expect(taskRoutes).toContain("governanceMode");
    expect(packet).toContain("Governance Decision Packet");
    expect(packet).toContain("Audit hash");
  });

  it("routes closeout and escalation notices through row-based delegate assignments", () => {
    const lifecycle = readFileSync("supabase/migrations/20260822000002_governance_delivery_lifecycle.sql", "utf8");
    const repair = readFileSync("supabase/migrations/20260824000003_fix_governance_delegate_assignment_columns.sql", "utf8");

    for (const sql of [lifecycle, repair]) {
      expect(sql).toContain("assignment.assignment_role in ('primary_approver', 'backup_approver', 'delegate')");
      expect(sql).toContain("assignment.valid_until is null or assignment.valid_until > now()");
      expect(sql).not.toContain("assignment.delegate_user_id");
      expect(sql).not.toContain("assignment.delegation_expires_at");
    }
  });

  it("routes non-governed collaboration tasks to their responsible organization leadership", () => {
    const sql = readFileSync("supabase/migrations/20260822000006_fix_interdepartment_department_review_routing.sql", "utf8");
    expect(sql).toContain("new.source_collaboration_draft_id is not null");
    expect(sql).toContain("expected_reviewer := org_head");
    expect(sql).toContain("expected_backup := org_assistant");
    expect(sql).toContain("task.org_id = organization.id");
    expect(sql).not.toContain("new.created_by");
  });

  it("keeps department-only proposals out of collaboration review", () => {
    const sql = readFileSync("supabase/migrations/20260822000009_single_department_publish_flow.sql", "utf8");
    expect(sql).toContain("guard_single_department_collaboration_review");
    expect(sql).toContain("participant.participation_role <> 'owner'");
    expect(sql).toContain("Single-organization proposals publish directly");
    expect(sql).toContain("set status = 'draft'");
    expect(sql).toContain("notification.type = 'collaboration_ready'");
  });
});
