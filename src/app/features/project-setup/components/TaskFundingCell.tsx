import {useCallback,useRef,useState} from 'react';
import {Lock, WalletCards} from 'lucide-react';
import {Modal,ModalButton} from '../../../components/ui/Modal';
import {ActionBlockerGroup} from '../../../components/ui/action-blockers';
import {WorkspaceTooltip} from '../../../components/ui/workspace/WorkspaceTooltip';
import {sumCentavos} from '../../../shared/currency';
import {useProjectFlow} from '../useProjectFlow';
import {TaskProjectFunding,type TaskFundingActionState} from './TaskProjectFunding';
import {FlowError} from './FlowError';
import {CancelTaskFunding} from './CancelTaskFunding';
import {useReturnedBudget} from '../hooks/useReturnedBudget';

const peso = (amount: number) => `₱${amount.toLocaleString('en-PH')}`;

export function TaskFundingCell({projectId,taskId,title,taskStatus}:{projectId:string;taskId:string;title:string;taskStatus?:string}){
 const flow=useProjectFlow(projectId),[open,setOpen]=useState(false),[locks,setLocks]=useState<string[]>([]);
 const submitRef=useRef<(() => void) | null>(null),[actionState,setActionState]=useState<TaskFundingActionState | null>(null);
 const busy=locks.length>0;
 const taskClosed=taskStatus==='completed'||taskStatus==='cancelled';
 const setLock=useCallback((id:string,value:boolean)=>setLocks(previous=>value?previous.includes(id)?previous:[...previous,id]:previous.includes(id)?previous.filter(item=>item!==id):previous),[]);
 const setAllocationBusy=useCallback((value:boolean)=>setLock('allocate',value),[setLock]);
 const lines = (flow.data?.taskFunding ?? []).filter(line => line.taskId === taskId && line.amount > 0);
 const returned = useReturnedBudget(taskId, taskClosed).task;
 const total = sumCentavos(lines.map(line => line.amount));
 // Finished work keeps showing the budget the Head authorised; the unused part
 // has already gone back to the project and is explained in the dialog.
 const shownBudget = sumCentavos([total, returned]);
 const protectedCents = lines.reduce((sum, line) => sum + Math.max(0, Math.round((line.amount - line.available) * 100)), 0);
 const protectedAmount = protectedCents / 100;
 const hasUnusedFunding = lines.some(line => line.available > 0);
 const protectionReason = 'Cash requests lock funds as soon as they’re submitted. Subtask allocations and recorded expenses can also lock funds.';
 const returnGuidance = hasUnusedFunding ? 'Only the unused balance can be returned.' : 'There’s no unused balance to return.';
 const tooltip = `${peso(protectedAmount)} of this task’s budget is locked. ${protectionReason} ${returnGuidance}`;
 const lockedByOtherAction = locks.some(id => id !== 'allocate');
 const actionDisabled = lockedByOtherAction || Boolean(actionState?.disabled);
 const actionBlockers = actionState?.blockers ?? (actionState?.disabledReason ? [actionState.disabledReason] : []);
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
    {shownBudget > 0 ? peso(shownBudget) : taskClosed ? peso(0) : 'Allocate budget'}
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
    {!taskClosed && actionState && <ActionBlockerGroup actionLabel={actionState.label} blockers={actionBlockers} busy={busy || actionState.pending}><ModalButton
     variant="primary" pending={actionState.pending} disabled={actionDisabled}
     onClick={() => submitRef.current?.()}
    >{actionState.label}</ModalButton></ActionBlockerGroup>}
   </>}
   width="max-w-3xl"
  >
   <div className="pf-task-budget-dialog">
    {lines.length > 0 && <section className="pf-task-budget-summary" aria-label="Allocated task funding">
     <header><h3>{taskClosed ? 'Budget' : 'Allocated'}: {peso(shownBudget)}</h3></header>
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
       {flow.data?.canAllocate && !taskClosed && <CancelTaskFunding
        line={line} onChanged={flow.reload} onBusyChange={setLock} disabled={locks.some(id => id !== line.id)}
       />}
      </div>)}
     </div>
    </section>}
    {taskClosed && !lines.length && returned <= 0 && (
     <p className="pf-task-budget-note">
      This task is {taskStatus}. No budget remains allocated.
     </p>
    )}
    {taskClosed && returned > 0 && <section className="pf-task-budget-summary" aria-label="Finished task budget">
     {!lines.length && <header><h3>Budget: {peso(shownBudget)}</h3></header>}
     <p><strong>{peso(returned)}</strong> was not used and was returned to the project budget when this task was completed. Actual spent is shown in the Actual expenses column.</p>
    </section>}
    {!taskClosed && <TaskProjectFunding
     projectId={projectId} taskId={taskId} funded={lines.length > 0} variant="modal"
     submitRef={submitRef} onActionState={setActionState} onChanged={flow.reload} onBusyChange={setAllocationBusy}
    />}
    <FlowError error={flow.error} />
    {!taskClosed && !flow.data?.canAllocate && !lines.length && <p className="pf-task-budget-note">The project lead allocates this task’s budget from the authorized project sources.</p>}
   </div>
  </Modal>}
 </>;
}
