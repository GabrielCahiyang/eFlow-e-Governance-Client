import {useCallback,useRef,useState} from 'react';
import {Lock, WalletCards} from 'lucide-react';
import {Modal,ModalButton} from '../../../components/ui/Modal';
import {WorkspaceTooltip} from '../../../components/ui/workspace/WorkspaceTooltip';
import {useProjectFlow} from '../useProjectFlow';
import {TaskProjectFunding,type TaskFundingActionState} from './TaskProjectFunding';
import {FlowError} from './FlowError';
import {CancelTaskFunding} from './CancelTaskFunding';

const peso = (amount: number) => `₱${amount.toLocaleString('en-PH')}`;

export function TaskFundingCell({projectId,taskId,title}:{projectId:string;taskId:string;title:string}){
 const flow=useProjectFlow(projectId),[open,setOpen]=useState(false),[locks,setLocks]=useState<string[]>([]);
 const submitRef=useRef<(() => void) | null>(null),[actionState,setActionState]=useState<TaskFundingActionState | null>(null);
 const busy=locks.length>0;
 const setLock=useCallback((id:string,value:boolean)=>setLocks(previous=>value?previous.includes(id)?previous:[...previous,id]:previous.includes(id)?previous.filter(item=>item!==id):previous),[]);
 const setAllocationBusy=useCallback((value:boolean)=>setLock('allocate',value),[setLock]);
 const lines = (flow.data?.taskFunding ?? []).filter(line => line.taskId === taskId && line.amount > 0);
 const total = lines.reduce((sum, line) => sum + line.amount, 0);
 const protectedCents = lines.reduce((sum, line) => sum + Math.max(0, Math.round((line.amount - line.available) * 100)), 0);
 const protectedAmount = protectedCents / 100;
 const hasUnusedFunding = lines.some(line => line.available > 0);
 const protectionReason = 'Cash requests lock funds as soon as they’re submitted. Subtask allocations and recorded expenses can also lock funds.';
 const returnGuidance = hasUnusedFunding ? 'Only the unused balance can be returned.' : 'There’s no unused balance to return.';
 const tooltip = `${peso(protectedAmount)} of this task’s budget is locked. ${protectionReason} ${returnGuidance}`;
 if(!flow.data)return <span>{flow.error?'Funding data unavailable':'Loading funding…'}</span>;
 if(flow.data.project.funding_not_required&&!lines.length)return <span>Funding not required</span>;
 return <>
  <WorkspaceTooltip content={tooltip} disabled={!protectedCents}>
   <button
    type="button"
    className="pt-date"
    aria-label={`Budget for ${title}`}
    onClick={() => { setOpen(true); void flow.reload(); }}
   >
    {protectedCents > 0 ? <Lock size={15} aria-hidden="true" /> : <WalletCards size={15} aria-hidden="true" />}
    {lines.length ? peso(total) : 'Allocate budget'}
   </button>
  </WorkspaceTooltip>
  {open && <Modal
   isOpen
   title={`Task budget · ${title}`}
   description="This task uses funding reserved by its project."
   onClose={() => setOpen(false)}
   preventClose={busy}
   footer={<>
    <ModalButton disabled={busy} onClick={() => setOpen(false)}>Close</ModalButton>
    {actionState && <ModalButton
     variant="primary" pending={actionState.pending} disabled={locks.some(id => id !== 'allocate')}
     onClick={() => submitRef.current?.()}
    >{actionState.label}</ModalButton>}
   </>}
   width="max-w-3xl"
  >
   <div className="pf-task-budget-dialog">
    {lines.length > 0 && <section className="pf-task-budget-summary" aria-label="Allocated task funding">
     <header><h3>Allocated: {peso(total)}</h3></header>
     {protectedCents > 0 && <p className="pf-task-budget-protection">
      <Lock size={14} aria-hidden="true" />
      <span><strong>{peso(protectedAmount)} locked.</strong> {returnGuidance}</span>
     </p>}
     <div className="pf-task-budget-lines">
      {lines.map(line => <div key={line.id} className="pf-task-budget-line">
       <div>
        <strong>{line.source}</strong>
        <p>{peso(line.amount)} allocated · {peso(line.available)} available for cash requests</p>
       </div>
       {flow.data?.canAllocate && <CancelTaskFunding
        line={line} onChanged={flow.reload} onBusyChange={setLock} disabled={locks.some(id => id !== line.id)}
       />}
      </div>)}
     </div>
    </section>}
    <TaskProjectFunding
     projectId={projectId} taskId={taskId} funded={lines.length > 0} variant="modal"
     submitRef={submitRef} onActionState={setActionState} onChanged={flow.reload} onBusyChange={setAllocationBusy}
    />
    <FlowError error={flow.error} />
    {!flow.data?.canAllocate && !lines.length && <p className="pf-task-budget-note">The project lead allocates this task’s budget from the authorized project sources.</p>}
   </div>
  </Modal>}
 </>;
}
