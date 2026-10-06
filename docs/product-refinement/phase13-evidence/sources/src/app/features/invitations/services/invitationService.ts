import { jsonRequest, phase2Request } from '../../../shared/phase2Api';
import type { Invitation, InvitationMetadata, InviteResult, InvitedRole } from '../types';
export const listInvitations = () => phase2Request<{ invitations: Invitation[] }>('/invitations');
export const sendInvitations = (invitations: { email: string; account_role: InvitedRole }[]) => phase2Request<{ results: InviteResult[] }>('/invitations', jsonRequest('POST', { invitations }));
export const resendInvitation = (id: string, copyLink = false) => phase2Request<Invitation>(`/invitations/${id}/resend`, jsonRequest('POST', { copy_link: copyLink }));
export const revokeInvitation = (id: string) => phase2Request<Invitation>(`/invitations/${id}/revoke`, { method: 'POST' });
export const validateInvitation = (token: string) => phase2Request<InvitationMetadata>('/invitations/validate', jsonRequest('POST', { token }), true);
export const createInvitedAccount = (token: string, fullName: string, password: string, attemptId: string) => phase2Request('/invitations/create-account', jsonRequest('POST', { token, full_name: fullName, password, attempt_id: attemptId }), true);
export const acceptInvitation = (token: string, fullName?: string) => phase2Request('/invitations/accept', jsonRequest('POST', { token, ...(fullName ? { full_name: fullName } : {}) }));
