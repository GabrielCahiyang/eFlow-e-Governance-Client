import { jsonRequest, phase2Request } from '../../../shared/phase2Api';
import type { PdsDocument, ProfessionalProfile, ProfessionalValues } from '../types';
export const getProfessionalProfile = (id: string) => phase2Request<{ profile: ProfessionalProfile | null }>(`/professional-profile/${id}`);
export const updateProfessionalProfile = (profile: ProfessionalValues) => phase2Request<{ profile: ProfessionalProfile }>('/professional-profile/me', jsonRequest('PATCH', profile));
export const confirmProfessionalProfile = () => phase2Request<{ profile: ProfessionalProfile }>('/professional-profile/me/confirm', { method: 'POST' });
export const getMyPds = () => phase2Request<{ documents: PdsDocument[] }>('/pds/me');
export const retryPds = (id: string) => phase2Request(`/pds/${id}/process`, { method: 'POST' });
export const getPdsDownload = (id: string) => phase2Request<{ url: string }>(`/pds/${id}/download`);
export const getPdsDraft = (id: string) => phase2Request<{ draft: ProfessionalValues }>(`/pds/${id}/professional-draft`);
export function uploadPds(file: File, invitationId?: string) {
  return phase2Request<PdsDocument>(`/pds/upload${invitationId ? `?invitation_id=${encodeURIComponent(invitationId)}` : ''}`, { method: 'POST', headers: { 'Content-Type': 'application/pdf', 'X-File-Name': encodeURIComponent(file.name) }, body: file });
}

/** Future AI consumers get confirmed, concise professional data only. */
export function professionalStaffingContext(profile: ProfessionalProfile | null) {
  if (!profile?.confirmed_by_user) return null;
  return { skills: profile.skills.slice(0, 15), training: profile.trainings.slice(0, 8), specializations: profile.specializations.slice(0, 8), experience_summary: profile.competency_summary.slice(0, 700) };
}
