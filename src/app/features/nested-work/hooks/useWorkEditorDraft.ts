import {useEffect,useRef,useState} from 'react';
import {useExplicitDraft} from '../../../shared/useExplicitDraft';
import {duplicateWorkNameError} from '../../../shared/workNames';
import {captureWorkEditorBaseline,freezeWorkEditorRequest,sameWorkEditorScope,workEditorCapability,workEditorDirty,workEditorPayload,workEditorReceiptRetryAllowed,workEditorDateError} from '../selectors/editorDraft';
import {workRequestFailure} from '../services/workRequestOutcome';
import type {WorkCapabilityContext,WorkRequest,WorkTreeSnapshot} from '../types';
import type {WorkEdit,WorkEditorFields,WorkEditorOutcome,WorkEditorSaveOptions} from '../types/editor';
import {WorkRequestFailure} from '../types/editor';
import {useWorkDraftRecovery} from './useWorkDraftRecovery';

export function useWorkEditorDraft({data,edit,context,refreshPending,onCancel}:{data:WorkTreeSnapshot;edit:WorkEdit;context:WorkCapabilityContext;refreshPending:boolean;onCancel:()=>void}) {
 const [captured]=useState(()=>captureWorkEditorBaseline(data,edit,context.actorId,crypto.randomUUID()));
 const recovery=useWorkDraftRecovery(data,context,captured,captured.command,edit.recoveryRevision),baseline=recovery.baseline;
 const [fields,setFields]=useState<WorkEditorFields>(()=>recovery.initial?.fields||({...baseline.fields,people:[...baseline.fields.people],order:[...baseline.fields.order]}));
 const [outcome,setOutcome]=useState<WorkEditorOutcome>(()=>recovery.initial?.request?{kind:recovery.initial.requestState||'unknown_result',message:recovery.initial.uncertain?'The saved request result is unverified. Verify current work before retrying.':'The saved request was blocked. Discard the draft and review current work before a new attempt.'}:{kind:'idle'});
 const request=useRef<WorkRequest|undefined>(recovery.initial?.request),committed=useRef(false),unresolved=useRef(!!recovery.initial?.request&&recovery.initial.uncertain!==false),active=useRef(true);
 const rejectedSnapshot=useRef<WorkTreeSnapshot|undefined>(undefined);
 useEffect(()=>{active.current=true;return()=>{active.current=false;};},[]);
 const sameItem=baseline.command===edit.command&&baseline.nodeId===(edit.node?.id||edit.itemId||null)&&(!['create','order'].includes(edit.command)||baseline.fields.parent===(edit.parent||''));
 const capability=workEditorCapability(data,baseline,context),scopeMatches=sameItem&&sameWorkEditorScope(baseline,context);
 const busy=outcome.kind==='saving',saved=outcome.kind==='committed'||outcome.kind==='committed_refresh_failed';
 // An uncertain command is itself a recoverable draft, even when its visible
 // fields were untouched (for example accepting the default review decision).
 const dirty=!saved&&(workEditorDirty(baseline,fields)||unresolved.current);
 const closed=useRef(false);
 const discard=()=>{recovery.clear();if(!closed.current){closed.current=true;onCancel();}};
 const guard=useExplicitDraft('Nested work changes',dirty,busy,discard,`${context.actorId}:${context.rootId}:${edit.node?.id||edit.itemId||edit.parent}:${edit.command}`);
 useEffect(()=>{if(scopeMatches&&!saved){if(dirty||busy&&request.current)recovery.persist({baseline,fields,request:request.current,requestState:outcome.kind==='stale_revision'||outcome.kind==='revoked_authority'?outcome.kind:'unknown_result',uncertain:busy||unresolved.current});else recovery.clear();}},[fields,dirty,outcome,scopeMatches,saved]);
 const uncertain=unresolved.current;
 // After a blocked uncertain lookup, only a newly verified read can permit
 // another exact receipt lookup. A known first-send failure stays blocked.
 const blocked=(outcome.kind==='stale_revision'||outcome.kind==='revoked_authority')&&(!uncertain||rejectedSnapshot.current===data);
 const authorized=scopeMatches&&!refreshPending&&!blocked&&!saved&&(!recovery.stale||uncertain)&&(uncertain?workEditorReceiptRetryAllowed(data,context):capability.allowed);
 const locked=busy||!!request.current||saved||!scopeMatches||!capability.allowed||refreshPending;
 const latest=useRef({fields,authorized,data,context,scopeMatches});latest.current={fields,authorized,data,context,scopeMatches};
 const update=<K extends keyof WorkEditorFields>(key:K,value:WorkEditorFields[K])=>{if(!locked&&!guard.pendingRef.current)setFields(current=>({...current,[key]:value}));};

 async function submit(options:WorkEditorSaveOptions){
  if(guard.pendingRef.current||committed.current||!latest.current.authorized)return;
  guard.pendingRef.current=true;setOutcome({kind:'saving'});
  let receipt:WorkTreeSnapshot|undefined;
  try{
   if(!request.current&&options.confirm&&!await options.confirm()){if(active.current)setOutcome({kind:'idle'});return;}
   if(!active.current)return;
   if(!latest.current.authorized){setOutcome({kind:'revoked_authority',message:'Your current branch authority changed. Reload the tree before saving.'});return;}
   if(!request.current){
    if(['create','edit','move'].includes(baseline.command)){
     const fields=latest.current.fields,parent=baseline.command==='edit'?baseline.fields.parent:fields.parent;
     const title=baseline.command==='move'?latest.current.data.nodes.find(node=>node.id===baseline.nodeId)?.title||'':fields.title;
     // Keep existing required-title handling in the form/server; this guard only adds sibling uniqueness.
     const issue=title.trim()?duplicateWorkNameError(title,latest.current.data.nodes.filter(node=>(node.parent_subtask_id||'')===(parent||'')),'Subitem',baseline.nodeId||undefined):'';if(issue)throw new Error(issue);
    }
    const dateIssue=workEditorDateError(latest.current.data,baseline,latest.current.fields);
    if(dateIssue)throw new Error(dateIssue);
    const candidate=freezeWorkEditorRequest(baseline,latest.current.fields,crypto.randomUUID());
    const snapshot=JSON.stringify(latest.current.data);
    const fingerprint=options.prepare?await options.prepare(candidate):options.impactFingerprint;
    if(fingerprint===null){if(active.current)setOutcome({kind:'idle'});return;}
    if(!active.current||!latest.current.scopeMatches)return;
    if(!latest.current.authorized)throw new Error('Current authority changed during confirmation. Review current work again.');
    if(JSON.stringify(latest.current.data)!==snapshot||JSON.stringify(workEditorPayload(baseline,latest.current.fields))!==JSON.stringify(candidate.payload))throw new Error('Work or draft terms changed during confirmation. Review the current impact again.');
    request.current=freezeWorkEditorRequest(baseline,latest.current.fields,candidate.id,fingerprint);
   }
   // Persist before dispatch: a real reload while awaiting an RPC is uncertain.
   recovery.persist({baseline,fields:latest.current.fields,request:request.current});
   receipt=await options.save(request.current);
   if(!active.current||!latest.current.scopeMatches)return;
   // Commit is recorded before notifying the owner. Callback/refresh failure
   // never becomes a command failure and cannot re-enable mutation submission.
   committed.current=true;unresolved.current=false;recovery.clear();setOutcome({kind:'committed',receipt});guard.markClean();
  }catch(reason){
   if(active.current&&latest.current.scopeMatches){
    // Preparation/confirmation failed before any send. An RPC rejection on an
    // uncertain retry cannot prove the original attempt never committed.
    const failure=request.current?workRequestFailure(reason):new WorkRequestFailure('confirmed_failure',reason instanceof Error?reason.message:'Could not prepare the work request.');
    if(failure.kind==='unknown_result')unresolved.current=true;
    const kind=unresolved.current&&failure.kind==='confirmed_failure'?'unknown_result':failure.kind;
    if(kind==='stale_revision'||kind==='revoked_authority')rejectedSnapshot.current=latest.current.data;
    setOutcome({kind,message:failure.message});
    if(kind==='confirmed_failure')request.current=undefined;
   }
  }finally{guard.pendingRef.current=false;if(active.current)setOutcome(current=>current.kind==='saving'?{kind:'idle'}:current);}
  if(receipt&&active.current&&latest.current.scopeMatches){
   try{await options.onDone(receipt);}catch{if(active.current&&latest.current.scopeMatches)setOutcome({kind:'committed_refresh_failed',receipt,message:'Work was saved, but the view could not refresh. Close and reload; do not submit again.'});}
  }
 }
 return {baseline,fields,update,outcome,request:request.current,unresolvedReceipt:unresolved.current,dirty,busy,saved,locked,authorized,capability,submit,confirmationCurrent:()=>active.current&&latest.current.scopeMatches&&latest.current.authorized,recovered:recovery.recovered,staleRecovery:recovery.stale,storageFailed:recovery.storageFailed,discard};
}
