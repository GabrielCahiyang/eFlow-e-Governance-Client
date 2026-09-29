import type { Notification, NotificationType } from "../../services/notificationService";

export type NotificationDetailTone = "neutral" | "info" | "success" | "warning" | "danger";

export interface NotificationDetail {
  label: string;
  text: string;
  tone: NotificationDetailTone;
}

type DetailSource = Pick<
  Notification,
  "reason" | "title" | "statusFrom" | "statusTo"
> & { type: NotificationType };

export function getNotificationDetail(
  notification: DetailSource,
): NotificationDetail | null {
  const text = notification.reason?.trim();
  if (!text) return null;

  const title = notification.title.toLowerCase();
  const destination = notification.statusTo?.toLowerCase();

  if (title.includes("updates needed") || destination === "changes_requested") {
    return { label: "Reviewer feedback", text, tone: "danger" };
  }

  if (title.includes("approved") || (notification.type === "completed" && destination === "completed")) {
    return { label: "Approval note", text, tone: "success" };
  }

  if (title.includes("evidence ready for review")) {
    return { label: "Submission note", text, tone: "info" };
  }

  if (title.includes("ready for review") || destination === "for_review") {
    return { label: "Completion note", text, tone: "info" };
  }

  if (title.includes("cancel") || destination === "cancelled") {
    return { label: "Cancellation reason", text, tone: "warning" };
  }

  if (title.includes("reopen") || (notification.statusFrom === "completed" && destination === "in_progress")) {
    return { label: "Reopening reason", text, tone: "warning" };
  }

  if (notification.type === "reassignment") {
    return { label: "Reassignment note", text, tone: "neutral" };
  }

  return { label: "Details", text, tone: "neutral" };
}
