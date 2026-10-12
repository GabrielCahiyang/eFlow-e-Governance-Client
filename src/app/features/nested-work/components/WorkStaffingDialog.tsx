import {useEffect,useRef,useState} from 'react';
import {useAuth} from '../../../contexts/AuthContext';
import {FeatureDialog} from '../../../components/ui/FeatureDialog';
import {useWorkImpactConfirmation} from '../hooks/useWorkImpactConfirmation';
import {useExplicitDraft} from '../../../shared/useExplicitDraft';
import {WorkPeoplePicker} from './WorkPeoplePicker';
import {captureStaffingBaseline,clearedStaffingAppointments,createStaffingRequest,scopedInvitationRequestAllowed,staffingCapabilities,staffingDraftError,staffingNodePath} from '../selectors/staffing';
import {compatibilityWorkWorkerIds,resolveWorkPersonName} from '../selectors/people';
import type {WorkCapabilityContext,WorkRequest,WorkTreeSnapshot,WorkTreeController} from '../types';
import '../nestedWork.css';
import {captureWorkEditorBaseline} from '../selectors/editorDraft';
import {descendantIds} from '../selectors/tree';
import {useWorkDraftRecovery} from '../hooks/useWorkDraftRecovery';
import {isCurrentWorkSnapshot} from '../selectors/capabilities';

/** Narrow compatibility input for historical standalone callers.
 * The existing owner supplies its own snapshot/save/loading and current identity.
 * This dialog never creates another tree owner or starts a poller.
 */
export interface WorkStaffingController {
 rootId:string;actorId:string|null;data:WorkTreeSnapshot;loading:boolean;verificationFailed?:boolean;
 save:(request:WorkRequest)=>Promise<WorkTreeSnapshot>;
}
export interface WorkStaffingDialogProps {
 controller:WorkTreeController|WorkStaffingController;nodeId:string|null;readOnly?:boolean;executionBlocked?:boolean;contributorsOnly?:boolean;
 preselectedLeadId?:string;onClose:()=>void;onChanged:(receipt:WorkTreeSnapshot)=>void|Promise<void>;
}
export function WorkStaffingDialog(props:WorkStaffingDialogProps) {
 if('authorityFresh' in props.controller)return <ControlledWorkStaffingDialog {...props} controller={props.controller}/>;
 return <WorkStaffingDialogContent key={`${props.controller.actorId}:${props.controller.rootId}:${props.nodeId}`} {...props} controller={props.controller}/>;
}
function ControlledWorkStaffingDialog(props:Omit<WorkStaffingDialogProps,'controller'> & {controller:WorkTreeController}) {
 const {user}=useAuth();
 const source=props.controller;
 const data=source.data;
 if(!data||source.actorId!==(user?.id||null)||!isCurrentWorkSnapshot(data,{actorId:source.actorId,rootId:source.rootId,projectId:data.root.project,officeId:data.root.office,kind:data.root.kind,revision:data.revision}))return <FeatureDialog open title="Task/subitem people" onClose={props.onClose}><p role={source.loading?'status':'alert'}>{source.error||'Verify current work access before choosing people.'}</p></FeatureDialog>;
 const controller:WorkStaffingController={...source,data,verificationFailed:!source.authorityFresh||source.pending};
 return <WorkStaffingDialogContent key={`${controller.actorId}:${controller.rootId}:${props.nodeId}`} {...props} controller={controller}/>;
}
function WorkStaffingDialogContent({controller,nodeId,readOnly=false,executionBlocked=false,contributorsOnly=false,preselectedLeadId,onClose,onChanged}:Omit<WorkStaffingDialogProps,'controller'> & {controller:WorkStaffingController}) {
 const data=controller.data,context:WorkCapabilityContext={actorId:controller.actorId,rootId:controller.rootId,projectId:data.root.project,officeId:data.root.office,kind:data.root.kind,revision:data.revision,readOnly,executionBlocked};
 const [captured]=useState(()=>{
  const staff=captureStaffingBaseline(data,nodeId,context),editor=captureWorkEditorBaseline(data,{command:nodeId?'staff':'root_lead',node:data.nodes.find(node=>node.id===nodeId),root:!nodeId},context.actorId,crypto.randomUUID());
  editor.fields.lead=staff.leadId||'';editor.fields.people=staff.workerIds;return editor;
 });
 const recovery=useWorkDraftRecovery(data,context,captured,contributorsOnly?'staffing_contributors':'staffing'),draftBaseline=recovery.baseline;
 const baseline=useRef({...captureStaffingBaseline(data,nodeId,context),revision:draftBaseline.revision,leadId:draftBaseline.fields.lead||null,workerIds:draftBaseline.fields.people}).current;
 const [lead,setLead]=useState<string|null>(recovery.initial?.fields.lead||preselectedLeadId||baseline.leadId),[workers,setWorkers]=useState(recovery.initial?.fields.people||baseline.workerIds);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState(false);
 const request=useRef<WorkRequest|undefined>(recovery.initial?.request),confirmed=useRef(false),active=useRef(true),closed=useRef(false);
 useEffect(()=>{active.current=true;return()=>{active.current=false;};},[]);
 const caps=staffingCapabilities(data,nodeId,context);
 // A quiet in-flight read does not invalidate an already verified response.
 // Preserve the existing save/read generation race; SQL rechecks the revision.
 const draftError=controller.verificationFailed?'Verify current work access before saving.':contributorsOnly&&lead!==baseline.leadId?'Lead appointments use the separate appointment action.':staffingDraftError(data,context,baseline,lead,workers,!!request.current);
 const dirty=!!request.current||lead!==baseline.leadId||JSON.stringify(workers)!==JSON.stringify(baseline.workerIds);
 const closeOwner=()=>{recovery.clear();if(!closed.current){closed.current=true;onClose();}};
 const guard=useExplicitDraft('Task/subitem people changes',dirty&&!saved,busy,closeOwner,`${controller.actorId}:${controller.rootId}:${nodeId}:${contributorsOnly?'contributors':'staffing'}`);
 const confirmation=useWorkImpactConfirmation(controller.rootId),locked=busy||!!request.current||saved||!!controller.verificationFailed;
 const persist=()=>recovery.persist({baseline:draftBaseline,fields:{...draftBaseline.fields,lead:lead||'',people:workers},request:request.current});
 useEffect(()=>{if(!saved){if(dirty)persist();else recovery.clear();}},[lead,workers,busy,error,saved]);
 const latest=useRef({controller,context,lead,workers,draftError,onChanged});latest.current={controller,context,lead,workers,draftError,onChanged};
 const close=()=>{if(!guard.pendingRef.current)void guard.requestClose(closeOwner);};

 async function submit(){
  if(guard.pendingRef.current||confirmed.current||latest.current.draftError)return;
  guard.pendingRef.current=true;setBusy(true);setError('');
  let receipt:WorkTreeSnapshot|undefined;
  try{
   const current=latest.current;
   const candidate=request.current||createStaffingRequest(baseline,current.lead!,current.workers);
   let impactFingerprint:string|undefined;
   if(!request.current&&current.lead!==baseline.leadId){
    const snapshot=current.controller.data,fingerprint=JSON.stringify(snapshot),cleared=clearedStaffingAppointments(snapshot,nodeId);
    const affected=nodeId?new Set([nodeId,...descendantIds(snapshot.nodes,nodeId)]):new Set(snapshot.nodes.map(node=>node.id));
    const retained=baseline.kind==='personal'&&!nodeId?[]:compatibilityWorkWorkerIds(current.lead,current.workers);
    const accepted=await confirmation.review(candidate,{title:'Transfer Lead appointment?',description:'Review the current appointment and worker impact before saving. The server checks this exact impact again.',actionLabel:'Transfer Lead',isCurrent:()=>active.current&&!latest.current.draftError&&JSON.stringify(latest.current.controller.data)===fingerprint,details:impact=>{
     if(impact.allowed&&impact.affected_appointment_count!==cleared.length)throw new Error('Appointments changed while checking impact. Reload and review current work again.');
     return <div>
     <p>Lead: {baseline.leadId?resolveWorkPersonName(snapshot.people,baseline.leadId):'Unappointed'} → {resolveWorkPersonName(snapshot.people,current.lead!)}</p>
     <p>Retained workers: {baseline.workerIds.map(id=>resolveWorkPersonName(snapshot.people,id)).join(', ')||'None'}</p>
     <p>Added workers: {retained.filter(id=>!baseline.workerIds.includes(id)).map(id=>resolveWorkPersonName(snapshot.people,id)).join(', ')||'None'}</p>
     <p>{impact.affected_appointment_count} descendant Lead appointments will be cleared; workers and historical authorship remain.</p>
     <ul>{cleared.map(node=><li key={node.id}>{staffingNodePath(snapshot,node.id)} · {node.id} · Lead {resolveWorkPersonName(snapshot.people,node.lead_id!)} → {node.status==='completed'?'Current appointment cleared · Completed work remains historical':'Needs reassignment'}</li>)}</ul>
     <p>Pending review routing will be re-evaluated against current eligible appointments. Cleared branches may need reassignment before execution.</p>
     <ul>{snapshot.nodes.filter(node=>affected.has(node.id)&&node.status==='for_review').map(node=><li key={node.id}>{staffingNodePath(snapshot,node.id)} · {node.id} · Current reviewer: {node.current_reviewer?resolveWorkPersonName(snapshot.people,node.current_reviewer):'Unavailable'}</li>)}</ul>
     <p>Recorded submitters, decisions, evidence and financial history are preserved.</p>
    </div>;}});
    if(accepted===null)return;
    impactFingerprint=accepted;
    if(!active.current)return;
    if(latest.current.draftError)throw new Error(latest.current.draftError);
    if(JSON.stringify(latest.current.controller.data)!==fingerprint)throw new Error('Work or permissions changed during confirmation. Review the current impact again.');
   }
   if(!request.current&&current.lead===baseline.leadId&&baseline.workerIds.some(id=>!current.workers.includes(id))){
    const snapshot=JSON.stringify(current.controller.data);
    const accepted=await confirmation.review(candidate,{title:'Review contributor removal?',actionLabel:'Remove contributors',description:'Review the affected staffing before saving. Current work facts and membership remain preserved.',isCurrent:()=>active.current&&!latest.current.draftError&&JSON.stringify(latest.current.controller.data)===snapshot,details:<p>Removed contributors: {baseline.workerIds.filter(id=>!current.workers.includes(id)).map(id=>resolveWorkPersonName(current.controller.data.people,id)).join(', ')}</p>});
    if(accepted===null)return;
    impactFingerprint=accepted;
    if(JSON.stringify(latest.current.controller.data)!==snapshot)throw new Error('Work or permissions changed during confirmation. Review the current impact again.');
   }
   if(!active.current)return;
   if(latest.current.draftError)throw new Error(latest.current.draftError);
   if(!request.current){
    if(JSON.stringify(candidate.payload)!==JSON.stringify(createStaffingRequest(baseline,latest.current.lead!,latest.current.workers).payload))throw new Error('Draft terms changed during confirmation. Review the current impact again.');
    for(const value of Object.values(candidate.payload))if(Array.isArray(value))Object.freeze(value);
    request.current=Object.freeze({...candidate,payload:Object.freeze(candidate.payload),...(impactFingerprint!==undefined?{impactFingerprint}:{})});
   }
   persist();
   receipt=await latest.current.controller.save(request.current);
   if(!active.current)return;
   confirmed.current=true;recovery.clear();setSaved(true);guard.markClean();
  }catch(reason){if(active.current)setError(reason instanceof Error?reason.message:'Could not save people.');}
  finally{guard.pendingRef.current=false;if(active.current)setBusy(false);}
  if(receipt&&active.current){
   try{await latest.current.onChanged(receipt);}catch{if(active.current)setError('People were saved, but the view could not refresh. Close and reload; do not submit again.');}
  }
 }
 const title=nodeId?'Subitem Lead and contributors':'Task lead and contributors';
 return <FeatureDialog title={title} onClose={close} preventClose={busy} contentClassName="max-w-lg">
  <form className="r7-work r7-form m-0 overflow-y-auto border-0" aria-label="Task/subitem people changes" onSubmit={event=>{event.preventDefault();void submit();}}>
   <h3>{title}</h3>
   <WorkPeoplePicker people={data.people} lead={lead||''} selected={workers} onLead={setLead} onSelected={setWorkers}
    appointmentCapability={contributorsOnly?{allowed:false,reason_code:'read_only',disabledReason:'Lead appointments use the separate appointment action.'}:caps.appointment} contributorCapability={caps.contributors} disabled={locked}
    invite={!readOnly&&!locked?{project:data.root.project,office:data.root.office,root:controller.rootId,node:nodeId||undefined,canRequest:scopedInvitationRequestAllowed(data,nodeId,context)}:undefined}/>
   {draftError&&<p role="alert">{draftError}</p>}
   {error&&<p role="alert">{error}{request.current&&!saved?' The original request is retained for safe retry.':''}</p>}
   {saved&&<p role="status">People saved.</p>}
   {recovery.recovered&&<p role="status">{recovery.stale?'Recovered people draft is stale. Review the current appointments before saving.':'People draft recovered after current access verification.'}</p>}
   {recovery.storageFailed&&<p role="alert">Draft recovery could not be stored in this tab. Keep the editor open to retain your changes.</p>}
   <div className="r7-actions"><button type="button" disabled={busy} onClick={close}>{saved?'Close':'Cancel changes'}</button>
    {!saved&&<button type="submit" disabled={busy||!!draftError}>{busy?'Saving…':request.current?'Retry saved request':'Save work changes'}</button>}
   </div>
   {confirmation.dialog}
  </form>
 </FeatureDialog>;
}
