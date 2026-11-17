import { readableUiError } from '../../../shared/userFacingError';
import {useEffect,useRef,useState} from 'react';
import {projectFlowCall,ProjectFlowError} from '../services/projectFlow';
import {FlowError} from './FlowError';
import type {ProjectFlow} from '../types';
type Line=ProjectFlow['taskFunding'][number];
export function CancelTaskFunding({line,onChanged,onBusyChange,disabled=false}:{line:Line;onChanged:()=>Promise<void>;onBusyChange:(id:string,busy:boolean)=>void;disabled?:boolean}){
 const [open,setOpen]=useState(false),[reason,setReason]=useState(''),[busy,setBusy]=useState(false),[uncertain,setUncertain]=useState(false),[error,setError]=useState('');
 const attempt=useRef<Record<string,unknown>|null>(null),pending=useRef(false);
 const canReturn = line.available > 0;
 const returnAmount = uncertain && attempt.current ? Number(attempt.current.p_amount) : line.available;
 useEffect(()=>{onBusyChange(line.id,busy||uncertain);return()=>onBusyChange(line.id,false);},[busy,uncertain,onBusyChange,line.id]);
 async function cancel(){
  if(pending.current||disabled)return;pending.current=true;setBusy(true);setError('');
  try{
   if(!attempt.current){if(!reason.trim())throw new Error('Add a reason for cancelling.');if(line.available<=0)throw new Error('No unused funding can be returned.');attempt.current={p_line:line.id,p_amount:line.available,p_reason:reason.trim(),p_key:crypto.randomUUID()};}
   try{await projectFlowCall('release_project_task_funding',attempt.current);}catch(problem){if(problem instanceof ProjectFlowError&&!uncertain)attempt.current=null;else setUncertain(true);throw problem;}
   attempt.current=null;setUncertain(false);setOpen(false);setReason('');await onChanged();window.dispatchEvent(new Event('eflow:project-setup'));
  }catch(problem){setError(readableUiError(problem, "Could not cancel the allocation. Try again.", 'write'));}finally{pending.current=false;setBusy(false);}
 }
 if (!open) return <button type="button" disabled={disabled || !canReturn} onClick={() => setOpen(true)}>
  {line.available === line.amount ? 'Cancel allocation' : 'Return unused funding'}
 </button>;
 return <section className="pf-warning">
  {canReturn || uncertain
   ? <p>Return ₱{returnAmount.toLocaleString('en-PH')} from {line.source} to the project budget.</p>
   : <p role="status">This account’s remaining funding is now locked.</p>}
  <label>Reason for cancelling
   <textarea maxLength={3000} value={reason} disabled={disabled || busy || uncertain || !canReturn} onChange={e => setReason(e.target.value)} />
  </label>
  <div className="pf-actions">
   <button type="button" disabled={disabled || busy || uncertain} onClick={() => { setOpen(false); setReason(''); setError(''); }}>Keep allocation</button>
   <button type="button" className="pf-primary" disabled={disabled || busy || (!uncertain && (!canReturn || !reason.trim()))} onClick={() => void cancel()}>
    {busy ? 'Cancelling…' : uncertain ? 'Retry cancellation' : 'Confirm cancellation'}
   </button>
  </div>
  <FlowError error={error} />
 </section>;
}
