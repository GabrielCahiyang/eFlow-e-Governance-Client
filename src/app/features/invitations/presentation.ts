import type { Invitation } from './types';
export function invitationValidity(item: Invitation, now = Date.now()) {
  if (item.status === 'pending' && Number.isFinite(Date.parse(item.expires_at)) && Date.parse(item.expires_at) <= now) return 'expired';
  return item.status;
}
export const invitationCanManage = (item: Invitation) => ['pending', 'expired'].includes(item.status);
export const deliveryLabel = (item: Invitation) => item.email_delivery_status ? ({ queued: 'Queued', sent: 'Sent', delivered: 'Delivered', bounced: 'Bounced', failed: 'Failed' }[item.email_delivery_status]) : 'Not reported';
