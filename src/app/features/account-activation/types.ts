export type ManagedAccountRole = 'member' | 'accounting_staff' | 'head' | 'admin';
export interface ActivationNotes { strengths: string; weaknesses: string; notes: string; tags: string[] }
export interface StageAccountActivation {
  request_id: string; mode: 'ledipo_create' | 'office_invite'; email: string; full_name: string;
  role: ManagedAccountRole; org_id: string; skills: Record<string, boolean>; pds_notes?: ActivationNotes | null;
}
export interface PendingActivation {
  invitation_id: string; email: string; full_name: string; office_id: string; office_name: string;
  account_role: 'member' | 'accounting_staff'; requested_privileged_role: 'head' | 'admin' | null;
  source_mode: 'ledipo_create' | 'office_invite'; status: 'pending' | 'accepted' | 'expired' | 'revoked';
  email_delivery_status: 'queued' | 'sent' | 'delivered' | 'bounced' | 'failed' | null;
  expires_at: string; created_at: string; last_sent_at: string | null; awaiting_authority: boolean; needs_reconciliation?: boolean; delivery_error?: string; requires_reinvite?:boolean;
}
export interface ActivationOffice { id: string; name: string; slug: string }
export interface ActivationPreview { email: string; full_name: string; office_name: string; account_role: string; requested_privileged_role: string | null; expires_at: string }
export interface ActivationResult { activated: boolean; next_step: 'sign_in' | 'awaiting_authority' }
