import type {NodeWorkAction,WorkActionAvailability,WorkCapabilityContext,WorkRequest,WorkTreeSnapshot} from '../types';
import type {WorkEdit,WorkEditorBaseline,WorkEditorFields} from '../types/editor';
import {selectNodeWorkCapability,selectRootWorkCapability} from './capabilities';
import {compatibilityWorkWorkerIds} from './people';
import {scheduledDateError} from '../../../shared/calendarDates';

export function workEditorDateError(data:WorkTreeSnapshot,baseline:WorkEditorBaseline,fields:WorkEditorFields):string {
 if(!['create','edit'].includes(baseline.command))return '';
 const latest=data.nodes.find(item=>item.id===fields.parent)?.due_date||data.root.due||'';
 return scheduledDateError(fields.due,{original:baseline.command==='edit'?baseline.fields.due:'',latest,label:'Subitem due date'});
}

export function captureWorkEditorBaseline(data:WorkTreeSnapshot,edit:WorkEdit,actorId:string|null,createdId:string):WorkEditorBaseline {
 const node=data.nodes.find(item=>item.id===edit.node?.id)||edit.node;
 return {actorId,rootId:data.root.id,projectId:data.root.project,officeId:data.root.office,kind:data.root.kind,revision:data.revision,
  command:edit.command,nodeId:node?.id||edit.itemId||null,createdId,fields:{title:node?.title||'',due:node?node.due_date||'':(edit.parent?data.nodes.find(item=>item.id===edit.parent)?.due_date:null)||data.root.due||'',
   lead:edit.root?data.root.lead||'':node?.lead_id||'',people:edit.root?[...new Set([data.root.lead,...data.root.people].filter((id):id is string=>!!id))]:[...(node?.assigned_to_ids||[])],
   parent:node?.parent_subtask_id||edit.parent||'',standalone:node?.is_standalone||false,note:'',progress:node?.percent_complete||0,
   order:data.nodes.filter(item=>item.parent_subtask_id===(edit.parent||null)).sort((a,b)=>a.sibling_order-b.sibling_order||a.id.localeCompare(b.id)).map(item=>item.id)}};
}
const applicableFields:Record<WorkEdit['command'],readonly (keyof WorkEditorFields)[]>={
 create:['title','due','standalone','parent','lead','people'],edit:['title','due','standalone','note'],move:['parent'],order:['order'],
 delete:[],progress:['progress','note'],submit:['note'],review:['progress','note'],staff:['lead','people'],contributors:['people'],root_lead:['lead','people'],
};
export function workEditorDirty(baseline:WorkEditorBaseline,fields:WorkEditorFields):boolean {
 return applicableFields[baseline.command].some(key=>{
  // Membership is a set; sibling ordering is deliberately positional.
  if(key==='people')return JSON.stringify([...new Set(fields.people)].sort())!==JSON.stringify([...new Set(baseline.fields.people)].sort());
  if(key==='order')return JSON.stringify(fields.order)!==JSON.stringify(baseline.fields.order);
  if(key==='progress'&&baseline.command==='review')return (fields.progress===100)!==(baseline.fields.progress===100);
  return fields[key]!==baseline.fields[key];
 });
}
export function workEditorPayload(baseline:WorkEditorBaseline,fields:WorkEditorFields):Record<string,unknown> {
 const id=baseline.nodeId,people=compatibilityWorkWorkerIds(fields.lead||null,fields.people);
 switch(baseline.command){
  case 'create':return {id:baseline.createdId,title:fields.title,parent:fields.parent||null,lead:fields.lead||null,people,due:fields.due||null,standalone:fields.standalone};
  case 'edit':return {id,title:fields.title,due:fields.due||null,standalone:fields.standalone,note:fields.note};
  case 'move':return {id,parent:fields.parent||null};
  case 'order':return {parent:fields.parent||null,order:[...fields.order]};
  case 'progress':return {id,progress:fields.progress,note:fields.note};
  case 'submit':return {id,note:fields.note};
  case 'review':return {id,approve:fields.progress===100,note:fields.note};
  case 'delete':return {id};
  case 'staff':return {id,lead:fields.lead||null,people};
  case 'contributors':return {people};
  case 'root_lead':return baseline.kind==='personal'?{lead:fields.lead||null}:{lead:fields.lead||null,people};
 }
}
function freezeTerms(value:unknown):void {
 if(value&&typeof value==='object'){for(const child of Object.values(value))freezeTerms(child);Object.freeze(value);}
}
export function freezeWorkEditorRequest(baseline:WorkEditorBaseline,fields:WorkEditorFields,id:string,impactFingerprint?:string):WorkRequest {
 const request:WorkRequest={id,command:baseline.command,revision:baseline.revision,payload:workEditorPayload(baseline,fields),
  ...(impactFingerprint!==undefined?{impactFingerprint}:{})};
 freezeTerms(request);return request;
}
export function workEditorCapability(data:WorkTreeSnapshot,baseline:WorkEditorBaseline,context:WorkCapabilityContext):WorkActionAvailability {
 const parent=baseline.fields.parent;
 if(baseline.command==='create')return parent?selectNodeWorkCapability(data,parent,'create_child',context):selectRootWorkCapability(data,'create_child',context);
 if(baseline.command==='order')return parent?selectNodeWorkCapability(data,parent,'order_children',context):selectRootWorkCapability(data,'order_children',context);
 const actions:Partial<Record<WorkEdit['command'],NodeWorkAction>>={edit:'edit_details',move:'move',delete:'delete',progress:'execute',submit:'submit',review:'review',staff:'manage_contributors',contributors:'manage_contributors',root_lead:'appoint_lead'};
 const action=actions[baseline.command]!;
 return baseline.nodeId?selectNodeWorkCapability(data,baseline.nodeId,action,context):selectRootWorkCapability(data,baseline.command==='root_lead'?'appoint_lead':'manage_contributors',context);
}
export function sameWorkEditorScope(baseline:WorkEditorBaseline,context:WorkCapabilityContext):boolean {
 return baseline.actorId===context.actorId&&baseline.rootId===context.rootId&&baseline.projectId===context.projectId&&baseline.officeId===context.officeId&&baseline.kind===context.kind;
}
/** Exact uncertain retries can read a committed receipt after completion/deletion
 * removed mutation eligibility. Require a verified current read scope; SQL still
 * checks read access, identity/terms and current authority if no receipt exists.
 */
export function workEditorReceiptRetryAllowed(data:WorkTreeSnapshot,context:WorkCapabilityContext):boolean {
 const verified=selectRootWorkCapability(data,'create_child',context);
 return !['capability_unavailable','access_unavailable','read_only'].includes(verified.reason_code||'');
}
