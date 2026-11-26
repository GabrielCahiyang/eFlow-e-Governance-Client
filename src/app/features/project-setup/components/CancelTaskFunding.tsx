import { readableUiError } from '../../../shared/userFacingError';
import {useEffect,useId,useRef,useState} from 'react';
import { ActionBlockerGroup } from '../../../components/ui/action-blockers';
import { BoundedTextarea } from '../../../components/ui/BoundedInput';
import { WorkspaceTooltip } from '../../../components/ui/workspace/WorkspaceTooltip';
import { INPUT_LIMITS, textLengthError } from '../../../shared/inputLimits';
import {projectFlowCall,ProjectFlowError} from '../services/projectFlow';
import {FlowError} from './FlowError';
import type {ProjectFlow} from '../types';
type Line=ProjectFlow['taskFunding'][number];
const MIN_CANCEL_REASON = 5;
export function CancelTaskFunding({line,onChanged,onBusyChange,disabled=false}:{line:Line;onChanged:()=>Promise<void>;onBusyChange:(id:string,busy:boolean)=>void;disabled?:boolean}){
 const reasonId = useId();
 const [open,setOpen]=useState(false),[reason,setReason]=useState(''),[reasonTouched,setReasonTouched]=useState(false),[busy,setBusy]=useState(false),[uncertain,setUncertain]=useState(false),[error,setError]=useState('');
 const attempt=useRef<Record<string,unknown>|null>(null),pending=useRef(false);
 const canReturn = line.available > 0;
 const returnAmount = uncertain && attempt.current ? Number(attempt.current.p_amount) : line.available;
 const reasonError = textLengthError(reason, 'Reason for cancelling', { required: true, min: MIN_CANCEL_REASON, max: INPUT_LIMITS.FUNDING_REASON }) || '';
 const visibleReasonError = reasonTouched || reason.length > 0 ? reasonError : '';
 const confirmDisabled = disabled || busy || (!uncertain && (!canReturn || Boolean(reasonError)));
 const initialDisabled = disabled || !canReturn;
 const initialBlockedList = !initialDisabled
  ? []
  : !canReturn
   ? ['No unused funding remains to return — all funds on this account are locked or spent.']
   : [];
 const confirmBlockers = busy || !confirmDisabled
  ? []
  : disabled
   ? []
   : !canReturn && !uncertain
    ? ['This account’s remaining funding is locked and cannot be returned.']
    : reasonError
     ? [reasonError]
     : [];
 const confirmEnabledTip = busy || confirmDisabled
  ? ''
  : uncertain
   ? 'Re-check and finish returning this unused funding to the project budget.'
   : `Returns ₱${returnAmount.toLocaleString('en-PH')} from this task back to the project budget. This cannot be undone.`;
 useEffect(()=>{onBusyChange(line.id,busy||uncertain);return()=>onBusyChange(line.id,false);},[busy,uncertain,onBusyChange,line.id]);
 async function cancel(){
  setReasonTouched(true);
  if(pending.current||disabled)return;pending.current=true;setBusy(true);setError('');
  try{
   if(!attempt.current){if(reasonError)throw new Error(reasonError);if(line.available<=0)throw new Error('No unused funding can be returned.');attempt.current={p_line:line.id,p_amount:line.available,p_reason:reason.trim(),p_key:crypto.randomUUID()};}
   try{await projectFlowCall('release_project_task_funding',attempt.current);}catch(problem){if(problem instanceof ProjectFlowError&&!uncertain)attempt.current=null;else setUncertain(true);throw problem;}
   attempt.current=null;setUncertain(false);setOpen(false);setReason('');setReasonTouched(false);await onChanged();window.dispatchEvent(new Event('eflow:project-setup'));
  }catch(problem){setError(readableUiError(problem, "Could not cancel the allocation. Try again.", 'write'));}finally{pending.current=false;setBusy(false);}
 }
 if (!open) return <ActionBlockerGroup
  actionLabel={line.available === line.amount ? 'Cancel allocation' : 'Return unused funding'}
  blockers={initialBlockedList}
  busy={disabled}
  size="sm"
 >
  <button type="button" disabled={initialDisabled} onClick={() => setOpen(true)}>
   {line.available === line.amount ? 'Cancel allocation' : 'Return unused funding'}
  </button>
 </ActionBlockerGroup>;
 return <section className="pf-warning">
  {canReturn || uncertain
   ? <p>Return ₱{returnAmount.toLocaleString('en-PH')} from {line.source} to the project budget.</p>
   : <p role="status">This account’s remaining funding is now locked.</p>}
  <div className="pf-field">
   <label htmlFor={reasonId}>Reason for cancelling <span className="text-[var(--eflow-negative-text)]" aria-hidden="true">*</span></label>
   <BoundedTextarea
    id={reasonId}
    maxLength={INPUT_LIMITS.FUNDING_REASON}
    rows={3}
    value={reason}
    aria-required="true"
    disabled={disabled || busy || uncertain || !canReturn}
    placeholder="Explain why unused task funding is being returned (at least 5 characters)"
    error={visibleReasonError || undefined}
    onChange={e => { setReason(e.target.value); if (!reasonTouched) setReasonTouched(true); }}
    onBlur={() => setReasonTouched(true)}
   />
  </div>
  <div className="pf-actions">
   <button type="button" disabled={disabled || busy || uncertain} onClick={() => { setOpen(false); setReason(''); setReasonTouched(false); setError(''); }}>Keep allocation</button>
   <ActionBlockerGroup
    actionLabel={uncertain ? 'Retry cancellation' : 'Confirm cancellation'}
    blockers={confirmBlockers}
    busy={busy || disabled}
    size="sm"
   >
    <WorkspaceTooltip content={confirmEnabledTip} disabled={!confirmEnabledTip}>
     <span className="inline-flex">
      <button type="button" className="pf-primary" disabled={confirmDisabled} onClick={() => void cancel()}>
       {busy ? 'Cancelling…' : uncertain ? 'Retry cancellation' : 'Confirm cancellation'}
      </button>
     </span>
    </WorkspaceTooltip>
   </ActionBlockerGroup>
  </div>
  <FlowError error={error} />
 </section>;
}
