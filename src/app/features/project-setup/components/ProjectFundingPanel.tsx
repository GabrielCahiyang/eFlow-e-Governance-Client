import { WorkspaceTooltip } from '../../../components/ui/workspace/WorkspaceTooltip';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useNavigationBlocker } from '../../../shared/navigationGuard';
import { AlertCircle, Plus, Wallet, Check, Trash2, Undo2 } from 'lucide-react';
import { BoundedTextarea } from '../../../components/ui/BoundedInput';
import { FieldValidationTooltip } from '../../../components/ui/FieldValidationTooltip';
import { MoneyInput } from '../../../components/ui/MoneyInput';
import { INPUT_LIMITS, textLengthError } from '../../../shared/inputLimits';
import { DecisionModal } from '../../../components/ui/DecisionModal';
import { getPhilippineYear } from '../../../shared/calendarDates';
import { formatManilaDateTime } from '../../../shared/calendarDisplay';
import { formatPeso, sumCentavos, toCentavos } from '../../../shared/currency';
import { projectFlowCall, ProjectFlowError } from '../services/projectFlow';
import { FlowError } from './FlowError';
import { fundingEntryError, fundingErrorMessage, fundingHardError, fundingRowIssues } from '../fundingMessages';
import { readFundingDraft, storeFundingDraft, type FundingDraftRecovery } from '../fundingDraftRecovery';
import type { FundingDraft, ProjectFlow, ProjectFundingSource } from '../types';

type FundingDecision = {
  title: string;
  description: ReactNode;
  label: string;
  decision?: 'approve' | 'reject' | 'changes';
  requireReason?: boolean;
  children?: ReactNode;
  action: (reason: string) => Promise<unknown>;
  success: string;
};

function sortSourcesAlphabetically(list: ProjectFundingSource[]): ProjectFundingSource[] {
  return [...list].sort(
    (a, b) => a.year - b.year || a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true }),
  );
}

function FundingSourceSelect({
  id,
  value,
  sources,
  lines,
  index,
  wizard,
  currentYear,
  error,
  onChange,
  onBlur,
}: {
  id: string;
  value: string;
  sources: ProjectFundingSource[];
  lines: FundingDraft[];
  index: number;
  wizard: boolean;
  currentYear: number;
  error?: string;
  onChange: (partitionId: string) => void;
  onBlur?: () => void;
}) {
  const selectRef = useRef<HTMLSelectElement | null>(null);
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const tooltipId = useId();
  const errorId = useId();
  const showTooltip = Boolean(error) && (focused || hovered);

  return (
    <div className="eflow-bounded-field">
      <select
        id={id}
        ref={selectRef}
        value={sources.some((source) => source.id === value) ? value : ''}
        aria-required="true"
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={[error ? errorId : undefined, showTooltip ? tooltipId : undefined].filter(Boolean).join(' ') || undefined}
        className={error ? 'eflow-field-invalid' : undefined}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          onBlur?.();
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">
          {wizard ? `Select a FY ${currentYear} Office Budget source` : 'Select fiscal year and account'}
        </option>
        {sources.map((source) => (
          <option
            key={source.id}
            value={source.id}
            disabled={lines.some((row, i) => i !== index && row.partitionId === source.id)}
          >
            FY {source.year} · {source.name} · {formatPeso(source.available)} available
          </option>
        ))}
      </select>
      <FieldValidationTooltip id={tooltipId} anchorRef={selectRef} message={error} open={showTooltip} tone="error" />
      {error && (
        <div id={errorId} className="eflow-bounded-meta">
          <span className="eflow-bounded-meta__hint" data-tone="error" role="alert">
            {error}
          </span>
        </div>
      )}
    </div>
  );
}

export function ProjectFundingPanel({
  data,
  reload,
  ensureProject,
  wizard = false,
  allowFundingEntry = true,
  onBusyChange,
  onDraftChange,
  onErrorChange,
  onUncertainChange,
  recoveryKey = '',
}: {
  data: ProjectFlow;
  reload: () => Promise<void>;
  /** Optional lazy project creator used in wizard preview mode before any DB project row exists. */
  ensureProject?: () => Promise<string>;
  wizard?: boolean;
  allowFundingEntry?: boolean;
  onBusyChange?: (busy: boolean) => void;
  onDraftChange?: (dirty: boolean) => void;
  onErrorChange?: (hasError: boolean) => void;
  onUncertainChange?: (uncertain: boolean) => void;
  recoveryKey?: string;
}) {
  const [recovered] = useState(() => readFundingDraft(recoveryKey));
  const [lines, setLines] = useState<FundingDraft[]>(recovered?.lines ?? [{ partitionId: '', amount: 0 }]);
  const [reason, setReason] = useState(recovered?.reason ?? '');
  const [touchedSources, setTouchedSources] = useState<Record<number, boolean>>({});
  const [touchedAmounts, setTouchedAmounts] = useState<Record<number, boolean>>({});
  const [reasonTouched, setReasonTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const attempt = useRef<FundingDraftRecovery['request']>(recovered?.request);
  const [uncertain, setUncertain] = useState(!!recovered?.request);
  const inFlight = useRef(false);
  const [decision, setDecision] = useState<FundingDecision>();
  const [decisionReason, setDecisionReason] = useState('');

  const total = sumCentavos(lines.map((line) => line.amount));
  const currentYear = getPhilippineYear();
  const canConfigure = data.canConfigure === true || data.canAuthorize === true;
  const sources = sortSourcesAlphabetically(
    data.sources.filter((source) => source.available > 0 && (!wizard || source.year === currentYear)),
  );
  const entryAllowed = data.canAllocate && (data.canAuthorize || canConfigure || !wizard);
  const noEligibleAccounting = data.hasEligibleAccountingStaff === false && data.canAuthorize;
  const entryHintId = useId();
  const activeSources = wizard ? sources : data.sources;
  const rowIssues = fundingRowIssues(lines, activeSources);
  const hardError = fundingHardError(lines, activeSources, reason);
  const reasonError = textLengthError(reason, 'Reason / approved authority reference', {
    required: true,
    min: 5,
    max: INPUT_LIMITS.FUNDING_REASON,
  });
  const visibleReasonError = reasonTouched || reason.length > 0 ? reasonError : '';
  const baseEntryIssue = fundingEntryError(lines, activeSources, reason) || reasonError;
  const entryIssue = noEligibleAccounting
    ? 'No active independent Accounting Staff is available in this office to certify funding.'
    : baseEntryIssue;
  const hasBlockingError = Boolean(hardError || noEligibleAccounting);
  const anyVisibleSourceError = lines.some((line, index) =>
    Boolean(rowIssues[index]?.sourceError || (touchedSources[index] && !line.partitionId)),
  );
  const anyVisibleAmountError = lines.some((line, index) =>
    Boolean(
      rowIssues[index]?.amountError ||
        (touchedAmounts[index] && (!Number.isFinite(line.amount) || toCentavos(line.amount) <= 0)),
    ),
  );
  const showEntryHint = Boolean(
    entryIssue &&
      !hardError &&
      !noEligibleAccounting &&
      !(entryIssue === 'Choose a budget source.' && anyVisibleSourceError) &&
      !(entryIssue === 'Enter an amount greater than zero.' && anyVisibleAmountError) &&
      !((entryIssue === 'Add a reason for this funding.' || entryIssue === reasonError) && Boolean(visibleReasonError)),
  );
  const draftDirty = !!reason.trim() || lines.some((line) => !!line.partitionId || line.amount !== 0);
  const [localSaved, setLocalSaved] = useState(false);

  useEffect(() => {
    setLocalSaved(storeFundingDraft(recoveryKey, draftDirty ? { lines, reason, request: attempt.current } : undefined));
  }, [recoveryKey, lines, reason, draftDirty, uncertain]);

  useNavigationBlocker({
    label: 'Unsaved project funding',
    dirty: allowFundingEntry && draftDirty && !localSaved,
    pending: busy || (uncertain && !localSaved),
    onDiscard: () => {
      setLines([{ partitionId: '', amount: 0 }]);
      setReason('');
      setTouchedSources({});
      setTouchedAmounts({});
      setReasonTouched(false);
    },
  });

  useEffect(
    () => () => {
      onBusyChange?.(false);
      onDraftChange?.(false);
      onErrorChange?.(false);
      onUncertainChange?.(false);
    },
    [onBusyChange, onDraftChange, onErrorChange, onUncertainChange],
  );
  useEffect(() => onBusyChange?.(busy), [busy, onBusyChange]);
  useEffect(() => onDraftChange?.(draftDirty), [draftDirty, onDraftChange]);
  useEffect(() => onErrorChange?.(hasBlockingError), [hasBlockingError, onErrorChange]);
  useEffect(() => onUncertainChange?.(uncertain), [uncertain, onUncertainChange]);

  async function run(action: () => Promise<unknown>, success: string) {
    if (inFlight.current) return false;
    inFlight.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await action();
      setNotice(success);
      await reload();
      window.dispatchEvent(new Event('eflow:project-setup'));
      return true;
    } catch (e) {
      setError(fundingErrorMessage(e));
      return false;
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  function confirmDecision(next: FundingDecision) {
    setDecisionReason('');
    setError('');
    setDecision(next);
  }

  const executeSubmitFunding = async () => {
    if (!entryAllowed || !navigator.onLine) {
      throw new Error('Reconnect and verify your project access before saving funding.');
    }
    if (!attempt.current && entryIssue) throw new Error(entryIssue);
    const operation = data.canAuthorize ? 'authorize_project_funding' : 'request_project_funding';
    if (attempt.current && attempt.current.operation !== operation) {
      throw new Error('The original funding authority is required to verify this request.');
    }

    const projectId = data.project.id || (ensureProject ? await ensureProject() : '');
    if (!projectId) throw new Error('Save the project details before submitting funding.');

    attempt.current ??= { id: crypto.randomUUID(), operation };
    storeFundingDraft(recoveryKey, { lines, reason, request: attempt.current });
    try {
      const receipt = await projectFlowCall<{ authorized?: number; requested?: number; status?: string }>(operation, {
        p_project: projectId,
        p_lines: lines,
        p_reason: reason.trim(),
        p_key: attempt.current.id,
      });
      if (wizard && operation === 'authorize_project_funding') {
        const confirmedAmount = Number(receipt?.authorized || 0) + Number(receipt?.requested || 0);
        if (!Number.isFinite(confirmedAmount) || confirmedAmount <= 0) {
          throw new Error('Could not confirm the funding submission. Verify the saved funding request.');
        }
      }
    } catch (e) {
      if (e instanceof ProjectFlowError && !uncertain) {
        attempt.current = undefined;
        storeFundingDraft(recoveryKey, { lines, reason });
      } else {
        setUncertain(true);
      }
      throw e;
    }
    attempt.current = undefined;
    storeFundingDraft(recoveryKey);
    setUncertain(false);
    setLines([{ partitionId: '', amount: 0 }]);
    setReason('');
    setTouchedSources({});
    setTouchedAmounts({});
    setReasonTouched(false);
  };

  const submitSuccessMessage = data.canAuthorize
    ? 'Submitted to Accounting Staff for independent funding certification.'
    : 'Funding request sent to the Office Head for endorsement and Accounting certification.';

  const verifySavedFunding = () => void run(executeSubmitFunding, submitSuccessMessage);

  const promptSubmitFunding = () => {
    if (entryIssue || busy) return;
    const summaryRows = lines.map((line, idx) => {
      const source = activeSources.find((item) => item.id === line.partitionId);
      return (
        <li key={`${line.partitionId}-${idx}`}>
          <span>{source ? `FY ${source.year} · ${source.name}` : 'Selected budget source'}</span>
          <strong>{formatPeso(line.amount)}</strong>
        </li>
      );
    });
    confirmDecision({
      title: data.canAuthorize ? 'Submit funding for Accounting certification?' : 'Submit project funding request?',
      description: data.canAuthorize
        ? 'Independent Accounting Staff must certify fund availability before funds are reserved. You can continue drafting the work plan while certification is pending.'
        : 'This sends your funding request to the Office Head for endorsement and then to independent Accounting Staff for certification.',
      label: data.canAuthorize ? 'Confirm & submit' : 'Confirm & request funding',
      decision: 'approve',
      requireReason: false,
      children: (
        <div className="pf-confirm-summary">
          <ul className="pf-confirm-lines">{summaryRows}</ul>
          <div className="pf-confirm-total">
            <span>Total funding submitted</span>
            <strong>{formatPeso(total)}</strong>
          </div>
          <p className="pf-confirm-reason">
            <strong>Authority / reason:</strong> {reason.trim()}
          </p>
        </div>
      ),
      action: executeSubmitFunding,
      success: submitSuccessMessage,
    });
  };

  const hasPendingAccounting = data.fundingRequests.some((request) => request.status === 'pending_accounting');
  const pendingTotal = sumCentavos(
    data.fundingRequests.map((request) =>
      typeof request.totalAmount === 'number'
        ? request.totalAmount
        : sumCentavos(request.lines.map((item) => Number(item?.amount || 0))),
    ),
  );
  const statusTone = data.project.funding_not_required
    ? 'neutral'
    : data.total > 0
      ? 'positive'
      : data.fundingRequests.length
        ? 'warning'
        : 'attention';
  const statusLabel = data.project.funding_not_required
    ? 'Funding not required'
    : data.total > 0
      ? 'Funding certified'
      : hasPendingAccounting
        ? 'Awaiting Accounting certification'
        : data.fundingRequests.length
          ? 'Awaiting Head endorsement'
          : 'Funding required · not yet certified';

  return (
    <section className="pf-panel" aria-label="Project budget">
      <header>
        <div>
          <h2>
            <Wallet size={20} /> Project budget
          </h2>
          <p>
            Submit funding from named Office Budget sources{wizard ? ` for FY ${currentYear}` : ''}. Independent
            Accounting Staff must certify fund availability before funds are reserved.
          </p>
        </div>
        <span className="pf-status-badge" data-tone={statusTone}>
          {statusLabel}
        </span>
      </header>

      {wizard ? (
        (data.total > 0 || pendingTotal > 0) && (
          <div className="pf-wizard-funding-strip">
            <div>
              <small>Certified budget</small>
              <strong>{formatPeso(data.total)}</strong>
            </div>
            <div>
              <small>Pending certification</small>
              <strong>{formatPeso(pendingTotal)}</strong>
            </div>
            <div>
              <small>FY {currentYear} sources available</small>
              <strong>{sources.length}</strong>
            </div>
          </div>
        )
      ) : (
        <div className="pf-summary">
          {[
            ['Certified budget', data.total],
            ['Allocated to tasks', data.allocated],
            ['Unallocated', data.unallocated],
            ['Cash released', data.released],
            ['Actual spent', data.spent],
            ['Cash returned', data.returned ?? 0],
            ['Outstanding advances', data.outstanding ?? 0],
          ].map(([label, value]) => (
            <div key={String(label)}>
              <small>{label}</small>
              <strong>{formatPeso(Number(value))}</strong>
            </div>
          ))}
        </div>
      )}

      {data.funds.length > 0 && (
        <div className="pf-table-scroll">
          <table>
            <thead>
              <tr>
                <th>Funding source</th>
                <th>Fiscal year</th>
                <th>Certified</th>
                <th>Unallocated</th>
                {!wizard && data.canAuthorize && <th>Closeout</th>}
              </tr>
            </thead>
            <tbody>
              {data.funds.map((source) => (
                <tr key={source.id}>
                  <td>{source.name}</td>
                  <td>FY {source.fiscal_year}</td>
                  <td>{formatPeso(source.amount)}</td>
                  <td>{formatPeso(source.available)}</td>
                  {!wizard && data.canAuthorize && (
                    <td>
                      {(() => {
                        const returnDisabled = busy || toCentavos(source.available) <= 0;
                        const returnTip = busy
                          ? ''
                          : toCentavos(source.available) <= 0
                            ? 'No unallocated funds remain on this source to return to Office Budget.'
                            : `Return up to ${formatPeso(source.available)} of unallocated funds to Office Budget.`;
                        return (
                          <WorkspaceTooltip content={returnTip} disabled={!returnTip}>
                            <span className="inline-flex">
                              <button
                                className="pf-closeout-button"
                                disabled={returnDisabled}
                                onClick={() => {
                                  const requestId = crypto.randomUUID();
                                  confirmDecision({
                                    title: 'Return unused funding to Office Budget',
                                    description:
                                      'Only the unallocated amount is returned to Office Budget. Task allocations and cash records stay recorded. ' +
                                      source.name +
                                      ' · ' +
                                      formatPeso(source.available),
                                    label: 'Return to Office Budget',
                                    decision: 'changes',
                                    requireReason: true,
                                    action: (r) =>
                                      projectFlowCall('release_project_funding', {
                                        p_project: data.project.id,
                                        p_source: source.id,
                                        p_amount: source.available,
                                        p_reason: r,
                                        p_key: requestId,
                                      }),
                                    success: 'Unused funding returned to Office Budget with an audit record.',
                                  });
                                }}
                              >
                                <Undo2 size={14} />
                                Return to Office Budget
                              </button>
                            </span>
                          </WorkspaceTooltip>
                        );
                      })()}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {wizard && !data.canAuthorize && (
        <p className="pf-warning">
          You can request Office Budget funding below (requires Office Head endorsement and Accounting Staff
          certification), or select No funding required above.
        </p>
      )}
      {wizard && data.canAuthorize && !noEligibleAccounting && (
        <p className="pf-warning">
          Anti-corruption check: Head-submitted funding requires independent Accounting Staff certification before funds
          are locked. You can continue drafting the work plan after submitting.
        </p>
      )}
      {noEligibleAccounting && !data.project.funding_not_required && (
        <div className="pf-error pf-funding-error-banner" role="alert">
          <AlertCircle size={18} aria-hidden="true" />
          <div>
            <strong>Independent Accounting Staff required</strong>
            <p>
              No active independent Accounting Staff is available in this office to certify funding. Assign an active
              Accounting Staff account first, or choose <strong>No funding required</strong>.
            </p>
          </div>
        </div>
      )}

      {allowFundingEntry &&
        entryAllowed &&
        !data.project.funding_not_required &&
        !['completed', 'archived'].includes(data.project.status) && (
          <fieldset disabled={busy || uncertain} className="min-w-0 space-y-4">
            <h3>{data.canAuthorize ? 'Submit project funding for Accounting certification' : 'Request project funding'}</h3>
            {!sources.length && (
              <p className="pf-warning">
                {wizard
                  ? `No FY ${currentYear} Office Budget sources with available balances yet. Check the Office Budget balances first.`
                  : 'No funding is available from Office Budget. Check the Office Budget balances first.'}
              </p>
            )}
            {lines.map((line, index) => {
              const sourceList = uncertain
                ? sortSourcesAlphabetically(data.sources.filter((source) => !wizard || source.year === currentYear))
                : sources;
              const selectedSource = sourceList.find((source) => source.id === line.partitionId);
              const rowIssue = rowIssues[index];
              const sourceError =
                rowIssue?.sourceError ||
                (touchedSources[index] && !line.partitionId ? 'Choose a budget source.' : undefined);
              const amountError =
                rowIssue?.amountError ||
                (touchedAmounts[index] && (!Number.isFinite(line.amount) || toCentavos(line.amount) <= 0)
                  ? 'Enter an amount greater than ₱0.00.'
                  : undefined);
              const sourceFieldId = `${entryHintId}-source-${index}`;
              const amountFieldId = `${entryHintId}-amount-${index}`;
              const removeDisabled = lines.length === 1;
              const removeTip = removeDisabled
                ? 'At least one funding source row is required.'
                : `Remove funding row ${index + 1}`;
              return (
                <div key={index} className="pf-funding-row">
                  <div className="pf-field">
                    <label htmlFor={sourceFieldId}>
                      Office Budget source <span className="text-[var(--eflow-negative-text)]" aria-hidden="true">*</span>
                    </label>
                    <FundingSourceSelect
                      id={sourceFieldId}
                      value={line.partitionId}
                      sources={sourceList}
                      lines={lines}
                      index={index}
                      wizard={wizard}
                      currentYear={currentYear}
                      error={sourceError}
                      onBlur={() => setTouchedSources((prev) => ({ ...prev, [index]: true }))}
                      onChange={(partitionId) => {
                        setTouchedSources((prev) => ({ ...prev, [index]: true }));
                        setLines((rows) => rows.map((row, i) => (i === index ? { ...row, partitionId } : row)));
                      }}
                    />
                  </div>
                  <div className="pf-field">
                    <label htmlFor={amountFieldId}>
                      Amount <span className="text-[var(--eflow-negative-text)]" aria-hidden="true">*</span>
                    </label>
                    <MoneyInput
                      id={amountFieldId}
                      min="0"
                      max={INPUT_LIMITS.MONEY_MAX_BUDGET}
                      availableMax={selectedSource?.available}
                      showCeilingHint={Boolean(selectedSource) || Boolean(amountError)}
                      externalError={amountError}
                      step="0.01"
                      value={line.amount || ''}
                      onBlur={() => setTouchedAmounts((prev) => ({ ...prev, [index]: true }))}
                      onValueChange={(value) => {
                        setTouchedAmounts((prev) => ({ ...prev, [index]: true }));
                        setLines((rows) => rows.map((row, i) => (i === index ? { ...row, amount: Number(value) } : row)));
                      }}
                    />
                  </div>
                  <WorkspaceTooltip content={removeTip} disabled={!removeTip}>
                    <span className="inline-flex">
                      <button
                        type="button"
                        className="pf-remove-funding"
                        aria-label={`Remove funding row ${index + 1}`}
                        disabled={removeDisabled}
                        onClick={() => {
                          setLines((rows) => rows.filter((_, i) => i !== index));
                          const shiftMap = (prev: Record<number, boolean>) => {
                            const next: Record<number, boolean> = {};
                            Object.entries(prev).forEach(([k, v]) => {
                              const idx = Number(k);
                              if (idx < index) next[idx] = v;
                              else if (idx > index) next[idx - 1] = v;
                            });
                            return next;
                          };
                          setTouchedSources(shiftMap);
                          setTouchedAmounts(shiftMap);
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </span>
                  </WorkspaceTooltip>
                </div>
              );
            })}
            {hardError && !noEligibleAccounting && (
              <div id={entryHintId} className="pf-error pf-funding-error-banner" role="alert">
                <AlertCircle size={18} aria-hidden="true" />
                <div>
                  <strong>{hardError.title}</strong>
                  <p>{hardError.detail}</p>
                </div>
              </div>
            )}
            {(() => {
              const addDisabled = lines.length >= sources.length;
              const addTip = addDisabled
                ? sources.length === 0
                  ? 'No available Office Budget sources to add.'
                  : 'All available Office Budget sources are already listed.'
                : '';
              return (
                <WorkspaceTooltip content={addTip} disabled={!addTip}>
                  <span className="inline-flex">
                    <button
                      type="button"
                      disabled={addDisabled}
                      onClick={() =>
                        setLines((rows) => (rows.length >= sources.length ? rows : [...rows, { partitionId: '', amount: 0 }]))
                      }
                    >
                      <Plus size={16} />
                      Add funding source
                    </button>
                  </span>
                </WorkspaceTooltip>
              );
            })()}
            <div className="pf-field">
              <label htmlFor={`${entryHintId}-reason`}>
                Reason / approved authority reference <span className="text-[var(--eflow-negative-text)]" aria-hidden="true">*</span>
              </label>
              <BoundedTextarea
                id={`${entryHintId}-reason`}
                value={reason}
                aria-required="true"
                maxLength={INPUT_LIMITS.FUNDING_REASON}
                error={visibleReasonError || undefined}
                placeholder="State the approved work program, resolution, or authority reference (at least 5 characters)."
                onChange={(e) => {
                  setReason(e.target.value);
                  if (!reasonTouched) setReasonTouched(true);
                }}
                onBlur={() => setReasonTouched(true)}
              />
            </div>
            {showEntryHint && (
              <p id={entryHintId} className="pf-entry-hint">
                {entryIssue}
              </p>
            )}
            <div className="pf-actions">
              <strong className="pf-funding-total" data-over={hardError ? 'true' : undefined}>
                Additional funding total: {formatPeso(total)}
              </strong>
              <WorkspaceTooltip content={!busy && entryIssue ? entryIssue : ''} disabled={busy || !entryIssue}>
                <span className="inline-flex">
                  <button
                    type="button"
                    className="pf-primary disabled:cursor-not-allowed"
                    aria-describedby={showEntryHint ? entryHintId : undefined}
                    disabled={!!entryIssue || busy}
                    onClick={promptSubmitFunding}
                  >
                    <Check size={16} />
                    {busy
                      ? 'Saving…'
                      : data.canAuthorize
                        ? 'Submit for Accounting certification'
                        : 'Request funding'}
                  </button>
                </span>
              </WorkspaceTooltip>
            </div>
          </fieldset>
        )}

      {data.fundingRequests.map((request) => {
        const isAccountingStage = request.status === 'pending_accounting';
        const requestTotal =
          typeof request.totalAmount === 'number'
            ? request.totalAmount
            : sumCentavos(request.lines.map((item) => Number(item?.amount || 0)));
        const canEndorse = request.canEndorse ?? (data.canAuthorize && !isAccountingStage);
        const canCertify = request.canCertify === true;
        const canCancel = request.canCancel === true;
        const submittedAt = request.created_at ? formatManilaDateTime(request.created_at, '') : '';
        return (
          <article key={request.id} className="pf-warning">
            <strong>
              {isAccountingStage
                ? 'Head-endorsed · Awaiting Accounting Staff certification'
                : 'Pending Office Head endorsement'}{' '}
              · {formatPeso(requestTotal)}
            </strong>
            <p>{request.reason}</p>
            {(request.actorName || submittedAt) && (
              <p className="text-xs opacity-80">
                {request.actorName ? `Requested by ${request.actorName}` : ''}
                {request.headApprovedByName ? ` · Endorsed by ${request.headApprovedByName}` : ''}
                {submittedAt ? `${request.actorName || request.headApprovedByName ? ' · ' : ''}Submitted ${submittedAt}` : ''}
              </p>
            )}
            <div className="pf-actions">
              {canEndorse && (
                <>
                  <button
                    type="button"
                    disabled={busy}
                    className="pf-primary"
                    onClick={() =>
                      confirmDecision({
                        title: 'Endorse funding request for Accounting?',
                        description: `Endorse ${formatPeso(requestTotal)} and forward it to independent Accounting Staff for fund-availability certification.`,
                        label: 'Endorse for Accounting',
                        decision: 'approve',
                        requireReason: false,
                        action: () =>
                          projectFlowCall('decide_project_funding', {
                            p_request: request.id,
                            p_approve: true,
                            p_reason: 'Endorsed by Office Head for Accounting certification',
                          }),
                        success: 'Endorsed and forwarded to Accounting Staff for certification.',
                      })
                    }
                  >
                    Endorse for Accounting
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      confirmDecision({
                        title: 'Decline funding request',
                        description: request.reason,
                        label: 'Decline funding request',
                        decision: 'changes',
                        requireReason: true,
                        action: (r) =>
                          projectFlowCall('decide_project_funding', {
                            p_request: request.id,
                            p_approve: false,
                            p_reason: r,
                          }),
                        success: 'Funding request declined.',
                      })
                    }
                  >
                    Decline
                  </button>
                </>
              )}
              {canCertify && (
                <>
                  <button
                    type="button"
                    disabled={busy}
                    className="pf-primary"
                    onClick={() =>
                      confirmDecision({
                        title: 'Certify & reserve project funding?',
                        description: `Certifying locks ${formatPeso(requestTotal)} from the Office Budget to this project and records a binding ledger entry.`,
                        label: 'Certify & reserve funds',
                        decision: 'approve',
                        requireReason: false,
                        action: () =>
                          projectFlowCall('certify_project_funding', {
                            p_request: request.id,
                            p_approve: true,
                            p_reason: 'Certified fund availability by Accounting Staff',
                          }),
                        success: 'Project funding certified and reserved.',
                      })
                    }
                  >
                    Certify & reserve funds
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      confirmDecision({
                        title: 'Decline funding certification',
                        description: request.reason,
                        label: 'Decline certification',
                        decision: 'changes',
                        requireReason: true,
                        action: (r) =>
                          projectFlowCall('certify_project_funding', {
                            p_request: request.id,
                            p_approve: false,
                            p_reason: r,
                          }),
                        success: 'Funding certification declined.',
                      })
                    }
                  >
                    Decline
                  </button>
                </>
              )}
              {canCancel && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    confirmDecision({
                      title: 'Withdraw funding request',
                      description: `Withdraw ${formatPeso(requestTotal)} request so you can revise funding or choose No funding required.`,
                      label: 'Withdraw request',
                      decision: 'changes',
                      requireReason: true,
                      action: (r) =>
                        projectFlowCall('cancel_project_funding_request', {
                          p_request: request.id,
                          p_reason: r,
                        }),
                      success: 'Funding request withdrawn.',
                    })
                  }
                >
                  Withdraw request
                </button>
              )}
            </div>
          </article>
        );
      })}

      {!wizard && data.canAllocate && data.taskFunding?.length > 0 && (
        <section>
          <h3>Task allocations</h3>
          {data.taskFunding.map((line) => {
            const returnTaskDisabled = busy || toCentavos(line.available) <= 0;
            const returnTaskTip = busy
              ? ''
              : toCentavos(line.available) <= 0
                ? 'No unused funds remain on this task allocation to return.'
                : `Return ${formatPeso(line.available)} of unused task funds back to the project budget.`;
            return (
              <div key={line.id} className="pf-actions py-2">
                <span>
                  {line.task} · {line.source} · {formatPeso(line.amount)} allocated · {formatPeso(line.available)} unused
                </span>
                <WorkspaceTooltip content={returnTaskTip} disabled={!returnTaskTip}>
                  <span className="inline-flex">
                    <button
                      disabled={returnTaskDisabled}
                      onClick={() => {
                        const requestId = crypto.randomUUID();
                        confirmDecision({
                          title: 'Return unused task funding',
                          description: line.task + ' · ' + formatPeso(line.available),
                          label: 'Return unused funding',
                          decision: 'changes',
                          requireReason: true,
                          action: (r) =>
                            projectFlowCall('release_project_task_funding', {
                              p_line: line.id,
                              p_amount: line.available,
                              p_reason: r,
                              p_key: requestId,
                            }),
                          success: 'Unused task funding returned to the project.',
                        });
                      }}
                    >
                      Return unused to project
                    </button>
                  </span>
                </WorkspaceTooltip>
              </div>
            );
          })}
        </section>
      )}

      {!wizard &&
        data.liquidations
          ?.filter((item) => item.canReview)
          .map((item) => (
            <section key={item.id}>
              <h3>Receipt endorsement · {item.purpose}</h3>
              <p>Declared spent: {formatPeso(item.spent)}. Verify receipts in the cash record before endorsing.</p>
              <div className="pf-actions">
                <button
                  disabled={busy}
                  className="pf-primary"
                  onClick={() =>
                    void run(
                      () =>
                        projectFlowCall('decide_petty_cash_liquidation_leader_review', {
                          p_liquidation_id: item.id,
                          p_approve: true,
                          p_reason: 'Project reviewer endorsed receipt package',
                        }),
                      'Receipt package endorsed for Accounting settlement.',
                    )
                  }
                >
                  Endorse receipts
                </button>
                <button
                  disabled={busy}
                  onClick={() =>
                    confirmDecision({
                      title: 'Request receipt corrections',
                      description: item.purpose,
                      label: 'Request changes',
                      decision: 'changes',
                      requireReason: true,
                      action: (r) =>
                        projectFlowCall('decide_petty_cash_liquidation_leader_review', {
                          p_liquidation_id: item.id,
                          p_approve: false,
                          p_reason: r,
                        }),
                      success: 'Receipt package returned for changes.',
                    })
                  }
                >
                  Request changes
                </button>
              </div>
            </section>
          ))}

      {!wizard && data.requests.length > 0 && (
        <section>
          <h3>Project cash requests</h3>
          {data.requests.map((request) => (
            <article key={request.id} className="border-b py-3">
              <strong>
                {request.purpose} · {formatPeso(request.amount)}
              </strong>
              <p>
                {request.requester} · {request.status.replace(/_/g, ' ')}
              </p>
              {request.canReview && (
                <div className="pf-actions">
                  <button
                    className="pf-primary"
                    disabled={busy}
                    onClick={() =>
                      void run(
                        () =>
                          projectFlowCall('decide_petty_cash_request', {
                            p_request_id: request.id,
                            p_approve: true,
                            p_reason: 'Reviewed by project reviewer',
                          }),
                        'Cash request approved for Accounting release.',
                      )
                    }
                  >
                    Approve cash request
                  </button>
                  <button
                    disabled={busy}
                    onClick={() =>
                      confirmDecision({
                        title: 'Decline cash request',
                        description: request.purpose,
                        label: 'Decline cash request',
                        decision: 'changes',
                        requireReason: true,
                        action: (r) =>
                          projectFlowCall('decide_petty_cash_request', {
                            p_request_id: request.id,
                            p_approve: false,
                            p_reason: r,
                          }),
                        success: 'Cash request declined.',
                      })
                    }
                  >
                    Decline request
                  </button>
                </div>
              )}
            </article>
          ))}
        </section>
      )}

      {uncertain && (
        <button className="pf-primary" disabled={busy || !entryAllowed} onClick={verifySavedFunding}>
          Verify saved funding request
        </button>
      )}

      {decision && (() => {
        const needsReason = decision.requireReason ?? true;
        return (
          <DecisionModal
            title={decision.title}
            description={decision.description}
            decision={decision.decision ?? 'changes'}
            confirmLabel={decision.label}
            requireReason={needsReason}
            minReasonLength={needsReason ? 5 : 0}
            maxReasonLength={INPUT_LIMITS.FUNDING_REASON}
            reason={needsReason ? decisionReason : undefined}
            onReasonChange={needsReason ? setDecisionReason : undefined}
            busy={busy}
            error={error}
            onCancel={() => {
              setDecision(undefined);
              setError('');
            }}
            onConfirm={() =>
              void run(() => decision.action(decisionReason.trim()), decision.success).then((saved) => {
                if (saved) setDecision(undefined);
              })
            }
          >
            {decision.children}
          </DecisionModal>
        );
      })()}

      <FlowError error={decision ? '' : error} />
      {notice && (
        <p role="status" className="pf-success">
          {notice}
        </p>
      )}
    </section>
  );
}
