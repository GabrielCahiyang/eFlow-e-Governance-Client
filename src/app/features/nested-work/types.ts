export interface WorkPerson {id:string;name:string;office?:string;eligible?:boolean}
export interface WorkNode {
 id:string;task_id:string;parent_subtask_id:string|null;lead_id:string|null;title:string;
 assigned_to_ids:string[];sibling_order:number;position?:number;depth:number;due_date:string|null;
 is_standalone:boolean;status:'todo'|'in_progress'|'for_review'|'changes_requested'|'completed';percent_complete:number;
 can_manage:boolean;can_appoint:boolean;can_order:boolean;can_work:boolean;can_review:boolean;current_reviewer?:string|null;
}
export interface WorkTreeSnapshot {
 root:{id:string;project:string;office:string|null;lead:string|null;kind:'office'|'personal';open:boolean;due:string|null;people:string[]};
 revision:number;can_manage:boolean;can_transfer:boolean;nodes:WorkNode[];people:WorkPerson[];leaf_total:number;leaf_completed:number;
}
export type WorkCommand='create'|'staff'|'edit'|'move'|'delete'|'order'|'contributors'|'root_lead'|'progress'|'submit'|'review';
export interface WorkRequest {id:string;command:WorkCommand;payload:Record<string,unknown>;revision:number}
