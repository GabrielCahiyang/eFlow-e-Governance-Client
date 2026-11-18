import type {WorkNode} from '../types';

/** Execution participation belongs to this node, never an ancestor appointment. */
export function isAssignedSubtaskParticipant(node:Pick<WorkNode,'lead_id'|'assigned_to_ids'>|undefined,actorId:string|null|undefined):boolean {
 return !!actorId&&!!node&&(node.lead_id===actorId||Array.isArray(node.assigned_to_ids)&&node.assigned_to_ids.includes(actorId));
}
