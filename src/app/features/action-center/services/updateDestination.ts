import { resolveNotificationDestination } from '../../notifications';
import type { Notification } from '../../../services/notificationService';
/** Accounting preserves its funding routes and also retains ordinary employee work. */
export function resolveInboxUpdateDestination(notification: Notification, role: string) {
  return resolveNotificationDestination(notification,role) || (role === 'accounting_staff' ? resolveNotificationDestination(notification,'member') : null);
}
