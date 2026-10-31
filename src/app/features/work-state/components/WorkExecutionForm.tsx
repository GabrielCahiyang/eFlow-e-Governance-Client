import {useEffect,useState} from 'react';
import {Button} from '@vibe/core';
import {AlertCircle, CheckCircle2, CirclePause, FileUp, MessageSquareText, Paperclip, Send, X} from 'lucide-react';
import {useExplicitDraft} from '../../../shared/useExplicitDraft';
import {attachmentError,EVIDENCE_ACCEPT} from '../../../shared/fileValidation';
import type {WorkUpdate} from '../types';
import {workStateLabel} from '../selectors';
import './workState.css';

export function WorkExecutionForm({status,readOnly=false,disabled=false,canSubmit=true,submitBlockedReason=null,blockedBy,onSave,onSubmit,onCommitted,initialAction,initialBlocker='',completionMode='review',freezeFields=false}:{
 completionMode?:'review'|'direct';freezeFields?:boolean;initialAction?:'stuck'|'submit';status:string;readOnly?:boolean;disabled?:boolean;canSubmit?:boolean;submitBlockedReason?:string|null;blockedBy?:string;initialBlocker?:string;
 onSave:(update:WorkUpdate)=>Promise<void>;onSubmit?:(update:WorkUpdate)=>Promise<void>;onCommitted?:(submitted:boolean)=>void;
}) {
 const [mode,setMode]=useState<'in_progress'|'stuck'|'submit'>(initialAction||(initialBlocker?'stuck':'in_progress'));
 const [blocker,setBlocker]=useState(initialBlocker),[note,setNote]=useState(''),[nextStep,setNextStep]=useState('');
 const [files,setFiles]=useState<File[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const reset=()=>{setNote('');setNextStep('');setFiles([]);setError('');};
 const dirty=freezeFields||!!note||!!nextStep||files.length>0||blocker!==initialBlocker;
 const guard=useExplicitDraft('Work update',dirty,busy,reset);
 useEffect(()=>{if(!dirty&&!busy){setMode(initialAction||(initialBlocker?'stuck':'in_progress'));setBlocker(initialBlocker);}},[initialBlocker]);
 const submit=mode==='submit',direct=completionMode==='direct',fieldsLocked=busy||disabled||freezeFields;
 const displayStatus=direct&&status==='for_review'?'Ready to finish':workStateLabel(status,!!initialBlocker);
 async function save(){
  if(readOnly||disabled||busy||guard.pendingRef.current||blockedBy)return;
  const issue=attachmentError(files,{maxCount:submit?10:1});
  if(issue||note.length>3000||nextStep.length>300||blocker.length>3000){setError(issue||'Keep notes under 3,000 characters and the next step under 300.');return;}
  if(mode==='stuck'&&!blocker.trim()){setError('Tell your lead what is blocking you.');return;}
  if(submit&&!direct&&(!note.trim()||files.length===0)){setError('Add a completion note and at least one evidence file.');return;}
  guard.pendingRef.current=true;setBusy(true);setError('');
  try {
   const input:WorkUpdate={state:mode==='stuck'?'stuck':'in_progress',blocker:mode==='stuck'?blocker.trim():'',note:note.trim(),nextStep:nextStep.trim(),files};
   if(submit){if(!canSubmit||!onSubmit)return;await onSubmit(input);}else await onSave(input);
   reset();setMode(mode==='stuck'?'stuck':'in_progress');if(mode!=='stuck')setBlocker('');guard.markClean();window.dispatchEvent(new CustomEvent('eflow:work-updated'));onCommitted?.(submit);
  }catch(reason){setError(reason instanceof Error?reason.message:'Could not save. Your update is still here.');}
  finally{guard.pendingRef.current=false;setBusy(false);}
 }
 if(['completed','cancelled'].includes(status)||!direct&&status==='for_review')return <div className="work-state-message" role="status"><CheckCircle2 size={20}/><div><strong>{workStateLabel(status)}</strong><p>{status==='for_review'?'Your submission is with the assigned reviewer.':status==='completed'?direct?'This step is complete.':'The reviewer approved this work.':'This work is closed.'}</p></div></div>;
 if(blockedBy)return <div className="work-state-message" role="status"><CirclePause size={20}/><div><strong>Waiting for an earlier step</strong><p>{blockedBy}</p></div></div>;
 if(readOnly)return <p className="work-state-muted">Only the assigned team can update this work.</p>;
 return <section className="work-execution" aria-label="Work status and update">
  <div className="work-execution-heading"><div className="work-execution-intro"><span className="work-execution-icon"><MessageSquareText size={21} aria-hidden="true"/></span><div><h3>Update work</h3><p>{direct?'Update this step or mark it complete. No separate approval is needed.':'Share progress, flag a blocker or submit finished work.'}</p></div></div>
   <label className="work-status-choice">Status<select aria-label="Work status" disabled={fieldsLocked} value={mode} onChange={event=>{setMode(event.target.value as typeof mode);setError('');}}>
    <option value="in_progress">In progress</option><option value="stuck">Stuck</option>{onSubmit&&<option value="submit" disabled={!canSubmit}>{direct?'Mark complete':'Submit finished work'}</option>}
   </select></label></div>
  {onSubmit&&!canSubmit&&submitBlockedReason&&<p className="work-state-muted" role="status" data-testid="mark-complete-blocked">Mark complete is unavailable: {submitBlockedReason}</p>}
   <div className="work-execution-current"><span>Current status</span><strong>{displayStatus}</strong></div>
  {!direct&&status==='changes_requested'&&<p className="work-state-message">Changes requested. Check the feedback, then submit your revised evidence.</p>}
  {mode==='stuck'&&<label>What is blocking you?<textarea aria-label="Blocker reason" maxLength={3000} value={blocker} disabled={fieldsLocked} onChange={event=>setBlocker(event.target.value)} placeholder="Tell your lead what you need to continue."/></label>}
  <label>{submit?direct?'Completion note (optional)':'Completion note':'Update (optional)'}<textarea aria-label={submit?'Completion note':'Work update'} maxLength={3000} rows={5} value={note} disabled={fieldsLocked} onChange={event=>setNote(event.target.value)} placeholder={submit?direct?'Add any useful completion details.':'Describe what you finished and what the reviewer should check.':'What changed since your last update?'}/></label>
  {!submit&&<label>Next step (optional)<input aria-label="Next step" maxLength={300} disabled={fieldsLocked} value={nextStep} onChange={event=>setNextStep(event.target.value)} placeholder="What will you work on next?"/></label>}
  <div className="work-evidence-upload"><label className="work-evidence-picker" data-disabled={fieldsLocked||undefined}><span className="work-evidence-icon"><FileUp size={22} aria-hidden="true"/></span><span><strong>{submit?'Add evidence':'Attach a file'}</strong><small>Images, PDF, Word or Excel · up to 25 MB per file</small></span><input className="work-evidence-input" aria-label={submit?'Evidence files':'Update attachment'} type="file" accept={EVIDENCE_ACCEPT} multiple={submit} disabled={fieldsLocked} onChange={event=>{const chosen=Array.from(event.target.files||[]);const issue=attachmentError(chosen,{maxCount:submit?10:1});if(issue)setError(issue);else setFiles(chosen);event.target.value='';}}/></label></div>
  {files.length>0&&<ul className="work-evidence-files">{files.map((file,index)=><li key={`${file.name}:${index}`}><Paperclip size={15}/><span>{file.name}</span><button type="button" aria-label={`Remove ${file.name}`} disabled={fieldsLocked} onClick={()=>setFiles(current=>current.filter((_,i)=>i!==index))}><X size={16}/></button></li>)}</ul>}
  {error&&<div role="alert" className="work-state-error"><AlertCircle size={18} aria-hidden="true"/><div><strong>{submit?direct?"Could not complete this subtask":"Could not submit this task":"Could not save this update"}</strong><p>{error}</p></div></div>}
  <div className="work-execution-footer"><p>{submit?direct?'This completes the step directly. Final approval stays with the task.':'Your note and evidence will be sent for review.':'Updates are shared with your task team.'}</p><Button size="medium" disabled={busy||disabled||submit&&(!canSubmit||!direct&&(!note.trim()||!files.length))} onClick={()=>void save()}>{busy?'Saving…':submit?<><Send size={16}/>{direct?freezeFields?'Retry completion':'Mark complete':'Submit for review'}</>:status==='todo'?'Start work':mode==='stuck'?'Report blocker':'Save update'}</Button></div>
 </section>;
}

