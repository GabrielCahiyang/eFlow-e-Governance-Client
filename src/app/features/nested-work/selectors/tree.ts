import type {WorkNode} from '../types';
export const MAX_WORK_DEPTH=8;
export function descendantIds(nodes:readonly WorkNode[],id:string):Set<string>{
 const result=new Set<string>(),queue=[id];while(queue.length){const parent=queue.shift()!;for(const child of nodes.filter(n=>n.parent_subtask_id===parent)){if(!result.has(child.id)&&child.id!==id){result.add(child.id);queue.push(child.id);}}}return result;
}
export function reparentChoices(nodes:readonly WorkNode[],node:WorkNode):WorkNode[]{
 const below=descendantIds(nodes,node.id),height=Math.max(0,...nodes.filter(n=>below.has(n.id)).map(n=>n.depth-node.depth));
 return nodes.filter(n=>n.id!==node.id&&!below.has(n.id)&&n.can_manage&&n.depth+1+height<=MAX_WORK_DEPTH&&n.status==='todo');
}
export function leafCompletion(nodes:readonly Pick<WorkNode,'id'|'parent_subtask_id'|'status'>[]){
 const parents=new Set(nodes.map(n=>n.parent_subtask_id));const leaves=nodes.filter(n=>!parents.has(n.id));
 return {total:leaves.length,completed:leaves.filter(n=>n.status==='completed').length};
}

/** Governed and unresolved Office planning retain their existing flat workflows. */
export function supportsNestedWork(task:{linkedProjectId?:string;proposedOfficeIdentityId?:string;sourceCollaborationDraftId?:string}){return !!task.linkedProjectId&&!task.proposedOfficeIdentityId&&!task.sourceCollaborationDraftId;}
