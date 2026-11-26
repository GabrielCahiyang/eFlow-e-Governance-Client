import { readableUiError } from '../../../shared/userFacingError';
import {TaskFundingCell,useProjectFlow,useReturnedBudget} from '../../project-setup';
import { createContext, useContext, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { Trash2, Wallet, WalletCards } from 'lucide-react';
import { BoundedTextarea } from '../../../components/ui/BoundedInput';
import { FeatureDialog } from '../../../components/ui/FeatureDialog';
import { FieldValidationTooltip } from '../../../components/ui/FieldValidationTooltip';
import { Modal, ModalButton } from '../../../components/ui/Modal';
import { MoneyInput } from '../../../components/ui/MoneyInput';
import { ActionBlockerGroup } from '../../../components/ui/action-blockers';
import { WorkspaceTooltip } from '../../../components/ui/workspace/WorkspaceTooltip';
import { useAuth } from '../../../contexts/AuthContext';
import { useOrgs } from '../../../hooks/useSupabaseData';
import { exceedsCentavos, formatPeso } from '../../../shared/currency';
import { INPUT_LIMITS, textLengthError } from '../../../shared/inputLimits';
import { isAppointedOfficeHead } from '../../../shared/officeAuthority';
import { useReviewedMutation } from '../../../shared/useReviewedMutation';
import type { Task } from '../../tasks';
import { useDepartmentBudget } from '../hooks/useDepartmentBudget';
import { useTaskFundingContext } from '../hooks/useTaskFundingContext';
import { formatCents, fromCents, parsePesoCents, toCents } from '../selectors/subtaskDistribution';
import { getCurrentFiscalYear } from '../constants';
import { removeSubtaskBudgetCap, setSubtaskBudgetCap, SUBTASK_BUDGET_CHANGED_EVENT } from '../services/budgetService';
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

export function ProjectWorkExpensesCell({ task, subtaskId, subtaskStatus, personal }: { task?: Task; subtaskId?: string; subtaskStatus?: string; personal?: boolean }) {
  const completed = subtaskId ? subtaskStatus === 'completed' : task?.status === 'completed';
  return <ProjectActualExpensesCell taskId={task?.id} subtaskId={subtaskId} personal={personal} completed={completed}/>;
}
export function ProjectTaskBudgetCell(props:{task:Task;readOnly?:boolean}){return props.task.linkedProjectId?<TaskFundingCell projectId={props.task.linkedProjectId} taskId={props.task.id} title={props.task.title} taskStatus={props.task.status}/>:<LegacyTaskBudgetCell {...props}/>;}
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
  subtaskStatus,
  readOnly = false,
  isPersonal = false,
}: {
  task?: Task;
  subtaskId: string;
  subtaskTitle: string;
  subtaskStatus?: string;
  readOnly?: boolean;
  isPersonal?: boolean;
}) {
  const budgets = useContext(BudgetContext);
  const { userProfile } = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [savedCap, setSavedCap] = useState<number>();

  useEffect(() => {
    if (!task?.id) return;
    const syncCap = (event: Event) => {
      const detail = (event as CustomEvent<{ taskId?: string; subtaskId?: string; amount?: number }>).detail;
      if (!detail || (detail.taskId && detail.taskId !== task.id)) return;
      if (detail.subtaskId === subtaskId && typeof detail.amount === 'number') setSavedCap(detail.amount);
      else if (!detail.subtaskId) setSavedCap(undefined);
    };
    window.addEventListener(SUBTASK_BUDGET_CHANGED_EVENT, syncCap);
    return () => window.removeEventListener(SUBTASK_BUDGET_CHANGED_EVENT, syncCap);
  }, [subtaskId, task?.id]);

  const subtaskClosed = subtaskStatus === 'completed' || subtaskStatus === 'cancelled';
  const returnedToProject = useReturnedBudget(task?.id, subtaskClosed && !isPersonal).subtasks.get(subtaskId) ?? 0;
  if (isPersonal) return <span>—</span>;
  const budget = (task && (Object.values(budgets).find(item => item.allocations.some(a => a.taskId === task.id && a.status === 'approved')) || budgets[task.orgId || ''])) || undefined;
  if (!task) return <span>Budget unavailable</span>;

  const caps = budget?.allocations.filter(a => a.taskId === task.id && a.subtaskId === subtaskId && a.status === 'approved') || [];
  // Finished subtasks keep the budget they were given; the unused part went back to the project.
  const amount = (savedCap ?? caps.reduce((sum, a) => sum + a.amount, 0)) + returnedToProject;
  const canManage = !readOnly && !subtaskClosed && !!userProfile?.id && userProfile.is_active !== false &&
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
        {amount > 0 ? peso.format(amount) : subtaskClosed ? peso.format(0) : canManage ? 'Open budget' : 'View budget'}
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
  const [touched, setTouched] = useState<{ account?: boolean; amount?: boolean; reason?: boolean }>({});
  const [accountActive, setAccountActive] = useState(false);
  const accountRef = useRef<HTMLSelectElement | null>(null);
  const accountId = useId();
  const accountTipId = useId();
  const amountId = useId();
  const reasonId = useId();
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
  const row = context?.subtaskBudgets?.find(item => item.id === subtaskId);
  const capHasActiveRequest = context?.subtaskBudgetBlocked || capRequests.some(request => ACTIVE_CAP_REQUEST_STATES.has(request.status));
  const lines = funding.allocation?.lines || [];
  const canEdit = Boolean(canManage && !funding.loading && funding.allocation?.canAllocate && context?.funded);
  const selectedLine = lines.find(line => line.id === lineId);
  const capLine = context?.cap ? context.lines.find(line => line.id === context.cap?.allocationLineId) : undefined;
  const floorCents = context?.cap ? Math.max(0, toCents(context.cap.amount) - toCents(context.cap.available)) : 0;
  const capMinimum = fromCents(Math.max(1, floorCents));
  const capMaximum = selectedLine?.available || 0;
  const sourceLocked = Boolean(context?.cap && (row?.hasHistory || row?.finished));
  const poolAvailable = lines.reduce((sum, line) => sum + line.available, 0) - (context?.cap?.amount ?? 0);
  const allocationReason = funding.allocation?.reason;
  const hasAvailableLines = lines.some(line => line.available > 0);
  const parsedCents = parsePesoCents(String(amount || ''));
  const accountError = !selectedLine
    ? 'Choose a task budget account.'
    : sourceLocked && context?.cap?.allocationLineId && selectedLine.id !== context.cap.allocationLineId
      ? 'Keep the same funding account because this subtask already has cash history or finished work.'
      : '';
  const visibleAccountError = touched.account ? accountError : '';
  const amountOverMax = Number.isFinite(amount) && exceedsCentavos(amount, capMaximum);
  const amountError =
    parsedCents === null
      ? 'Enter an amount greater than zero with up to two decimal places.'
      : exceedsCentavos(amount, INPUT_LIMITS.MONEY_MAX_BUDGET)
        ? `Amount cannot exceed ${formatPeso(INPUT_LIMITS.MONEY_MAX_BUDGET)}.`
        : floorCents > 0 && parsedCents < floorCents
          ? `Keep at least ${formatCents(floorCents)} to cover recorded spending on this subtask.`
          : amountOverMax
            ? `Enter a valid amount up to ${peso.format(capMaximum)}.`
            : '';
  const visibleAmountError = touched.amount || amountOverMax ? amountError : '';
  const reasonError = textLengthError(reason, 'Allocation reason', {
    required: true,
    min: 5,
    max: INPUT_LIMITS.FUNDING_REASON,
  });
  const visibleReasonError = touched.reason || reason.length > 0 ? reasonError : '';
  const submitBlockers = [
    !hasAvailableLines
      ? 'All approved Task funds are committed. Free up funds on the parent Task first.'
      : '',
    capHasActiveRequest
      ? 'Settle, reject, or cancel the active cash request before changing this subtask cap.'
      : '',
    accountError,
    amountError,
    reasonError,
  ].filter(Boolean);
  const submitBlockedReason = submitBlockers[0] || '';
  const submitDisabled =
    saving || capHasActiveRequest || !hasAvailableLines || Boolean(submitBlockedReason);

  async function refreshAll() {
    await Promise.all([budget?.refresh(), funding.refresh()]);
  }

  async function saveCap() {
    if (!canEdit || capHasActiveRequest || inFlight.current) return;
    setTouched({ account: true, amount: true, reason: true });
    if (submitBlockedReason) {
      setError(submitBlockedReason);
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
      setError(readableUiError(caught, "Subtask allocation could not be saved.", 'write'));
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
      refresh: async () => {
        onCapRead(0);
        await refreshAll();
      },
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
              <WorkspaceTooltip
                content="Returns this subtask’s unused budget cap back to the parent task pool."
                disabled={saving || safety.pending}
              >
                <button type="button" disabled={saving || safety.pending} onClick={() => void removeCap()}>
                  <Trash2 size={14} aria-hidden="true" /> Cancel allocation
                </button>
              </WorkspaceTooltip>
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
          {!hasAvailableLines && <p>All approved Task funds are committed. Free up funds on the parent Task before allocating more.</p>}
          <fieldset disabled={saving || capHasActiveRequest || !hasAvailableLines} className="space-y-3 border-0 p-0 m-0 min-w-0">
            <div className="bk-funding-row">
              <div className="grid gap-1.5 text-[13px]">
                <label htmlFor={accountId} className="inline-flex items-center gap-1">
                  Account{' '}
                  <span className="text-[var(--eflow-negative-text)]" aria-hidden="true">
                    *
                  </span>
                </label>
                <select
                  ref={accountRef}
                  id={accountId}
                  aria-label="Subtask budget account"
                  aria-required="true"
                  aria-invalid={Boolean(visibleAccountError) || undefined}
                  aria-describedby={accountActive && visibleAccountError ? accountTipId : undefined}
                  disabled={sourceLocked}
                  value={selectedLine ? lineId : ''}
                  onFocus={() => setAccountActive(true)}
                  onMouseEnter={() => setAccountActive(true)}
                  onMouseLeave={() => setAccountActive(false)}
                  onBlur={() => {
                    setAccountActive(false);
                    setTouched(prev => ({ ...prev, account: true }));
                  }}
                  onChange={event => {
                    setTouched(prev => ({ ...prev, account: true }));
                    setLineId(event.target.value);
                    setError('');
                  }}
                  className={visibleAccountError ? 'eflow-field-invalid' : undefined}
                >
                  <option value="">Choose account</option>
                  {lines.map(line => (
                    <option key={line.id} value={line.id}>
                      {line.name} · {peso.format(line.available)} available
                    </option>
                  ))}
                </select>
                <FieldValidationTooltip
                  id={accountTipId}
                  anchorRef={accountRef}
                  message={visibleAccountError}
                  open={accountActive && Boolean(visibleAccountError)}
                  tone="error"
                />
                {visibleAccountError && (
                  <small role="alert" className="text-[var(--eflow-negative-text)]">
                    {visibleAccountError}
                  </small>
                )}
                {selectedLine && !visibleAccountError && (
                  <small className="text-[11px] text-muted-foreground">
                    {floorCents > 0 ? `${formatCents(floorCents)} min for recorded spending · ` : ''}
                    {peso.format(capMaximum)} max from this account
                  </small>
                )}
              </div>
              <div className="grid gap-1.5 text-[13px]">
                <label htmlFor={amountId} className="inline-flex items-center gap-1">
                  Amount{' '}
                  <span className="text-[var(--eflow-negative-text)]" aria-hidden="true">
                    *
                  </span>
                </label>
                <MoneyInput
                  id={amountId}
                  aria-label="Subtask budget amount"
                  aria-required="true"
                  min={capMinimum}
                  max={INPUT_LIMITS.MONEY_MAX_BUDGET}
                  availableMax={capMaximum}
                  showCeilingHint
                  externalError={visibleAmountError || undefined}
                  step="0.01"
                  value={amount || ''}
                  onBlur={() => setTouched(prev => ({ ...prev, amount: true }))}
                  onValueChange={raw => {
                    setTouched(prev => ({ ...prev, amount: true }));
                    setAmount(Number(raw));
                    setError('');
                  }}
                />
              </div>
            </div>
            <div className="bk-task-accounts__totals">
              {context.cap && <div><span>Already allocated</span><strong>{peso.format(context.cap.amount)}</strong></div>}
              <div><span>{context.cap ? 'Updated cap' : 'Subtask budget'}</span><strong>{peso.format(Number.isFinite(amount) ? amount : 0)}</strong></div>
            </div>
            <div className="grid gap-1.5 text-[13px]">
              <label htmlFor={reasonId} className="inline-flex items-center gap-1">
                Allocation reason{' '}
                <span className="text-[var(--eflow-negative-text)]" aria-hidden="true">
                  *
                </span>
              </label>
              <BoundedTextarea
                id={reasonId}
                aria-label="Subtask allocation reason"
                aria-required="true"
                value={reason}
                maxLength={INPUT_LIMITS.FUNDING_REASON}
                rows={3}
                error={visibleReasonError || undefined}
                placeholder="Explain why this subtask budget cap is needed (at least 5 characters)"
                onBlur={() => setTouched(prev => ({ ...prev, reason: true }))}
                onChange={event => {
                  setTouched(prev => ({ ...prev, reason: true }));
                  setReason(event.target.value);
                  setError('');
                }}
              />
            </div>
          </fieldset>
          <div className="mt-3">
            <ActionBlockerGroup
              actionLabel={context.cap ? 'Update subtask budget' : 'Allocate subtask budget'}
              blockers={submitDisabled ? submitBlockers : []}
              busy={saving}
              size="md"
            >
              <button type="button" className="bk-primary" disabled={submitDisabled} onClick={() => void saveCap()}>
                {saving ? 'Saving…' : context.cap ? 'Update subtask budget' : 'Allocate subtask budget'}
              </button>
            </ActionBlockerGroup>
          </div>
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
