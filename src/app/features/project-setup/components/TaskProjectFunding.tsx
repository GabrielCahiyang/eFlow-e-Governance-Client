import { readableUiError } from '../../../shared/userFacingError';
import { ActionBlockerGroup } from "../../../components/ui/action-blockers";
import { WorkspaceTooltip } from "../../../components/ui/workspace/WorkspaceTooltip";
import { useEffect, useId, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { Wallet, Plus, X } from 'lucide-react';
import { BoundedTextarea } from '../../../components/ui/BoundedInput';
import { FieldValidationTooltip } from '../../../components/ui/FieldValidationTooltip';
import { MoneyInput } from '../../../components/ui/MoneyInput';
import { diffCentavos, exceedsCentavos, formatPeso, sumCentavos, toCentavos } from '../../../shared/currency';
import { INPUT_LIMITS, textLengthError } from '../../../shared/inputLimits';
import { useProjectFlow } from '../useProjectFlow';
import { projectFlowCall, ProjectFlowError } from '../services/projectFlow';
import { FlowError } from './FlowError';
import { availableTaskAccounts, taskFundingTotal } from '../taskFundingAccounts';
import { fundingEntryError } from '../fundingMessages';
import '../projectSetup.css';

const MIN_REASON_LENGTH = 5;

export interface TaskFundingActionState {
  label: string;
  pending: boolean;
  disabled?: boolean;
  disabledReason?: string;
  blockers?: string[];
}

type TaskAccountOption = ReturnType<typeof availableTaskAccounts>[number];

function TaskAccountSelect({
  index,
  value,
  selected,
  sources,
  otherSelectedIds,
  error,
  onChange,
  onBlur,
}: {
  index: number;
  value: string;
  selected?: TaskAccountOption;
  sources: TaskAccountOption[];
  otherSelectedIds: Set<string>;
  error?: string;
  onChange: (nextValue: string) => void;
  onBlur: () => void;
}) {
  const selectRef = useRef<HTMLSelectElement | null>(null);
  const selectId = useId();
  const tipId = useId();
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const showTip = Boolean(error) && (focused || hovered);

  return (
    <label htmlFor={selectId}>
      Account <span className="text-[var(--eflow-negative-text)]" aria-hidden="true">*</span>
      <select
        ref={selectRef}
        id={selectId}
        aria-label={`Task budget account ${index + 1}`}
        aria-required="true"
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={showTip ? tipId : undefined}
        className={error ? 'eflow-field-invalid' : undefined}
        value={value}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          onBlur();
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Choose account</option>
        {sources.map((source) => (
          <option value={source.id} key={source.id} disabled={otherSelectedIds.has(source.id)}>
            FY {source.fiscal_year} · {source.name} · ₱{source.available.toLocaleString('en-PH')} left
          </option>
        ))}
      </select>
      <FieldValidationTooltip id={tipId} anchorRef={selectRef} message={error} open={showTip} tone="error" />
      {error ? (
        <small className="pf-field-error" role="alert">{error}</small>
      ) : selected ? (
        <small>₱{selected.available.toLocaleString('en-PH')} left in this project</small>
      ) : null}
    </label>
  );
}

export function TaskProjectFunding({
 projectId,
 taskId,
 funded,
 variant='panel',
 submitRef,
 onActionState,
 onChanged,
 onBusyChange,
}:{
 projectId:string;
 taskId:string;
 funded:boolean;
 variant?:'panel'|'modal';
 submitRef?:MutableRefObject<(() => void) | null>;
 onActionState?:(state:TaskFundingActionState | null) => void;
 onChanged:()=>Promise<void>;
 onBusyChange?:(busy:boolean)=>void;
}){
 const flow=useProjectFlow(projectId),[lines,setLines]=useState([{sourceId:'',amount:0}]),[reason,setReason]=useState(''),[reasonTouched,setReasonTouched]=useState(false),[touchedRows,setTouchedRows]=useState<Record<number,boolean>>({}),[busy,setBusy]=useState(false),[error,setError]=useState('');const key=useRef(crypto.randomUUID()),pending=useRef(false),attempt=useRef<{lines:{sourceId:string;amount:number}[];reason:string}|null>(null);const [uncertain,setUncertain]=useState(false);
 const reasonId=useId();
 const data=flow.data;
 const sources=data?availableTaskAccounts(data,taskId):[];
 const blockedByState=!data||data.project.funding_not_required||(funded&&!data.canExtendTaskFunding)||!data.canAllocate||['completed','archived'].includes(data.project.status);
 const exhaustedInModal=variant==='modal'&&!sources.length;
 const formVisible=!blockedByState&&!exhaustedInModal;
 const submitLabel=uncertain?'Verify saved task allocation':busy?'Saving…':funded?'Add to task budget':'Allocate task budget';

 const selectedYears=lines
  .map(line=>sources.find(source=>source.id===line.sourceId)?.fiscal_year)
  .filter((year):year is number=>year!==undefined);
 const firstSelectedYear=selectedYears[0];
 const hasCrossFiscalYear=new Set(selectedYears).size>1;

 const reasonError=textLengthError(reason,'Allocation reason',{required:true,min:MIN_REASON_LENGTH,max:INPUT_LIMITS.FUNDING_REASON})||'';
 const visibleReasonError=reasonTouched||reason.length>0?reasonError:'';
 const rowIssues=lines.map((line,index)=>{
  const selected=sources.find(source=>source.id===line.sourceId);
  const crossYearMismatch=hasCrossFiscalYear&&selected&&firstSelectedYear!==undefined&&selected.fiscal_year!==firstSelectedYear;
  const sourceErr=!line.sourceId&&touchedRows[index]
   ?'Select a project budget account.'
   :crossYearMismatch
    ?'Choose accounts from the same fiscal year.'
    :undefined;
  const amountErr=selected&&Number.isFinite(line.amount)&&exceedsCentavos(line.amount,selected.available)
   ?`Exceeds ${selected.name} available (${formatPeso(selected.available)}) by ${formatPeso(diffCentavos(line.amount,selected.available))}.`
   :touchedRows[index]&&(!Number.isFinite(line.amount)||toCentavos(line.amount)<=0)
    ?'Enter an amount greater than ₱0.00.'
    :undefined;
  return {sourceErr,amountErr};
 });
 const rawBlockedReasons=(!uncertain&&data)?[
  lines.some(l=>!l.sourceId)?'Select a project budget account.':'',
  hasCrossFiscalYear?'Choose accounts from the same fiscal year.':'',
  ...rowIssues.map(r=>r.amountErr||'').filter(Boolean),
  lines.some(l=>!Number.isFinite(l.amount)||toCentavos(l.amount)<=0)?'Enter an amount greater than ₱0.00.':'',
  reasonError,
 ].filter(Boolean):[];
 const blockedReasonsKey=rawBlockedReasons.join('\n');
 const blockedReasons=useMemo(()=>(blockedReasonsKey?blockedReasonsKey.split('\n'):[]),[blockedReasonsKey]);
 const firstBlockedReason=blockedReasons[0]||'';
 const submitDisabled=busy||(!uncertain&&blockedReasons.length>0);

 useEffect(()=>{onBusyChange?.(busy||uncertain);return()=>onBusyChange?.(false);},[busy,uncertain,onBusyChange]);
 useEffect(()=>{
  if(submitRef) submitRef.current=formVisible?()=>{void save();}:null;
 });
 useEffect(()=>{
  if(!onActionState)return;
  onActionState(formVisible?{label:submitLabel,pending:busy,disabled:submitDisabled,disabledReason:firstBlockedReason,blockers:blockedReasons}:null);
  return()=>onActionState(null);
 },[onActionState,formVisible,submitLabel,busy,submitDisabled,firstBlockedReason,blockedReasons]);

 if(!data)return flow.error ? (
  <div role="alert" className="mb-3 flex items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
   <span>{flow.error}</span>
   <button type="button" className="shrink-0 rounded-md border border-amber-300 bg-white px-2.5 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100" onClick={()=>void flow.reload()}>Retry</button>
  </div>
 ) : null;
 if(data.project.funding_not_required)return <p>Funding not required</p>;
 if((funded&&!data.canExtendTaskFunding)||!data.canAllocate||['completed','archived'].includes(data.project.status))return null;
 if(exhaustedInModal){
  return <p className="pf-task-budget-note">{funded?'All authorized project funding sources available for this task are already allocated above.':'No project-funded accounts have available balance for this task yet.'}</p>;
 }
 const existing=taskFundingTotal((data.taskFunding||[]).filter(line=>line.taskId===taskId));
 const added=taskFundingTotal(lines);
 const newTaskTotal=sumCentavos([existing,added]);
 async function save(){
  if(pending.current||!data)return;pending.current=true;setBusy(true);setError('');
  try{
   if(!attempt.current){const issue=fundingEntryError(lines.map(line=>({partitionId:line.sourceId,amount:line.amount})),sources.map(source=>({id:source.id,name:source.name,year:source.fiscal_year,available:source.available})),reason);if(issue)throw new Error(issue);if(new Set(lines.map(line=>sources.find(source=>source.id===line.sourceId)?.fiscal_year)).size>1)throw new Error('Choose accounts from the same fiscal year.');}
   attempt.current??={lines:lines.map(line=>({...line})),reason:reason.trim()};
   try{await projectFlowCall('allocate_project_task_funding',{p_task:taskId,p_lines:attempt.current.lines,p_reason:attempt.current.reason,p_key:key.current});}
   catch(e){if(e instanceof ProjectFlowError&&!uncertain){attempt.current=null;key.current=crypto.randomUUID();setUncertain(false);}else setUncertain(true);throw e;}
   attempt.current=null;setUncertain(false);key.current=crypto.randomUUID();setReason('');setReasonTouched(false);setTouchedRows({});setLines([{sourceId:'',amount:0}]);await flow.reload();await onChanged();
  }catch(e){setError(readableUiError(e, "Task allocation could not be saved.", 'write'));}finally{pending.current=false;setBusy(false);}
 }

 const fieldsetDisabled=busy||uncertain||!data.ready||!sources.length;
 const addAccountDisabled=lines.length>=sources.length;

 return <section className={variant==='modal'?'pf-task-accounts pf-task-accounts--modal':'pf-panel pf-task-accounts'} aria-label="Allocate task budget">
  <header><div><h3><Wallet size={20}/>{funded?'Add accounts to this task':'Task budget accounts'}</h3><p>Use one account, or split the task budget across several accounts.</p></div><div className="pf-task-accounts__balance"><small>Project funds left</small><strong>₱{data.unallocated.toLocaleString('en-PH')}</strong></div></header>
  {!sources.length&&<p>No other project-funded accounts are available for this task.</p>}
  <fieldset disabled={fieldsetDisabled} className="space-y-3">
   {lines.map((line,index)=>{
    const selected=sources.find(source=>source.id===line.sourceId);
    const issue=rowIssues[index];
    const otherSelectedIds=new Set(lines.filter((_,i)=>i!==index).map(row=>row.sourceId).filter(Boolean));
    const removeDisabled=lines.length===1;
    return <div key={index} className="pf-funding-row pf-task-funding-row">
     <TaskAccountSelect
      index={index}
      value={selected?line.sourceId:''}
      selected={selected}
      sources={sources}
      otherSelectedIds={otherSelectedIds}
      error={issue?.sourceErr}
      onBlur={()=>setTouchedRows(prev=>({...prev,[index]:true}))}
      onChange={nextSourceId=>{
       setTouchedRows(prev=>({...prev,[index]:true}));
       setLines(rows=>rows.map((row,i)=>i===index?{...row,sourceId:nextSourceId}:row));
      }}
     />
     <label>Amount <span className="text-[var(--eflow-negative-text)]" aria-hidden="true">*</span><MoneyInput aria-label={`Task account ${index+1} amount`} min="0" max={INPUT_LIMITS.MONEY_MAX_BUDGET} availableMax={selected?.available} showCeilingHint={Boolean(selected)||Boolean(touchedRows[index])} externalError={issue?.amountErr} step="0.01" value={line.amount||''} onBlur={()=>setTouchedRows(prev=>({...prev,[index]:true}))} onValueChange={value=>{setTouchedRows(prev=>({...prev,[index]:true}));setLines(rows=>rows.map((row,i)=>i===index?{...row,amount:Number(value)}:row));}}/></label>
     <ActionBlockerGroup actionLabel={`Remove task funding source ${index+1}`} blockers={removeDisabled?'At least one funding account is required.':''} busy={fieldsetDisabled} compact size="sm">
      <WorkspaceTooltip content={`Remove task funding source ${index+1}`} disabled={removeDisabled||fieldsetDisabled}>
       <button type="button" disabled={removeDisabled} aria-label={`Remove task funding source ${index+1}`} onClick={()=>{setLines(rows=>rows.filter((_,i)=>i!==index));setTouchedRows(prev=>{const next:Record<number,boolean>={};Object.entries(prev).forEach(([k,v])=>{const idx=Number(k);if(idx<index)next[idx]=v;else if(idx>index)next[idx-1]=v;});return next;});}}><X size={16}/></button>
      </WorkspaceTooltip>
     </ActionBlockerGroup>
    </div>;
   })}
   <ActionBlockerGroup actionLabel="Add another account" blockers={addAccountDisabled?'All available project budget accounts are already added.':''} busy={fieldsetDisabled} compact size="sm">
    <button type="button" className="pf-task-accounts__add" disabled={addAccountDisabled} onClick={()=>setLines(rows=>rows.length>=sources.length?rows:[...rows,{sourceId:'',amount:0}])}><Plus size={16}/>Add another account</button>
   </ActionBlockerGroup>
   <div className="pf-task-accounts__totals">{funded&&<div><span>Already allocated</span><strong>₱{existing.toLocaleString('en-PH')}</strong></div>}<div><span>{funded?'Adding now':'Task budget'}</span><strong>₱{added.toLocaleString('en-PH')}</strong></div>{funded&&<div><span>New task total</span><strong>₱{newTaskTotal.toLocaleString('en-PH')}</strong></div>}</div>
   <div className="pf-field">
    <label htmlFor={reasonId}>Allocation reason <span className="text-[var(--eflow-negative-text)]" aria-hidden="true">*</span></label>
    <BoundedTextarea
     id={reasonId}
     value={reason}
     maxLength={INPUT_LIMITS.FUNDING_REASON}
     rows={3}
     aria-required="true"
     placeholder="Describe why this task needs these funds (at least 5 characters)"
     error={visibleReasonError||undefined}
     onChange={e=>{setReason(e.target.value);if(!reasonTouched)setReasonTouched(true);}}
     onBlur={()=>setReasonTouched(true)}
    />
   </div>
   {!onActionState&&<ActionBlockerGroup actionLabel={funded?'Add to task budget':'Allocate task budget'} blockers={blockedReasons} busy={fieldsetDisabled}><button type="button" className="pf-primary" disabled={submitDisabled} onClick={()=>void save()}>{busy?'Saving…':funded?'Add to task budget':'Allocate task budget'}</button></ActionBlockerGroup>}
  </fieldset>
  {!onActionState&&uncertain&&<button type="button" className="pf-primary" disabled={busy} onClick={()=>void save()}>Verify saved task allocation</button>}
  <FlowError error={error}/>
 </section>;
}
