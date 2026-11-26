import { requestNavigation } from '../../../shared/navigationGuard';
import { Modal } from '../../../components/ui/Modal';
import { BoundedTextInput, BoundedTextarea } from '../../../components/ui/BoundedInput';
import { MoneyInput } from '../../../components/ui/MoneyInput';
import { ActionBlockerGroup } from '../../../components/ui/action-blockers';
import { WorkspaceTooltip } from '../../../components/ui/workspace/WorkspaceTooltip';
import { useEffect, useId, useRef, useState } from 'react';
import { ListPlus, AlertCircle, ArrowLeft, Trash2, Wallet } from 'lucide-react';
import {
  assignWorkCash,
  buildUnifiedFundingOptions,
  fetchTaskFundingContext,
  peso,
  pickDefaultFundingOption,
  validateCashAssignmentAmount,
  type TaskFundingContext,
} from '../../budget';
import { calendarMinDate } from '../../../shared/calendarDates';
import { exceedsCentavos } from '../../../shared/currency';
import { INPUT_LIMITS, textLengthError } from '../../../shared/inputLimits';
import { duplicateWorkNameError } from '../../../shared/workNames';
import {subtaskDateLimits} from '../selectors/subtaskDates';
import {freezeWorkEditorRequest,workEditorDateError,workEditorDefinitionError,workEditorDirty,workEditorPayload} from '../selectors/editorDraft';
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
import {captureStaffingBaseline,createStaffingRequest,scopedInvitationRequestAllowed,staffingCapabilities,staffingDraftError} from '../selectors/staffing';
import {reparentChoices} from '../selectors/tree';
import type {WorkImpact,WorkRequest,WorkTreeSnapshot} from '../types';
import type {WorkEdit} from '../types/editor';
import {readNodeDetailEditState} from '../selectors/detailEditing';
import {canCreateSubtaskPrerequisites,canEditSubtaskPrerequisites,displayedSubtaskPrerequisiteIds,subtaskPrerequisiteChoices} from '../selectors/prerequisites';
import {PrerequisiteField} from '../../../components/ui/workspace/PrerequisiteField';
import {compatibilityWorkWorkerIds,workAssignmentPriority} from '../selectors/people';
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
 const scheduleReasonId=useId();
 const budgetSourceSelectId=useId();
 const budgetAmountId=useId();
 const budgetReasonId=useId();
 const feedbackNoteId=useId();
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
 const [savingExtras,setSavingExtras]=useState(false);
 const [impactError,setImpactError]=useState('');
 const [fundingContext,setFundingContext]=useState<TaskFundingContext|null>(null);
 const [budgetSourceId,setBudgetSourceId]=useState('');
 const [budgetAmount,setBudgetAmount]=useState('');
 const [budgetReason,setBudgetReason]=useState('');
 const [submitted,setSubmitted]=useState(false);
 const [leadTouched,setLeadTouched]=useState(false);
 const [reasonTouched,setReasonTouched]=useState(false);
 const [startInvalidText,setStartInvalidText]=useState(false);
 const [dueInvalidText,setDueInvalidText]=useState(false);
 const budgetAttemptKey=useRef<string>(crypto.randomUUID());
 const budgetInputDirtyRef=useRef(false);
 const effectiveBusy=busy||savingExtras;
 const effectiveLocked=locked||savingExtras;
 const isDetailsCommand=['create','edit'].includes(edit.command);
 const canShowSubtaskBudget=isDetailsCommand&&data.root.kind==='office'&&node?.status!=='completed';
 const budgetTargetSubtaskId=edit.command==='edit'&&node?node.id:'__new__';
 useEffect(()=>{
  if(!canShowSubtaskBudget||typeof fetchTaskFundingContext!=='function'){setFundingContext(null);return;}
  let current=true;
  void fetchTaskFundingContext(data.root.id).then(ctx=>{
   if(!current)return;
   setFundingContext(ctx);
   const groups=typeof buildUnifiedFundingOptions==='function'
    ?buildUnifiedFundingOptions(ctx,budgetTargetSubtaskId,{includeUnrequestedBudgetCap:false})
    :{taskCashOptions:[],officePettyCashOptions:[],budgetCapOptions:[],allOptions:[]};
   const spendable=groups.allOptions.filter(opt=>opt.maxForTarget>0);
   const existingAssigned=edit.command==='edit'?spendable.find(opt=>opt.existingTargetAmount>0):undefined;
   const first=existingAssigned||(typeof pickDefaultFundingOption==='function'?pickDefaultFundingOption(spendable):spendable[0]);
   if(first){
    setBudgetSourceId(prev=>prev||first.key);
    if(edit.command==='edit'&&!budgetInputDirtyRef.current&&first.existingTargetAmount>0){
     setBudgetAmount(String(first.existingTargetAmount));
     const existingRow=ctx?.cashPools?.assignments?.find(a=>a.id===first.existingAssignmentId);
     if(existingRow?.note)setBudgetReason(existingRow.note);
    }
   }
  }).catch(()=>{if(current)setFundingContext(null);});
  return()=>{current=false;};
 },[canShowSubtaskBudget,data.root.id,budgetTargetSubtaskId,edit.command]);
 const unifiedGroups=canShowSubtaskBudget&&typeof buildUnifiedFundingOptions==='function'
  ?buildUnifiedFundingOptions(fundingContext,budgetTargetSubtaskId,{includeUnrequestedBudgetCap:false})
  :{taskCashOptions:[],officePettyCashOptions:[],budgetCapOptions:[],allOptions:[]};
 const availableTaskCashOptions=unifiedGroups.taskCashOptions.filter(opt=>opt.maxForTarget>0);
 const availablePettyCashOptions=unifiedGroups.officePettyCashOptions.filter(opt=>opt.maxForTarget>0);
 const fundingOptions=[...availableTaskCashOptions,...availablePettyCashOptions];
 const canFundSubtask=Boolean(fundingContext?.cashPools?.canAssignCash||fundingContext?.canManageDistribution);
 const showSubtaskBudget=Boolean(canShowSubtaskBudget&&canFundSubtask&&fundingOptions.length>0);
 const selectedFundingOption=fundingOptions.find(opt=>opt.key===budgetSourceId)||(edit.command==='edit'?fundingOptions.find(opt=>opt.existingTargetAmount>0):undefined)||(typeof pickDefaultFundingOption==='function'?pickDefaultFundingOption(fundingOptions):fundingOptions[0]);
 const existingAssignment=selectedFundingOption?.existingAssignmentId
  ?fundingContext?.cashPools?.assignments?.find(a=>a.id===selectedFundingOption.existingAssignmentId)
  :undefined;
 const existingAssignmentNote=existingAssignment?.note?.trim()||'';
 const existingTargetAmount=selectedFundingOption?.existingTargetAmount??0;
 const rawBudgetText=budgetAmount.trim();
 const parsedBudgetAmount=rawBudgetText?Number(rawBudgetText):0;
 const budgetAmountIssue=showSubtaskBudget&&typeof validateCashAssignmentAmount==='function'?validateCashAssignmentAmount(rawBudgetText,selectedFundingOption,{allowBlank:true}):'';
 const budgetOverAvailable=Boolean(
  showSubtaskBudget&&
  rawBudgetText&&
  selectedFundingOption&&
  Number.isFinite(parsedBudgetAmount)&&
  exceedsCentavos(parsedBudgetAmount,selectedFundingOption.maxForTarget),
 );
 const budgetExternalError=budgetOverAvailable?'':budgetAmountIssue;
 const budgetAmountChanged=Boolean(rawBudgetText)&&Boolean(selectedFundingOption)&&(
  edit.command==='create'
   ?parsedBudgetAmount>0
   :(Number.isFinite(parsedBudgetAmount)&&Math.round(parsedBudgetAmount*100)!==Math.round(existingTargetAmount*100))
 );
 const budgetNoteChanged=edit.command==='edit'&&existingTargetAmount>0&&Boolean(rawBudgetText)&&budgetReason.trim()!==existingAssignmentNote;
 const shouldSaveBudget=Boolean(showSubtaskBudget&&selectedFundingOption&&selectedFundingOption.kind!=='budget_cap'&&(budgetAmountChanged||budgetNoteChanged));

 const editStaffingCaps=edit.command==='edit'&&data.root.kind==='office'&&node
  ?staffingCapabilities(data,node.id,context,lead||null)
  :null;
 const editStaffingBaseline=edit.command==='edit'&&data.root.kind==='office'&&node
  ?captureStaffingBaseline(data,node.id,context)
  :null;
 const showPeoplePicker=isDetailsCommand&&!data.root.subtask_staffing_locked&&(edit.command==='create'||(data.root.kind==='office'&&Boolean(node)));
 const leadRequired=isDetailsCommand&&data.root.kind==='office'&&!data.root.subtask_staffing_locked&&(
  edit.command==='create'?createCapability.allowed:Boolean(editStaffingCaps?.appointment.allowed)
 );
 const leadError=leadRequired&&!lead?'Choose an appointed subtask lead.':'';
 const samePersonSet=(a:readonly string[],b:readonly string[])=>JSON.stringify([...new Set(a)].sort())===JSON.stringify([...new Set(b)].sort());
 const staffingChanged=edit.command==='edit'&&data.root.kind==='office'&&Boolean(node)&&!data.root.subtask_staffing_locked&&(
  lead!==editor.baseline.fields.lead||
  !samePersonSet(
   compatibilityWorkWorkerIds(lead||null,people),
   compatibilityWorkWorkerIds(editor.baseline.fields.lead||null,editor.baseline.fields.people),
  )
 );
 const staffingEditError=staffingChanged&&editStaffingBaseline
  ?(staffingDraftError(data,context,editStaffingBaseline,lead||null,people)||'')
  :'';
 const visibleLeadError=submitted||leadTouched||Boolean(editor.fields.title.trim())?(leadError||staffingEditError):staffingEditError;
 const detailsDirty=edit.command==='edit'?workEditorDirty(editor.baseline,editor.fields):true;
 const titleDuplicateIssue=isDetailsCommand&&editor.fields.title.trim()
  ?(duplicateWorkNameError(
   editor.fields.title,
   data.nodes.filter(item=>(item.parent_subtask_id||'')===((edit.command==='edit'?editor.baseline.fields.parent:parent)||'')),
   'Subitem',
   editor.baseline.nodeId||undefined,
  )||'')
  :'';
 const titleError=isDetailsCommand
  ?(textLengthError(editor.fields.title,'Subtask title',{required:true,max:INPUT_LIMITS.TITLE})||titleDuplicateIssue)
  :'';
 const visibleTitleError=submitted||Boolean(titleDuplicateIssue)?titleError:'';

 const liveDateIssue=isDetailsCommand?workEditorDateError(data,editor.baseline,editor.fields):'';
 const startDateError=startInvalidText
  ?'Enter a valid start date in MM/DD/YYYY format.'
  :(liveDateIssue&&/start date/i.test(liveDateIssue)&&!/due date must be on or after/i.test(liveDateIssue)?liveDateIssue:'');
 const dueDateError=dueInvalidText
  ?'Enter a valid due date in MM/DD/YYYY format.'
  :(liveDateIssue&&!startDateError?liveDateIssue:'');

 const scheduleReasonLabel=dueChanged&&startChanged
  ?'Reason for schedule change'
  :dueChanged
   ?'Reason for due date change'
   :'Reason for start date change';
 const scheduleReasonError=reasonRequired&&canEnterScheduleReason
  ?textLengthError(note,scheduleReasonLabel,{required:true,max:INPUT_LIMITS.REASON})
  :'';
 const visibleScheduleReasonError=reasonRequired&&canEnterScheduleReason&&(reasonTouched||submitted)?scheduleReasonError:'';

 const moveHasDestinations=destinationRoot.allowed||destinations.length>0;
 const moveSelectionValid=(parent===''&&destinationRoot.allowed)||destinations.some(item=>item.id===parent);
 const moveError=edit.command==='move'&&!reviewStep
  ?(!moveHasDestinations?'No valid destination parents are available for this subtask.':!moveSelectionValid?'Choose a valid destination parent.':'')
  :'';
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
 const commitBudgetAssignment=async(targetSubtaskId:string):Promise<boolean>=>{
  if(!shouldSaveBudget||!selectedFundingOption||selectedFundingOption.kind==='budget_cap')return true;
  if(!Number.isFinite(parsedBudgetAmount)||parsedBudgetAmount<=0||exceedsCentavos(parsedBudgetAmount,selectedFundingOption.maxForTarget)){
   setImpactError(`Amount cannot exceed the ${peso.format(selectedFundingOption.maxForTarget)} available in ${selectedFundingOption.label}.`);
   return false;
  }
  await assignWorkCash({
   taskId:data.root.id,
   subtaskId:targetSubtaskId,
   sourceKind:selectedFundingOption.kind,
   sourceRequestId:selectedFundingOption.sourceId,
   allocationLineId:selectedFundingOption.allocationLineId??null,
   amount:parsedBudgetAmount,
   note:budgetReason.trim()||existingAssignmentNote||(edit.command==='create'?'Initial subtask funding':'Subtask funding'),
   idempotencyKey:budgetAttemptKey.current,
  });
  budgetAttemptKey.current=crypto.randomUUID();
  return true;
 };
 const handleCreateDone=async()=>{
  if(shouldSaveBudget){
   setSavingExtras(true);
   try{
    const ok=await commitBudgetAssignment(editor.baseline.createdId);
    if(!ok)return;
   }catch(caught){
    const msg=caught instanceof Error?caught.message:'Could not save the subtask funding assignment.';
    setImpactError(`Subtask created, but funding assignment could not be saved: ${msg}`);
    return;
   }finally{
    if(activeRef.current)setSavingExtras(false);
   }
  }
  await onDone();
 };
 const handleEditDone=async(receipt:WorkTreeSnapshot)=>{
  if(staffingChanged||shouldSaveBudget){
   setSavingExtras(true);
   try{
    if(staffingChanged&&node&&editStaffingBaseline&&lead){
     await save(createStaffingRequest({...editStaffingBaseline,revision:receipt.revision},lead,people));
    }
    if(shouldSaveBudget&&node){
     const ok=await commitBudgetAssignment(node.id);
     if(!ok)return;
    }
   }catch(caught){
    const msg=caught instanceof Error?caught.message:'Could not save team or funding updates.';
    setImpactError(`Subtask details saved, but remaining changes could not be saved: ${msg}`);
    return;
   }finally{
    if(activeRef.current)setSavingExtras(false);
   }
  }
  await onDone();
 };
 const saveEditExtrasOnly=async()=>{
  if(effectiveBusy||!node)return;
  setSavingExtras(true);
  setImpactError('');
  try{
   if(staffingChanged&&editStaffingBaseline&&lead){
    await save(createStaffingRequest(editStaffingBaseline,lead,people));
   }
   if(shouldSaveBudget){
    const ok=await commitBudgetAssignment(node.id);
    if(!ok)return;
   }
   await onDone();
  }catch(caught){
   if(activeRef.current)setImpactError(caught instanceof Error?caught.message:'Could not save subtask changes.');
  }finally{
   if(activeRef.current)setSavingExtras(false);
  }
 };
 const submit=()=>{
  setSubmitted(true);
  setImpactError('');
  if(isDetailsCommand&&budgetAmountIssue)return;
  if(isDetailsCommand&&(titleError||startDateError||dueDateError||scheduleReasonError||leadError||staffingEditError))return;
  if(moveError)return;
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
  if(edit.command==='edit'&&!detailsDirty&&(staffingChanged||shouldSaveBudget)){
   void saveEditExtrasOnly();
   return;
  }
  void editor.submit({save,onDone:edit.command==='create'?handleCreateDone:edit.command==='edit'?handleEditDone:onDone,prepare:needsEditPreview?prepare:undefined});
 };
 const error=impactError||('message' in outcome?outcome.message:null);
 const actionLabel={create:'Add subtask',edit:'Save subtask',delete:'Delete subtask',move:'Move subtask',order:'Save sequence',progress:'Post update',submit:'Submit for review',review:'Save review',staff:'Save staffing',contributors:'Save contributors',root_lead:'Save task lead'}[edit.command];
 const modalMeta={
  create:{title:'Add subtask',description:'Break the work into a clear, manageable step.',width:'max-w-3xl'},
  edit:{title:'Edit subtask',description:'Update subtask details, team, and funding.',width:'max-w-3xl'},
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
 const formValidationBlockers=!editor.request&&!reviewStep
  ?(isDetailsCommand
    ?[titleError,startDateError,dueDateError,scheduleReasonError,leadError,staffingEditError,budgetAmountIssue].filter(Boolean)
    :moveError?[moveError]:[])
  :[];
 const primaryBusy=effectiveBusy||checkingImpact||(!reviewStep&&!authorized&&refreshPending)||(edit.command==='delete'&&!editor.request&&deletePreview.loading);
 const primaryDisabled=effectiveBusy||checkingImpact||(reviewStep?!reviewStep.impact.allowed:!authorized||deleteBlocked||formValidationBlockers.length>0);
 const primaryBlockers=reviewStep
  ?(!reviewStep.impact.allowed?['This change is blocked by current work constraints.']:[])
  :!authorized
   ?(!refreshPending?[editor.capability.disabledReason||(editor.staleRecovery?'Review against current work before saving.':'Saving is unavailable with your current access.')]:[])
   :deleteBlocked
    ?(!deletePreview.loading?[deletePreview.error||(!deletePreview.impact?.allowed?'This subtask cannot be deleted in its current state.':'Work changed. Reload and review before deleting.')]:[])
    :formValidationBlockers;
 const deleteEnabledTip=edit.command==='delete'&&!primaryDisabled
  ?'Permanently deletes this subtask and any nested steps. This cannot be undone.'
  :'';
 const primaryActionName=editor.request?'Retry saved request':reviewStep?'Confirm changes':actionLabel;
 const actions=<div className="r7-actions">
  {reviewStep
   ?<button type="button" disabled={effectiveBusy} onClick={()=>{setReviewStep(null);setImpactError('');}}><ArrowLeft size={14} aria-hidden="true"/>Back</button>
   :<button type="button" disabled={effectiveBusy||checkingImpact} onClick={close}>{editor.saved?'Close':'Cancel changes'}</button>}
  {editor.canReviewLatest&&!reviewStep&&<button type="button" onClick={editor.reviewLatest}>Review against current work</button>}
  {!editor.saved&&(
   <ActionBlockerGroup
    actionLabel={primaryActionName}
    blockers={primaryBlockers}
    busy={primaryBusy}
    onRefresh={edit.command==='delete'&&!editor.request&&deletePreview.error?()=>setDeletePreviewRetry(count=>count+1):undefined}
   >
    <WorkspaceTooltip content={deleteEnabledTip} disabled={!deleteEnabledTip}>
     <button type="button" onClick={()=>void submit()} className={edit.command==='delete'?'nw-delete-action':'nw-create-save'} disabled={primaryDisabled}>
      {edit.command==='create'&&<ListPlus size={16} aria-hidden="true"/>}
      {edit.command==='delete'&&<Trash2 size={15} aria-hidden="true"/>}
      {effectiveBusy?'Saving…':checkingImpact?'Checking impact…':primaryActionName}
     </button>
    </WorkspaceTooltip>
   </ActionBlockerGroup>
  )}
 </div>;
 const form=<form id={formId} noValidate className="r7-form r7-form--modal" aria-label="Nested work changes" onSubmit={e=>{e.preventDefault();void submit();}}>
  {error&&<div role="alert" className="nw-operation-error"><AlertCircle size={18} aria-hidden="true"/><div><strong>{editor.saved?'Work saved':'Could not confirm this change'}</strong><p>{error}{editor.unresolvedReceipt?' Your draft is kept. You can retry the same request if its result is still unconfirmed.':outcome.kind==='stale_revision'?' The work changed while you were editing. Your draft is kept.':outcome.kind==='confirmed_failure'?' Nothing was saved. Correct the draft before submitting a new request.':outcome.kind==='revoked_authority'?' Saving is paused while current access is checked. Your draft is kept.':''}</p></div></div>}
  {fieldPolicyRequired&&!detailPolicy&&<p role="status">Editing permissions could not be verified. Refresh this work.</p>}
  {startedEdit&&<p role="note">Work is already in progress. Start date and prerequisites cannot be changed. Authorized editors can correct the title and priority; due-date changes require supervising authority and a reason.</p>}
  {['create','edit'].includes(edit.command)&&<WorkDetailsEditor fields={editor.fields} disabled={effectiveLocked||detailsUnavailable} update={update} presentation="dialog"
   showPriority={edit.command==='edit'}
   leadRequired={leadRequired}
   titleError={visibleTitleError||undefined}
   startDateError={startDateError||undefined}
   dueDateError={dueDateError||undefined}
   onStartInvalidTextChange={setStartInvalidText}
   onDueInvalidTextChange={setDueInvalidText}
   dueChangeReason={reasonRequired&&canEnterScheduleReason?(
    <div className="mt-2 grid gap-1">
     <label htmlFor={scheduleReasonId}>
      {scheduleReasonLabel} <span className="text-[var(--eflow-negative-text)]" aria-hidden="true">*</span>
     </label>
     <BoundedTextarea
      id={scheduleReasonId}
      rows={2}
      value={note}
      maxLength={INPUT_LIMITS.REASON}
      aria-required="true"
      disabled={effectiveLocked}
      error={visibleScheduleReasonError||undefined}
      onBlur={()=>setReasonTouched(true)}
      onChange={e=>update('note',e.target.value)}
     />
    </div>
   ):undefined}
   prerequisiteField={dependencyField} showWorkOrder={data.root.kind==='personal'}
   showStart={!!data.root.scheduleBounds}
   minDue={data.root.scheduleBounds?dateLimits.earliest||'':calendarMinDate(edit.command==='edit'?editor.baseline.fields.due:'')}
   maxDue={dateLimits.latest}
   planningLocked={fieldPolicyRequired&&detailPolicy?.planning!==true}
   dueDisabled={fieldPolicyRequired&&detailPolicy?.due!==true}
   staffingLocked={isDetailsCommand&&data.root.kind==='office'&&!!data.root.subtask_staffing_locked}
   peoplePicker={showPeoplePicker?{
    people:data.people,
    priority:workAssignmentPriority(data,(edit.command==='edit'?editor.baseline.fields.parent:parent)||null),
    lead,
    leadError:visibleLeadError||undefined,
    selected:people,
    onLead:value=>{setLeadTouched(true);update('lead',value);},
    onSelected:value=>update('people',value),
    appointmentCapability:edit.command==='edit'&&editStaffingCaps?editStaffingCaps.appointment:createCapability,
    contributorCapability:edit.command==='edit'&&editStaffingCaps?editStaffingCaps.contributors:createCapability,
    disabled:effectiveLocked,
    disabledReason:effectiveBusy?'Saving…':editor.staleRecovery?'Review against current work to edit.':undefined,
    invite:!effectiveLocked?{project:data.root.project,office:data.root.office,root:data.root.id,node:(edit.command==='edit'?node?.id:edit.parent)||undefined,canRequest:scopedInvitationRequestAllowed(data,(edit.command==='edit'?node?.id:edit.parent)||null,context)}:undefined,
   }:undefined}/>}
  {showSubtaskBudget&&(
   <section className="nw-create-section space-y-3 rounded-xl border border-[var(--eflow-border,#d6deed)] bg-[var(--eflow-surface,#ffffff)] p-4" aria-label="Fund this subtask">
    <div className="flex flex-wrap items-center justify-between gap-2">
     <div className="flex items-center gap-2 text-sm font-semibold text-[var(--eflow-text,#161b35)]">
      <Wallet size={15} className="text-[var(--eflow-primary,#00006b)]" aria-hidden="true"/>
      <span>Fund this subtask</span>
      <span className="rounded-full bg-[var(--eflow-subtle,#f0f4fb)] px-2 py-0.5 text-[11px] font-medium text-[var(--eflow-text-muted,#5e6b85)]">Optional</span>
     </div>
     <div className="flex flex-wrap items-center gap-1.5 text-xs font-medium tabular-nums">
      {availableTaskCashOptions.map(opt=>(
       <span key={opt.key} className="rounded-md bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-800">
        {opt.sourceName||opt.label}{' '}
        {opt.existingTargetAmount>0
         ?`${peso.format(opt.existingTargetAmount)} assigned${opt.available>0?` · ${peso.format(opt.available)} free`:''}`
         :peso.format(opt.available)}
       </span>
      ))}
      {availablePettyCashOptions.map(opt=>(
       <span key={opt.key} className="rounded-md bg-indigo-50 px-2 py-0.5 font-semibold text-indigo-800">
        {opt.sourceName||'Petty cash'}{' '}
        {opt.existingTargetAmount>0
         ?`${peso.format(opt.existingTargetAmount)} assigned${opt.available>0?` · ${peso.format(opt.available)} free`:''}`
         :peso.format(opt.available)}
       </span>
      ))}
     </div>
    </div>
    <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,13rem)]">
     <div className="grid min-w-0 gap-1.5 text-xs font-medium text-[var(--eflow-text,#161b35)]">
      <label htmlFor={budgetSourceSelectId}>Funding source</label>
      <select
       id={budgetSourceSelectId}
       className="w-full min-w-0 truncate"
       value={selectedFundingOption?.key||''}
       disabled={effectiveLocked}
       onChange={e=>{
        const nextKey=e.target.value;
        setBudgetSourceId(nextKey);
        setImpactError('');
        if(edit.command==='edit'){
         const nextOpt=fundingOptions.find(opt=>opt.key===nextKey);
         budgetInputDirtyRef.current=true;
         setBudgetAmount(nextOpt&&nextOpt.existingTargetAmount>0?String(nextOpt.existingTargetAmount):'');
         const existingRow=nextOpt?.existingAssignmentId?fundingContext?.cashPools?.assignments?.find(a=>a.id===nextOpt.existingAssignmentId):undefined;
         setBudgetReason(existingRow?.note||'');
        }
       }}
      >
       {availableTaskCashOptions.length>0&&(
        <optgroup label="Task cash">
         {availableTaskCashOptions.map(opt=>(
          <option key={opt.key} value={opt.key}>
           {opt.label} — {opt.existingTargetAmount>0?`${peso.format(opt.existingTargetAmount)} assigned${opt.available>0?` · ${peso.format(opt.available)} free`:''}`:peso.format(opt.available)}
          </option>
         ))}
        </optgroup>
       )}
       {availablePettyCashOptions.length>0&&(
        <optgroup label="Office petty cash">
         {availablePettyCashOptions.map(opt=>(
          <option key={opt.key} value={opt.key}>
           {opt.label} — {opt.existingTargetAmount>0?`${peso.format(opt.existingTargetAmount)} assigned${opt.available>0?` · ${peso.format(opt.available)} free`:''}`:peso.format(opt.available)}
          </option>
         ))}
        </optgroup>
       )}
      </select>
     </div>
     <div className="grid min-w-0 gap-1.5 text-xs font-medium text-[var(--eflow-text,#161b35)]">
      <label htmlFor={budgetAmountId}>Amount (PHP)</label>
      <MoneyInput
       id={budgetAmountId}
       min={0}
       max={INPUT_LIMITS.MONEY_MAX_BUDGET}
       availableMax={selectedFundingOption?.maxForTarget}
       showCeilingHint
       externalError={budgetExternalError||undefined}
       placeholder="0.00"
       value={budgetAmount}
       disabled={effectiveLocked||(selectedFundingOption?.maxForTarget??0)<=0}
       onValueChange={raw=>{budgetInputDirtyRef.current=true;setBudgetAmount(raw);setImpactError('');}}
      />
     </div>
    </div>
    {rawBudgetText&&(
     <div className="grid min-w-0 gap-1.5 text-xs font-medium text-[var(--eflow-text,#161b35)]">
      <label htmlFor={budgetReasonId}>Note (optional)</label>
      <BoundedTextInput
       id={budgetReasonId}
       maxLength={INPUT_LIMITS.TASK_TITLE}
       placeholder="e.g. Materials and transport"
       value={budgetReason}
       disabled={effectiveLocked}
       onChange={e=>{budgetInputDirtyRef.current=true;setBudgetReason(e.target.value);}}
      />
     </div>
    )}
   </section>
  )}
  {edit.command==='move'&&!reviewStep&&<WorkMoveDialog data={data} destinations={destinations} allowTask={destinationRoot.allowed} parent={parent} disabled={effectiveLocked||checkingImpact} error={submitted?moveError:undefined} onChange={value=>update('parent',value)}/>}
  {edit.command==='order'&&!reviewStep&&<WorkOrderDialog data={data} order={order} disabled={effectiveLocked||checkingImpact} onChange={value=>update('order',value)}/>}
  {['move','order'].includes(edit.command)&&reviewStep&&<div className="space-y-3">
   {edit.command==='order'&&<div className="rounded-xl border border-[var(--eflow-border,#d6deed)] bg-[var(--eflow-subtle,#f0f4fb)] p-3 text-[12.5px]">
    <div className="font-semibold text-[var(--eflow-text,#161b35)]">New sequence</div>
    <p className="mt-1 mb-0 text-[var(--eflow-text-secondary,#505c77)]">{order.map(id=>data.nodes.find(item=>item.id===id)?.title||'Unavailable subtask').join(' → ')}</p>
   </div>}
   <WorkImpactSummary impact={reviewStep.impact}/>
  </div>}
  {edit.command==='delete'&&!editor.request&&<WorkDeleteDialog impact={deletePreview.impact} loading={deletePreview.loading} error={deletePreview.error} onRetry={()=>setDeletePreviewRetry(count=>count+1)}/>}
  {edit.command==='progress'&&<p>In progress · Save an update, or mark this step complete.</p>}

  {['progress','submit','review'].includes(edit.command)&&(
   <div className="grid gap-1">
    <label htmlFor={feedbackNoteId}>Note / feedback</label>
    <BoundedTextarea
     id={feedbackNoteId}
     rows={3}
     value={note}
     maxLength={INPUT_LIMITS.COMMENT}
     disabled={effectiveLocked}
     onChange={e=>update('note',e.target.value)}
    />
   </div>
  )}
  {editor.saved&&<p role="status">Work saved.</p>}
  {editor.recovered&&<p role="status">{editor.staleRecovery?'This draft was saved against an older version. Review it against the current work before saving.':'Draft recovered after current access verification. Review before saving.'}</p>}
  {editor.storageFailed&&<p role="alert">Draft recovery could not be stored in this tab. Keep the editor open to retain your changes.</p>}
 </form>;
 return <><Modal isOpen title={modalMeta.title} description={modalMeta.description} width={modalMeta.width} className="nw-create-modal" bodyClassName="r7-work nw-create-body" footer={<div className="r7-work nw-create-footer">{actions}</div>} preventClose={effectiveBusy||checkingImpact} onClose={close}>{form}</Modal>{confirmation.dialog}</>;
}
