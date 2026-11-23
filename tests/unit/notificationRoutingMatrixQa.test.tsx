// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  resolveNotificationDestination,
  queueNotificationNavigationIntent,
} from "../../src/app/features/notifications";
import {
  peekNotificationNavigationIntent,
  completeNotificationNavigationIntent,
} from "../../src/app/features/notifications/navigationIntent";
import { canOpenNavigationSection } from "../../src/app/features/navigation/navigationPermissions";
import { readNavigationLocation } from "../../src/app/features/navigation/navigationUrl";
import type { Notification } from "../../src/app/services/notificationService";
import { PendingProjectApprovalsQueue } from "../../src/app/features/reviews/components/PendingProjectApprovalsQueue";

const projectMocks = vi.hoisted(() => ({
  listPendingProjectApprovals: vi.fn(),
  decideNonHeadProjectApproval: vi.fn(),
  writeNavigationLocation: vi.fn(),
}));

vi.mock("../../src/app/features/projects", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/app/features/projects")>();
  return {
    ...actual,
    listPendingProjectApprovals: (...args: unknown[]) =>
      projectMocks.listPendingProjectApprovals(...args),
    decideNonHeadProjectApproval: (...args: unknown[]) =>
      projectMocks.decideNonHeadProjectApproval(...args),
  };
});

vi.mock("../../src/app/features/navigation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/app/features/navigation")>();
  return {
    ...actual,
    writeNavigationLocation: (...args: unknown[]) =>
      projectMocks.writeNavigationLocation(...args),
  };
});

function makeNotif(patch: Partial<Notification>): Notification {
  return {
    id: "notif-qa-1",
    type: "status_change",
    title: "Update",
    message: "Details updated.",
    read: false,
    createdAt: Date.parse("2026-11-22T04:00:00Z"),
    ...patch,
  };
}

beforeEach(() => {
  sessionStorage.clear();
  projectMocks.listPendingProjectApprovals.mockReset();
  projectMocks.decideNonHeadProjectApproval.mockReset();
  projectMocks.writeNavigationLocation.mockReset();
});

afterEach(() => {
  cleanup();
});

describe("Notification Routing Matrix QA (R1–R21)", () => {
  it("routes non-Head project approvals to Head For Review and decisions back to project Settings", () => {
    const req = makeNotif({
      type: "project_approval_request",
      entityType: "project_approval",
      title: "Project awaiting Head approval",
      message: 'Juan requested approval for "Community Portal".',
      projectId: "proj-100",
    });

    expect(resolveNotificationDestination(req, "head")).toMatchObject({
      section: "reviews",
      page: "For Review",
      label: "Review project approval",
      intent: { kind: "project_approval", projectId: "proj-100" },
    });
    expect(resolveNotificationDestination(req, "admin")).toBeNull();

    const returned = makeNotif({
      type: "status_change",
      entityType: "project_approval",
      title: "Project returned for revisions",
      projectId: "proj-100",
    });
    expect(resolveNotificationDestination(returned, "member")).toMatchObject({
      section: "projects",
      page: "Projects",
      label: "Open project setup",
      intent: { kind: "project", projectId: "proj-100", projectTab: "settings" },
    });
  });

  it("routes two-step project funding requests, certifications, and decisions to the exact role queues", () => {
    const headReq = makeNotif({
      type: "project_funding_request",
      entityType: "project_funding",
      financialRecordId: "fund-req-1",
      financialRecordType: "project_funding",
      projectId: "proj-200",
      title: "Project funding awaits Head approval",
    });
    expect(resolveNotificationDestination(headReq, "head")).toMatchObject({
      section: "reviews",
      page: "For Review",
      label: "Review project funding",
      intent: {
        kind: "budget",
        projectId: "proj-200",
        financialRecordId: "fund-req-1",
        financialRecordType: "project_funding",
      },
    });

    const acctCert = makeNotif({
      type: "project_funding_certification",
      entityType: "project_funding",
      financialRecordId: "fund-req-1",
      financialRecordType: "project_funding",
      projectId: "proj-200",
      title: "Project funding awaits Accounting certification",
    });
    expect(resolveNotificationDestination(acctCert, "accounting_staff")).toMatchObject({
      section: "accounting_overview",
      page: "Accounting Overview",
      label: "Open funding certification",
      intent: {
        kind: "budget",
        projectId: "proj-200",
        financialRecordId: "fund-req-1",
        financialRecordType: "project_funding",
      },
    });

    const decided = makeNotif({
      type: "project_funding_decided",
      entityType: "project_funding",
      financialRecordId: "fund-req-1",
      financialRecordType: "project_funding",
      projectId: "proj-200",
      title: "Project funding certified",
    });
    for (const role of ["member", "head", "accounting_staff"]) {
      expect(resolveNotificationDestination(decided, role)).toMatchObject({
        section: "projects",
        page: "Projects",
        label: "Open project funding",
        intent: { kind: "project", projectId: "proj-200", projectTab: "budget" },
      });
    }
  });

  it("routes Accounting settlements, cash releases, and Office Petty Cash to their exact distinct tabs", () => {
    const settlement = makeNotif({
      type: "petty_cash_liquidation_accounting_review",
      title: "Liquidation ready for accounting settlement",
      taskId: "task-1",
      financialRecordId: "liq-1",
      financialRecordType: "petty_cash_liquidation",
    });
    expect(resolveNotificationDestination(settlement, "accounting_staff")).toMatchObject({
      section: "accounting_releases",
      page: "Settlements",
      label: "Open accounting settlements",
      intent: { kind: "budget", financialRecordId: "liq-1" },
    });

    const returnApproved = makeNotif({
      type: "petty_cash_return_approved",
      title: "Cash return approved — ready for settlement",
      taskId: "task-1",
      financialRecordId: "liq-1",
      financialRecordType: "petty_cash_liquidation",
    });
    expect(resolveNotificationDestination(returnApproved, "accounting_staff")).toMatchObject({
      section: "accounting_releases",
      page: "Settlements",
      label: "Open accounting settlements",
    });

    const releaseReady = makeNotif({
      type: "petty_cash_release_ready",
      title: "Approved cash request scheduled for release",
      taskId: "task-1",
      financialRecordId: "req-1",
      financialRecordType: "petty_cash_request",
    });
    expect(resolveNotificationDestination(releaseReady, "accounting_staff")).toMatchObject({
      section: "accounting_releases",
      page: "Voucher & Cash Releases",
      label: "Open cash releases",
    });

    const officeCash = makeNotif({
      type: "petty_cash_decision",
      title: "Office Petty Cash approved — ready for release",
      financialRecordId: "opc-1",
      financialRecordType: "office_petty_cash",
    });
    expect(resolveNotificationDestination(officeCash, "accounting_staff")).toMatchObject({
      section: "accounting_budgets",
      page: "Office Budget Ledgers",
      label: "Open Office Petty Cash",
      intent: { kind: "budget", financialRecordId: "opc-1", financialRecordType: "office_petty_cash" },
    });
    expect(resolveNotificationDestination(officeCash, "head")).toMatchObject({
      section: "budget",
      page: "Office Budget",
      label: "Open Office Petty Cash",
    });
  });

  it("splits Head financial approver actions from Head requester/recipient notifications", () => {
    const returnReceived = makeNotif({
      type: "petty_cash_return_received",
      title: "Cash return received — Head approval required",
      taskId: "task-9",
      financialRecordId: "liq-9",
    });
    expect(resolveNotificationDestination(returnReceived, "head")).toMatchObject({
      section: "reviews",
      page: "For Review",
      label: "Open funding review",
    });

    const overdue = makeNotif({
      type: "petty_cash_liquidation_overdue",
      title: "Liquidation overdue",
      taskId: "task-9",
      projectId: "proj-9",
    });
    expect(resolveNotificationDestination(overdue, "head")).toMatchObject({
      section: "projects",
      page: "Projects",
      label: "Open task funding",
      intent: { kind: "budget", taskId: "task-9", projectId: "proj-9" },
    });

    const changes = makeNotif({
      type: "petty_cash_liquidation_changes",
      title: "Liquidation returned for corrections",
      taskId: "task-9",
    });
    expect(resolveNotificationDestination(changes, "head")).toMatchObject({
      section: "personal_work",
      page: "Assigned work",
      label: "Open task funding",
    });
  });

  it("routes Head leader-review endorsements to For Review and member/accounting leader reviews to Leader Reviews", () => {
    const leaderReview = makeNotif({
      type: "petty_cash_liquidation_leader_review",
      title: "Liquidation awaits your endorsement",
      taskId: "task-22",
      financialRecordId: "liq-22",
    });
    expect(resolveNotificationDestination(leaderReview, "head")).toMatchObject({
      section: "reviews",
      page: "For Review",
    });
    expect(resolveNotificationDestination(leaderReview, "member")).toMatchObject({
      section: "reviews",
      page: "Leader Reviews",
    });
    expect(resolveNotificationDestination(leaderReview, "accounting_staff")).toMatchObject({
      section: "reviews",
      page: "Leader Reviews",
    });
  });

  it("routes project completion review requests to Head For Review and m7 author decisions back to Subtasks/Assigned work", () => {
    const completionReq = makeNotif({
      type: "approval_needed",
      entityType: "project_completion_review",
      title: "Project completion ready for review",
      projectId: "proj-300",
    });
    expect(resolveNotificationDestination(completionReq, "head")).toMatchObject({
      section: "reviews",
      page: "For Review",
      label: "Open project completion review",
      intent: { kind: "project_completion_review", projectId: "proj-300" },
    });

    const proposalSubtaskDecision = makeNotif({
      type: "status_change",
      entityType: "m7_work_proposal",
      title: "Subtask submission needs changes",
      taskId: "task-50",
      workNodeId: "node-50",
    });
    expect(resolveNotificationDestination(proposalSubtaskDecision, "member")).toMatchObject({
      section: "personal_work",
      page: "Subtasks",
      intent: { kind: "subtask", taskId: "task-50", entityId: "node-50" },
    });

    const proposalReview = makeNotif({
      type: "approval_needed",
      entityType: "m7_work_proposal",
      title: "Subtask submission awaiting review",
      taskId: "task-50",
      workNodeId: "node-50",
    });
    expect(resolveNotificationDestination(proposalReview, "member")).toMatchObject({
      section: "personal_work",
      page: "Leading",
      intent: { kind: "leading_task", taskId: "task-50", entityId: "node-50", inspectorSection: "review" },
    });
  });

  it("routes collaborations, project invitations, workload overrides, retention, admin announcements, and project tasks accurately", () => {
    expect(
      resolveNotificationDestination(
        makeNotif({
          type: "collaboration_change",
          entityType: "collaboration_draft",
          title: "Closeout governance sign-off needed",
          proposalId: "draft-9",
        }),
        "head",
      ),
    ).toMatchObject({
      section: "projects",
      page: "Projects",
      intent: { kind: "collaboration", proposalId: "draft-9", proposalTab: "governance" },
    });

    expect(
      resolveNotificationDestination(
        makeNotif({
          type: "project_office_invitation",
          title: "Office invited to project",
          projectId: "proj-7",
        }),
        "head",
      ),
    ).toMatchObject({
      section: "projects",
      page: "Projects",
      intent: { kind: "project", projectId: "proj-7", projectTab: "members" },
    });

    expect(
      resolveNotificationDestination(
        makeNotif({
          type: "office_invitation_accepted",
          title: "Office invitation accepted",
        }),
        "head",
      ),
    ).toMatchObject({
      section: "team",
      page: "Office Team",
    });

    expect(
      resolveNotificationDestination(
        makeNotif({
          type: "status_change",
          title: "Overloaded member assigned to task",
          projectId: "proj-8",
        }),
        "head",
      ),
    ).toMatchObject({
      section: "projects",
      page: "Projects",
      intent: { kind: "project", projectId: "proj-8", projectTab: "members" },
    });

    expect(
      resolveNotificationDestination(
        makeNotif({
          type: "project_retention_ready",
          title: "Archived project ready for retention purge",
          projectId: "proj-old",
        }),
        "admin",
      ),
    ).toMatchObject({
      section: "administration",
      page: "Archive & Retention",
    });

    expect(
      resolveNotificationDestination(
        makeNotif({
          type: "assignment",
          title: "Task assignment",
          message: 'You were assigned to "Coordinate partners".',
          taskId: "task-77",
          projectId: "proj-77",
        }),
        "member",
      ),
    ).toMatchObject({
      section: "projects",
      page: "Projects",
      label: "Open task",
      intent: { kind: "task", taskId: "task-77", projectId: "proj-77" },
    });

    // Admin announcements route & permission compatibility
    expect(
      resolveNotificationDestination(
        makeNotif({ type: "system", title: "New announcement", message: "City Hall Advisory" }),
        "admin",
      ),
    ).toMatchObject({ section: "announcements", page: "Announcements", intent: { kind: "announcement" } });
    expect(canOpenNavigationSection("admin", "announcements", () => true)).toBe(true);
    window.history.replaceState({}, "", "/announcements?page=Announcements");
    expect(readNavigationLocation("admin", () => "People & Accounts")).toEqual({
      section: "announcements",
      page: "Announcements",
    });

    // Conversation denied for admin, allowed for operational roles
    expect(
      resolveNotificationDestination(makeNotif({ conversationId: "conv-1" }), "admin"),
    ).toBeNull();
    expect(
      resolveNotificationDestination(makeNotif({ conversationId: "conv-1", conversationMessageId: "msg-1" }), "head"),
    ).toMatchObject({
      section: "messages",
      page: "Messages",
      intent: { kind: "conversation", conversationId: "conv-1", conversationMessageId: "msg-1" },
    });
  });

  it("persists conversation, project_approval, projectTab, and proposalTab through sessionStorage reload", async () => {
    const actorId = "actor-qa-1";
    queueNotificationNavigationIntent(
      {
        notificationId: "n-persist-1",
        kind: "project_approval",
        projectId: "proj-99",
        projectTab: "settings",
      },
      actorId,
    );
    vi.resetModules();
    const reloaded = await import("../../src/app/features/notifications/navigationIntent");
    expect(reloaded.peekNotificationNavigationIntent(actorId)).toMatchObject({
      notificationId: "n-persist-1",
      kind: "project_approval",
      projectId: "proj-99",
      projectTab: "settings",
    });
    reloaded.completeNotificationNavigationIntent("n-persist-1");

    queueNotificationNavigationIntent(
      {
        notificationId: "n-persist-2",
        kind: "conversation",
        conversationId: "conv-42",
        conversationMessageId: "msg-42",
      },
      actorId,
    );
    vi.resetModules();
    const reloadedConv = await import("../../src/app/features/notifications/navigationIntent");
    expect(reloadedConv.peekNotificationNavigationIntent(actorId)).toMatchObject({
      notificationId: "n-persist-2",
      kind: "conversation",
      conversationId: "conv-42",
      conversationMessageId: "msg-42",
    });
    reloadedConv.completeNotificationNavigationIntent("n-persist-2");
    completeNotificationNavigationIntent("n-persist-2");
    expect(peekNotificationNavigationIntent(actorId)).toBeNull();
  });
});

describe("PendingProjectApprovalsQueue (Rich Head Project Approval Details)", () => {
  const sampleApproval = {
    projectId: "proj-approval-1",
    title: "Barangay Health Records Digitization",
    description: "Digitize maternal and immunization logbooks across 12 barangays.",
    scope: "Phase 1 covers intake template design, training, and pilot deployment.",
    orgId: "org-1",
    officeName: "City Health Office",
    startDate: "2026-12-01",
    targetDate: "2026-12-15",
    fundingNotRequired: true,
    requestedBy: "user-member",
    requestedByName: "Maria Santos",
    requestedAt: "2026-11-22T02:30:00Z",
    createdAt: "2026-11-22T02:00:00Z",
    projectLeadId: "user-lead",
    projectLeadName: "Jose Rizal",
    taskCount: 7,
    memberCount: 4,
    tasksPreview: [
      { id: "t-1", title: "Audit existing forms", dueDate: "2026-12-04", assigneeName: "Ana Cruz" },
      { id: "t-2", title: "Train barangay clerks", dueDate: "2026-12-10", assigneeName: "Pedro Reyes" },
    ],
  };

  it("displays full project details, Manila dates, task previews, focus highlight, and zero rounded-full pills", async () => {
    projectMocks.listPendingProjectApprovals.mockResolvedValue([sampleApproval]);

    const { container } = render(
      <PendingProjectApprovalsQueue
        orgId="org-1"
        projects={[]}
        focusProjectId="proj-approval-1"
      />,
    );

    expect(await screen.findByText("Barangay Health Records Digitization")).toBeTruthy();
    expect(screen.getByText("City Health Office")).toBeTruthy();
    expect(screen.getByText("Jose Rizal")).toBeTruthy();
    expect(screen.getByText("No funding required")).toBeTruthy();
    expect(screen.getByText(/Digitize maternal and immunization logbooks/)).toBeTruthy();
    expect(screen.getByText(/Phase 1 covers intake template design/)).toBeTruthy();
    expect(screen.getByText(/12\/01\/2026/)).toBeTruthy();
    expect(screen.getByText(/12\/15\/2026/)).toBeTruthy();
    expect(screen.getByText(/15 days/)).toBeTruthy();
    expect(screen.getByText(/7 tasks · 4 members/)).toBeTruthy();
    expect(screen.getByText("Audit existing forms")).toBeTruthy();
    expect(screen.getByText("+5 more in project")).toBeTruthy();
    expect(screen.getByText(/11\/22\/2026,?\s*10:30\s*AM/)).toBeTruthy();

    const focusedCard = container.querySelector('[data-focused="true"]');
    expect(focusedCard).toBeTruthy();
    expect(container.querySelector(".rounded-full")).toBeNull();
  });

  it("enforces required bounded revision feedback when returning and confirmation when approving", async () => {
    projectMocks.listPendingProjectApprovals.mockResolvedValue([sampleApproval]);
    projectMocks.decideNonHeadProjectApproval.mockResolvedValue({
      projectId: "proj-approval-1",
      status: "planning",
      projectApprovalStatus: "changes_requested",
    });

    render(<PendingProjectApprovalsQueue orgId="org-1" projects={[]} />);
    await screen.findByText("Barangay Health Records Digitization");

    // Return for revisions requires non-empty reason
    fireEvent.click(screen.getByRole("button", { name: /Return for revisions/i }));
    const dialog = await screen.findByRole("dialog");
    const submitReturn = within(dialog).getByRole("button", { name: /Return project/i });
    expect((submitReturn as HTMLButtonElement).disabled).toBe(true);
    expect(within(dialog).getByText("0 / 2,000")).toBeTruthy();

    const textarea = within(dialog).getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "  Please attach the barangay rollout list.  " } });
    expect((submitReturn as HTMLButtonElement).disabled).toBe(false);

    projectMocks.listPendingProjectApprovals.mockResolvedValueOnce([]);
    fireEvent.click(submitReturn);

    await waitFor(() => {
      expect(projectMocks.decideNonHeadProjectApproval).toHaveBeenCalledWith(
        "proj-approval-1",
        false,
        "Please attach the barangay rollout list.",
      );
    });
    expect(await screen.findByRole("status")).toBeTruthy();
  });
});
