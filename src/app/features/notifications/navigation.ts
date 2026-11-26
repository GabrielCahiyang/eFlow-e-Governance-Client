import type { Notification } from "../../services/notificationService";

export type NotificationIntentKind =
  | "task"
  | "subtask"
  | "leading_task"
  | "personal_work"
  | "task_review"
  | "subtask_review"
  | "project_approval"
  | "project_completion_review"
  | "announcement"
  | "team_intelligence"
  | "project"
  | "membership_review"
  | "proposal"
  | "collaboration"
  | "conversation"
  | "budget";

export type NotificationProjectTab =
  | "tasks"
  | "reviews"
  | "members"
  | "budget"
  | "analytics"
  | "settings";

export type NotificationProposalTab = "overview" | "approvals" | "governance";

export interface NotificationNavigationIntent {
  notificationId: string;
  kind: NotificationIntentKind;
  taskId?: string;
  projectId?: string;
  proposalId?: string;
  entityLabel?: string;
  /** Canonical item identity takes precedence over an older display label. */
  entityId?: string;
  /** Notification item entrances use the canonical Inspector's existing sections. */
  inspectorSection?: "work" | "review";
  financialRecordId?: string;
  financialRecordType?: string;
  conversationId?: string;
  conversationMessageId?: string;
  projectTab?: NotificationProjectTab;
  proposalTab?: NotificationProposalTab;
}

export interface NotificationDestination {
  section: string;
  page: string;
  label: string;
  intent: NotificationNavigationIntent;
}

/** Resolve only supplied authorized records. An ID never falls back to a label. */
export function resolveNotificationSubitem<T extends {id:string;taskId:string;title:string}>(
  intent:NotificationNavigationIntent, items:readonly T[],
):{status:'resolved';item:T}|{status:'unavailable'|'ambiguous'} {
  const label=intent.entityLabel?.trim().toLowerCase();
  if(!intent.entityId&&!label)return {status:'unavailable'};
  const matches=items.filter(item=>(!intent.taskId||item.taskId===intent.taskId)
    &&(intent.entityId?item.id===intent.entityId:item.title.trim().toLowerCase()===label));
  return matches.length===1?{status:'resolved',item:matches[0]}:{status:matches.length?'ambiguous':'unavailable'};
}

function quotedLabels(value: string): string[] {
  const normalized = value.replace(/[“”]/g, '"');
  return Array.from(normalized.matchAll(/"([^"]+)"/g), (match) => match[1].trim())
    .filter(Boolean);
}

function destinationForTask(role: string, notification?: Notification) {
  if (role === "admin") return null;
  if (["head", "member", "accounting_staff", "teamleader"].includes(role)) {
    if (notification?.projectId) {
      return { section: "projects", page: "Projects" };
    }
    return { section: "personal_work", page: "Assigned work" };
  }
  return null;
}

function destinationForSubtask(role: string) {
  if (role === "head" || role === "member" || role === "accounting_staff" || role === "teamleader") {
    return { section: "personal_work", page: "Subtasks" };
  }
  return destinationForTask(role);
}

function destinationForReview(role: string) {
  if (role === "head") return { section: "reviews", page: "For Review" };
  if (role === "member" || role === "accounting_staff" || role === "teamleader") {
    return { section: "reviews", page: "Leader Reviews" };
  }
  return destinationForTask(role);
}

function destinationForAnnouncement(role: string) {
  if (["admin", "head", "member", "accounting_staff", "teamleader"].includes(role)) {
    return { section: "announcements", page: "Announcements" };
  }
  return null;
}

function destinationForProject(role: string) {
  if (["head", "member", "accounting_staff", "teamleader"].includes(role)) {
    return { section: "projects", page: "Projects" };
  }
  return null;
}

const OPERATIONAL_ROLES = new Set([
  "head",
  "member",
  "accounting_staff",
  "teamleader",
]);

function isOperationalRole(role: string): boolean {
  return OPERATIONAL_ROLES.has(role);
}

const ACCOUNTING_SETTLEMENT_TYPES = new Set([
  "petty_cash_liquidation_accounting_review",
  "petty_cash_liquidation_department_review",
  "petty_cash_liquidation",
  "petty_cash_settlement_blocked",
  "petty_cash_return_approved",
  "petty_cash_return_received",
]);

const REQUESTER_BUDGET_TYPES = new Set([
  "budget_decision",
  "petty_cash_decision",
  "petty_cash_released",
  "petty_cash_changes",
  "petty_cash_liquidation_changes",
  "petty_cash_liquidation_overdue",
  "petty_cash_liquidation_decision",
  "petty_cash_request_expired",
]);

const HEAD_BUDGET_APPROVAL_TYPES = new Set([
  "budget_approval",
  "petty_cash_request",
  "petty_cash_department_approval",
  "petty_cash_liquidation_department_review",
  "petty_cash_settlement_blocked",
  "petty_cash_return_received",
]);

function destinationForBudget(
  notification: Notification,
  role: string,
): { route: { section: string; page: string } | null; label: string } {
  const title = notification.title.trim().toLowerCase();
  if (notification.financialRecordType === "office_petty_cash") {
    if (role === "head") {
      return { route: { section: "budget", page: "Office Budget" }, label: "Open Office Petty Cash" };
    }
    if (role === "accounting_staff") {
      return {
        route: { section: "accounting_budgets", page: "Office Budget Ledgers" },
        label: "Open Office Petty Cash",
      };
    }
    return { route: destinationForTask(role, notification), label: "Open Office Petty Cash" };
  }
  // A task-leader endorsement belongs in the reviewer's canonical review queue.
  if (notification.type.includes("leader_review")) {
    return { route: destinationForReview(role), label: "Open funding review" };
  }
  if (role === "accounting_staff") {
    if (ACCOUNTING_SETTLEMENT_TYPES.has(notification.type)) {
      return {
        route: { section: "accounting_releases", page: "Settlements" },
        label: "Open accounting settlements",
      };
    }
    if (
      notification.type === "petty_cash_release_ready" ||
      (notification.type.includes("release") && notification.type !== "petty_cash_released") ||
      (title.includes("ready for release") && !REQUESTER_BUDGET_TYPES.has(notification.type))
    ) {
      return {
        route: { section: "accounting_releases", page: "Voucher & Cash Releases" },
        label: "Open cash releases",
      };
    }
    if (notification.taskId && REQUESTER_BUDGET_TYPES.has(notification.type)) {
      return { route: destinationForTask(role, notification), label: "Open task funding" };
    }
    if (title.includes("scheduled") || title.includes("approved")) {
      return {
        route: { section: "accounting_releases", page: "Voucher & Cash Releases" },
        label: "Open cash releases",
      };
    }
    if (notification.taskId) {
      return { route: destinationForTask(role, notification), label: "Open task funding" };
    }
    return {
      route: { section: "accounting_audit", page: "Financial Audit Trail" },
      label: "Open accounting record",
    };
  }
  if (role === "head") {
    const isHeadApprovalAlert =
      HEAD_BUDGET_APPROVAL_TYPES.has(notification.type) ||
      (notification.type === "petty_cash_liquidation" &&
        (title.includes("approval") || title.includes("late") || title.includes("review") || title.includes("return"))) ||
      title.includes("head approval") ||
      title.includes("awaiting approval") ||
      title.includes("needs your approval");

    if (isHeadApprovalAlert) {
      return { route: { section: "reviews", page: "For Review" }, label: "Open funding review" };
    }
    if (notification.taskId) {
      return { route: destinationForTask(role, notification), label: "Open task funding" };
    }
    return { route: { section: "budget", page: "Office Budget" }, label: "Open Office Budget" };
  }
  if (role === "member" || role === "teamleader") {
    return { route: destinationForTask(role, notification), label: "Open task funding" };
  }
  return { route: null, label: "Open task funding" };
}

function makeDestination(
  notification: Notification,
  route: { section: string; page: string } | null,
  kind: NotificationIntentKind,
  label: string,
  entityLabel?: string,
  extra?: Partial<Pick<NotificationNavigationIntent, "inspectorSection" | "projectTab" | "proposalTab">>,
): NotificationDestination | null {
  if (!route) return null;
  const defaultInspectorSection =
    notification.workNodeId && ["subtask", "subtask_review", "leading_task"].includes(kind)
      ? kind === "subtask_review"
        ? "review"
        : "work"
      : undefined;
  return {
    ...route,
    label,
    intent: {
      notificationId: notification.id,
      kind,
      taskId: notification.taskId,
      projectId: notification.projectId,
      proposalId: notification.proposalId,
      entityLabel,
      entityId: notification.workNodeId,
      inspectorSection: extra?.inspectorSection ?? defaultInspectorSection,
      financialRecordId: notification.financialRecordId,
      financialRecordType: notification.financialRecordType,
      ...(notification.conversationId ? { conversationId: notification.conversationId } : {}),
      ...(notification.conversationMessageId
        ? { conversationMessageId: notification.conversationMessageId }
        : {}),
      ...(extra?.projectTab ? { projectTab: extra.projectTab } : {}),
      ...(extra?.proposalTab ? { proposalTab: extra.proposalTab } : {}),
    },
  };
}

/**
 * Resolves persisted notification data to stable role navigation contracts.
 * Quoted labels keep older subtask notifications useful even though the
 * original table stores their parent task id rather than a subtask id.
 */
export function resolveNotificationDestination(
  notification: Notification,
  role: string,
): NotificationDestination | null {
  if (notification.conversationId) {
    return makeDestination(
      notification,
      isOperationalRole(role) ? { section: "messages", page: "Messages" } : null,
      "conversation",
      "Open conversation",
    );
  }
  const title = notification.title.trim().toLowerCase();
  const messageLabels = quotedLabels(notification.message || "");
  const isSubtask = !!notification.workNodeId || title.includes("subtask");

  if (notification.entityType === "m7_personal_work_proposal" && notification.taskId) {
    const isAuthorDecision = notification.type === "status_change";
    return makeDestination(
      notification,
      isOperationalRole(role)
        ? { section: "personal_work", page: isAuthorDecision ? "Assigned work" : "Leading" }
        : null,
      "personal_work",
      isAuthorDecision ? "Open personal work decision" : "Open personal work submission",
      messageLabels[0],
      isAuthorDecision ? undefined : { inspectorSection: "review" },
    );
  }

  if (notification.financialRecordType === "independent_liquidation_review") {
    return makeDestination(
      notification,
      ["head", "member", "accounting_staff"].includes(role)
        ? { section: "inbox", page: "Needs action" }
        : null,
      "budget",
      "Open independent review",
    );
  }

  if (notification.financialRecordType === "settlement_staffing") {
    return makeDestination(
      notification,
      role === "head" ? { section: "reviews", page: "For Review" } : null,
      "budget",
      "Open budget review",
    );
  }

  if (notification.financialRecordType === "office_petty_cash_staffing") {
    return makeDestination(
      notification,
      role === "head"
        ? { section: "budget", page: "Office Budget" }
        : role === "accounting_staff"
          ? { section: "accounting_budgets", page: "Office Budget Ledgers" }
          : null,
      "budget",
      "Open Office Petty Cash",
    );
  }

  if (
    notification.type === "project_retention_ready" ||
    notification.type === "project_retention_blocked" ||
    notification.type === "project_retention_notice"
  ) {
    if (role === "admin") {
      return makeDestination(
        notification,
        { section: "administration", page: "Archive & Retention" },
        "project",
        "Open archive & retention",
      );
    }
    return makeDestination(
      notification,
      notification.projectId ? destinationForProject(role) : null,
      "project",
      "Review project retention",
    );
  }

  if (notification.type === "project_archive_blocked" && notification.projectId) {
    return makeDestination(
      { ...notification, financialRecordType: "project_archive_blocker" },
      destinationForProject(role),
      "project",
      "Review archive requirements",
    );
  }

  // Non-Head project approval requests & decisions
  if (
    notification.type === "project_approval_request" ||
    (notification.entityType === "project_approval" && notification.type === "approval_needed")
  ) {
    if (role === "head") {
      return makeDestination(
        notification,
        { section: "reviews", page: "For Review" },
        "project_approval",
        "Review project approval",
        messageLabels[0],
      );
    }
    return makeDestination(
      notification,
      notification.projectId ? destinationForProject(role) : null,
      "project",
      "Open project setup",
      messageLabels[0],
      { projectTab: "settings" },
    );
  }

  if (notification.entityType === "project_approval" && notification.projectId) {
    return makeDestination(
      notification,
      destinationForProject(role),
      "project",
      "Open project setup",
      messageLabels[0],
      { projectTab: "settings" },
    );
  }

  // Two-step project funding approval & certification workflow
  if (
    notification.type === "project_funding_request" ||
    notification.type === "project_funding_certification" ||
    notification.type === "project_funding_decided" ||
    notification.entityType === "project_funding" ||
    notification.financialRecordType === "project_funding"
  ) {
    const fundingNotif: Notification = {
      ...notification,
      financialRecordType: notification.financialRecordType || "project_funding",
    };
    if (notification.type === "project_funding_request") {
      if (role === "head") {
        return makeDestination(
          fundingNotif,
          { section: "reviews", page: "For Review" },
          "budget",
          "Review project funding",
          messageLabels[0],
        );
      }
      if (role === "accounting_staff") {
        return makeDestination(
          fundingNotif,
          { section: "accounting_overview", page: "Accounting Overview" },
          "budget",
          "Open funding certification",
          messageLabels[0],
        );
      }
    }
    if (notification.type === "project_funding_certification") {
      if (role === "accounting_staff") {
        return makeDestination(
          fundingNotif,
          { section: "accounting_overview", page: "Accounting Overview" },
          "budget",
          "Open funding certification",
          messageLabels[0],
        );
      }
      if (role === "head") {
        return makeDestination(
          fundingNotif,
          { section: "reviews", page: "For Review" },
          "budget",
          "Review project funding",
          messageLabels[0],
        );
      }
    }
    return makeDestination(
      fundingNotif,
      notification.projectId ? destinationForProject(role) : null,
      "project",
      "Open project funding",
      messageLabels[0],
      { projectTab: "budget" },
    );
  }

  // Project completion review request (Project Lead -> Office Head)
  if (
    (notification.entityType === "project_completion_review" &&
      notification.type === "approval_needed") ||
    (notification.type === "approval_needed" &&
      Boolean(notification.projectId) &&
      !notification.taskId &&
      title.includes("completion"))
  ) {
    if (role === "head") {
      return makeDestination(
        notification,
        { section: "reviews", page: "For Review" },
        "project_completion_review",
        "Open project completion review",
        messageLabels[0],
      );
    }
    return makeDestination(
      notification,
      notification.projectId ? destinationForProject(role) : null,
      "project",
      "Open project",
      messageLabels[0],
    );
  }

  if (
    notification.type.startsWith("budget_") ||
    notification.type.startsWith("petty_cash_") ||
    notification.financialRecordType === "office_petty_cash"
  ) {
    if (
      notification.financialRecordType === "work_cash_assignment" &&
      notification.workNodeId &&
      [
        "petty_cash_liquidation_decision",
        "petty_cash_liquidation_changes",
      ].includes(notification.type)
    ) {
      return makeDestination(
        notification,
        destinationForSubtask(role),
        "subtask",
        "Open subtask",
        messageLabels[0],
      );
    }
    const budgetTarget = destinationForBudget(notification, role);
    return makeDestination(
      notification,
      budgetTarget.route,
      "budget",
      budgetTarget.label,
      notification.taskTitle || messageLabels[0],
    );
  }

  if (
    notification.entityType === "collaboration_draft" ||
    notification.type.startsWith("collaboration_")
  ) {
    const proposalTab: NotificationProposalTab =
      title.includes("closeout") || title.includes("governance")
        ? "governance"
        : notification.type === "collaboration_request" ||
            title.includes("approval") ||
            title.includes("review") ||
            title.includes("delegated") ||
            title.includes("overdue")
          ? "approvals"
          : "overview";
    const label =
      proposalTab === "governance"
        ? "Open collaboration governance"
        : proposalTab === "approvals"
          ? "Open collaboration review"
          : "Open collaboration plan";
    return makeDestination(
      notification,
      destinationForProject(role),
      "collaboration",
      label,
      notification.message.trim() || undefined,
      { proposalTab },
    );
  }

  if (title.includes("announcement")) {
    return makeDestination(
      notification,
      destinationForAnnouncement(role),
      "announcement",
      "Open announcements",
      notification.message.trim() || undefined,
    );
  }

  if (title.includes("overloaded member")) {
    if (role === "head" && notification.projectId) {
      return makeDestination(
        notification,
        destinationForProject(role),
        "project",
        "Review project workload",
        messageLabels[0],
        { projectTab: "members" },
      );
    }
    const route =
      role === "head"
        ? { section: "team", page: "Analytics" }
        : isOperationalRole(role)
          ? { section: "personal_work", page: "Assigned work" }
          : null;
    return makeDestination(notification, route, "team_intelligence", "Open workload insight");
  }

  if (notification.type === "burnout_warning") {
    const route =
      role === "head"
        ? { section: "team", page: "Analytics" }
        : ["accounting_staff", "member", "teamleader"].includes(role)
          ? { section: "personal_work", page: "Assigned work" }
          : null;
    return makeDestination(notification, route, "team_intelligence", "Open workload insight");
  }

  if (notification.type === "office_invitation_accepted") {
    return makeDestination(
      notification,
      role === "head" ? { section: "team", page: "Office Team" } : null,
      "team_intelligence",
      "Open Office Team",
    );
  }

  if (notification.entityType === "m7_work_proposal" && notification.taskId) {
    if (notification.type === "status_change") {
      if (notification.workNodeId) {
        return makeDestination(
          notification,
          destinationForSubtask(role),
          "subtask",
          "Open subtask decision",
          messageLabels[0],
        );
      }
      return makeDestination(
        notification,
        destinationForTask(role, notification),
        "task",
        "Open task decision",
        notification.taskTitle || messageLabels[0],
      );
    }
    const route = isOperationalRole(role)
      ? { section: "personal_work", page: "Leading" }
      : null;
    return makeDestination(
      notification,
      route,
      "leading_task",
      notification.workNodeId ? "Open subtask submission" : "Open task submission",
      messageLabels[0],
      notification.workNodeId ? { inspectorSection: "review" } : undefined,
    );
  }

  if (notification.entityType === "work_change" && notification.taskId) {
    return makeDestination(
      notification,
      notification.workNodeId
        ? isOperationalRole(role)
          ? { section: "personal_work", page: "Leading" }
          : null
        : destinationForTask(role, notification),
      notification.workNodeId ? "leading_task" : "task",
      notification.workNodeId ? "View subtask changes" : "View task changes",
      messageLabels[0],
    );
  }

  if (
    isSubtask &&
    ["progress updated", "work updated", "blocker reported", "subtask completed"].some((label) =>
      title.includes(label),
    )
  ) {
    const route = isOperationalRole(role)
      ? { section: "personal_work", page: "Leading" }
      : destinationForTask(role, notification);
    return makeDestination(
      notification,
      route,
      "leading_task",
      "Open leading task",
      messageLabels[0],
    );
  }

  const needsReview =
    notification.type === "approval_needed" ||
    notification.statusTo?.toLowerCase() === "for_review" ||
    title.includes("ready for review");

  if (isSubtask && needsReview) {
    return makeDestination(
      notification,
      destinationForReview(role),
      "subtask_review",
      "Open subtask review",
      messageLabels[0],
      { inspectorSection: "review" },
    );
  }

  if (!isSubtask && needsReview) {
    if (!notification.taskId && notification.projectId) {
      return makeDestination(
        notification,
        destinationForProject(role),
        "project",
        "Open project",
        messageLabels[0],
      );
    }
    return makeDestination(
      notification,
      destinationForReview(role),
      "task_review",
      "Open task review",
      notification.taskTitle || messageLabels[0],
    );
  }

  if (isSubtask) {
    return makeDestination(
      notification,
      destinationForSubtask(role),
      "subtask",
      "Open subtask",
      messageLabels[0],
    );
  }

  if (notification.entityType === "proposal" && notification.proposalId) {
    return makeDestination(
      notification,
      destinationForProject(role),
      "proposal",
      "Open proposal",
      messageLabels[0],
    );
  }

  if (
    notification.projectId &&
    (notification.type === "project_office_invitation" ||
      notification.title.startsWith("Project invitation"))
  ) {
    return makeDestination(
      notification,
      destinationForProject(role),
      "project",
      "Open project invitations",
      messageLabels[0],
      { projectTab: "members" },
    );
  }

  if (notification.taskId) {
    return makeDestination(
      notification,
      destinationForTask(role, notification),
      "task",
      "Open task",
      notification.taskTitle || messageLabels[0],
    );
  }

  if (notification.projectId) {
    return makeDestination(
      notification,
      destinationForProject(role),
      "project",
      "Open project",
      messageLabels[0],
    );
  }

  return null;
}
