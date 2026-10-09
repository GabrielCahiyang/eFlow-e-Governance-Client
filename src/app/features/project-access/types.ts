export type AccessPermission='viewer'|'member';
export type Engagement='Permanent'|'Job Order'|'OJT'|'Consultant'|'Other';
export interface AccessGrant {id:string;project_id:string;recipient:string;office_id:string|null;name:string;email:string;access:AccessPermission;engagement:Engagement;access_end:string|null;until_close:boolean;revoked_at:string|null;effective:boolean;redeemed_at:string|null;redeem_expires_at:string;can_revoke:boolean}
export interface AccessSnapshot {can_share:boolean;open:boolean;timezone:string;kind:'office'|'personal';grants:AccessGrant[];can_remove_offices:string[];can_remove_personal:boolean}
export interface RemovalImpact {project:string;user:string;office:string|null;fingerprint:string;tasks:{id:string;title:string;status:string;lead?:string|null;recommendation_lead?:string|null;reviewer?:string|null}[];nodes:{id:string;root:string;title:string;status:string;lead:string|null;people:string[]}[]}
export interface SelectionImpact {fingerprint:string;removed:RemovalImpact[]}
