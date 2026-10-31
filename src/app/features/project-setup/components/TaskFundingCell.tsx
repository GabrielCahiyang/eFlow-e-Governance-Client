import {useState} from 'react';
import {WalletCards} from 'lucide-react';
import {Modal} from '../../../components/ui/Modal';
import {useProjectFlow} from '../useProjectFlow';
import {TaskProjectFunding} from './TaskProjectFunding';
import {FlowError} from './FlowError';
export function TaskFundingCell({projectId,taskId,title}:{projectId:string;taskId:string;title:string}){
 const flow=useProjectFlow(projectId),[open,setOpen]=useState(false);
 const lines=flow.data?.taskFunding?.filter(line=>line.taskId===taskId)||[],total=lines.reduce((sum,line)=>sum+line.amount,0);
 return <><button className="pt-date" aria-label={`Budget for ${title}`} onClick={()=>setOpen(true)}><WalletCards size={15}/>{lines.length?`₱${total.toLocaleString('en-PH')}`:'Allocate budget'}</button>{open&&<Modal isOpen title={`Task budget · ${title}`} description="This task uses funding reserved by its project." onClose={()=>setOpen(false)} width="max-w-3xl"><div className="pf-panel">{lines.length>0&&<><h3>Allocated: ₱{total.toLocaleString('en-PH')}</h3>{lines.map(line=><p key={line.id}>{line.source} · ₱{line.amount.toLocaleString('en-PH')} allocated · ₱{line.available.toLocaleString('en-PH')} available for cash requests</p>)}<p>Manage unused allocations in Project settings → Project budget.</p></>}<TaskProjectFunding projectId={projectId} taskId={taskId} funded={lines.length>0} onChanged={flow.reload}/><FlowError error={flow.error}/>{!flow.data?.canAllocate&&!lines.length&&<p>The project lead allocates this task’s budget from the authorized project sources.</p>}</div></Modal>}</>;
}
