export interface ProjectOffice {
  id: string; project_id: string; office_id: string;
  relationship_type: 'lead' | 'collaborating' | 'observer';
  invitation_status: 'pending' | 'awaiting_head' | 'joined' | 'revoked';
  contact_email: string; contact_user_id: string | null; joined_at: string | null;
}
export interface ProjectOfficeMember { project_office_id: string; user_id: string }
export interface OfficeProposal { name: string; officeId: string; evidence: string }
export interface ProjectOfficeState {
  offices: ProjectOffice[]; members: ProjectOfficeMember[]; loading: boolean; error: string;
  refresh: () => Promise<void>;
}
