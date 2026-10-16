import {selectNodeWorkCapability,selectRootWorkCapability} from './capabilities';
import {compatibilityWorkWorkerIds,deduplicateWorkPersonIds,eligibleWorkPeople} from './people';
import {descendantIds} from './tree';
import type {WorkCapabilityContext,WorkRequest,WorkTreeSnapshot} from '../types';

export interface StaffingBaseline {
 actorId:string|null;rootId:string;projectId:string;officeId:string|null;kind:'office'|'personal';
 nodeId:string|null;revision:number;leadId:string|null;workerIds:string[];
}
export function captureStaffingBaseline(data:WorkTreeSnapshot,nodeId:string|null,context:WorkCapabilityContext):StaffingBaseline {
 const node=data.nodes.find(item=>item.id===nodeId);
 return {actorId:context.actorId,rootId:context.rootId,projectId:context.projectId,officeId:context.officeId,kind:context.kind,
  nodeId,revision:data.revision,leadId:nodeId?node?.lead_id||null:data.root.lead,
  workerIds:deduplicateWorkPersonIds(nodeId?node?.assigned_to_ids||[]:data.root.kind==='office'?data.root.people:[])};
}
export function staffingCapabilities(data:WorkTreeSnapshot|undefined,nodeId:string|null,context:WorkCapabilityContext,draftLead?:string|null) {
 const select=(action:'appoint_lead'|'manage_contributors')=>nodeId
  ?selectNodeWorkCapability(data,nodeId,action,context):selectRootWorkCapability(data,action,context);
 const appointment=select('appoint_lead'),contributors=select('manage_contributors');
 const currentLead=nodeId?data?.nodes.find(node=>node.id===nodeId)?.lead_id:data?.root.lead;
 // Initial appointment commands save the Lead and team together. This does not
 // authorize a standalone contributors command or override any other denial.
 const initialTeam=!!data&&data.root.kind==='office'&&!currentLead&&!!draftLead
  &&appointment.allowed&&contributors.reason_code==='lifecycle_blocked'
  &&eligibleWorkPeople(data.people).some(person=>person.id===draftLead);
 return {appointment,contributors:initialTeam?{allowed:true,reason_code:null,disabledReason:null} as const:contributors};
}

/** R8's scoped requester uses the existing server branch predicate. This is
 * request-only presentation, independent of staffing permissions and R8's
 * per-request approval/dispatch flags. Require verified NW2 response context.
 */
export function scopedInvitationRequestAllowed(data:WorkTreeSnapshot|undefined,nodeId:string|null,context:WorkCapabilityContext):boolean {
 const verified=selectRootWorkCapability(data,'appoint_lead',context);
 return !!data&&data.root.open&&!context.readOnly
  &&!['capability_unavailable','read_only','access_unavailable'].includes(verified.reason_code||'')
  &&(nodeId?data.nodes.find(node=>node.id===nodeId)?.can_manage:data.can_manage)===true;
}
const sameIds=(a:readonly string[],b:readonly string[])=>JSON.stringify([...new Set(a)].sort())===JSON.stringify([...new Set(b)].sort());

export function staffingDraftError(data:WorkTreeSnapshot|undefined,context:WorkCapabilityContext,baseline:StaffingBaseline,leadId:string|null,workerIds:readonly string[],retry=false):string|null {
 const caps=staffingCapabilities(data,baseline.nodeId,context,leadId),changedLead=leadId!==baseline.leadId;
 if(context.actorId!==baseline.actorId||context.rootId!==baseline.rootId||context.projectId!==baseline.projectId||context.officeId!==baseline.officeId||context.kind!==baseline.kind)return 'The work scope changed. Reopen staffing in the current scope.';
 if(!leadId&&caps.appointment.allowed)return 'Choose a lead first.';
 const required=changedLead?caps.appointment:caps.contributors;
 if(!required.allowed)return required.disabledReason;
 if(!sameIds(workerIds,baseline.workerIds)&&!caps.contributors.allowed)return caps.contributors.disabledReason;
 if(!data)return 'Reload the current work before saving.';
 if(!retry&&data.revision!==baseline.revision)return 'Work changed. Reopen staffing and review the current tree before saving.';
 if(baseline.nodeId&&!data.nodes.some(node=>node.id===baseline.nodeId))return 'This subitem is no longer available in the current tree.';
 const eligible=new Set(eligibleWorkPeople(data.people).map(person=>person.id));
 if(!leadId||!eligible.has(leadId))return 'Choose a currently eligible selected project Lead.';
 const personalRoot=baseline.kind==='personal'&&!baseline.nodeId;
 const workers=personalRoot?[]:compatibilityWorkWorkerIds(leadId,workerIds);
 if(workers.length>200)return 'Choose at most 200 project workers.';
 if(workers.some(id=>!eligible.has(id)))return 'A selected worker is no longer eligible. Resolve the roster explicitly before saving.';
 if(changedLead&&baseline.workerIds.some(id=>!workers.includes(id)))return 'Retain existing workers during a Lead transfer. Save contributor removals separately.';
 if(baseline.nodeId){
  const below=descendantIds(data.nodes,baseline.nodeId);
  if(data.nodes.some(node=>below.has(node.id)&&node.status!=='completed'&&node.assigned_to_ids.some(id=>!workers.includes(id))))return 'Reassign unfinished descendant workers before removing a branch contributor.';
 }
 return null;
}

export function createStaffingRequest(baseline:StaffingBaseline,leadId:string,workerIds:readonly string[]):WorkRequest {
 const people=compatibilityWorkWorkerIds(leadId,workerIds),transfer=leadId!==baseline.leadId;
 return {id:crypto.randomUUID(),revision:baseline.revision,
  command:baseline.nodeId?'staff':transfer?'root_lead':'contributors',
  payload:baseline.nodeId?{id:baseline.nodeId,lead:leadId,people}:transfer
   ?baseline.kind==='personal'?{lead:leadId}:{lead:leadId,people}:{people}};
}

export function clearedStaffingAppointments(data:WorkTreeSnapshot,nodeId:string|null) {
 const below=nodeId?descendantIds(data.nodes,nodeId):new Set(data.nodes.map(node=>node.id));
 return data.nodes.filter(node=>below.has(node.id)&&node.lead_id!==null);
}
export function staffingNodePath(data:WorkTreeSnapshot,nodeId:string):string {
 const names:string[]=[],seen=new Set<string>();let id:string|null=nodeId;
 while(id&&seen.size<8&&!seen.has(id)){seen.add(id);const node=data.nodes.find(item=>item.id===id);if(!node)break;names.unshift(node.title);id=node.parent_subtask_id;}
 return names.join(' / ');
}
