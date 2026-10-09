import type {Engagement} from '../project-members';
export interface ProjectInvitation {
 id:string;project_id:string;root_id:string|null;node_id:string|null;office_id:string;email:string;summary:string;skills:string[];
 engagement:Engagement;access_end:string|null;until_close:boolean;kind:'office'|'personal';revision:number;
 state:'pending'|'approved'|'rejected'|'revoked'|'expired'|'accepted';
 invitation_created_at:string|null;expires_at:string|null;delivery_status:'not_attempted'|'attempting'|'provider_accepted'|'failed';delivery_error:string|null;
 accepted_by?:string|null;onboarding:'pending'|'complete';can_approve:boolean;can_dispatch:boolean;can_revoke:boolean;can_complete_onboarding?:boolean;
 pds_documents:{id:string;original_filename:string;processing_status:string}[];
}
export interface InvitationContext {kind:'office'|'personal';office_id:string|null;can_request?:boolean;requests:ProjectInvitation[];timezone?:string;workspace_id?:string;can_designate?:boolean}
export interface InvitationDraft {id:string;email:string;summary:string;skills:string;engagement:Engagement;end:string;untilClose:boolean;file?:File}
