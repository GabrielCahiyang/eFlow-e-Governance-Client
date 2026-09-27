import type { Notification } from "../../services/notificationService";

export type NotificationIntentKind =
  | "task"
  | "subtask"
  | "leading_task"
  | "task_review"
  | "subtask_review"
  | "announcement"
  | "team_intelligence"
  | "project"
  | "proposal"
  | "collaboration"
  | "budget";

export interface NotificationNavigationIntent {
  notificationId: string;
  kind: NotificationIntentKind;
  taskId?: string;
  projectId?: string;
  proposalId?: string;
  entityLabel?: string;
  financialRecordId?: string;
  financialRecordType?: string;
}

export interface NotificationDestination {
  section: string;
  page: string;
  label: string;
  intent: NotificationNavigationIntent;
}

function quotedLabels(value: string): string[] {
  const normalized = value.replace(/[“”]/g, '"');
  return Array.from(normalized.matchAll(/"([^"]+)"/g), (match) => match[1].trim())
    .filter(Boolean);
}

function destinationForTask(role: string) {
  if (role === "superadmin") return null;
  if (role === "depthead") return { section: "tasks", page: "Task Board" };
  if (role === "employee" || role === "teamleader") {
    return { section: "tasks", page: "My Tasks" };
  }
  return null;
}

function destinationForSubtask(role: string) {
  if (role === "depthead" || role === "employee" || role === "teamleader") {
    return { section: "subtasks", page: "My Subtasks" };
  }
  return destinationForTask(role);
}

function destinationForReview(role: string) {
  if (role === "depthead") return { section: "reviews", page: "For Review" };
  if (role === "employee" || role === "teamleader") {
    return { section: "reviews", page: "Leader Reviews" };
  }
  return destinationForTask(role);
}

function destinationForAnnouncement(role: string) {
  if (["superadmin", "depthead", "employee", "teamleader"].includes(role)) {
    return { section: "announcements", page: "Announcements" };
  }
  return null;
}

function destinationForProject(role: string) {
  if (["superadmin", "depthead", "employee", "teamleader"].includes(role)) {
    return { section: "projects", page: "Projects" };
  }
  return null;
}

function destinationForBudget(notification: Notification, role: string) {
  if (role === "accounting_staff") {
    return notification.type.includes("settlement") || notification.type.includes("release") || notification.type.includes("liquidation")
      ? { section: "accounting_releases", page: "Voucher & Cash Releases" }
      : { section: "accounting_audit", page: "Financial Audit Trail" };
  }
  if (role === "depthead") {
    return { section: "reviews", page: "For Review" };
  }
  if (role === "employee" || role === "teamleader") {
    if (notification.type.includes("leader_review")) {
      return { section: "reviews", page: "Leader Reviews" };
    }
    return { section: "tasks", page: "My Tasks" };
  }
  return null;
}

function makeDestination(
  notification: Notification,
  route: { section: string; page: string } | null,
  kind: NotificationIntentKind,
  label: string,
  entityLabel?: string,
): NotificationDestination | null {
  if (!route) return null;
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
      financialRecordId: notification.financialRecordId,
      financialRecordType: notification.financialRecordType,
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
  const title = notification.title.trim().toLowerCase();
  const messageLabels = quotedLabels(notification.message || "");
  const isSubtask = title.includes("subtask");

  if (
    notification.type.startsWith("budget_")
    || notification.type.startsWith("petty_cash_")
  ) {
    return makeDestination(
      notification,
      destinationForBudget(notification, role),
      "budget",
      role === "accounting_staff" ? "Open accounting record" : role === "depthead" || notification.type.includes("leader_review") ? "Open funding review" : "Open task funding",
      notification.taskTitle || messageLabels[0],
    );
  }

  if (notification.entityType === "collaboration_draft" || notification.type.startsWith("collaboration_")) {
    return makeDestination(
      notification,
      destinationForProject(role),
      "collaboration",
      "Open collaboration review",
      notification.message.trim() || undefined,
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

  if (notification.type === "burnout_warning") {
    const route = role === "depthead"
      ? { section: "intelligence", page: "Team Intelligence" }
      : role === "employee" || role === "teamleader"
        ? { section: "performance", page: "Performance" }
        : null;
    return makeDestination(notification, route, "team_intelligence", "Open workload insight");
  }

  if (isSubtask && title.includes("progress updated")) {
    const route = role === "depthead" || role === "employee" || role === "teamleader"
      ? { section: "leading", page: "Leading Work" }
      : destinationForTask(role);
    return makeDestination(
      notification,
      route,
      "leading_task",
      "Open leading task",
      messageLabels[0],
    );
  }

  const needsReview = notification.type === "approval_needed"
    || notification.statusTo?.toLowerCase() === "for_review"
    || title.includes("ready for review");

  if (isSubtask && needsReview) {
    return makeDestination(
      notification,
      destinationForReview(role),
      "subtask_review",
      "Open subtask review",
      messageLabels[0],
    );
  }

  if (!isSubtask && needsReview) {
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

  if (notification.projectId) {
    return makeDestination(
      notification,
      destinationForProject(role),
      "project",
      "Open project",
      messageLabels[0],
    );
  }

  if (notification.taskId) {
    return makeDestination(
      notification,
      destinationForTask(role),
      "task",
      "Open task",
      notification.taskTitle || messageLabels[0],
    );
  }

  return null;
}
