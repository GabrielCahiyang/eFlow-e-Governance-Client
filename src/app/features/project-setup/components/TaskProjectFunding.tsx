import {useRef,useState} from 'react';
import {Wallet,Plus,X} from 'lucide-react';
import {MoneyInput} from '../../../components/ui/MoneyInput';
import {useProjectFlow} from '../useProjectFlow';
import {projectFlowCall,ProjectFlowError} from '../services/projectFlow';
import {FlowError} from './FlowError';
import '../projectSetup.css';
export function TaskProjectFunding({projectId,taskId,funded,onChanged}:{projectId:string;taskId:string;funded:boolean;onChanged:()=>Promise<void>}){
 const flow=useProjectFlow(projectId),[lines,setLines]=useState([{sourceId:'',amount:0}]),[reason,setReason]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');const key=useRef(crypto.randomUUID()),pending=useRef(false),attempt=useRef<{lines:{sourceId:string;amount:number}[];reason:string}|null>(null);const [uncertain,setUncertain]=useState(false);
 if(!flow.data)return <FlowError error={flow.error}/>;
 if(funded||!flow.data.canAllocate||['completed','archived'].includes(flow.data.project.status))return null;
 const data=flow.data;
 async function save(){
  if(pending.current)return;pending.current=true;setBusy(true);setError('');
  try{
   if(!reason.trim()||lines.some(line=>!line.sourceId||!Number.isFinite(line.amount)||line.amount<=0))throw new Error('Select project sources, positive amounts and an allocation reason.');
   attempt.current??={lines:lines.map(line=>({...line})),reason:reason.trim()};
   try{await projectFlowCall('allocate_project_task_funding',{p_task:taskId,p_lines:attempt.current.lines,p_reason:attempt.current.reason,p_key:key.current});}
   catch(e){if(e instanceof ProjectFlowError&&!uncertain){attempt.current=null;key.current=crypto.randomUUID();setUncertain(false);}else setUncertain(true);throw e;}
   attempt.current=null;setUncertain(false);key.current=crypto.randomUUID();setReason('');setLines([{sourceId:'',amount:0}]);await flow.reload();await onChanged();
  }catch(e){setError(e instanceof Error?e.message:'Task allocation could not be saved.');}finally{pending.current=false;setBusy(false);}
 }

 return <section className="pf-panel" aria-label="Allocate task budget"><h3><Wallet size={20}/>Allocate from project budget</h3><p>Project unallocated: ₱{data.unallocated.toLocaleString('en-PH')}. This allocation divides existing project funding and does not charge Office Budget again.</p><fieldset disabled={busy||uncertain||!data.ready} className="space-y-3">{lines.map((line,index)=><div key={index} className="pf-funding-row pf-task-funding-row"><label>Project funding source<select value={line.sourceId} onChange={e=>setLines(rows=>rows.map((row,i)=>i===index?{...row,sourceId:e.target.value}:row))}><option value="">Select source</option>{data.funds.map(source=><option value={source.id} key={source.id}>FY {source.fiscal_year} Q{source.quarter} · {source.name} · ₱{source.available.toLocaleString('en-PH')} available</option>)}</select></label><label>Amount<MoneyInput min="0" step="0.01" value={line.amount||''} onValueChange={value=>setLines(rows=>rows.map((row,i)=>i===index?{...row,amount:Number(value)}:row))}/></label><button disabled={lines.length===1} aria-label={`Remove task funding source ${index+1}`} onClick={()=>setLines(rows=>rows.filter((_,i)=>i!==index))}><X size={16}/></button></div>)}<button onClick={()=>setLines(rows=>[...rows,{sourceId:'',amount:0}])}><Plus size={16}/>Add source</button><label>Allocation reason<textarea value={reason} maxLength={3000} onChange={e=>setReason(e.target.value)}/></label><button className="pf-primary" onClick={()=>void save()}>{busy?'Allocating…':'Allocate task budget'}</button></fieldset>{uncertain&&<button className="pf-primary" disabled={busy} onClick={()=>void save()}>Verify saved task allocation</button>}<FlowError error={error}/></section>;
}
