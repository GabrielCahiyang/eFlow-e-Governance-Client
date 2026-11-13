import {TaskFundingCell,useProjectFlow} from '../../project-setup';
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Trash2, Wallet, WalletCards } from 'lucide-react';
import { FeatureDialog } from '../../../components/ui/FeatureDialog';
import { Modal, ModalButton } from '../../../components/ui/Modal';
import { MoneyInput } from '../../../components/ui/MoneyInput';
import { useAuth } from '../../../contexts/AuthContext';
import { useOrgs } from '../../../hooks/useSupabaseData';
import { isAppointedOfficeHead } from '../../../shared/officeAuthority';
import { useReviewedMutation } from '../../../shared/useReviewedMutation';
import type { Task } from '../../tasks';
import { useDepartmentBudget } from '../hooks/useDepartmentBudget';
import { useTaskFundingContext } from '../hooks/useTaskFundingContext';
import { getCurrentFiscalYear } from '../constants';
import { removeSubtaskBudgetCap, setSubtaskBudgetCap } from '../services/budgetService';
import { DirectWorkFunding } from './DirectWorkFunding';
import { peso } from './budgetUi';
import { ProjectActualExpensesCell } from './ProjectActualExpenses';
import './subtaskBudget.css';

const ProjectAllocationContext=createContext<import('../../project-setup').ProjectFlow|undefined>(undefined);
const BudgetContext = createContext<Record<string,ReturnType<typeof useDepartmentBudget>>>({});
/** Share one ledger subscription across the table, including its totals. */
export function ProjectTaskBudgetProvider({projectId,officeId,officeIds=[],children}:{projectId?:string;officeId?:string;officeIds?:string[];children:ReactNode}) {
  const flow=useProjectFlow(projectId||'',!!projectId);
  return <ProjectAllocationContext.Provider value={flow.data}><OfficeBudgetScope ids={[...new Set([officeId,...officeIds].filter((id):id is string=>!!id))]}>{children}</OfficeBudgetScope></ProjectAllocationContext.Provider>;
}
function OfficeBudgetScope({ids,children}:{ids:string[];children:ReactNode}) {
  const parent=useContext(BudgetContext),id=ids[0],budget=useDepartmentBudget(id,getCurrentFiscalYear());
  if(!id)return <>{children}</>;
  return <BudgetContext.Provider value={{...parent,[id]:budget}}><OfficeBudgetScope ids={ids.slice(1)}>{children}</OfficeBudgetScope></BudgetContext.Provider>;
}
export function useProjectTaskBudgetTotal(taskIds:string[]) {
  const project=useContext(ProjectAllocationContext);
  const budgets=Object.values(useContext(BudgetContext));
  if(project)return (project.taskFunding||[]).filter(line=>taskIds.includes(line.taskId)).reduce((sum,line)=>sum+line.amount,0);
  if(!budgets.length||budgets.some(budget=>budget.loading||budget.error))return null;
  const allocations=budgets.flatMap(budget=>budget.allocations).filter(a=>!a.subtaskId&&a.status==='approved'&&taskIds.includes(a.taskId));
  return allocations.reduce((sum,a,index)=>sum+(a.id&&allocations.findIndex(other=>other.id===a.id)!==index?0:a.amount),0);
}

export function ProjectWorkExpensesCell({ task, subtaskId, personal }: { task?: Task; subtaskId?: string; personal?: boolean }) {
  return <ProjectActualExpensesCell taskId={task?.id} subtaskId={subtaskId} personal={personal}/>;
}
export function ProjectTaskBudgetCell(props:{task:Task;readOnly?:boolean}){return props.task.linkedProjectId?<TaskFundingCell projectId={props.task.linkedProjectId} taskId={props.task.id} title={props.task.title}/>:<LegacyTaskBudgetCell {...props}/>;}
function LegacyTaskBudgetCell({task,readOnly=false}:{task:Task;readOnly?:boolean}) {
  const budgets=useContext(BudgetContext),{userProfile}=useAuth(),{orgs}=useOrgs();
  const budget=Object.values(budgets).find(item=>item.allocations.some(a=>a.taskId===task.id&&!a.subtaskId&&a.status==='approved'))||budgets[task.orgId||''];
  const [open,setOpen]=useState(false);
  const allocations=budget?.allocations.filter(a=>a.taskId===task.id&&!a.subtaskId&&a.status==='approved')||[];
  const amount=allocations.reduce((sum,a)=>sum+a.amount,0);
  const canFund=!readOnly&&!task.archivedAt&&!task.proposedOfficeIdentityId&&!['completed','cancelled'].includes(task.status)&&
    task.orgId===userProfile?.org_id&&isAppointedOfficeHead(userProfile,orgs);
  if(!budget)return <span>Budget unavailable</span>;
  if(budget.loading&&!open)return <span role="status">Loading budget…</span>;
  if(budget.error&&!open)return <button onClick={()=>void budget.refresh()}>Retry budget</button>;
  return <>
    <button type="button" className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-[13px] hover:bg-muted" aria-label={`Budget for ${task.title}`} onClick={()=>setOpen(true)}>
      <WalletCards size={15}/><span>{allocations.length?peso.format(amount):canFund?'Set budget':'Not funded'}{!allocations.length&&!!task.budgetImpact&&<small className="block text-muted-foreground">{peso.format(task.budgetImpact)} from plan</small>}</span>
    </button>
    {open&&<FeatureDialog title={`Budget for ${task.title}`} description={`FY ${getCurrentFiscalYear()} · Approved funding reserves Office Budget. Cash requests use this task's remaining pool.`} onClose={()=>setOpen(false)} contentClassName="max-w-2xl">
      <header className="border-b p-5 pr-12"><h2 className="text-lg font-semibold">Budget · {task.title}</h2><p className="mt-1 text-sm text-muted-foreground">FY {getCurrentFiscalYear()} · Authorizing funding reserves the Office Budget once.</p></header>
      <div className="min-h-0 overflow-y-auto p-5">
      {budget.loading&&<p role="status">Refreshing Office Budget. Your draft is kept.</p>}
      {budget.error&&<p role="alert">{budget.error} <button onClick={()=>void budget.refresh()}>Retry budget</button></p>}
      <fieldset disabled={budget.loading||!!budget.error}>
      {allocations.length?<div className="space-y-3"><p className="text-lg font-semibold">{peso.format(amount)} authorized</p><p>This amount is already reserved from the Office Budget. Requesting or releasing cash does not reserve it a second time.</p><p className="text-sm text-muted-foreground">Funding adjustments remain in Office Budget so existing requests, receipts and audit history stay reconciled.</p></div>
        :budget.summary?.status!=='locked'?<p>Save and lock the annual Office Budget before authorizing this task.</p>
        :canFund?<DirectWorkFunding data={budget} tasks={[task]} onChanged={budget.refresh}/>
        :<p>No authorized funding. Ask the appointed Head of the responsible Office to set this budget.</p>}
      </fieldset></div>
    </FeatureDialog>}
  </>;
}

export function ProjectSubtaskBudgetCell({
  task,
  subtaskId,
  subtaskTitle,
  readOnly = false,
  isPersonal = false,
}: {
  task?: Task;
  subtaskId: string;
  subtaskTitle: string;
  readOnly?: boolean;
  isPersonal?: boolean;
}) {
  const budgets = useContext(BudgetContext);
  const { userProfile } = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [savedCap, setSavedCap] = useState<number>();

  if (isPersonal) return <span>—</span>;
  const budget = (task && (Object.values(budgets).find(item => item.allocations.some(a => a.taskId === task.id && a.status === 'approved')) || budgets[task.orgId || ''])) || undefined;
  if (!task) return <span>Budget unavailable</span>;

  const caps = budget?.allocations.filter(a => a.taskId === task.id && a.subtaskId === subtaskId && a.status === 'approved') || [];
  const amount = savedCap ?? caps.reduce((sum, a) => sum + a.amount, 0);
  const canManage = !readOnly && !!userProfile?.id && userProfile.is_active !== false &&
    !task.archivedAt && !task.proposedOfficeIdentityId && !['completed', 'cancelled'].includes(task.status);

  return (
    <>
      <button
        type="button"
        className="pt-date"
        aria-label={`Budget for ${subtaskTitle}`}
        onClick={() => setOpen(true)}
      >
        <WalletCards size={15} aria-hidden="true" />
        {amount > 0 ? peso.format(amount) : canManage ? 'Open budget' : 'View budget'}
      </button>
      {open && (
        <Modal
          isOpen
          title={`Subtask budget · ${subtaskTitle}`}
          description={`This subtask uses funding from ${task.title}'s approved task pool.`}
          onClose={() => setOpen(false)}
          preventClose={busy}
          footer={<ModalButton disabled={busy} onClick={() => setOpen(false)}>Close</ModalButton>}
          width="max-w-3xl"
        >
          <SubtaskBudgetModalContent
            key={`${task.id}:${subtaskId}:${userProfile?.id}`}
            task={task}
            subtaskId={subtaskId}
            subtaskTitle={subtaskTitle}
            budget={budget}
            canManage={canManage}
            currentUserId={userProfile?.id || ''}
            onBusyChange={setBusy}
            onCapRead={setSavedCap}
          />
        </Modal>
      )}
    </>
  );
}

const ACTIVE_CAP_REQUEST_STATES = new Set([
  'pending', 'pending_leader_review', 'leader_changes_requested', 'pending_department_approval',
  'department_changes_requested', 'approved', 'scheduled_for_release', 'partially_released',
  'released', 'liquidation_draft', 'liquidation_submitted', 'pending_leader_liquidation_review',
  'pending_department_settlement', 'changes_requested', 'overdue_liquidation',
]);

const allocationMessages: Record<string, string> = {
  access_unavailable: 'Allocation access could not be verified. Ask your Office Head to check your project access and lead appointment.',
  service_unavailable: 'Subtask allocation is unavailable on this server. Contact your eFlow administrator.',
  project_state_blocked: 'Subtask budgets can be allocated during Planning, Active, or On hold.',
  responsible_office_pending: 'Confirm the responsible Office before allocating a subtask budget.',
  planning_lead_required: 'During Planning, the appointed Project Lead or assigned Task Lead can allocate this budget.',
  task_lead_required: 'Only the assigned Task Lead can allocate this budget after Planning.',
  subtask_unavailable: 'This subtask is unavailable. Reopen it from the parent Task.',
  work_state_blocked: 'Check the Task and Subtask status. Allocation is available for open work before review or completion.',
};

function SubtaskBudgetModalContent({
  task,
  subtaskId,
  subtaskTitle,
  budget,
  canManage,
  currentUserId,
  onBusyChange,
  onCapRead,
}: {
  task: Task;
  subtaskId: string;
  subtaskTitle: string;
  budget?: ReturnType<typeof useDepartmentBudget>;
  canManage: boolean;
  currentUserId: string;
  onBusyChange: (busy: boolean) => void;
  onCapRead: (amount: number) => void;
}) {
  const version = useMemo(
    () => [
      task.assigneeId,
      ...(budget?.allocations || []).map(item => `${item.id}:${item.status}:${item.amount}`),
      ...(budget?.requests || []).map(item => `${item.id}:${item.status}:${item.requestedAmount}:${item.updatedAt}`),
    ].join('|'),
    [task.assigneeId, budget?.allocations, budget?.requests],
  );
  const funding = useTaskFundingContext(task.id, subtaskId, version, canManage);
  const safety = useReviewedMutation(`${task.id}:${subtaskId}:${currentUserId}`);
  const context = funding.context;

  const [lineId, setLineId] = useState('');
  const [amount, setAmount] = useState(0);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const attempt = useRef<{ key: string; terms: string } | undefined>(undefined);
  const inFlight = useRef(false);

  useEffect(() => {
    if (!context) return;
    onCapRead(context.cap?.amount ?? 0);
  }, [context, onCapRead]);

  useEffect(() => {
    if (!funding.allocation?.canAllocate || !context) return;
    const available = funding.allocation.lines;
    setLineId(prev => {
      if (available.some(line => line.id === prev)) return prev;
      return context.cap?.allocationLineId || available.find(line => line.available > 0)?.id || available[0]?.id || '';
    });
    if (context.cap) {
      setAmount(prev => prev || context.cap?.amount || 0);
      setReason(prev => prev || context.cap?.reason || '');
    }
  }, [context, funding.allocation]);

  useEffect(() => {
    onBusyChange(saving || safety.pending);
    return () => onBusyChange(false);
  }, [saving, safety.pending, onBusyChange]);

  const capRequests = context?.cap
    ? (budget?.requests || []).filter(request => request.allocationId === context.cap?.id)
    : [];
  const capHasActiveRequest = context?.subtaskBudgetBlocked || capRequests.some(request => ACTIVE_CAP_REQUEST_STATES.has(request.status));
  const lines = funding.allocation?.lines || [];
  const canEdit = Boolean(canManage && !funding.loading && funding.allocation?.canAllocate && context?.funded);
  const selectedLine = lines.find(line => line.id === lineId);
  const capLine = context?.cap ? context.lines.find(line => line.id === context.cap?.allocationLineId) : undefined;
  const capMaximum = selectedLine?.available || 0;
  const poolAvailable = lines.reduce((sum, line) => sum + line.available, 0) - (context?.cap?.amount ?? 0);
  const allocationReason = funding.allocation?.reason;

  async function refreshAll() {
    await Promise.all([budget?.refresh(), funding.refresh()]);
  }

  async function saveCap() {
    if (!canEdit || capHasActiveRequest || inFlight.current) return;
    if (!selectedLine) {
      setError('Choose a task budget account.');
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0 || amount > capMaximum) {
      setError(`Enter a valid amount up to ${peso.format(capMaximum)}.`);
      return;
    }
    if (!reason.trim()) {
      setError('Enter an allocation reason.');
      return;
    }
    const terms = JSON.stringify([lineId, amount, reason.trim()]);
    if (attempt.current?.terms !== terms) attempt.current = { key: crypto.randomUUID(), terms };
    inFlight.current = true;
    setSaving(true);
    setError('');
    try {
      await setSubtaskBudgetCap({
        taskId: task.id,
        subtaskId,
        allocationLineId: lineId,
        amount,
        reason: reason.trim(),
        idempotencyKey: attempt.current.key,
      });
      attempt.current = undefined;
      onCapRead(amount);
      await refreshAll();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Subtask allocation could not be saved.');
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }

  async function removeCap() {
    const cap = context?.cap;
    if (!cap || !canEdit || capHasActiveRequest || inFlight.current) return;
    let removalReason = '';
    await safety.run({
      key: `${cap.id}:remove`,
      confirmation: {
        title: 'Return unused cap to the task pool?',
        description: `Remove the protected cap for “${subtaskTitle}”. The server checks active requests before releasing the cap.`,
        actionLabel: 'Cancel allocation',
        danger: true,
        impact: `Allocated ${peso.format(cap.amount)} · available ${peso.format(cap.available)}`,
        reason: {
          label: 'Reason for removing the cap',
          onAccept: value => { removalReason = value; },
        },
      },
      operation: () => removeSubtaskBudgetCap({ capId: cap.id, reason: removalReason, idempotencyKey: crypto.randomUUID() }),
      success: 'Unused cap returned to the task pool.',
      refresh: refreshAll,
    });
  }

  return (
    <div className="bk-panel">
      {safety.dialog}
      {funding.loading && <p role="status">Loading task funding sources…</p>}
      {context?.cap && (
        <>
          <h3>Allocated: {peso.format(context.cap.amount)}</h3>
          <div className="bk-existing-cap">
            <p>
              {capLine ? `${capLine.category} · ${capLine.particular} · ${capLine.fundSource} · ` : ''}
              {peso.format(context.cap.amount)} allocated · {peso.format(context.cap.available)} available for cash requests
            </p>
            {canEdit && !capHasActiveRequest && (
              <button type="button" disabled={saving || safety.pending} onClick={() => void removeCap()}>
                <Trash2 size={14} aria-hidden="true" /> Cancel allocation
              </button>
            )}
          </div>
        </>
      )}
      {capHasActiveRequest && (
        <p role="status">Settle, reject, or cancel the active cash request before changing this subtask cap.</p>
      )}
      {context?.funded && canEdit && (
        <section className="bk-panel bk-task-accounts" aria-label="Allocate subtask budget">
          <header>
            <div>
              <h3><Wallet size={20} aria-hidden="true" />{context.cap ? 'Update subtask budget cap' : 'Subtask budget accounts'}</h3>
              <p>Reserve a protected cap for this subtask from its parent task’s approved funding pool.</p>
            </div>
            <div className="bk-task-accounts__balance">
              <small>Task funds left</small>
              <strong>{peso.format(Math.max(0, poolAvailable))}</strong>
            </div>
          </header>
          {!lines.some(line => line.available > 0) && <p>All approved Task funds are committed. Free up funds on the parent Task before allocating more.</p>}
          <fieldset disabled={saving || capHasActiveRequest || !lines.some(line => line.available > 0)} className="space-y-3 border-0 p-0 m-0 min-w-0">
            <div className="bk-funding-row">
              <label>
                Account
                <select
                  aria-label="Subtask budget account"
                  value={selectedLine ? lineId : ''}
                  onChange={event => {
                    setLineId(event.target.value);
                    setError('');
                  }}
                >
                  <option value="">Choose account</option>
                  {lines.map(line => (
                    <option key={line.id} value={line.id}>
                      {line.name} · {peso.format(line.available)} available
                    </option>
                  ))}
                </select>
                {selectedLine && <small>{peso.format(capMaximum)} max from this account</small>}
              </label>
              <label>
                Amount
                <MoneyInput
                  aria-label="Subtask budget amount"
                  min="0.01"
                  max={capMaximum}
                  step="0.01"
                  value={amount || ''}
                  onValueChange={raw => {
                    setAmount(Number(raw));
                    setError('');
                  }}
                />
              </label>
            </div>
            <div className="bk-task-accounts__totals">
              {context.cap && <div><span>Already allocated</span><strong>{peso.format(context.cap.amount)}</strong></div>}
              <div><span>{context.cap ? 'Updated cap' : 'Subtask budget'}</span><strong>{peso.format(Number.isFinite(amount) ? amount : 0)}</strong></div>
            </div>
            <label>
              Allocation reason
              <textarea
                aria-label="Subtask allocation reason"
                value={reason}
                maxLength={3000}
                onChange={event => setReason(event.target.value)}
              />
            </label>
            <button type="button" className="bk-primary" onClick={() => void saveCap()}>
              {saving ? 'Saving…' : context.cap ? 'Update subtask budget' : 'Allocate subtask budget'}
            </button>
          </fieldset>
        </section>
      )}
      {!funding.loading && context && !context.funded && (
        <p>No approved task budget yet. Allocate budget on “{task.title}” before assigning a subtask cap.</p>
      )}
      {!funding.loading && context?.funded && !canEdit && !funding.error && (
        <p role="status">{allocationReason && allocationMessages[allocationReason] ||
          (canManage ? 'Ask the assigned Task Lead, or the appointed Project Lead during Planning, to check allocation access.'
            : 'This budget is read-only in the current view.')}</p>
      )}
      {(error || funding.error || safety.message) && (
        <div role="alert" className="bk-error">
          {error || funding.error || safety.message}
          {funding.error && <button type="button" onClick={() => void funding.refresh()}>Retry funding</button>}
        </div>
      )}
    </div>
  );
}
