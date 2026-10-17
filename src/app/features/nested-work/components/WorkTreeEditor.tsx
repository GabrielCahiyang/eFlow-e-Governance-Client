import {requestNavigation} from '../../../shared/navigationGuard';
import {calendarMinDate} from '../../../shared/calendarDates';
import {useId} from 'react';
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
interface WorkTreeEditorProps {data:WorkTreeSnapshot;edit:WorkEdit;save:(request:WorkRequest)=>Promise<WorkTreeSnapshot>;onDone:()=>void|Promise<void>;onCancel:()=>void;readOnly?:boolean;refreshPending?:boolean}
export function WorkTreeEditor(props:WorkTreeEditorProps){
 const {user}=useAuth();
 if(props.edit.command==='staff')return <WorkStaffingDialog controller={{rootId:props.data.root.id,actorId:user?.id||null,data:props.data,loading:!!props.refreshPending,verificationFailed:!!props.refreshPending,save:props.save}}
  nodeId={props.edit.root?null:props.edit.node?.id||''} readOnly={props.readOnly} onChanged={props.onDone} onClose={props.onCancel}/>;
 return <WorkTreeForm {...props}/>;
}
function WorkTreeForm({data,edit,save,onDone,onCancel,readOnly=false,refreshPending=false}:WorkTreeEditorProps){
 const progressHelpId=useId();
 const {user}=useAuth();
 const context={actorId:user?.id||null,rootId:data.root.id,projectId:data.root.project,officeId:data.root.office,kind:data.root.kind,revision:data.revision,readOnly};
 const editor=useWorkEditorDraft({data,edit,context,refreshPending,onCancel});
 const {fields:{lead,people,parent,standalone,note,progress,order},update,locked,busy,authorized,outcome}=editor;
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
  return confirmation.review(request,{title:edit.command==='delete'?'Delete untouched subtree?':edit.command==='move'?'Review subitem move?':edit.command==='order'?'Review subitem sequence?':modeChanged?'Review execution mode change?':'Review due-date impact?',dateChange:dateChanged,alwaysConfirm:modeChanged,
   actionLabel:edit.command==='delete'?'Delete subtree':'Confirm changes',danger:edit.command==='delete',isCurrent:editor.confirmationCurrent,description:'Review the current affected work. The server checks this exact impact again before saving.',
   details:modeChanged?<p>Execution mode: {editor.baseline.fields.standalone?'Can start independently':'In sequence'} → {standalone?'Can start independently':'In sequence'}. Changing the sequence can affect when related work may start.</p>:edit.command==='order'?<p>New sequence: {order.map(id=>data.nodes.find(item=>item.id===id)?.title||'Unavailable subitem').join(' → ')}</p>:undefined});
 };
 const needsPreview=['move','order','delete'].includes(edit.command)||edit.command==='edit'&&(standalone!==editor.baseline.fields.standalone||editor.fields.due!==editor.baseline.fields.due);
 const submit=()=>editor.submit({save,onDone,prepare:needsPreview?prepare:undefined});
 const error='message' in outcome?outcome.message:null;
 return <form className="r7-form" aria-label="Nested work changes" onSubmit={e=>{e.preventDefault();void submit();}}>
  <h3>{edit.root?'Task lead and contributors':`${edit.command==='create'?'Add child':edit.command==='staff'?'Staff':edit.command==='move'?'Move':edit.command==='delete'?'Delete':edit.command==='review'?'Review':'Update'} ${node?.title||'subitem'}`}</h3>
  {['create','edit'].includes(edit.command)&&<WorkDetailsEditor fields={editor.fields} disabled={locked} update={update}
   minDue={calendarMinDate(edit.command==='edit'?editor.baseline.fields.due:'')}
   maxDue={data.nodes.find(item=>item.id===(edit.command==='create'?edit.parent:editor.baseline.fields.parent))?.due_date||data.root.due||undefined}
   peoplePicker={edit.command==='create'?{people:data.people,lead,selected:people,onLead:value=>update('lead',value),onSelected:value=>update('people',value),appointmentCapability:createCapability,contributorCapability:createCapability,disabled:locked,
    invite:!locked?{project:data.root.project,office:data.root.office,root:data.root.id,node:edit.parent||undefined,canRequest:scopedInvitationRequestAllowed(data,edit.parent||null,context)}:undefined}:undefined}/>}
  {edit.command==='move'&&<WorkMoveDialog data={data} destinations={destinations} allowTask={destinationRoot.allowed} parent={parent} disabled={locked} onChange={value=>update('parent',value)}/>}
  {edit.command==='order'&&<WorkOrderDialog data={data} order={order} disabled={locked} onChange={value=>update('order',value)}/>}
  {edit.command==='delete'&&<WorkDeleteDialog impact={confirmation.impact}/>}
  {edit.command==='progress'&&<div><label>Progress<input type="number" min={0} max={99} aria-describedby={progressHelpId} value={progress} disabled={locked} onChange={e=>update('progress',Number(e.target.value))}/></label><small id={progressHelpId}>Progress stays below 100% until your reviewer approves the work.</small></div>}
  {edit.command==='review'&&<label>Decision<select value={progress===100?'approve':'reject'} disabled={locked} onChange={e=>update('progress',e.target.value==='approve'?100:99)}><option value="approve">Approve personal work</option><option value="reject">Return for changes</option></select></label>}
  {['edit','progress','submit','review'].includes(edit.command)&&<label>{edit.command==='edit'?'Reason for date change':'Note / feedback'}<textarea value={note} maxLength={4000} disabled={locked} onChange={e=>update('note',e.target.value)}/></label>}
  {error&&<p role="alert">{error}{editor.unresolvedReceipt?' The original result is unverified and its request is retained. Reload current work before retrying this saved request.':outcome.kind==='stale_revision'?' The draft is retained. Reload and review the current work before reopening this editor.':outcome.kind==='confirmed_failure'?' Nothing was saved. Correct the draft before submitting a new request.':outcome.kind==='revoked_authority'?' Saving is blocked. Verify current authority before reopening this editor.':''}</p>}
  {editor.saved&&<p role="status">Work saved.</p>}
  {editor.recovered&&<p role="status">{editor.staleRecovery?'Recovered draft is stale. Review current work; discard this draft to start again.':'Draft recovered after current access verification. Review before saving.'}</p>}
  {editor.storageFailed&&<p role="alert">Draft recovery could not be stored in this tab. Keep the editor open to retain your changes.</p>}
  <div className="r7-actions"><button type="button" disabled={busy} onClick={close}>{editor.saved?'Close':'Cancel changes'}</button>{!authorized&&!editor.saved&&<p role="alert">Your current branch authority changed. Reload the tree before saving.</p>}{!editor.saved&&<button type="submit" disabled={busy||!authorized}>{busy?'Saving…':editor.request?'Retry saved request':edit.command==='delete'?'Review deletion':'Save work changes'}</button>}</div>
  {confirmation.dialog}
 </form>;
}
