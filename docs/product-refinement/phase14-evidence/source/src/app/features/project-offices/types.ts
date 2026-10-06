export interface ProjectOffice {
  id: string; project_id: string; office_id: string;
  relationship_type: 'lead' | 'collaborating' | 'observer';
  invitation_status: 'pending' | 'awaiting_head' | 'joined' | 'revoked';
  contact_email: string; contact_user_id: string | null; joined_at: string | null;
}
export interface ProjectOfficeMember { project_office_id: string; user_id: string }
export interface OfficeProposal { name: string; officeId: string; evidence: string }
export interface ProposedOfficeTask { id: string; title: string; proposed_office_identity_id: string }
export interface OfficeIdentity {
  id: string; project_id: string; display_name: string;
  canonical_office_id: string | null; project_office_id: string | null;
  relationship_type: 'lead' | 'collaborating' | 'observer';
  contact_email: string; contact_user_id: string | null;
  contact_status: 'none' | 'invited' | 'accepted' | 'revoked';
  provenance: { source?: string; evidence?: string };
}
export interface ProjectOfficeState {
  projectId?: string;
  offices: ProjectOffice[]; members: ProjectOfficeMember[]; loading: boolean; error: string;
  identities?: OfficeIdentity[]; identityError?: string;
  refresh: () => Promise<void>;
}
