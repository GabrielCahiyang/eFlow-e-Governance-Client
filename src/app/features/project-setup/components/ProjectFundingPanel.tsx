import {useEffect,useId,useRef,useState} from 'react';
import {useNavigationBlocker} from '../../../shared/navigationGuard';
import {Plus,Wallet,Check,X,Undo2} from 'lucide-react';
import {MoneyInput} from '../../../components/ui/MoneyInput';
import {DecisionModal} from '../../../components/ui/DecisionModal';
import {decimalError} from '../../../shared/numericValidation';
import {projectFlowCall,ProjectFlowError} from '../services/projectFlow';
import {FlowError} from './FlowError';
import {fundingEntryError,fundingErrorMessage} from '../fundingMessages';
import {readFundingDraft,storeFundingDraft,type FundingDraftRecovery} from '../fundingDraftRecovery';
import type {FundingDraft,ProjectFlow} from '../types';
const money=(n:number)=>new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP'}).format(n);
type FundingDecision={title:string;description:string;label:string;action:(reason:string)=>Promise<unknown>;success:string};
export function ProjectFundingPanel({data,reload,wizard=false,allowFundingEntry=true,onBusyChange,onDraftChange,onUncertainChange,recoveryKey=''}:{data:ProjectFlow;reload:()=>Promise<void>;wizard?:boolean;allowFundingEntry?:boolean;onBusyChange?:(busy:boolean)=>void;onDraftChange?:(dirty:boolean)=>void;onUncertainChange?:(uncertain:boolean)=>void;recoveryKey?:string}){
 const [recovered]=useState(()=>readFundingDraft(recoveryKey));
 const [lines,setLines]=useState<FundingDraft[]>(recovered?.lines??[{partitionId:'',amount:0}]),[reason,setReason]=useState(recovered?.reason??''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [selectedYears,setSelectedYears]=useState<Record<number,number|undefined>>(recovered?.years??{});
 const attempt=useRef<FundingDraftRecovery['request']>(recovered?.request),[uncertain,setUncertain]=useState(!!recovered?.request);
 const inFlight=useRef(false);
 const [decision,setDecision]=useState<FundingDecision>(),[decisionReason,setDecisionReason]=useState('');
 const total=lines.reduce((sum,line)=>sum+line.amount,0);
 const sources=data.sources.filter(source=>source.available>0&&(!wizard||(
  !!data.project.start_date&&!!data.project.target_date&&source.year>=Number(data.project.start_date.slice(0,4))&&source.year<=Number(data.project.target_date.slice(0,4))
 )));
 const years=Array.from(new Set(sources.map(source=>source.year))).sort((a,b)=>a-b);
 const entryAllowed=data.canAllocate&&(!wizard||data.canAuthorize);
 const entryHintId=useId();
 const entryIssue=wizard&&lines.some(line=>!!line.partitionId&&!!decimalError(line.amount,'Amount',0.01,90_000_000_000,2))
  ?'Enter an amount from ₱0.01 to ₱90,000,000,000 with up to two decimal places.'
  :fundingEntryError(lines,wizard?sources:data.sources,reason);
 const draftDirty=!!reason.trim()||lines.some(line=>!!line.partitionId||line.amount!==0)||Object.values(selectedYears).some(Boolean);
 const [localSaved,setLocalSaved]=useState(false);
 useEffect(()=>{setLocalSaved(storeFundingDraft(recoveryKey,draftDirty?{lines,reason,years:selectedYears,request:attempt.current}:undefined));},[recoveryKey,lines,reason,draftDirty,uncertain,selectedYears]);
 useNavigationBlocker({label:'Unsaved project funding',dirty:allowFundingEntry&&draftDirty&&!localSaved,pending:busy||uncertain&&!localSaved,onDiscard:()=>{setLines([{partitionId:'',amount:0}]);setReason('');setSelectedYears({});}});
 useEffect(()=>()=>{onBusyChange?.(false);onDraftChange?.(false);onUncertainChange?.(false);},[onBusyChange,onDraftChange,onUncertainChange]);
 useEffect(()=>onBusyChange?.(busy),[busy,onBusyChange]);useEffect(()=>onDraftChange?.(draftDirty),[draftDirty,onDraftChange]);useEffect(()=>onUncertainChange?.(uncertain),[uncertain,onUncertainChange]);
 async function run(action:()=>Promise<unknown>,success:string){if(inFlight.current)return false;inFlight.current=true;setBusy(true);setError('');setNotice('');try{await action();setNotice(success);await reload();window.dispatchEvent(new Event('eflow:project-setup'));return true;}catch(e){setError(fundingErrorMessage(e));return false;}finally{inFlight.current=false;setBusy(false);}}
 function confirmDecision(next:FundingDecision){setDecisionReason('');setError('');setDecision(next);}
 const save=()=>void run(async()=>{
  if(!entryAllowed||!navigator.onLine)throw new Error('Reconnect and verify your project access before saving funding.');
  if(!attempt.current&&entryIssue)throw new Error(entryIssue);
  const operation=data.canAuthorize?'authorize_project_funding':'request_project_funding';
  if(attempt.current&&attempt.current.operation!==operation)throw new Error('The original funding authority is required to verify this request.');
  attempt.current??={id:crypto.randomUUID(),operation};
  storeFundingDraft(recoveryKey,{lines,reason,years:selectedYears,request:attempt.current});
  try{
   const receipt=await projectFlowCall<{authorized:number}>(operation,{p_project:data.project.id,p_lines:lines,p_reason:reason.trim(),p_key:attempt.current.id});
   if(wizard&&(!Number.isFinite(receipt?.authorized)||receipt.authorized<=0))throw new Error('Could not confirm the authorization. Verify the saved funding request.');
  }
  catch(e){
   if(e instanceof ProjectFlowError&&!uncertain){attempt.current=undefined;storeFundingDraft(recoveryKey,{lines,reason,years:selectedYears});}
   else setUncertain(true);
   throw e;
  }
  attempt.current=undefined;storeFundingDraft(recoveryKey);setUncertain(false);setLines([{partitionId:'',amount:0}]);setReason('');setSelectedYears({});
 },data.canAuthorize?(wizard?'Project funding authorized.':'Project budget updated.'):'Funding request sent to the Head.');
 return <section className="pf-panel" aria-label="Project budget">
 <header><div><h2><Wallet size={20}/> Project budget</h2><p>Authorize funding from named Office Budget sources. Tasks divide this funding; they do not charge Office Budget again.</p></div></header>
 <p>{data.project.funding_not_required?'Funding not required':data.total>0?'Funding authorized':data.fundingRequests.length?'Funding request pending':'Funding required · no funding authorized'}</p>
 <div className="pf-summary">{[['Authorized budget',data.total],['Allocated to tasks',data.allocated],['Unallocated',data.unallocated],['Cash released',data.released],['Actual spent',data.spent],['Cash returned',data.returned??0],['Outstanding advances',data.outstanding??0]].map(([label,value])=><div key={String(label)}><small>{label}</small><strong>{money(Number(value))}</strong></div>)}</div>
 {data.funds.length>0&&<div className="pf-table-scroll"><table><thead><tr><th>Funding source</th><th>Fiscal year</th><th>Authorized</th><th>Unallocated</th>{data.canAuthorize&&<th>Closeout</th>}</tr></thead><tbody>{data.funds.map(source=><tr key={source.id}><td>{source.name}</td><td>FY {source.fiscal_year}</td><td>{money(source.amount)}</td><td>{money(source.available)}</td>{data.canAuthorize&&<td><button disabled={busy||source.available<=0} onClick={()=>{const requestId=crypto.randomUUID();confirmDecision({title:'Release unused project funding',description:source.name+' · '+money(source.available),label:'Release unused funding',action:reason=>projectFlowCall('release_project_funding',{p_project:data.project.id,p_source:source.id,p_amount:source.available,p_reason:reason,p_key:requestId}),success:'Unused project funding released with an audit record.'});}}><Undo2 size={14}/>Release unused</button></td>}</tr>)}</tbody></table></div>}
 {wizard&&!data.canAuthorize&&<p className="pf-warning">Only the appointed Office Head can authorize project funding.</p>}
 {allowFundingEntry&&entryAllowed&&!data.project.funding_not_required&&!['completed','archived'].includes(data.project.status)&&<fieldset disabled={busy||uncertain} className="min-w-0 space-y-4"><h3>{data.canAuthorize?'Add authorized funding':'Request additional project funding'}</h3>
 {!sources.length&&<p className="pf-warning">{wizard?'No Office Budget sources with available balances overlap the project dates.':'No funding is available from Office Budget. Check the Office Budget balances first.'}</p>}
 {lines.map((line,index)=>{
  const sourceList=uncertain?data.sources:sources;
  const year=selectedYears[index]??sourceList.find(source=>source.id===line.partitionId)?.year;
  const rowSources=wizard?sourceList.filter(source=>source.year===year):sourceList;
  return <div key={index} className={wizard?'pf-funding-row pf-wizard-funding-row':'pf-funding-row'}>
   {wizard&&<label>Fiscal year<select value={year??''} onChange={event=>{
    const nextYear=Number(event.target.value)||undefined;
    setSelectedYears(current=>({...current,[index]:nextYear}));
    if(line.partitionId)setLines(rows=>rows.map((row,i)=>i===index?{...row,partitionId:''}:row));
   }}><option value="">Select fiscal year</option>{Array.from(new Set(year?[...years,year]:years)).map(value=><option key={value} value={value}>FY {value}</option>)}</select></label>}
   <label>Office Budget source<select disabled={wizard&&!year} value={rowSources.some(source=>source.id===line.partitionId)?line.partitionId:''} onChange={event=>{
    const partitionId=event.target.value;
    setLines(rows=>rows.map((row,i)=>i===index?{...row,partitionId}:row));
   }}><option value="">{wizard?'Select an Office Budget source':'Select fiscal year and account'}</option>
   {rowSources.map(source=><option key={source.id} value={source.id} disabled={lines.some((row,i)=>i!==index&&row.partitionId===source.id)}>{!wizard&&`FY ${source.year} · `}{source.name} · {money(source.available)} available</option>)}</select></label>
   <label>Amount<MoneyInput min="0" step="0.01" value={line.amount||''} onValueChange={value=>setLines(rows=>rows.map((row,i)=>i===index?{...row,amount:Number(value)}:row))}/></label>
   <button type="button" aria-label={`Remove funding row ${index+1}`} disabled={lines.length===1} onClick={()=>{
    setLines(rows=>rows.filter((_,i)=>i!==index));
    setSelectedYears(current=>Object.fromEntries(Object.entries(current).filter(([key])=>Number(key)!==index).map(([key,value])=>[Number(key)>index?Number(key)-1:Number(key),value])));
   }}><X size={16}/></button>
  </div>;
 })}
 <button type="button" disabled={lines.length>=sources.length} onClick={()=>setLines(rows=>rows.length>=sources.length?rows:[...rows,{partitionId:'',amount:0}])}><Plus size={16}/>Add funding source</button>
 <label>Reason / approved authority reference<textarea value={reason} maxLength={3000} onChange={e=>setReason(e.target.value)}/></label>
 {entryIssue&&<p id={entryHintId}>{entryIssue}</p>}
 <div className="pf-actions"><strong>Additional funding total: {money(total)}</strong><button type="button" className="pf-primary disabled:cursor-not-allowed disabled:opacity-50" aria-describedby={entryIssue?entryHintId:undefined} disabled={!!entryIssue||busy} onClick={save}><Check size={16}/>{busy?'Saving…':data.canAuthorize?'Authorize project funding':'Request funding'}</button></div></fieldset>}
 {data.fundingRequests.map(request=><article key={request.id} className="pf-warning"><strong>Pending funding request</strong><p>{request.reason}</p>{data.canAuthorize&&<div className="pf-actions"><button disabled={busy} className="pf-primary" onClick={()=>void run(()=>projectFlowCall('decide_project_funding',{p_request:request.id,p_approve:true,p_reason:'Authorized project funding request'}),'Funding request authorized.')}>Authorize</button><button disabled={busy} onClick={()=>{confirmDecision({title:'Decline funding request',description:request.reason,label:'Decline funding request',action:reason=>projectFlowCall('decide_project_funding',{p_request:request.id,p_approve:false,p_reason:reason}),success:'Funding request declined.'});}}>Decline</button></div>}</article>)}
 {data.canAllocate&&data.taskFunding?.length>0&&<section><h3>Task allocations</h3>{data.taskFunding.map(line=><div key={line.id} className="pf-actions py-2"><span>{line.task} · {line.source} · {money(line.amount)} allocated · {money(line.available)} unused</span><button disabled={busy||line.available<=0} onClick={()=>{const requestId=crypto.randomUUID();confirmDecision({title:'Return unused task funding',description:line.task+' · '+money(line.available),label:'Return unused funding',action:reason=>projectFlowCall('release_project_task_funding',{p_line:line.id,p_amount:line.available,p_reason:reason,p_key:requestId}),success:'Unused task funding returned to the project.'});}}>Return unused to project</button></div>)}</section>}
 {data.liquidations?.filter(item=>item.canReview).map(item=><section key={item.id}><h3>Receipt endorsement · {item.purpose}</h3><p>Declared spent: {money(item.spent)}. Verify receipts in the cash record before endorsing.</p><div className="pf-actions"><button disabled={busy} className="pf-primary" onClick={()=>void run(()=>projectFlowCall('decide_petty_cash_liquidation_leader_review',{p_liquidation_id:item.id,p_approve:true,p_reason:'Project reviewer endorsed receipt package'}),'Receipt package endorsed for Accounting settlement.')}>Endorse receipts</button><button disabled={busy} onClick={()=>{confirmDecision({title:'Request receipt corrections',description:item.purpose,label:'Request changes',action:reason=>projectFlowCall('decide_petty_cash_liquidation_leader_review',{p_liquidation_id:item.id,p_approve:false,p_reason:reason}),success:'Receipt package returned for changes.'});}}>Request changes</button></div></section>)}
 {data.requests.length>0&&<section><h3>Project cash requests</h3>{data.requests.map(request=><article key={request.id} className="border-b py-3"><strong>{request.purpose} · {money(request.amount)}</strong><p>{request.requester} · {request.status.replace(/_/g,' ')}</p>{request.canReview&&<div className="pf-actions"><button className="pf-primary" disabled={busy} onClick={()=>void run(()=>projectFlowCall('decide_petty_cash_request',{p_request_id:request.id,p_approve:true,p_reason:'Reviewed by project reviewer'}),'Cash request approved for Accounting release.')}>Approve cash request</button><button disabled={busy} onClick={()=>{confirmDecision({title:'Decline cash request',description:request.purpose,label:'Decline cash request',action:reason=>projectFlowCall('decide_petty_cash_request',{p_request_id:request.id,p_approve:false,p_reason:reason}),success:'Cash request declined.'});}}>Decline request</button></div>}</article>)}</section>}
 {uncertain&&<button className="pf-primary" disabled={busy||!entryAllowed} onClick={save}>Verify saved funding request</button>}
 {decision&&<DecisionModal title={decision.title} description={decision.description} decision="changes"
  confirmLabel={decision.label} requireReason reason={decisionReason} onReasonChange={setDecisionReason} busy={busy} error={error}
  onCancel={()=>{setDecision(undefined);setError('');}} onConfirm={()=>void run(()=>decision.action(decisionReason.trim()),decision.success).then(saved=>{if(saved)setDecision(undefined);})}/>}
 <FlowError error={decision?'':error}/>{notice&&<p role="status" className="pf-success">{notice}</p>}
 </section>;
}
