import {requestNavigation} from '../../../shared/navigationGuard';
import {Modal} from '../../../components/ui/Modal';
import {useId} from 'react';
import {ListPlus,AlertCircle} from 'lucide-react';
import {calendarMinDate} from '../../../shared/calendarDates';
import {WorkDetailsEditor} from './WorkDetailsEditor';
import {WorkMoveDialog} from './WorkMoveDialog';
import {WorkOrderDialog} from './WorkOrderDialog';
import {WorkDeleteDialog} from './WorkDeleteDialog';
import {WorkStaffingDialog} from './WorkStaffingDialog';
import {useAuth} from '../../../contexts/AuthContext';
import {selectNodeWorkCapability,selectRootWorkCapability} from '../selectors/capabilities';
import {useWorkEditorDraft} from '../hooks/useWorkEditorDraft';
import {useWorkImpactConfirmation} from '../hooks/useWorkImpactConfirmation';
import {scopedInvitationRequestAllowed} from '../selectors/staffing';
import {reparentChoices} from '../selectors/tree';
import type {WorkRequest,WorkTreeSnapshot} from '../types';
import type {WorkEdit} from '../types/editor';
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
 const node=data.nodes.find(item=>item.id===editor.baseline.nodeId)||edit.node;
 const createCapability=edit.parent?selectNodeWorkCapability(data,edit.parent,'create_child',context):selectRootWorkCapability(data,'create_child',context);
 const destinationRoot=selectRootWorkCapability(data,'create_child',context);
 const destinations=node?reparentChoices(data.nodes.map(item=>({...item,can_manage:selectNodeWorkCapability(data,item.id,'create_child',context).allowed})),node):[];
 const confirmation=useWorkImpactConfirmation(data.root.id);
 const close=()=>void requestNavigation(editor.discard);
 const prepare=(request:WorkRequest)=>{
  const modeChanged=edit.command==='edit'&&standalone!==editor.baseline.fields.standalone;
  const dateChanged=edit.command==='edit'&&editor.fields.due!==editor.baseline.fields.due;
  if(!['move','order','delete'].includes(edit.command)&&!modeChanged&&!dateChanged)return Promise.resolve(undefined);
  return confirmation.review(request,{title:edit.command==='delete'?'Delete subtask?':edit.command==='move'?'Review subtask move?':edit.command==='order'?'Review subtask sequence?':modeChanged?'Review execution mode change?':'Review due-date impact?',dateChange:dateChanged,alwaysConfirm:modeChanged,
   actionLabel:edit.command==='delete'?'Delete subtask':'Confirm changes',danger:edit.command==='delete',isCurrent:editor.confirmationCurrent,description:edit.command==='delete'?'This removes the selected subtask and any subtasks beneath it. Review the affected work before deleting.':'Review the current affected work. The server checks this exact impact again before saving.',
   details:modeChanged?<p>Execution mode: {editor.baseline.fields.standalone?'Can start independently':'In sequence'} → {standalone?'Can start independently':'In sequence'}. Changing the sequence can affect when related work may start.</p>:edit.command==='order'?<p>New sequence: {order.map(id=>data.nodes.find(item=>item.id===id)?.title||'Unavailable subtask').join(' → ')}</p>:undefined});
 };
 const needsPreview=['move','order','delete'].includes(edit.command)||edit.command==='edit'&&(standalone!==editor.baseline.fields.standalone||editor.fields.due!==editor.baseline.fields.due);
 const submit=()=>editor.submit({save,onDone,prepare:needsPreview?prepare:undefined});
 const error='message' in outcome?outcome.message:null;
 const actionLabel={create:'Add subtask',edit:'Save subtask',delete:'Review deletion',move:'Move subtask',order:'Save sequence',progress:'Post update',submit:'Submit for review',review:'Save review',staff:'Save staffing',contributors:'Save contributors',root_lead:'Save task lead'}[edit.command];
 const actions=<div className="r7-actions"><button type="button" disabled={busy} onClick={close}>{editor.saved?'Close':'Cancel changes'}</button>{editor.canReviewLatest&&<button type="button" onClick={editor.reviewLatest}>Review against current work</button>}{!authorized&&!editor.saved&&!busy&&!refreshPending&&!editor.capability.allowed&&<p role="status">Saving is unavailable with your current access.</p>}{!editor.saved&&<button type="submit" form={formId} className={edit.command==='create'?'nw-create-save':undefined} disabled={busy||!authorized}>{edit.command==='create'&&<ListPlus size={16} aria-hidden="true"/>}{busy?'Saving…':editor.request?'Retry saved request':actionLabel}</button>}</div>;
 const form=<form id={formId} className={`r7-form${edit.command==='create'?' r7-form--modal':''}`} aria-label="Nested work changes" onSubmit={e=>{e.preventDefault();void submit();}}>
  {edit.command!=='create'&&<h3>{edit.root?'Task lead and contributors':`${edit.command==='staff'?'Staff':edit.command==='move'?'Move':edit.command==='delete'?'Delete':edit.command==='submit'?'Complete':edit.command==='review'?'History':'Update'} ${node?.title||'subitem'}`}</h3>}
  {['create','edit'].includes(edit.command)&&<WorkDetailsEditor fields={editor.fields} disabled={locked} update={update} presentation={edit.command==='create'?'dialog':'default'}
   minDue={calendarMinDate(edit.command==='edit'?editor.baseline.fields.due:'')}
   maxDue={data.nodes.find(item=>item.id===(edit.command==='create'?edit.parent:editor.baseline.fields.parent))?.due_date||data.root.due||undefined}
   peoplePicker={edit.command==='create'?{people:data.people,lead,selected:people,onLead:value=>update('lead',value),onSelected:value=>update('people',value),appointmentCapability:createCapability,contributorCapability:createCapability,disabled:locked,
    invite:!locked?{project:data.root.project,office:data.root.office,root:data.root.id,node:edit.parent||undefined,canRequest:scopedInvitationRequestAllowed(data,edit.parent||null,context)}:undefined}:undefined}/>}
  {edit.command==='move'&&<WorkMoveDialog data={data} destinations={destinations} allowTask={destinationRoot.allowed} parent={parent} disabled={locked} onChange={value=>update('parent',value)}/>}
  {edit.command==='order'&&<WorkOrderDialog data={data} order={order} disabled={locked} onChange={value=>update('order',value)}/>}
  {edit.command==='delete'&&<WorkDeleteDialog impact={confirmation.impact}/>}
  {edit.command==='progress'&&<p>In progress · Save an update, or mark this step complete.</p>}

  {['edit','progress','submit','review'].includes(edit.command)&&<label>{edit.command==='edit'?'Reason for date change':'Note / feedback'}<textarea value={note} maxLength={4000} disabled={locked} onChange={e=>update('note',e.target.value)}/></label>}
  {error&&<div role="alert" className="nw-operation-error"><AlertCircle size={18} aria-hidden="true"/><div><strong>{editor.saved?'Work saved':'Could not confirm this change'}</strong><p>{error}{editor.unresolvedReceipt?' Your draft is kept. You can retry the same request if its result is still unconfirmed.':outcome.kind==='stale_revision'?' The work changed while you were editing. Your draft is kept.':outcome.kind==='confirmed_failure'?' Nothing was saved. Correct the draft before submitting a new request.':outcome.kind==='revoked_authority'?' Saving is paused while current access is checked. Your draft is kept.':''}</p></div></div>}
  {editor.saved&&<p role="status">Work saved.</p>}
  {editor.recovered&&<p role="status">{editor.staleRecovery?'This draft was saved against an older version. Review it against the current work before saving.':'Draft recovered after current access verification. Review before saving.'}</p>}
  {editor.storageFailed&&<p role="alert">Draft recovery could not be stored in this tab. Keep the editor open to retain your changes.</p>}
  {!['create','edit'].includes(edit.command)&&actions}
  {confirmation.dialog}
 </form>;
 return ['create','edit'].includes(edit.command)?<Modal isOpen title={edit.command==='create'?'Add subtask':'Edit subtask'} description="Break the work into a clear, manageable step." width="max-w-3xl" className="nw-create-modal" bodyClassName="r7-work nw-create-body" footer={<div className="r7-work nw-create-footer">{actions}</div>} preventClose={busy} onClose={close}>{form}</Modal>:form;
}
