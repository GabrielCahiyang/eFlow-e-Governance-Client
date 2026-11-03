import {useEffect,useRef,useState} from 'react';
import {Wallet,Plus,X} from 'lucide-react';
import {MoneyInput} from '../../../components/ui/MoneyInput';
import {useProjectFlow} from '../useProjectFlow';
import {projectFlowCall,ProjectFlowError} from '../services/projectFlow';
import {FlowError} from './FlowError';
import {availableTaskAccounts,taskFundingTotal} from '../taskFundingAccounts';
import {fundingEntryError} from '../fundingMessages';
import '../projectSetup.css';
export function TaskProjectFunding({projectId,taskId,funded,onChanged,onBusyChange}:{projectId:string;taskId:string;funded:boolean;onChanged:()=>Promise<void>;onBusyChange?:(busy:boolean)=>void}){
 const flow=useProjectFlow(projectId),[lines,setLines]=useState([{sourceId:'',amount:0}]),[reason,setReason]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');const key=useRef(crypto.randomUUID()),pending=useRef(false),attempt=useRef<{lines:{sourceId:string;amount:number}[];reason:string}|null>(null);const [uncertain,setUncertain]=useState(false);
 useEffect(()=>{onBusyChange?.(busy||uncertain);return()=>onBusyChange?.(false);},[busy,uncertain,onBusyChange]);
 if(!flow.data)return <FlowError error={flow.error}/>;
 if((funded&&!flow.data.canExtendTaskFunding)||!flow.data.canAllocate||['completed','archived'].includes(flow.data.project.status))return null;
 const data=flow.data;
 const sources=availableTaskAccounts(data,taskId);
 const existing=taskFundingTotal((data.taskFunding||[]).filter(line=>line.taskId===taskId));
 const added=taskFundingTotal(lines);
 async function save(){
  if(pending.current)return;pending.current=true;setBusy(true);setError('');
  try{
   if(!attempt.current){const issue=fundingEntryError(lines.map(line=>({partitionId:line.sourceId,amount:line.amount})),sources.map(source=>({id:source.id,name:source.name,year:source.fiscal_year,available:source.available})),reason);if(issue)throw new Error(issue);if(new Set(lines.map(line=>sources.find(source=>source.id===line.sourceId)?.fiscal_year)).size>1)throw new Error('Choose accounts from the same fiscal year.');}
   attempt.current??={lines:lines.map(line=>({...line})),reason:reason.trim()};
   try{await projectFlowCall('allocate_project_task_funding',{p_task:taskId,p_lines:attempt.current.lines,p_reason:attempt.current.reason,p_key:key.current});}
   catch(e){if(e instanceof ProjectFlowError&&!uncertain){attempt.current=null;key.current=crypto.randomUUID();setUncertain(false);}else setUncertain(true);throw e;}
   attempt.current=null;setUncertain(false);key.current=crypto.randomUUID();setReason('');setLines([{sourceId:'',amount:0}]);await flow.reload();await onChanged();
  }catch(e){setError(e instanceof Error?e.message:'Task allocation could not be saved.');}finally{pending.current=false;setBusy(false);}
 }

 return <section className="pf-panel pf-task-accounts" aria-label="Allocate task budget">
  <header><div><h3><Wallet size={20}/>{funded?'Add accounts to this task':'Task budget accounts'}</h3><p>Use one account, or split the task budget across several accounts.</p></div><div className="pf-task-accounts__balance"><small>Project funds left</small><strong>₱{data.unallocated.toLocaleString('en-PH')}</strong></div></header>
  {!sources.length&&<p>No other project-funded accounts are available for this task.</p>}
  <fieldset disabled={busy||uncertain||!data.ready||!sources.length} className="space-y-3">
   {lines.map((line,index)=>{const selected=sources.find(source=>source.id===line.sourceId);return <div key={index} className="pf-funding-row pf-task-funding-row">
    <label>Account<select aria-label={`Task budget account ${index+1}`} value={selected?line.sourceId:''} onChange={e=>setLines(rows=>rows.map((row,i)=>i===index?{...row,sourceId:e.target.value}:row))}><option value="">Choose account</option>{sources.map(source=><option value={source.id} key={source.id} disabled={lines.some((row,i)=>i!==index&&row.sourceId===source.id)}>FY {source.fiscal_year} · {source.name} · ₱{source.available.toLocaleString('en-PH')} left</option>)}</select>{selected&&<small>₱{selected.available.toLocaleString('en-PH')} left in this project</small>}</label>
    <label>Amount<MoneyInput aria-label={`Task account ${index+1} amount`} min="0" max={selected?.available} step="0.01" value={line.amount||''} onValueChange={value=>setLines(rows=>rows.map((row,i)=>i===index?{...row,amount:Number(value)}:row))}/></label>
    <button type="button" disabled={lines.length===1} aria-label={`Remove task funding source ${index+1}`} onClick={()=>setLines(rows=>rows.filter((_,i)=>i!==index))}><X size={16}/></button>
   </div>;})}
   <button type="button" className="pf-task-accounts__add" disabled={lines.length>=sources.length} onClick={()=>setLines(rows=>rows.length>=sources.length?rows:[...rows,{sourceId:'',amount:0}])}><Plus size={16}/>Add another account</button>
   <div className="pf-task-accounts__totals">{funded&&<div><span>Already allocated</span><strong>₱{existing.toLocaleString('en-PH')}</strong></div>}<div><span>{funded?'Adding now':'Task budget'}</span><strong>₱{added.toLocaleString('en-PH')}</strong></div>{funded&&<div><span>New task total</span><strong>₱{(existing+added).toLocaleString('en-PH')}</strong></div>}</div>
   <label>Allocation reason<textarea value={reason} maxLength={3000} onChange={e=>setReason(e.target.value)}/></label>
   <button type="button" className="pf-primary" onClick={()=>void save()}>{busy?'Saving…':funded?'Add to task budget':'Allocate task budget'}</button>
  </fieldset>
  {uncertain&&<button type="button" className="pf-primary" disabled={busy} onClick={()=>void save()}>Verify saved task allocation</button>}
  <FlowError error={error}/>
 </section>;
}
