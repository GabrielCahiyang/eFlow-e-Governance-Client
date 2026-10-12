import type {WorkDisplayContext,WorkDisplayRow} from './selectors/displayTree';

export interface WorkPerson {id:string;name:string;office?:string;eligible?:boolean}
/** Display identities from an already permitted directory; never eligibility. */
export interface WorkPeopleDisplay {
 leadId:string|null;leadName:string|null;
 contributors:readonly {id:string;name:string}[];
 /** Unique appointed Lead plus distinct Contributors, for display attribution. */
 participantIds:readonly string[];
}
/** Optional current display context, separate from workflow/history records.
 * A path contains only supplied authorized titles. It conveys no root access.
 */
export interface WorkNodeDisplayMetadata extends WorkPeopleDisplay {
 rootId:string;nodeId:string;parentId:string|null;dueDate:string|null;
 path:WorkDisplayRow['path'];pathLabel:string;
 context:WorkDisplayContext;pathTruncated:boolean;
}
export type RootWorkAction='manage_contributors'|'appoint_lead'|'create_child'|'order_children';
export type NodeWorkAction=RootWorkAction|'edit_details'|'move'|'delete'|'execute'|'submit'|'review';
export type WorkCapabilityReasonCode='access_unavailable'|'read_only'|'branch_denied'|'appointment_denied'|'lifecycle_blocked'|'history_blocked';
export type WorkCapabilityEntry={allowed:true;reason_code:null}|{allowed:false;reason_code:WorkCapabilityReasonCode};
export type WorkCapabilityMap<Action extends NodeWorkAction>=Partial<Record<Action,WorkCapabilityEntry>>;
/** Current caller/scope, independent of any previously loaded snapshot. */
export interface WorkCapabilityContext {
 actorId:string|null;rootId:string;projectId:string;officeId:string|null;kind:'office'|'personal';revision:number;
 readOnly?:boolean;executionBlocked?:boolean;
}
export interface WorkActionAvailability {
 allowed:boolean;reason_code:WorkCapabilityReasonCode|'capability_unavailable'|null;disabledReason:string|null;
}
export interface WorkNode {
 id:string;task_id:string;parent_subtask_id:string|null;lead_id:string|null;title:string;
 assigned_to_ids:string[];sibling_order:number;position?:number;depth:number;due_date:string|null;
 is_standalone:boolean;status:'todo'|'in_progress'|'for_review'|'changes_requested'|'completed';percent_complete:number;
 can_manage:boolean;can_appoint:boolean;can_order:boolean;can_work:boolean;can_review:boolean;current_reviewer?:string|null;
 capabilities?:WorkCapabilityMap<NodeWorkAction>;
}
export interface WorkTreeSnapshot {
 root:{id:string;project:string;office:string|null;lead:string|null;kind:'office'|'personal';open:boolean;due:string|null;people:string[];capabilities?:WorkCapabilityMap<RootWorkAction>};
 revision:number;can_manage:boolean;can_transfer:boolean;nodes:WorkNode[];people:WorkPerson[];leaf_total:number;leaf_completed:number;
}
export type WorkCommand='create'|'staff'|'edit'|'move'|'delete'|'order'|'contributors'|'root_lead'|'progress'|'submit'|'review';
export interface WorkRequest {id:string;command:WorkCommand;payload:Record<string,unknown>;revision:number;impactFingerprint?:string}
/** One connected owner; presentation children reuse its verified snapshot. */
export interface WorkTreeController {
 rootId:string;actorId:string|null;data?:WorkTreeSnapshot;
 loading:boolean;error:string;unavailable:boolean;authorityFresh:boolean;refreshPending:boolean;pending:boolean;
 reload:(preserve?:boolean)=>Promise<void>;
 save:(request:WorkRequest)=>Promise<WorkTreeSnapshot>;
}
/** For create/order, nodeId is the parent; undefined means the root (parent:null).
 * The command owner builds requests from the complete snapshot, never visible rows.
 */
export type WorkHierarchyAction=WorkCommand|'open'|'activity';
export interface WorkImpact {
 root_id:string;expected_revision:number;current_revision:number;command:WorkCommand;allowed:boolean;
 blocker_codes:WorkCapabilityReasonCode[];selected_count:number;descendant_count:number;affected_appointment_count:number;
 before_path:string[];after_path:string[];fingerprint:string;
 requires_date_confirmation?:boolean;
 date_impact?:{old_due:string|null;new_due:string|null;items:{id:string;path:string[];old_bound:string|null;new_bound:string|null;bound_changed:boolean;history_counts:Record<string,number>}[]};
}
