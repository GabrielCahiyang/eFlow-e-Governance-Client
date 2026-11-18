import type { Notification } from "../../services/notificationService";

export type NotificationIntentKind =
  | "task"
  | "subtask"
  | "leading_task"
  | "personal_work"
  | "task_review"
  | "subtask_review"
  | "announcement"
  | "team_intelligence"
  | "project"
  | "membership_review"
  | "proposal"
  | "collaboration"
  | "conversation"
  | "budget";

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
  inspectorSection?:'work'|'review';
  financialRecordId?: string;
  financialRecordType?: string;
  conversationId?: string;
  conversationMessageId?: string;
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

function destinationForBudget(notification: Notification, role: string): { route: { section: string; page: string } | null; label: string } {
  const title = notification.title.trim().toLowerCase();
  if (notification.financialRecordType === "office_petty_cash") {
    if (role === "head") return { route: { section: "budget", page: "Office Budget" }, label: "Open Office Petty Cash" };
    if (role === "accounting_staff") return { route: { section: "accounting_releases", page: "Voucher & Cash Releases" }, label: "Open Office Petty Cash" };
    return { route: destinationForTask(role, notification), label: "Open Office Petty Cash" };
  }
  // A task-leader endorsement belongs in Leader Reviews, even for accounting staff who lead the task.
  if (notification.type.includes("leader_review")) {
    return { route: { section: "reviews", page: "Leader Reviews" }, label: "Open funding review" };
  }
  if (role === "accounting_staff") {
    if (
      notification.type.includes("settlement") ||
      notification.type.includes("release") ||
      notification.type.includes("liquidation") ||
      title.includes("scheduled") ||
      title.includes("approved")
    ) {
      return { route: { section: "accounting_releases", page: "Voucher & Cash Releases" }, label: "Open cash releases" };
    }
    if (notification.taskId) {
      return { route: destinationForTask(role, notification), label: "Open task funding" };
    }
    return { route: { section: "accounting_audit", page: "Financial Audit Trail" }, label: "Open accounting record" };
  }
  if (role === "head") {
    if (
      notification.taskId &&
      ["petty_cash_decision", "petty_cash_released", "petty_cash_liquidation_decision"].includes(notification.type)
    ) {
      return { route: destinationForTask(role, notification), label: "Open task funding" };
    }
    return { route: { section: "reviews", page: "For Review" }, label: "Open funding review" };
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
      entityId: notification.workNodeId,
      inspectorSection:notification.workNodeId&&['subtask','subtask_review','leading_task'].includes(kind)?kind==='subtask_review'?'review':'work':undefined,
      financialRecordId: notification.financialRecordId,
      financialRecordType: notification.financialRecordType,
      ...(notification.conversationId ? { conversationId: notification.conversationId } : {}),
      ...(notification.conversationMessageId ? { conversationMessageId: notification.conversationMessageId } : {}),
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
    return makeDestination(notification, { section: 'messages', page: 'Messages' }, 'conversation', 'Open conversation');
  }
  const title = notification.title.trim().toLowerCase();
  const messageLabels = quotedLabels(notification.message || "");
  const isSubtask = !!notification.workNodeId || title.includes("subtask");
  if (notification.entityType === 'm7_personal_work_proposal' && notification.taskId) {
    return makeDestination(notification,
      ['head', 'member', 'accounting_staff', 'teamleader'].includes(role) ? { section: 'personal_work', page: 'Leading' } : null,
      'personal_work', 'Open personal work submission', messageLabels[0]);
  }
  if (notification.financialRecordType === 'independent_liquidation_review') {
    return makeDestination(notification, ['head','member','accounting_staff'].includes(role) ? { section: 'inbox', page: 'Needs action' } : null, 'budget', 'Open independent review');
  }
  if (notification.financialRecordType === 'settlement_staffing') {
    return makeDestination(notification, role === 'head' ? { section: 'reviews', page: 'For Review' } : null, 'budget', 'Open budget review');
  }
  if (notification.financialRecordType === 'office_petty_cash_staffing') {
    return makeDestination(notification, role === 'head' ? { section: 'budget', page: 'Office Budget' } : null, 'budget', 'Open Office Petty Cash');
  }
  if (notification.type === 'project_archive_blocked' && notification.projectId) {
    return makeDestination({ ...notification, financialRecordType: 'project_archive_blocker' }, destinationForProject(role), 'project', 'Review archive requirements');
  }

  if (
    notification.type.startsWith("budget_")
    || notification.type.startsWith("petty_cash_")
  ) {
    const budgetTarget = destinationForBudget(notification, role);
    return makeDestination(
      notification,
      budgetTarget.route,
      "budget",
      budgetTarget.label,
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
    const route = role === "head"
      ? { section: "team", page: "Analytics" }
      : ["accounting_staff", "member", "teamleader"].includes(role)
        ? { section: "personal_work", page: "Assigned work" }
        : null;
    return makeDestination(notification, route, "team_intelligence", "Open workload insight");
  }

  if (notification.entityType === 'm7_work_proposal' && notification.taskId) {
    const route = ["head", "member", "accounting_staff", "teamleader"].includes(role)
      ? { section: "personal_work", page: "Leading" }
      : null;
    return makeDestination(notification, route, "leading_task", notification.workNodeId ? "Open subtask submission" : "Open task submission");
  }

  if (notification.entityType === 'work_change' && notification.taskId) {
    return makeDestination(notification,
      notification.workNodeId ? ['head', 'member', 'accounting_staff', 'teamleader'].includes(role)
        ? { section: 'personal_work', page: 'Leading' } : null : destinationForTask(role, notification),
      notification.workNodeId ? 'leading_task' : 'task',
      notification.workNodeId ? 'View subtask changes' : 'View task changes', messageLabels[0]);
  }

  if (isSubtask && ["progress updated","work updated","blocker reported","subtask completed"].some(label=>title.includes(label))) {
    const route = role === "head" || role === "member" || role === "accounting_staff" || role === "teamleader"
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

  if (notification.projectId && role === 'head' && notification.title.startsWith('Project invitation')) {
    return makeDestination(notification, destinationForProject(role), 'project', 'Open project invitations', messageLabels[0]);
  }
  if (notification.taskId && (notification.type === 'reminder' || notification.type === 'overdue')) {
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

  if (notification.taskId) {
    return makeDestination(
      notification,
      destinationForTask(role, notification),
      "task",
      "Open task",
      notification.taskTitle || messageLabels[0],
    );
  }

  return null;
}
