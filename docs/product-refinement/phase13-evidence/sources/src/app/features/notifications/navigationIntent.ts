import type { NotificationNavigationIntent } from "./navigation";

type IntentListener = (intent: NotificationNavigationIntent) => void;

let pendingIntent: NotificationNavigationIntent | null = null;
const listeners = new Set<IntentListener>();

export function queueNotificationNavigationIntent(
  intent: NotificationNavigationIntent,
): void {
  pendingIntent = intent;
  listeners.forEach((listener) => listener(intent));
}

export function peekNotificationNavigationIntent(): NotificationNavigationIntent | null {
  return pendingIntent;
}

export function completeNotificationNavigationIntent(notificationId: string): void {
  if (pendingIntent?.notificationId === notificationId) pendingIntent = null;
}

export function subscribeToNotificationNavigationIntent(
  listener: IntentListener,
): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
