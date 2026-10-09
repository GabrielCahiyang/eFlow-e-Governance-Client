export type InvitedRole = 'member' | 'accounting_staff';
export interface Invitation {
  invitation_type?: 'office_member' | 'project_office' | 'project_office_identity' | 'project_member'; project_office_id?: string; project_office_identity_id?: string;
  id: string; email: string; account_role: InvitedRole; status: 'pending' | 'accepted' | 'expired' | 'revoked';
  expires_at: string; created_at: string; send_count: number;
  email_delivery_status: 'queued' | 'sent' | 'delivered' | 'bounced' | 'failed' | null;
  delivery_error?: string; invitation_url?: string;
  pds_documents?: { id: string; original_filename: string; processing_status: string; processing_error?: string }[];
}
export interface InvitationMetadata { home_workspace_id?:string;engagement?:string;access_end?:string|null;until_close?:boolean;summary?:string;skills?:string[];email: string; office_name: string; account_role: InvitedRole; expires_at: string; existing_account: boolean; needs_full_name?: boolean; invitation_type?: 'office_member' | 'project_office' | 'project_office_identity' | 'project_member'; project_id?: string; project_title?: string; workspace_access?: 'collaborating' | 'observer'; }
export interface InviteResult { email: string; invitation?: Invitation; error?: string; }
