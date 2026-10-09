export const ENGAGEMENT_TYPES=['Permanent','Job Order','OJT','Consultant','Other'] as const;
export type Engagement=typeof ENGAGEMENT_TYPES[number];
export interface SelectedMember {user_id:string;project_office_id?:string;office?:string;office_name?:string;name:string;engagement:Engagement;access_end:string|null;until_close:boolean;access_ended_at:string|null;eligible:boolean;can_read?:boolean;access:string;state:string;responsibilities?:{root:string;title:string;role:string;node?:string}[]}
export interface MemberOffice {id:string;project_id:string;office_id:string;name:string;can_select:boolean;eligible_count:number;invitation_status:string;relationship_type:string}
export interface MembersSnapshot {kind:'office'|'personal';timezone?:string;members:SelectedMember[];offices:MemberOffice[];can_select?:boolean}
