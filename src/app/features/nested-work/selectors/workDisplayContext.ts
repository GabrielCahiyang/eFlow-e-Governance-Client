import type {WorkNode,WorkNodeDisplayMetadata,WorkPeopleDisplay,WorkPerson} from '../types';
import {buildWorkDisplayTree} from './displayTree';
import {deduplicateWorkPersonIds,displayedWorkContributorIds,resolveWorkPersonName} from './people';

/** Caller supplies one currently authorized root/subtree and its permitted
 * directory. Omit rootTitle when the root record itself is not readable.
 * These pure adapters neither fetch ancestors nor decide access or eligibility.
 */
export interface WorkDisplayScope {
 rootId:string;
 rootTitle?:string;
 people:readonly WorkPerson[];
}
export type WorkDisplayNode = Pick<WorkNode,'id'|'task_id'|'parent_subtask_id'|'title'|'sibling_order'|'lead_id'|'assigned_to_ids'|'due_date'>;
/** Structural input for existing camelCase records; not a Subtask conversion. */
export interface SubtaskDisplayRecord {
 id:string;taskId:string;title:string;parentSubtaskId?:string;leadId?:string;
 assignedToIds:readonly string[];siblingOrder?:number;position:number;dueDate?:string;
}

export function selectWorkPeopleDisplay(leadId:string|null,workerIds:readonly string[],people:readonly WorkPerson[]):WorkPeopleDisplay {
 const contributorIds=displayedWorkContributorIds(leadId,workerIds);
 return {leadId,leadName:leadId?resolveWorkPersonName(people,leadId):null,
  contributors:contributorIds.map(id=>({id,name:resolveWorkPersonName(people,id)})),
  participantIds:deduplicateWorkPersonIds([...(leadId?[leadId]:[]),...contributorIds])};
}

/** Reuse NW6 traversal after root filtering. Duplicate IDs fail closed, while
 * duplicate titles remain separate. Missing/denied ancestry stays incomplete.
 * A readable root is prepended only to a complete supplied chain; a subtree
 * alone never proves that its unseen ancestors or root are readable.
 */
export function buildWorkNodeDisplayMetadata(nodes:readonly WorkDisplayNode[],scope:WorkDisplayScope):ReadonlyMap<string,WorkNodeDisplayMetadata> {
 const scoped=nodes.filter(node=>node.task_id===scope.rootId);
 const counts=new Map<string,number>();
 for(const node of scoped)counts.set(node.id,(counts.get(node.id)||0)+1);
 const unique=scoped.filter(node=>counts.get(node.id)===1);
 const byId=new Map(unique.map(node=>[node.id,node]));
 return new Map(buildWorkDisplayTree(unique).map(row=>{
  const node=byId.get(row.id)!;
  const includeRoot=scope.rootTitle!==undefined&&row.context===null&&!row.pathTruncated;
  const path=includeRoot?[{id:scope.rootId,title:scope.rootTitle!},...row.path]:row.path;
  const pathLabel=includeRoot?[scope.rootTitle,row.pathLabel].join(' / '):row.pathLabel;
  return [row.id,{rootId:scope.rootId,nodeId:row.id,parentId:row.parentId,dueDate:node.due_date,
   path,pathLabel,context:row.context,pathTruncated:row.pathTruncated,
   ...selectWorkPeopleDisplay(node.lead_id,node.assigned_to_ids,scope.people)}];
 }));
}

/** Preserve camelCase parentage explicitly; position orders legacy siblings,
 * never determines their parent. Original records/worker arrays are untouched.
 */
export function buildSubtaskDisplayMetadata(records:readonly SubtaskDisplayRecord[],scope:WorkDisplayScope):ReadonlyMap<string,WorkNodeDisplayMetadata> {
 return buildWorkNodeDisplayMetadata(records.map(record=>({id:record.id,task_id:record.taskId,title:record.title,
  parent_subtask_id:record.parentSubtaskId??null,lead_id:record.leadId??null,
  assigned_to_ids:[...record.assignedToIds],sibling_order:record.siblingOrder??record.position,due_date:record.dueDate??null})),scope);
}

/** Merge only into a separately loaded authorized full record (e.g. NW8's
 * fetchSubitemInspectorRecord). Metadata cannot manufacture workflow fields,
 * override timestamps/authors, or substitute a WorkNode for that record.
 * A missing/mismatched context clears any prior display context after refresh.
 */
export function mergeWorkDisplayMetadata<T extends {id:string;taskId:string;workContext?:WorkNodeDisplayMetadata}>(record:T,metadata:WorkNodeDisplayMetadata|undefined):T {
 if(!metadata||metadata.nodeId!==record.id||metadata.rootId!==record.taskId)
  return record.workContext?{...record,workContext:undefined}:record;
 return {...record,workContext:metadata};
}
