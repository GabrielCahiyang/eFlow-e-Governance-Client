import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Banknote, Plus, RefreshCw } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../components/ui/Toast';
import { readableUiError } from '../../../shared/userFacingError';
import { formatManilaDateTime } from '../../../shared/calendarDisplay';
import { Modal } from '../../../components/ui/Modal';
import { ActionBlockerGroup, type ActionBlockerItem } from '../../../components/ui/action-blockers';
import { EmptyState } from '../../../components/ui/EmptyState';
import { StatusPill } from '../../../components/ui/workspace/StatusPill';
import { OfficeCashDialog, actionLabels } from './OfficeCashDialog';
import { OfficeCashReturnBadge } from './OfficeCashReturnBadge';
import { computeReturnedAmount, getLiquidationDueStatus } from '../validation/officeCashValidation';
import { commandOfficeCash, loadOfficeCash, openOfficeReceipt } from '../services/officeCash';
import type { OfficeCashCommand, OfficeCashRequest, OfficeCashSnapshot, PettyAction } from '../types';
import '../officePettyCash.css';

const peso = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });
const requestColumns = ['Purpose / requester', 'Amount', 'Status', 'Receipts', 'Actions'];
const statusTone = {
  pending: 'warning',
  approved: 'positive',
  released: 'info',
  receipt_review: 'warning',
  receipt_approved: 'info',
  settled: 'positive',
  rejected: 'negative',
} as const;
const statusLabels: Record<string, string> = {
  pending: 'Pending Head approval',
  approved: 'Pending Accounting release',
  released: 'Cash released',
  receipt_review: 'Receipt review',
  receipt_approved: 'Awaiting Accounting settlement',
  settled: 'Settled',
  rejected: 'Declined',
  cancelled: 'Cancelled',
};
const eventActionLabels: Record<string, string> = {
  initialize: 'Starting fund',
  acknowledge_return: 'Cash return received',
  approve_return: 'Cash return approved',
  return_receipts: 'Receipts returned',
};

const TERMINAL_PETTY_STATUSES = new Set(['settled', 'rejected', 'cancelled']);

function formatCommandToast(command: OfficeCashCommand): string {
  if (
    command.action === 'receipts' &&
    Array.isArray(command.data.receipts) &&
    command.data.receipts.length === 0
  ) {
    return 'Unused cash return submitted — Accounting notified.';
  }
  if (command.action === 'settle' && command.data.returnReference) {
    return 'Cash return confirmed & settled.';
  }
  return `${actionLabels[command.action]} saved.`;
}

function PettyCashRequestsTable({
  requests,
  actor,
  head,
  accountant,
  disabled,
  onStartAction,
  onOpenReceiptError,
}: {
  requests: OfficeCashRequest[];
  actor: string;
  head: boolean;
  accountant: boolean;
  disabled: boolean;
  onStartAction: (action: PettyAction, request: OfficeCashRequest, options?: { returnOnly?: boolean }) => void;
  onOpenReceiptError: (message: string) => void;
}) {
  const button = (
    action: PettyAction,
    r: OfficeCashRequest,
    label = actionLabels[action],
    options?: { returnOnly?: boolean },
  ) => (
    <button
      key={`${action}${options?.returnOnly ? ':return' : ''}`}
      type="button"
      disabled={disabled}
      onClick={() => onStartAction(action, r, options)}
    >
      {label}
    </button>
  );

  return (
    <div className="opc-scroll" role="region" aria-label="Petty cash request records" tabIndex={0}>
      <table>
        <thead>
          <tr>
            {requestColumns.map((label) => (
              <th key={label} scope="col" className={label === 'Amount' ? 'opc-amount' : undefined}>
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {requests.map((r) => {
            const hasReceiptsSubmitted = ['receipt_review', 'receipt_approved', 'settled'].includes(r.status);
            const spent = Number(r.spent ?? 0);
            const returned = computeReturnedAmount(r);
            const assignedAmount = Number(r.assignedAmount ?? 0);
            const hasAssignedWork = assignedAmount > 0;
            const dueStatus = r.status === 'released' ? getLiquidationDueStatus(r.liquidation_due_at) : null;
            const canStandardSettle =
              accountant && actor !== r.requester && r.status === 'receipt_approved' && r.canSettle !== false;
            const canHeadFallbackSettle =
              head && actor !== r.requester && r.status === 'receipt_approved' && r.headCanSettle === true;
            const statusLabel =
              r.status === 'receipt_approved' && spent <= 0 && returned > 0
                ? 'Awaiting return confirmation'
                : statusLabels[r.status] || r.status.replace(/_/g, ' ');

            return (
              <tr key={r.id} id={'office-petty-cash-' + r.id} tabIndex={-1}>
                <td>
                  <strong>{r.purpose}</strong>
                  <small>{r.requesterName}</small>
                </td>
                <td className="opc-amount">
                  <span>{peso.format(r.amount)}</span>
                  {r.status === 'released' && (
                    hasAssignedWork ? (
                      <small className="opc-breakdown">
                        {peso.format(assignedAmount)} assigned to work ·{' '}
                        {peso.format(Math.max(0, r.amount - assignedAmount))} unassigned
                      </small>
                    ) : (
                      <small className="opc-breakdown">
                        Not assigned to any task/subtask — return unused cash
                      </small>
                    )
                  )}
                  {hasReceiptsSubmitted && (
                    <small className="opc-breakdown">
                      Spent {peso.format(spent)} · Returned {peso.format(returned)}
                    </small>
                  )}
                </td>
                <td>
                  <span className="opc-status">
                    <StatusPill
                      label={statusLabel}
                      tone={statusTone[r.status as keyof typeof statusTone]}
                    />
                  </span>
                  {dueStatus && (
                    <small className={dueStatus.isOverdue ? 'opc-overdue' : 'opc-due'}>
                      {dueStatus.label}
                    </small>
                  )}
                  <OfficeCashReturnBadge request={r} />
                </td>
                <td>
                  <div className="opc-row-actions">
                    {r.receipts.map((receipt, i) => (
                      <button
                        key={receipt.path}
                        type="button"
                        onClick={() =>
                          void openOfficeReceipt(receipt.path).catch((reason) =>
                            onOpenReceiptError((reason as Error).message),
                          )
                        }
                      >
                        Receipt {i + 1} · {peso.format(receipt.amount)}
                      </button>
                    ))}
                  </div>
                </td>
                <td>
                  <div className="opc-row-actions">
                    {actor === r.requester && ['pending', 'approved'].includes(r.status) && button('cancel', r)}
                    {head &&
                      actor !== r.requester &&
                      r.status === 'pending' &&
                      (['approve', 'reject'] as PettyAction[]).map((a) => button(a, r))}
                    {accountant && r.status === 'approved' && button('release', r)}
                    {actor === r.requester && r.status === 'released' && (
                      hasAssignedWork ? (
                        <>
                          {button('receipts', r)}
                          {r.receipts.length === 0 && !(r.assignmentReceipts?.length) &&
                            button('receipts', r, 'Return unused cash', { returnOnly: true })}
                        </>
                      ) : (
                        button('receipts', r, 'Return unused cash', { returnOnly: true })
                      )
                    )}
                    {head &&
                      actor !== r.requester &&
                      r.status === 'receipt_review' &&
                      (['endorse', 'return_receipts'] as PettyAction[]).map((a) => button(a, r))}
                    {canStandardSettle &&
                      button('settle', r, returned > 0 ? 'Confirm return & settle' : actionLabels.settle)}
                    {canHeadFallbackSettle &&
                      button(
                        'settle',
                        r,
                        returned > 0 ? 'Confirm return & settle (Head fallback)' : 'Settle petty cash (Head fallback)',
                      )}
                    {r.status === 'receipt_approved' &&
                      !canStandardSettle &&
                      !canHeadFallbackSettle &&
                      (r.settlementBlocked || (accountant && (actor === r.requester || r.canSettle === false))) &&
                      (() => {
                        const settleBlockers: ActionBlockerItem[] = [];
                        if (actor === r.requester) {
                          settleBlockers.push({
                            id: `${r.id}-self-settle`,
                            category: 'separation_of_duties',
                            title: 'Cannot settle your own petty cash request',
                            detail: 'Maker-checker rule: an independent Financial Officer (Accounting) must settle and post your request.',
                            waitingOn: 'Another Financial Officer (Accounting)',
                            statusLabel: 'Separation of duties',
                            amount: r.amount,
                          });
                        } else if (r.settlementBlocked) {
                          settleBlockers.push({
                            id: `${r.id}-indep`,
                            category: 'accounting_approval',
                            title: 'Waiting for independent Financial Officer (Accounting)',
                            detail: r.headNotified
                              ? 'Escalated to the Office Head. An independent Financial Officer (Accounting) or Office Head fallback is required.'
                              : 'No independent Financial Officer (Accounting) is currently eligible to settle this request.',
                            waitingOn: r.headNotified ? 'Office Head / Financial Officer (Accounting)' : 'Financial Officer (Accounting)',
                            statusLabel: r.headNotified ? 'Escalated to Head' : 'Independent Officer needed',
                            amount: r.amount,
                          });
                        } else {
                          settleBlockers.push({
                            id: `${r.id}-acct`,
                            category: 'accounting_approval',
                            title: 'Waiting for Financial Officer (Accounting) settlement',
                            detail: 'An independent Financial Officer (Accounting) must verify receipts and settle this request.',
                            waitingOn: 'Financial Officer (Accounting)',
                            statusLabel: 'Pending Financial Officer',
                            amount: r.amount,
                          });
                        }
                        return (
                          <ActionBlockerGroup
                            actionLabel={returned > 0 ? 'Confirm return & settle' : actionLabels.settle}
                            blockers={settleBlockers}
                            size="sm"
                          >
                            <button type="button" disabled>
                              {returned > 0 ? 'Confirm return & settle' : actionLabels.settle}
                            </button>
                          </ActionBlockerGroup>
                        );
                      })()}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function OfficePettyCash({
  focusRequestId,
  allowRequest = true,
}: {
  focusRequestId?: string;
  allowRequest?: boolean;
} = {}) {
  const { userProfile } = useAuth();
  const office = userProfile?.org_id || '';
  const actor = userProfile?.id || '';
  return (
    <ScopedOfficeCash
      key={`${office}:${actor}`}
      office={office}
      actor={actor}
      role={userProfile?.role || ''}
      focusRequestId={focusRequestId}
      allowRequest={allowRequest}
    />
  );
}

function ScopedOfficeCash({
  office,
  actor,
  role,
  focusRequestId,
  allowRequest,
}: {
  office: string;
  actor: string;
  role: string;
  focusRequestId?: string;
  allowRequest: boolean;
}) {
  const requestsHeading = useId();
  const [snapshot, setSnapshot] = useState<OfficeCashSnapshot | null>(null);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState(false);
  const [edit, setEdit] = useState<{
    action: PettyAction;
    request?: OfficeCashRequest;
    returnOnly?: boolean;
  } | null>(null);
  const { toast } = useToast();
  const storageKey = `eflow.office-petty.pending:${office}:${actor}`;
  const [pending, setPending] = useState<OfficeCashCommand | null>(() => {
    try {
      return JSON.parse(sessionStorage.getItem(storageKey) || 'null');
    } catch {
      return null;
    }
  });
  const active = useRef(true);
  const saving = useRef(false);
  const accountant = role === 'accounting_staff';
  const head = role === 'head';

  const reload = useCallback(async () => {
    try {
      const next = await loadOfficeCash(office);
      if (active.current) {
        setSnapshot(next);
        setError('');
      }
    } catch (reason) {
      if (active.current) {
        setError(readableUiError(reason, 'We couldn’t load Office Petty Cash.', 'read'));
      }
    }
  }, [office]);

  useEffect(() => {
    active.current = true;
    if (office) void reload();
    const update = () => {
      if (!saving.current && document.visibilityState === 'visible') void reload();
    };
    const timer = window.setInterval(update, 30_000);
    window.addEventListener('focus', update);
    document.addEventListener('visibilitychange', update);
    window.addEventListener('eflow:office-petty', update);
    return () => {
      active.current = false;
      window.clearInterval(timer);
      window.removeEventListener('focus', update);
      document.removeEventListener('visibilitychange', update);
      window.removeEventListener('eflow:office-petty', update);
    };
  }, [reload, office]);

  useEffect(() => {
    if (pending && !edit) {
      setEdit({
        action: pending.action,
        request: snapshot?.requests.find((r) => r.id === pending.data.request),
      });
    }
  }, [pending, snapshot, edit]);

  const focused = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!focusRequestId || focused.current === focusRequestId || !snapshot) return;
    const row = document.getElementById('office-petty-cash-' + focusRequestId);
    if (row) {
      focused.current = focusRequestId;
      row.focus();
    }
  }, [focusRequestId, snapshot]);

  async function submit(command: OfficeCashCommand) {
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    setActionError('');
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(command));
      setPending(command);
      await commandOfficeCash(office, command);
      sessionStorage.removeItem(storageKey);
      setPending(null);
      setEdit(null);
      toast(
        formatCommandToast(command),
        ['reject', 'return_receipts'].includes(command.action) ? 'warning' : 'success',
      );
      await reload();
      window.dispatchEvent(new Event('eflow:office-petty'));
    } catch (reason) {
      const problem = reason as Error & { definite?: boolean };
      if (problem.definite) {
        setActionError(
          readableUiError(
            reason,
            'The cash action could not be saved. Check the request before continuing.',
            'read',
          ),
        );
        sessionStorage.removeItem(storageKey);
        setPending(null);
      } else {
        setActionError('Choose Resume cash action to check the same attempt.');
      }
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  const start = (
    action: PettyAction,
    request?: OfficeCashRequest,
    options?: { returnOnly?: boolean },
  ) => {
    setActionError('');
    setEdit({ action, request, returnOnly: options?.returnOnly });
  };

  if (!office) return <p className="opc-error">Active office membership is required.</p>;

  return (
    <section className="opc">
      <header>
        <div>
          <h2>
            <Banknote size={18} />
            Office Petty Cash
          </h2>
          <p>₱30,000 starting fund · ₱5,000 per receipt. Available to your office’s projects and tasks.</p>
        </div>
        {(allowRequest || accountant) && (
          <div className="opc-actions">
            {allowRequest && (
              <button
                type="button"
                className="opc-primary"
                disabled={!snapshot || !!error || busy || !!pending}
                onClick={() => start('request')}
              >
                <Plus size={16} />
                Request petty cash
              </button>
            )}
            {accountant && (
              <button
                type="button"
                disabled={!snapshot || !!error || busy || !!pending || snapshot.replenishable <= 0}
                onClick={() => start('replenish')}
              >
                <RefreshCw size={16} />
                Replenish fund
              </button>
            )}
          </div>
        )}
      </header>

      {error && (
        <div className="opc-error" role="alert">
          {error}
        </div>
      )}

      {!snapshot && !error && (
        <div role="status" aria-live="polite" aria-label="Loading office petty cash…">
          <span className="sr-only">Loading office petty cash…</span>
          <div className="opc-metrics" aria-hidden="true">
            {['Available', 'Pending requests', 'Unsettled cash'].map((label) => (
              <div key={label}>
                <span>{label}</span>
                <strong>
                  <span className="inline-block h-6 w-24 animate-pulse rounded-md bg-neutral-200/80 align-middle" />
                </strong>
              </div>
            ))}
          </div>
          <div className="opc-scroll" aria-hidden="true">
            <table>
              <thead>
                <tr>
                  {requestColumns.map((label) => (
                    <th key={label}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[0, 1, 2].map((row) => (
                  <tr key={row}>
                    <td>
                      <div className="h-3.5 w-44 animate-pulse rounded bg-neutral-200/80" />
                      <div className="mt-1.5 h-2.5 w-28 animate-pulse rounded bg-neutral-100" />
                    </td>
                    <td>
                      <div className="h-3.5 w-20 animate-pulse rounded bg-neutral-200/80" />
                    </td>
                    <td>
                      <div className="h-5 w-20 animate-pulse rounded-full bg-neutral-200/70" />
                    </td>
                    <td>
                      <div className="h-6 w-24 animate-pulse rounded bg-neutral-100" />
                    </td>
                    <td>
                      <div className="h-7 w-20 animate-pulse rounded bg-neutral-100" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {snapshot && (
        <>
          <div className="opc-metrics">
            {[
              ['Available', snapshot.available],
              ['Pending requests', snapshot.reserved],
              ['Unsettled cash', snapshot.outstanding],
            ].map(([label, value]) => (
              <div key={String(label)}>
                <span>{label}</span>
                <strong>{peso.format(Number(value))}</strong>
              </div>
            ))}
          </div>

          {snapshot.available <= 0 && (
            <p className="opc-note" role="status">
              The available petty cash has been used or reserved. Cancel an unused request or ask Accounting to replenish
              settled expenses.
            </p>
          )}

          <section className="opc-records" aria-labelledby={requestsHeading}>
            <h3 id={requestsHeading}>Petty cash requests</h3>
            {!snapshot.requests.length ? (
              <EmptyState size="compact" illustration="budget" title="No office petty cash requests yet." />
            ) : (
              <PettyCashRequestsTable
                requests={snapshot.requests}
                actor={actor}
                head={head}
                accountant={accountant}
                disabled={!!error || busy || !!pending}
                onStartAction={start}
                onOpenReceiptError={setError}
              />
            )}
          </section>

          {accountant && (
            <details>
              <summary>Fund details</summary>
              <p>
                Cash in fund: {peso.format(snapshot.cash)} · Available to replenish:{' '}
                {peso.format(snapshot.replenishable)}
              </p>
              <p>
                Only the Accounting Officer can replenish settled expenses. Replenishment does not clear the history.
              </p>
            </details>
          )}

          {!!snapshot.events.length && (
            <details>
              <summary>History ({snapshot.events.length})</summary>
              <div className="opc-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Recorded</th>
                      <th>Action</th>
                      <th>Amount</th>
                      <th>Reference</th>
                      <th>Officer</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshot.events.map((event) => (
                      <tr key={event.id}>
                        <td>
                          {formatManilaDateTime(event.created_at, '—')}
                        </td>
                        <td>{eventActionLabels[event.action] || event.action.replace(/_/g, ' ')}</td>
                        <td>{peso.format(event.amount)}</td>
                        <td>{event.reference}</td>
                        <td>{event.action === 'initialize' ? 'Automatic setup' : event.actorName}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}
        </>
      )}

      {edit && (
        <OfficeCashDialog
          key={`${edit.action}:${edit.request?.id || ''}:${edit.returnOnly ? 'return' : 'default'}`}
          action={edit.action}
          request={edit.request}
          maximum={edit.action === 'replenish' ? snapshot?.replenishable || 0 : snapshot?.available || 0}
          busy={busy}
          pending={pending}
          error={actionError}
          returnOnly={edit.returnOnly}
          onClose={() => setEdit(null)}
          onSubmit={submit}
        />
      )}
    </section>
  );
}

export function OfficePettyCashInlineRequests({
  officeId,
  onChanged,
  flush = false,
}: {
  officeId?: string;
  onChanged?: () => void | Promise<void>;
  flush?: boolean;
} = {}) {
  const { userProfile } = useAuth();
  const office = userProfile?.org_id || officeId || '';
  const actor = userProfile?.id || '';
  const role = userProfile?.role || '';
  const requestsHeading = useId();
  const [snapshot, setSnapshot] = useState<OfficeCashSnapshot | null>(null);
  const [receiptError, setReceiptError] = useState('');
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState(false);
  const [edit, setEdit] = useState<{
    action: PettyAction;
    request?: OfficeCashRequest;
    returnOnly?: boolean;
  } | null>(null);
  const { toast } = useToast();
  const storageKey = `eflow.office-petty.pending:${office}:${actor}`;
  const [pending, setPending] = useState<OfficeCashCommand | null>(() => {
    if (!office || !actor || typeof sessionStorage === 'undefined') return null;
    try {
      return JSON.parse(sessionStorage.getItem(storageKey) || 'null');
    } catch {
      return null;
    }
  });
  const active = useRef(true);
  const saving = useRef(false);
  const accountant = role === 'accounting_staff';
  const head = role === 'head';

  const reload = useCallback(async () => {
    if (!office) return;
    try {
      const next = await loadOfficeCash(office);
      if (active.current) {
        setSnapshot(next);
        setReceiptError('');
      }
    } catch {
      // Quietly omit inline table when office petty cash snapshot is unavailable.
    }
  }, [office]);

  useEffect(() => {
    active.current = true;
    if (office) void reload();
    const update = () => {
      if (!saving.current && document.visibilityState === 'visible') void reload();
    };
    window.addEventListener('focus', update);
    document.addEventListener('visibilitychange', update);
    window.addEventListener('eflow:office-petty', update);
    return () => {
      active.current = false;
      window.removeEventListener('focus', update);
      document.removeEventListener('visibilitychange', update);
      window.removeEventListener('eflow:office-petty', update);
    };
  }, [reload, office]);

  async function submit(command: OfficeCashCommand) {
    if (saving.current || !office) return;
    saving.current = true;
    setBusy(true);
    setActionError('');
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(command));
      setPending(command);
      await commandOfficeCash(office, command);
      sessionStorage.removeItem(storageKey);
      setPending(null);
      setEdit(null);
      toast(
        formatCommandToast(command),
        ['reject', 'return_receipts'].includes(command.action) ? 'warning' : 'success',
      );
      await reload();
      window.dispatchEvent(new Event('eflow:office-petty'));
      await onChanged?.();
    } catch (reason) {
      const problem = reason as Error & { definite?: boolean };
      if (problem.definite) {
        setActionError(
          readableUiError(
            reason,
            'The cash action could not be saved. Check the request before continuing.',
            'read',
          ),
        );
        sessionStorage.removeItem(storageKey);
        setPending(null);
      } else {
        setActionError('Choose Resume cash action to check the same attempt.');
      }
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  const activeRequests = (snapshot?.requests ?? []).filter(
    (r) => !TERMINAL_PETTY_STATUSES.has(r.status),
  );

  if (!office || (!activeRequests.length && !edit)) return null;

  return (
    <div className={flush ? 'opc opc--inline opc--flush' : 'opc opc--inline'}>
      {receiptError && (
        <div className="opc-error" role="alert">
          {receiptError}
        </div>
      )}
      {activeRequests.length > 0 && (
        <section className="opc-records" aria-labelledby={requestsHeading}>
          <h3 id={requestsHeading}>Petty cash requests</h3>
          <PettyCashRequestsTable
            requests={activeRequests}
            actor={actor}
            head={head}
            accountant={accountant}
            disabled={busy || !!pending}
            onStartAction={(action, request, options) => {
              setActionError('');
              setEdit({ action, request, returnOnly: options?.returnOnly });
            }}
            onOpenReceiptError={setReceiptError}
          />
        </section>
      )}
      {edit && (
        <OfficeCashDialog
          key={`${edit.action}:${edit.request?.id || ''}:${edit.returnOnly ? 'return' : 'default'}`}
          action={edit.action}
          request={edit.request}
          maximum={edit.action === 'replenish' ? snapshot?.replenishable || 0 : snapshot?.available || 0}
          busy={busy}
          pending={pending}
          error={actionError}
          returnOnly={edit.returnOnly}
          onClose={() => setEdit(null)}
          onSubmit={submit}
        />
      )}
    </div>
  );
}

export function OfficePettyCashLauncher({ allowRequest = true }: { allowRequest?: boolean } = {}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="opc-launcher" onClick={() => setOpen(true)}>
        <Banknote size={16} />
        Office petty cash · separate fund
      </button>
      {open && (
        <Modal isOpen title="Office petty cash" width="max-w-6xl" onClose={() => setOpen(false)}>
          <OfficePettyCash allowRequest={allowRequest} />
        </Modal>
      )}
    </>
  );
}
