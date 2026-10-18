import {useEffect,useState} from 'react';
import {Button} from '@vibe/core';
import {CheckCircle2, CirclePause, Paperclip, Send, X} from 'lucide-react';
import {useExplicitDraft} from '../../../shared/useExplicitDraft';
import {attachmentError,EVIDENCE_ACCEPT} from '../../../shared/fileValidation';
import type {WorkUpdate} from '../types';
import {workStateLabel} from '../selectors';
import './workState.css';

export function WorkExecutionForm({status,readOnly=false,disabled=false,canSubmit=true,blockedBy,onSave,onSubmit,onCommitted,initialAction,initialBlocker=''}:{
 initialAction?:'stuck'|'submit';status:string;readOnly?:boolean;disabled?:boolean;canSubmit?:boolean;blockedBy?:string;initialBlocker?:string;
 onSave:(update:WorkUpdate)=>Promise<void>;onSubmit?:(update:WorkUpdate)=>Promise<void>;onCommitted?:(submitted:boolean)=>void;
}) {
 const [mode,setMode]=useState<'in_progress'|'stuck'|'submit'>(initialAction||(initialBlocker?'stuck':'in_progress'));
 const [blocker,setBlocker]=useState(initialBlocker),[note,setNote]=useState(''),[nextStep,setNextStep]=useState('');
 const [files,setFiles]=useState<File[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const reset=()=>{setNote('');setNextStep('');setFiles([]);setError('');};
 const dirty=!!note||!!nextStep||files.length>0||blocker!==initialBlocker;
 const guard=useExplicitDraft('Work update',dirty,busy,reset);
 useEffect(()=>{if(!dirty&&!busy){setMode(initialAction||(initialBlocker?'stuck':'in_progress'));setBlocker(initialBlocker);}},[initialBlocker]);
 const submit=mode==='submit';
 async function save(){
  if(readOnly||disabled||busy||guard.pendingRef.current||blockedBy)return;
  const issue=attachmentError(files,{maxCount:submit?10:1});
  if(issue||note.length>3000||nextStep.length>300||blocker.length>3000){setError(issue||'Keep notes under 3,000 characters and the next step under 300.');return;}
  if(mode==='stuck'&&!blocker.trim()){setError('Tell your lead what is blocking you.');return;}
  if(submit&&(!note.trim()||files.length===0)){setError('Add a completion note and at least one evidence file.');return;}
  guard.pendingRef.current=true;setBusy(true);setError('');
  try {
   const input:WorkUpdate={state:mode==='stuck'?'stuck':'in_progress',blocker:mode==='stuck'?blocker.trim():'',note:note.trim(),nextStep:nextStep.trim(),files};
   if(submit){if(!canSubmit||!onSubmit)return;await onSubmit(input);}else await onSave(input);
   reset();setMode(mode==='stuck'?'stuck':'in_progress');if(mode!=='stuck')setBlocker('');guard.markClean();window.dispatchEvent(new CustomEvent('eflow:work-updated'));onCommitted?.(submit);
  }catch(reason){setError(reason instanceof Error?reason.message:'Could not save. Your update is still here.');}
  finally{guard.pendingRef.current=false;setBusy(false);}
 }
 if(['for_review','completed','cancelled'].includes(status))return <div className="work-state-message" role="status"><CheckCircle2 size={20}/><div><strong>{workStateLabel(status)}</strong><p>{status==='for_review'?'Your submission is with the assigned reviewer.':status==='completed'?'The reviewer approved this work.':'This work is closed.'}</p></div></div>;
 if(blockedBy)return <div className="work-state-message" role="status"><CirclePause size={20}/><div><strong>Waiting for an earlier step</strong><p>{blockedBy}</p></div></div>;
 if(readOnly)return <p className="work-state-muted">Only the assigned team can update this work.</p>;
 return <section className="work-execution" aria-label="Work status and update">
  <div className="work-execution-heading"><div><h3>Update work</h3><span className="work-state-muted">{workStateLabel(status,!!initialBlocker)}</span></div>
   <label className="work-status-choice">Status<select aria-label="Work status" disabled={busy||disabled} value={mode} onChange={event=>{setMode(event.target.value as typeof mode);setError('');}}>
    <option value="in_progress">In progress</option><option value="stuck">Stuck</option>{onSubmit&&<option value="submit" disabled={!canSubmit}>Submit finished work</option>}
   </select></label></div>
  {status==='changes_requested'&&<p className="work-state-message">Changes requested. Check the feedback, then submit your revised evidence.</p>}
  {mode==='stuck'&&<label>What is blocking you?<textarea aria-label="Blocker reason" maxLength={3000} value={blocker} disabled={busy||disabled} onChange={event=>setBlocker(event.target.value)} placeholder="Tell your lead what you need to continue."/></label>}
  <label>{submit?'Completion note':'Update (optional)'}<textarea aria-label={submit?'Completion note':'Work update'} maxLength={3000} rows={3} value={note} disabled={busy||disabled} onChange={event=>setNote(event.target.value)} placeholder={submit?'What did you finish?':'What changed since your last update?'}/></label>
  {!submit&&<details><summary>Next step and attachment</summary><label>Next step<input aria-label="Next step" maxLength={300} disabled={busy||disabled} value={nextStep} onChange={event=>setNextStep(event.target.value)}/></label></details>}
  {<div className="work-evidence-upload"><label><Paperclip size={16}/>{submit?'Add evidence':'Attach a file'}<input aria-label={submit?'Evidence files':'Update attachment'} type="file" accept={EVIDENCE_ACCEPT} multiple={submit} disabled={busy||disabled} onChange={event=>{const chosen=Array.from(event.target.files||[]);const issue=attachmentError(chosen,{maxCount:submit?10:1});if(issue)setError(issue);else setFiles(chosen);event.target.value='';}}/></label><small>Images, PDF, Word or Excel · up to 25 MB per file</small></div>}
  {files.length>0&&<ul className="work-evidence-files">{files.map((file,index)=><li key={`${file.name}:${index}`}><Paperclip size={15}/><span>{file.name}</span><button type="button" aria-label={`Remove ${file.name}`} disabled={busy||disabled} onClick={()=>setFiles(current=>current.filter((_,i)=>i!==index))}><X size={16}/></button></li>)}</ul>}
  {error&&<p role="alert" className="work-state-error">{error}</p>}
  <div className="work-execution-footer"><Button size="medium" disabled={busy||disabled||submit&&(!canSubmit||!note.trim()||!files.length)} onClick={()=>void save()}>{busy?'Saving…':submit?<><Send size={16}/> Submit for review</>:status==='todo'?'Start work':mode==='stuck'?'Report blocker':'Save update'}</Button></div>
 </section>;
}

