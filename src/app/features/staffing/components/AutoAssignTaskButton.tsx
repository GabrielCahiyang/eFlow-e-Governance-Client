import {useRef,useState} from 'react';
import {Sparkles} from 'lucide-react';
import type {WorkTreeSnapshot} from '../../nested-work';
import {prepareAutoAssignment,applyAutoAssignment,type AutoAssignmentRequest} from '../services/autoAssignment';

export function AutoAssignTaskButton({snapshot,disabled,onBusyChange,onAssigned}:{snapshot:WorkTreeSnapshot;disabled:boolean;onBusyChange:(busy:boolean)=>void;onAssigned:(receipt:WorkTreeSnapshot)=>Promise<void>}) {
  const pending=useRef(false),request=useRef<AutoAssignmentRequest|undefined>(undefined);
  const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState(''),[saved,setSaved]=useState(false);
  async function assign(){
    if(pending.current||disabled||saved)return;
    pending.current=true;setBusy(true);onBusyChange(true);setError('');setMessage('Finding the right people…');
    try{
      if(!request.current)request.current=await prepareAutoAssignment(snapshot,()=>setMessage('AI is choosing your task team…'));
      setMessage('Adding people and saving assignments…');
      const receipt=await applyAutoAssignment(request.current);
      setSaved(true);setMessage('Team assigned and added to the project.');
      try{await onAssigned(receipt);}catch{setError('The team was saved. Reopen the task to see its current people.');}
    }catch(reason){
      const failure=reason as Error & {code?:string};
      if(['40001','42501','22023','23505','23514'].includes(failure.code||''))request.current=undefined;
      setMessage('');setError(failure.message||'Could not assign this task. Try again.');
    }finally{pending.current=false;setBusy(false);onBusyChange(false);}
  }
  return <section className="r7-auto-assignment" aria-label="AI task assignment">
    <div><strong>Let AI choose the team</strong><p>Find people across your office, add them to this project, and assign this task.</p></div>
    <button type="button" disabled={disabled||busy||saved} onClick={()=>void assign()}><Sparkles size={16} aria-hidden="true"/>{busy?'Assigning…':saved?'Team assigned':request.current?'Retry assignment':'AI auto assign'}</button>
    <small>Qwen3.5 4B · Existing assignments stay unchanged.</small>
    {message&&<p role="status">{message}</p>}{error&&<p role="alert">{error}</p>}
  </section>;
}
