import {useCallback,useState} from 'react';
import {WalletCards} from 'lucide-react';
import {Modal,ModalButton} from '../../../components/ui/Modal';
import {useProjectFlow} from '../useProjectFlow';
import {TaskProjectFunding} from './TaskProjectFunding';
import {FlowError} from './FlowError';
import {CancelTaskFunding} from './CancelTaskFunding';
export function TaskFundingCell({projectId,taskId,title}:{projectId:string;taskId:string;title:string}){
 const flow=useProjectFlow(projectId),[open,setOpen]=useState(false),[locks,setLocks]=useState<string[]>([]);
 const busy=locks.length>0;
 const setLock=useCallback((id:string,value:boolean)=>setLocks(previous=>value?previous.includes(id)?previous:[...previous,id]:previous.includes(id)?previous.filter(item=>item!==id):previous),[]);
 const setAllocationBusy=useCallback((value:boolean)=>setLock('allocate',value),[setLock]);
 const lines=flow.data?.taskFunding?.filter(line=>line.taskId===taskId&&line.amount>0)||[],total=lines.reduce((sum,line)=>sum+line.amount,0);
 if(!flow.data)return <span>{flow.error?'Funding data unavailable':'Loading funding…'}</span>;
 if(flow.data.project.funding_not_required&&!lines.length)return <span>Funding not required</span>;
 return <><button className="pt-date" aria-label={`Budget for ${title}`} onClick={()=>setOpen(true)}><WalletCards size={15}/>{lines.length?`₱${total.toLocaleString('en-PH')}`:'Allocate budget'}</button>{open&&<Modal isOpen title={`Task budget · ${title}`} description="This task uses funding reserved by its project." onClose={()=>setOpen(false)} preventClose={busy} footer={<ModalButton disabled={busy} onClick={()=>setOpen(false)}>Close</ModalButton>} width="max-w-3xl"><div className="pf-panel">{lines.length>0&&<><h3>Allocated: ₱{total.toLocaleString('en-PH')}</h3>{lines.map(line=><div key={line.id}><p>{line.source} · ₱{line.amount.toLocaleString('en-PH')} allocated · ₱{line.available.toLocaleString('en-PH')} available for cash requests</p>{flow.data?.canAllocate&&<CancelTaskFunding line={line} onChanged={flow.reload} onBusyChange={setLock} disabled={locks.some(id=>id!==line.id)}/>}</div>)}</>}<TaskProjectFunding projectId={projectId} taskId={taskId} funded={lines.length>0} onChanged={flow.reload} onBusyChange={setAllocationBusy}/><FlowError error={flow.error}/>{!flow.data?.canAllocate&&!lines.length&&<p>The project lead allocates this task’s budget from the authorized project sources.</p>}</div></Modal>}</>;
}
