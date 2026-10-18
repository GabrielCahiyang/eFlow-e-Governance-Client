import { jsonRequest, phase2Request } from '../../../shared/phase2Api';
import type { ActivationOffice, ActivationPreview, ActivationResult, PendingActivation, StageAccountActivation } from '../types';
import {accountSkillsError} from '../validation';

export const stageAccountActivation = async (input: StageAccountActivation) => {
 const issue=accountSkillsError(input.skills)||accountSkillsError(Object.fromEntries((input.pds_notes?.tags||[]).map(tag=>[tag,true])));if(issue)throw new Error(issue);
 return phase2Request<PendingActivation>(input.mode === 'ledipo_create' ? '/admin/users/create' : '/admin/users/invite', jsonRequest('POST', input));
};
export const listPendingActivations = () => phase2Request<{ invitations: PendingActivation[] }>('/admin/users/pending-activation');
export const listActivationOffices = () => phase2Request<{ offices: ActivationOffice[] }>('/admin/users/invite-options');
export const manageAccountActivation = (id: string, action: 'resend' | 'revoke' | 'approve') => phase2Request<PendingActivation>(`/admin/users/pending-activation/${encodeURIComponent(id)}/${action}`, { method: 'POST' });
export const validateAccountActivation = (token: string) => phase2Request<ActivationPreview>('/invitations/managed-account/validate', jsonRequest('POST', { token }), true);
export const completeAccountActivation = (token: string, password: string, attemptId: string) => phase2Request<ActivationResult>('/invitations/managed-account/activate', jsonRequest('POST', { token, password, attempt_id: attemptId }), true);
