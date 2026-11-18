import type {NodeWorkAction,WorkActionAvailability,WorkCapabilityContext,WorkRequest,WorkTreeSnapshot} from '../types';
import type {WorkEdit,WorkEditorBaseline,WorkEditorFields} from '../types/editor';
import {selectNodeWorkCapability,selectRootWorkCapability} from './capabilities';
import {compatibilityWorkWorkerIds} from './people';
import {subtaskDateIssue,subtaskDateLimits} from './subtaskDates';
import {getPhilippineCalendarDate,scheduledDateError} from '../../../shared/calendarDates';
import {readNodeDetailEditState} from './detailEditing';
import {canCreateSubtaskPrerequisites,canEditSubtaskPrerequisites,subtaskPrerequisiteError} from './prerequisites';

export function workEditorDateError(data:WorkTreeSnapshot,baseline:WorkEditorBaseline,fields:WorkEditorFields):string {
 if(!['create','edit'].includes(baseline.command))return '';
 if(data.root.scheduleBounds){
  if(baseline.command==='edit'&&(fields.start||'')===(baseline.fields.start||'')&&fields.due===baseline.fields.due)return '';
  return subtaskDateIssue(fields.start||'',fields.due,subtaskDateLimits(data,fields.parent));
 }
 const latest=data.nodes.find(item=>item.id===fields.parent)?.due_date||data.root.due||'';
 return scheduledDateError(fields.due,{original:baseline.command==='edit'?baseline.fields.due:'',latest,label:'Subtask due date'});
}

export function captureWorkEditorBaseline(data:WorkTreeSnapshot,edit:WorkEdit,actorId:string|null,createdId:string):WorkEditorBaseline {
 const node=data.nodes.find(item=>item.id===edit.node?.id)||edit.node;
 const limits=data.root.scheduleBounds?subtaskDateLimits(data,edit.parent||''):undefined;
 const defaultDue=limits
  ? limits.latest
  : (edit.parent?data.nodes.find(item=>item.id===edit.parent)?.due_date:null)||data.root.due;
 const rawStart=limits?.earliest||'';
 const effectiveToday=data.root.scheduling?.today||(defaultDue?getPhilippineCalendarDate():'');
 const defaultStart=data.root.scheduleBounds
  ? (rawStart?(defaultDue&&rawStart>defaultDue?defaultDue:rawStart):(effectiveToday&&(!defaultDue||effectiveToday<=defaultDue)?effectiveToday:defaultDue)||'')
  : '';
 const explicitCreate=edit.command==='create'&&canCreateSubtaskPrerequisites(data);
 return {actorId,rootId:data.root.id,projectId:data.root.project,officeId:data.root.office,kind:data.root.kind,revision:data.revision,
  command:edit.command,nodeId:node?.id||edit.itemId||null,createdId,fields:{title:node?.title||'',...(data.root.scheduleBounds?{start:node?node.start_date||'':defaultStart}:{}),due:node?node.due_date||'':defaultDue||'',
  priority:node?.priority,lead:edit.root?data.root.lead||'':node?.lead_id||'',people:edit.root?[...new Set([data.root.lead,...data.root.people].filter((id):id is string=>!!id))]:[...(node?.assigned_to_ids||[])],
   parent:node?.parent_subtask_id||edit.parent||'',standalone:node?.is_standalone??explicitCreate,note:'',progress:node?.percent_complete||0,
   ...(explicitCreate?{dependencies:[]}:edit.command==='edit'&&Array.isArray(node?.dependency_ids)?{dependencies:[...node.dependency_ids]}:{}),
   order:data.nodes.filter(item=>item.parent_subtask_id===(edit.parent||null)).sort((a,b)=>a.sibling_order-b.sibling_order||a.id.localeCompare(b.id)).map(item=>item.id)}};
}
const applicableFields:Record<WorkEdit['command'],readonly (keyof WorkEditorFields)[]>={
 create:['title','start','due','standalone','parent','lead','people','dependencies'],edit:['title','priority','start','due','standalone','note','dependencies'],move:['parent'],order:['order'],
 delete:[],progress:['progress','note'],submit:['note'],review:['progress','note'],staff:['lead','people'],contributors:['people'],root_lead:['lead','people'],
};
export function workEditorDirty(baseline:WorkEditorBaseline,fields:WorkEditorFields):boolean {
 return applicableFields[baseline.command].some(key=>{
  // Membership is a set; sibling ordering is deliberately positional.
  if(key==='people')return JSON.stringify([...new Set(fields.people)].sort())!==JSON.stringify([...new Set(baseline.fields.people)].sort());
  if(key==='order')return JSON.stringify(fields.order)!==JSON.stringify(baseline.fields.order);
  if(key==='dependencies')return dependenciesChanged(baseline,fields);
  if(key==='progress'&&baseline.command==='review')return (fields.progress===100)!==(baseline.fields.progress===100);
  return fields[key]!==baseline.fields[key];
 });
}
function dependenciesChanged(baseline:WorkEditorBaseline,fields:WorkEditorFields){
 return JSON.stringify(fields.dependencies&&[...fields.dependencies].sort())!==JSON.stringify(baseline.fields.dependencies&&[...baseline.fields.dependencies].sort());
}
export function workEditorPayload(baseline:WorkEditorBaseline,fields:WorkEditorFields):Record<string,unknown> {
 const schedule=fields.start?{start:fields.start}:{};
 const id=baseline.nodeId,people=compatibilityWorkWorkerIds(fields.lead||null,fields.people);
 switch(baseline.command){
  case 'create':return {id:baseline.createdId,title:fields.title,parent:fields.parent||null,lead:fields.lead||null,people,...schedule,due:fields.due||null,standalone:Array.isArray(fields.dependencies)?fields.dependencies.length===0:fields.standalone};
  case 'edit':return {id,title:fields.title,...schedule,due:fields.due||null,standalone:fields.standalone,note:fields.note,...(fields.priority&&fields.priority!==baseline.fields.priority?{priority:fields.priority}:{}),...(fields.dependencies&&dependenciesChanged(baseline,fields)?{dependency_ids:[...fields.dependencies].sort()}:{})};
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
export function selectStartedEditPolicy(data:WorkTreeSnapshot,nodeId:string|null) {
 if(!nodeId)return null;
 const matches=data.nodes.filter(node=>node.id===nodeId);
 if(matches.length!==1)return null;
 return readNodeDetailEditState(matches[0],data.root.id);
}
/** Field permissions supplement the current edit capability; neither grants the other. */
export function workEditorDefinitionError(data:WorkTreeSnapshot,baseline:WorkEditorBaseline,fields:WorkEditorFields):string {
 if(fields.dependencies&&dependenciesChanged(baseline,fields)){
  const node=data.nodes.find(item=>item.id===baseline.nodeId);
  if(data.root.kind!=='office'||data.supportsSubtaskDependencies!==true||baseline.command==='edit'&&!canEditSubtaskPrerequisites(data,node))return 'Current access does not allow changing prerequisites.';
  const issue=subtaskPrerequisiteError(data,fields.parent,baseline.nodeId||baseline.createdId,fields.dependencies,baseline.fields.dependencies);
  if(issue)return issue;
 }
 if(data.root.kind!=='office'||baseline.command!=='edit')return '';
 const policy=selectStartedEditPolicy(data,baseline.nodeId);
 if(!policy)return 'Editing permissions could not be verified. Refresh this work.';
 if(!policy.details)return 'These work details are read-only. Use the existing review or reopen action.';
 const startChanged=(fields.start||'')!==(baseline.fields.start||'');
 const planningChanged=startChanged||fields.standalone!==baseline.fields.standalone;
 if(planningChanged&&!policy.planning)return 'Start date, prerequisites and structure cannot change after work has started.';
 const dueChanged=fields.due!==baseline.fields.due;
 const scheduleChanged=dueChanged||startChanged;
 if(dueChanged&&!policy.due)return 'Only the supervising Lead or authorized Office Head can reschedule this work.';
 if(scheduleChanged&&!fields.note.trim())return dueChanged?'Enter a reason for changing the due date.':'Enter a reason for the schedule change.';
 if(scheduleChanged&&fields.note.trim().length>1000)return 'Keep the schedule change reason within 1,000 characters.';
 return '';
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
