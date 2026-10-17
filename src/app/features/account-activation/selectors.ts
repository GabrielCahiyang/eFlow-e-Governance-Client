import type { PendingActivation } from './types';
export function activationLabel(invite: PendingActivation, now = Date.now()) {
  if (invite.awaiting_authority) return 'Awaiting Admin approval';
  if (invite.status === 'accepted') return 'Activated';
  if (invite.status === 'revoked') return 'Revoked';
  if (invite.status === 'expired' || Date.parse(invite.expires_at) <= now) return 'Expired';
  return 'Pending activation';
}
export const activationRoleLabel = (role: string) => ({ member: 'Member', accounting_staff: 'Accounting Staff', head: 'Head', admin: 'Admin' })[role] || role;
