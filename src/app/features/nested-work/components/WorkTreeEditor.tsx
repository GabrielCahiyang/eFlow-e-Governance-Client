import {requestNavigation} from '../../../shared/navigationGuard';
import {Modal} from '../../../components/ui/Modal';
import {useEffect,useId,useRef,useState} from 'react';
import {ListPlus,AlertCircle,ArrowLeft,Trash2} from 'lucide-react';
import {calendarMinDate} from '../../../shared/calendarDates';
import {duplicateWorkNameError} from '../../../shared/workNames';
import {subtaskDateLimits} from '../selectors/subtaskDates';
import {freezeWorkEditorRequest,workEditorDateError,workEditorDefinitionError,workEditorPayload} from '../selectors/editorDraft';
import {fetchWorkImpact} from '../services/workTreeService';
import {WorkDetailsEditor} from './WorkDetailsEditor';
import {WorkMoveDialog} from './WorkMoveDialog';
import {WorkOrderDialog} from './WorkOrderDialog';
import {WorkDeleteDialog} from './WorkDeleteDialog';
import {WorkImpactSummary} from './WorkImpactSummary';
import {WorkStaffingDialog} from './WorkStaffingDialog';
import {useAuth} from '../../../contexts/AuthContext';
import {selectNodeWorkCapability,selectRootWorkCapability} from '../selectors/capabilities';
import {useWorkEditorDraft} from '../hooks/useWorkEditorDraft';
import {useWorkImpactConfirmation} from '../hooks/useWorkImpactConfirmation';
import {scopedInvitationRequestAllowed} from '../selectors/staffing';
import {reparentChoices} from '../selectors/tree';
import type {WorkImpact,WorkRequest,WorkTreeSnapshot} from '../types';
import type {WorkEdit} from '../types/editor';
import {readNodeDetailEditState} from '../selectors/detailEditing';
import {canCreateSubtaskPrerequisites,canEditSubtaskPrerequisites,displayedSubtaskPrerequisiteIds,subtaskPrerequisiteChoices} from '../selectors/prerequisites';
import {PrerequisiteField} from '../../../components/ui/workspace/PrerequisiteField';
import {workAssignmentPriority} from '../selectors/people';
export type {WorkEdit} from '../types/editor';
interface WorkTreeEditorProps {data:WorkTreeSnapshot;edit:WorkEdit;save:(request:WorkRequest)=>Promise<WorkTreeSnapshot>;onDone:()=>void|Promise<void>;onCancel:()=>void;reload?:()=>Promise<void>;readOnly?:boolean;refreshPending?:boolean}
export function WorkTreeEditor(props:WorkTreeEditorProps){
 const {user}=useAuth();
 if(props.edit.command==='staff')return <WorkStaffingDialog controller={{rootId:props.data.root.id,actorId:user?.id||null,data:props.data,loading:!!props.refreshPending,verificationFailed:!!props.refreshPending,save:props.save}}
  nodeId={props.edit.root?null:props.edit.node?.id||''} readOnly={props.readOnly} onChanged={props.onDone} onClose={props.onCancel}/>;
 return <WorkTreeForm {...props}/>;
}
function WorkTreeForm({data,edit,save,onDone,onCancel,reload,readOnly=false,refreshPending=false}:WorkTreeEditorProps){
 const formId=useId();
 const {user}=useAuth();
 const context={actorId:user?.id||null,rootId:data.root.id,projectId:data.root.project,officeId:data.root.office,kind:data.root.kind,revision:data.revision,readOnly};
 const editor=useWorkEditorDraft({data,edit,context,refreshPending,reload,onCancel});
 const {fields:{lead,people,parent,standalone,note,order},update,locked,busy,authorized,outcome}=editor;
 const dateLimits=subtaskDateLimits(data,parent);
 const node=data.nodes.find(item=>item.id===editor.baseline.nodeId)||edit.node;
 const detailPolicy=data.root.kind==='office'&&edit.command==='edit'?readNodeDetailEditState(node,data.root.id):null;
 const startedEdit=!!detailPolicy?.started;
 const fieldPolicyRequired=data.root.kind==='office'&&edit.command==='edit';
 const detailsUnavailable=fieldPolicyRequired&&!detailPolicy?.details;
 const dueChanged=edit.command==='edit'&&editor.fields.due!==editor.baseline.fields.due;
 const startChanged=edit.command==='edit'&&(editor.fields.start||'')!==(editor.baseline.fields.start||'');
 const reasonRequired=data.root.kind==='office'&&edit.command==='edit'&&(dueChanged||startChanged);
 const canEnterScheduleReason=dueChanged?detailPolicy?.due===true:detailPolicy?.planning===true;
 const createCapability=edit.parent?selectNodeWorkCapability(data,edit.parent,'create_child',context):selectRootWorkCapability(data,'create_child',context);
 const dependencySupported=data.root.kind==='office'&&data.supportsSubtaskDependencies===true;
 const dependencyEditable=dependencySupported&&(edit.command==='create'?createCapability.allowed&&canCreateSubtaskPrerequisites(data):edit.command==='edit'&&canEditSubtaskPrerequisites(data,node));
 const selectedDependencies=editor.fields.dependencies??(edit.command==='edit'?displayedSubtaskPrerequisiteIds(data,node):[]);
 const dependencyChoices=subtaskPrerequisiteChoices(data,parent,node?.id||editor.baseline.createdId,selectedDependencies);
 const dependencyField=data.root.kind==='office'?<div className="space-y-2"><PrerequisiteField label="Prerequisite subtasks" choices={dependencyChoices} selected={selectedDependencies}
  disabled={locked||!dependencyEditable} onChange={value=>update('dependencies',value)}/>
  {!dependencySupported?<p role="status">Prerequisite selection is unavailable in this view.</p>:!dependencyEditable&&!startedEdit?<p role="status">Prerequisites are read-only in this view.</p>:null}</div>:undefined;
 const destinationRoot=selectRootWorkCapability(data,'create_child',context);
 const destinations=node?reparentChoices(data.nodes.map(item=>({...item,can_manage:selectNodeWorkCapability(data,item.id,'create_child',context).allowed})),node):[];
 const confirmation=useWorkImpactConfirmation(data.root.id);
 const activeRef=useRef(true);
 const latestScope=useRef({actorId:user?.id||null,revision:data.revision});
 latestScope.current={actorId:user?.id||null,revision:data.revision};
 useEffect(()=>{activeRef.current=true;return()=>{activeRef.current=false;};},[]);
 const [deletePreview,setDeletePreview]=useState<{loading:boolean;impact?:WorkImpact;error?:string;revision?:number}>({loading:edit.command==='delete'});
 const [deletePreviewRetry,setDeletePreviewRetry]=useState(0);
 const [reviewStep,setReviewStep]=useState<{impact:WorkImpact;snapshotJson:string;payloadJson:string}|null>(null);
 const [checkingImpact,setCheckingImpact]=useState(false);
 const [impactError,setImpactError]=useState('');
 useEffect(()=>{
  if(edit.command!=='delete'||editor.request){
   setDeletePreview({loading:false});
   return;
  }
  let current=true;
  const requestRevision=data.revision;
  const candidate=freezeWorkEditorRequest(editor.baseline,editor.fields,crypto.randomUUID());
  setDeletePreview({loading:true});
  void fetchWorkImpact(data.root.id,candidate).then(preview=>{
   if(!current||!activeRef.current||latestScope.current.revision!==requestRevision)return;
   if(preview.current_revision!==requestRevision){
    setDeletePreview({loading:false,error:'Work changed. Reload and review the current work before confirming.'});
    return;
   }
   setDeletePreview({loading:false,impact:preview,revision:requestRevision});
  }).catch(reason=>{
   if(!current||!activeRef.current||latestScope.current.revision!==requestRevision)return;
   setDeletePreview({loading:false,error:reason instanceof Error?reason.message:'Could not check deletion impact.'});
  });
  return()=>{current=false;};
 },[edit.command,node?.id,data.revision,deletePreviewRetry,editor.request]);
 const close=()=>void requestNavigation(editor.discard);
 const prepare=(request:WorkRequest)=>{
  const modeChanged=edit.command==='edit'&&standalone!==editor.baseline.fields.standalone;
  if(!modeChanged&&!dueChanged&&!startChanged)return Promise.resolve(undefined);
  return confirmation.review(request,{title:modeChanged?'Change work order?':'Review schedule change?',dateChange:dueChanged,alwaysConfirm:modeChanged||startChanged,
   actionLabel:'Confirm changes',danger:false,isCurrent:editor.confirmationCurrent,description:'Review the current affected work. The server checks this exact impact again before saving.',
   details:modeChanged?<p>Work order: {editor.baseline.fields.standalone?'Can start out of order':'In sequence'} → {standalone?'Can start out of order':'In sequence'}. Changing the sequence can affect when related work may start.</p>:<p>Start date: {editor.baseline.fields.start||'No start date'} → {editor.fields.start}</p>});
 };
 const needsEditPreview=edit.command==='edit'&&(startChanged||standalone!==editor.baseline.fields.standalone||editor.fields.due!==editor.baseline.fields.due);
 const requestInlineReview=async()=>{
  if(checkingImpact||busy||!authorized)return;
  setImpactError('');
  try{
   if(edit.command==='move'){
    const moveTitle=node?.title||'';
    const issue=moveTitle.trim()?duplicateWorkNameError(moveTitle,data.nodes.filter(item=>(item.parent_subtask_id||'')===(parent||'')),'Subitem',node?.id):'';
    if(issue)throw new Error(issue);
   }
   const dateIssue=workEditorDateError(data,editor.baseline,editor.fields);
   if(dateIssue)throw new Error(dateIssue);
   const definitionIssue=workEditorDefinitionError(data,editor.baseline,editor.fields);
   if(definitionIssue)throw new Error(definitionIssue);
   const requestActor=user?.id||null;
   const requestRevision=data.revision;
   const snapshotJson=JSON.stringify(data);
   const payloadJson=JSON.stringify(workEditorPayload(editor.baseline,editor.fields));
   const candidate=freezeWorkEditorRequest(editor.baseline,editor.fields,crypto.randomUUID());
   setCheckingImpact(true);
   const preview=await fetchWorkImpact(data.root.id,candidate);
   if(!activeRef.current||latestScope.current.actorId!==requestActor||latestScope.current.revision!==requestRevision)return;
   if(preview.current_revision!==requestRevision)throw new Error('Work changed. Reload and review the current work before confirming.');
   setReviewStep({impact:preview,snapshotJson,payloadJson});
  }catch(reason){
   if(activeRef.current)setImpactError(reason instanceof Error?reason.message:'Could not review affected work.');
  }finally{
   if(activeRef.current)setCheckingImpact(false);
  }
 };
 const confirmInlineReview=()=>{
  if(!reviewStep||busy)return;
  setImpactError('');
  if(!editor.confirmationCurrent()||JSON.stringify(data)!==reviewStep.snapshotJson||JSON.stringify(workEditorPayload(editor.baseline,editor.fields))!==reviewStep.payloadJson){
   setImpactError('Work or authority changed during confirmation. Review current work again.');
   setReviewStep(null);
   return;
  }
  const fingerprint=reviewStep.impact.fingerprint;
  setReviewStep(null);
  void editor.submit({save,onDone,impactFingerprint:fingerprint});
 };
 const submit=()=>{
  setImpactError('');
  if(edit.command==='delete'){
   if(editor.request){void editor.submit({save,onDone});return;}
   if(!deletePreview.impact?.allowed||deletePreview.revision!==data.revision)return;
   void editor.submit({save,onDone,impactFingerprint:deletePreview.impact.fingerprint});
   return;
  }
  if(['move','order'].includes(edit.command)&&!editor.request){
   if(reviewStep){confirmInlineReview();return;}
   void requestInlineReview();
   return;
  }
  void editor.submit({save,onDone,prepare:needsEditPreview?prepare:undefined});
 };
 const error=impactError||('message' in outcome?outcome.message:null);
 const actionLabel={create:'Add subtask',edit:'Save subtask',delete:'Delete subtask',move:'Move subtask',order:'Save sequence',progress:'Post update',submit:'Submit for review',review:'Save review',staff:'Save staffing',contributors:'Save contributors',root_lead:'Save task lead'}[edit.command];
 const modalMeta={
  create:{title:'Add subtask',description:'Break the work into a clear, manageable step.',width:'max-w-3xl'},
  edit:{title:'Edit subtask',description:'Break the work into a clear, manageable step.',width:'max-w-3xl'},
  delete:{title:`Delete ${node?.title||'subtask'}?`,description:'Review the affected work before deleting.',width:'max-w-lg'},
  move:{title:reviewStep?'Review subtask move?':`Move ${node?.title||'subtask'}`,description:reviewStep?'Review the current affected work. The server checks this exact impact again before saving.':'Choose where this subtask belongs in the hierarchy.',width:'max-w-lg'},
  order:{title:reviewStep?'Review subtask sequence?':'Reorder subtasks',description:reviewStep?'Review the current affected work. The server checks this exact impact again before saving.':'Adjust the sequence of subtasks at this level.',width:'max-w-lg'},
  progress:{title:`Update ${node?.title||'subtask'}`,description:'Share a work update or progress note.',width:'max-w-lg'},
  submit:{title:`Complete ${node?.title||'subtask'}`,description:'Add a note before submitting this subtask.',width:'max-w-lg'},
  review:{title:`History for ${node?.title||'subtask'}`,description:'Record review feedback for this subtask.',width:'max-w-lg'},
  staff:{title:'Subtask Lead and contributors',description:'Update leadership and contributors.',width:'max-w-lg'},
  contributors:{title:'Task Lead and contributors',description:'Update leadership and contributors for this work.',width:'max-w-lg'},
  root_lead:{title:'Task Lead and contributors',description:'Update leadership and contributors for this work.',width:'max-w-lg'},
 }[edit.command];
 const deleteBlocked=edit.command==='delete'&&!editor.request&&(deletePreview.loading||!!deletePreview.error||!deletePreview.impact?.allowed||deletePreview.revision!==data.revision);
 const primaryDisabled=busy||checkingImpact||(reviewStep?!reviewStep.impact.allowed:!authorized||deleteBlocked);
 const actions=<div className="r7-actions">
  {reviewStep
   ?<button type="button" disabled={busy} onClick={()=>{setReviewStep(null);setImpactError('');}}><ArrowLeft size={14} aria-hidden="true"/>Back</button>
   :<button type="button" disabled={busy||checkingImpact} onClick={close}>{editor.saved?'Close':'Cancel changes'}</button>}
  {editor.canReviewLatest&&!reviewStep&&<button type="button" onClick={editor.reviewLatest}>Review against current work</button>}
  {!authorized&&!editor.saved&&!busy&&!refreshPending&&!editor.capability.allowed&&!reviewStep&&<p role="status">Saving is unavailable with your current access.</p>}
  {!editor.saved&&<button type="button" onClick={()=>void submit()} className={edit.command==='delete'?'nw-delete-action':'nw-create-save'} disabled={primaryDisabled}>
   {edit.command==='create'&&<ListPlus size={16} aria-hidden="true"/>}
   {edit.command==='delete'&&<Trash2 size={15} aria-hidden="true"/>}
   {busy?'Saving…':checkingImpact?'Checking impact…':editor.request?'Retry saved request':reviewStep?'Confirm changes':actionLabel}
  </button>}
 </div>;
 const form=<form id={formId} noValidate className="r7-form r7-form--modal" aria-label="Nested work changes" onSubmit={e=>{e.preventDefault();void submit();}}>
  {error&&<div role="alert" className="nw-operation-error"><AlertCircle size={18} aria-hidden="true"/><div><strong>{editor.saved?'Work saved':'Could not confirm this change'}</strong><p>{error}{editor.unresolvedReceipt?' Your draft is kept. You can retry the same request if its result is still unconfirmed.':outcome.kind==='stale_revision'?' The work changed while you were editing. Your draft is kept.':outcome.kind==='confirmed_failure'?' Nothing was saved. Correct the draft before submitting a new request.':outcome.kind==='revoked_authority'?' Saving is paused while current access is checked. Your draft is kept.':''}</p></div></div>}
  {fieldPolicyRequired&&!detailPolicy&&<p role="status">Editing permissions could not be verified. Refresh this work.</p>}
  {startedEdit&&<p role="note">Work is already in progress. Start date and prerequisites cannot be changed. Authorized editors can correct the title and priority; due-date changes require supervising authority and a reason.</p>}
  {['create','edit'].includes(edit.command)&&<WorkDetailsEditor fields={editor.fields} disabled={locked||detailsUnavailable} update={update} presentation={edit.command==='create'?'dialog':'default'}
   dueChangeReason={reasonRequired&&canEnterScheduleReason?<label>Reason for due date change<textarea value={note} maxLength={1000} required disabled={locked} onChange={e=>update('note',e.target.value)}/></label>:undefined}
   prerequisiteField={dependencyField} showWorkOrder={data.root.kind==='personal'}
   showStart={!!data.root.scheduleBounds}
   minDue={data.root.scheduleBounds?dateLimits.earliest||'':calendarMinDate(edit.command==='edit'?editor.baseline.fields.due:'')}
   maxDue={dateLimits.latest}
   planningLocked={fieldPolicyRequired&&detailPolicy?.planning!==true}
   dueDisabled={fieldPolicyRequired&&detailPolicy?.due!==true}
   staffingLocked={edit.command==='create'&&!!data.root.subtask_staffing_locked}
   peoplePicker={edit.command==='create'&&!data.root.subtask_staffing_locked?{people:data.people,priority:workAssignmentPriority(data,parent||null),lead,selected:people,onLead:value=>update('lead',value),onSelected:value=>update('people',value),appointmentCapability:createCapability,contributorCapability:createCapability,disabled:locked,
    invite:!locked?{project:data.root.project,office:data.root.office,root:data.root.id,node:edit.parent||undefined,canRequest:scopedInvitationRequestAllowed(data,edit.parent||null,context)}:undefined}:undefined}/>}
  {edit.command==='move'&&!reviewStep&&<WorkMoveDialog data={data} destinations={destinations} allowTask={destinationRoot.allowed} parent={parent} disabled={locked||checkingImpact} onChange={value=>update('parent',value)}/>}
  {edit.command==='order'&&!reviewStep&&<WorkOrderDialog data={data} order={order} disabled={locked||checkingImpact} onChange={value=>update('order',value)}/>}
  {['move','order'].includes(edit.command)&&reviewStep&&<div className="space-y-3">
   {edit.command==='order'&&<div className="rounded-xl border border-[var(--eflow-border,#d6deed)] bg-[var(--eflow-subtle,#f0f4fb)] p-3 text-[12.5px]">
    <div className="font-semibold text-[var(--eflow-text,#161b35)]">New sequence</div>
    <p className="mt-1 mb-0 text-[var(--eflow-text-secondary,#505c77)]">{order.map(id=>data.nodes.find(item=>item.id===id)?.title||'Unavailable subtask').join(' → ')}</p>
   </div>}
   <WorkImpactSummary impact={reviewStep.impact}/>
  </div>}
  {edit.command==='delete'&&!editor.request&&<WorkDeleteDialog impact={deletePreview.impact} loading={deletePreview.loading} error={deletePreview.error} onRetry={()=>setDeletePreviewRetry(count=>count+1)}/>}
  {edit.command==='progress'&&<p>In progress · Save an update, or mark this step complete.</p>}

  {['progress','submit','review'].includes(edit.command)&&<label>Note / feedback<textarea value={note} maxLength={4000} disabled={locked} onChange={e=>update('note',e.target.value)}/></label>}
  {editor.saved&&<p role="status">Work saved.</p>}
  {editor.recovered&&<p role="status">{editor.staleRecovery?'This draft was saved against an older version. Review it against the current work before saving.':'Draft recovered after current access verification. Review before saving.'}</p>}
  {editor.storageFailed&&<p role="alert">Draft recovery could not be stored in this tab. Keep the editor open to retain your changes.</p>}
 </form>;
 return <><Modal isOpen title={modalMeta.title} description={modalMeta.description} width={modalMeta.width} className="nw-create-modal" bodyClassName="r7-work nw-create-body" footer={<div className="r7-work nw-create-footer">{actions}</div>} preventClose={busy||checkingImpact} onClose={close}>{form}</Modal>{confirmation.dialog}</>;
}
