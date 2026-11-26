import { useId, useRef, useState, type FormEvent } from "react";
import { Plus, WalletCards } from "lucide-react";
import { BoundedTextarea } from "../../../components/ui/BoundedInput";
import { FieldValidationTooltip } from "../../../components/ui/FieldValidationTooltip";
import { Modal, ModalButton } from "../../../components/ui/Modal";
import { MoneyInput } from "../../../components/ui/MoneyInput";
import { ActionBlockerGroup } from "../../../components/ui/action-blockers";
import { WorkspaceTooltip } from "../../../components/ui/workspace/WorkspaceTooltip";
import { exceedsCentavos, formatPeso } from "../../../shared/currency";
import { INPUT_LIMITS, textLengthError } from "../../../shared/inputLimits";
import { readableUiError } from "../../../shared/userFacingError";
import {
  buildDistributionCommand,
  distributionLimits,
  formatCents,
  fromCents,
  parsePesoCents,
  resolveEffectiveSubtaskFunding,
  toCents,
  type SubtaskBudgetActionMode,
} from "../selectors/subtaskDistribution";
import { removeSubtaskBudgetCap, setSubtaskBudgetCap } from "../services/budgetService";
import type { SubtaskBudgetRow, TaskFundingContext, WorkCashAssignment } from "../types";
import { peso } from "./budgetUi";

export interface SubtaskBudgetDraftTrigger {
  id: string;
  mode: SubtaskBudgetActionMode;
}

function resolveDefaultSource(
  item: SubtaskBudgetRow,
  sources: NonNullable<TaskFundingContext["parentSources"]>,
): string {
  return item.sourceId || sources.find((source) => source.available > 0)?.id || "";
}

function buildInitialDraft(
  initialDraft: SubtaskBudgetDraftTrigger | undefined,
  rows: SubtaskBudgetRow[],
  sources: NonNullable<TaskFundingContext["parentSources"]>,
): Draft | undefined {
  if (!initialDraft) return undefined;
  const item = rows.find((entry) => entry.id === initialDraft.id);
  if (!item) return undefined;
  return {
    id: item.id,
    mode: initialDraft.mode,
    source: resolveDefaultSource(item, sources),
    amount: item.amount > 0 ? String(item.amount) : "",
    reason: "",
    expectedCapId: item.capId,
    expectedAmount: item.amount,
  };
}

export function SubtaskBudgetTotals({ context, subtask = false }: { context: TaskFundingContext; subtask?: boolean }) {
  const totals = context.distribution;
  if (!totals) return null;
  const amounts = subtask
    ? [
        ...(context.cap ? [["Subtask budget", context.cap.amount]] as const : []),
        [context.cap ? "Available to request" : "Available from task budget", context.available],
        ["Cash released", totals.released],
        ["Actual spent", totals.spent],
      ] as const
    : [
        ["Approved task budget", context.taskBudget],
        ["Allocated to subtasks", totals.allocated],
        ["Unallocated", totals.unallocated],
        ["Available to allocate", totals.available],
        ["Cash released", totals.released],
        ["Actual spent", totals.spent],
      ] as const;
  return (
    <dl className="grid grid-cols-2 gap-2">
      {amounts.map(([label, value]) => (
        <div key={label} className="min-w-0 rounded-lg border border-border bg-muted/50 px-3 py-2.5">
          <dt className="text-xs text-muted-foreground">{label}</dt>
          <dd className="mt-1 break-words text-sm font-semibold tabular-nums">{peso.format(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Inline subtask budget distribution panel matching mobile's breakdown, progress bar, and subtask allocation list. */
export function SubtaskBudgetDistributionInline({
  context,
  subtaskId,
  canManage,
  taskFinished,
  onOpenRow,
  showTotals = true,
  assignments,
}: {
  context: TaskFundingContext;
  subtaskId?: string;
  canManage: boolean;
  taskFinished: boolean;
  onOpenRow?: (trigger: SubtaskBudgetDraftTrigger) => void;
  showTotals?: boolean;
  assignments?: WorkCashAssignment[];
}) {
  const totals = context.distribution;
  if (!context.funded || !totals) return null;

  const rows = context.subtaskBudgets ?? [];
  const sources = context.parentSources ?? [];
  const focusedRow = subtaskId ? rows.find((item) => item.id === subtaskId) : undefined;
  const effective = resolveEffectiveSubtaskFunding(context, assignments);
  const progress = effective.progressPercent;
  const effectiveAllocated = fromCents(effective.totalAllocatedCents);

  const showProgressHeader =
    !subtaskId && context.taskBudget > 0 && (rows.length > 0 || effective.totalAllocatedCents > 0);

  return (
    <div className={subtaskId ? "space-y-3" : "flex h-full flex-col overflow-hidden rounded-[12px] border border-[var(--eflow-border)] bg-[var(--eflow-surface)] shadow-[0_1px_2px_rgb(12_36_33/4%)]"}>
      {showTotals && (
        <div className={subtaskId ? undefined : "border-b border-border p-3.5"}>
          <SubtaskBudgetTotals context={context} subtask={Boolean(subtaskId)} />
        </div>
      )}

      {subtaskId ? (
        focusedRow && (
          <div className="rounded-xl border border-border bg-muted/25 px-3 py-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-xs font-semibold text-foreground">Allocation details</div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {focusedRow.capId
                    ? `${sources.find((source) => source.id === focusedRow.sourceId)?.name || "Approved account"} · ${peso.format(focusedRow.returnable)} unused`
                    : (effective.bySubtaskId.get(focusedRow.id)?.taskCashCents ?? 0) > 0
                      ? `${effective.bySubtaskId.get(focusedRow.id)?.sourceLabels.join(", ") || "Assigned task cash"} · Spent ${formatCents(effective.bySubtaskId.get(focusedRow.id)?.recordedSpentCents ?? 0)}`
                      : "No separate subtask budget allocated yet."}
                </p>
                {focusedRow.reason && (
                  <p className="mt-1 text-xs text-muted-foreground">Reason: {focusedRow.reason}</p>
                )}
                {focusedRow.blocked && (
                  <p className="mt-1 text-xs text-amber-700">
                    Resolve the open cash request to change this budget.
                  </p>
                )}
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold tabular-nums">
                  {formatCents(effective.bySubtaskId.get(focusedRow.id)?.effectiveTaskCents ?? toCents(focusedRow.amount))}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {focusedRow.capId
                    ? "Allocated cap"
                    : (effective.bySubtaskId.get(focusedRow.id)?.taskCashCents ?? 0) > 0
                      ? "Assigned cash"
                      : "Unallocated"}
                </div>
              </div>
            </div>
          </div>
        )
      ) : (
        <>
          <div className="space-y-2 border-b border-border bg-muted/30 px-4 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-foreground">Subtask allocations</span>
              <span className="rounded-[5px] border border-border bg-background px-2 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground">
                {rows.length} {rows.length === 1 ? "subtask" : "subtasks"}
              </span>
            </div>
            {showProgressHeader && (
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11.5px]">
                  <span className="font-medium text-muted-foreground">Subtask allocation progress</span>
                  <span className="font-medium tabular-nums text-foreground">
                    {progress}% · {peso.format(effectiveAllocated)} of {peso.format(context.taskBudget)}
                  </span>
                </div>
                <div
                  className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted"
                  role="progressbar"
                  aria-label="Subtask allocation progress"
                  aria-valuenow={progress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
                </div>
              </div>
            )}
          </div>
          {rows.length > 0 ? (
            <ul className="flex-1 divide-y divide-border">
              {rows.map((item) => {
                const finished = taskFinished || item.finished;
                const sourceName = sources.find((source) => source.id === item.sourceId)?.name;
                const rowFunding = effective.bySubtaskId.get(item.id);
                const hasAssignedTaskCash = (rowFunding?.taskCashCents ?? 0) > 0;
                const hasAssignedPettyCash = (rowFunding?.pettyCashCents ?? 0) > 0;
                const displayAmount = fromCents(rowFunding?.effectiveTaskCents ?? 0);
                return (
                  <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="break-words text-sm font-medium text-foreground">{item.title}</span>
                        {finished && (
                          <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                            Finished
                          </span>
                        )}
                        {hasAssignedTaskCash && rowFunding?.allApproved && (
                          <span className="rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-900">
                            Approved by Accounting
                          </span>
                        )}
                        {hasAssignedTaskCash && !rowFunding?.allApproved && rowFunding?.hasPendingAccounting && (
                          <span className="rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-900">
                            Pending Accounting
                          </span>
                        )}
                        {item.blocked && (
                          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] text-amber-800">
                            Open cash request
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {item.capId
                          ? `${sourceName || "Approved account"} · ${peso.format(item.returnable)} unused`
                          : hasAssignedTaskCash
                            ? `${rowFunding!.sourceLabels.join(", ") || "Assigned task cash"} · Spent ${formatCents(rowFunding!.recordedSpentCents)}`
                            : hasAssignedPettyCash
                              ? `Funded via Office Petty Cash (${formatCents(rowFunding!.pettyCashCents)})`
                              : "No separate subtask budget"}
                      </p>
                      {item.reason && (
                        <p className="mt-0.5 truncate text-[11px] text-muted-foreground" title={item.reason}>
                          {item.reason}
                        </p>
                      )}
                      {item.blocked && (
                        <p className="mt-0.5 text-[11px] text-amber-700">
                          Resolve the open cash request to change this budget.
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <div className="text-right">
                        <strong className="block text-sm tabular-nums text-foreground">{peso.format(displayAmount)}</strong>
                        {hasAssignedPettyCash && (
                          <span className="block text-[11px] tabular-nums text-indigo-800">
                            + {formatCents(rowFunding!.pettyCashCents)} petty cash
                          </span>
                        )}
                      </div>
                      {canManage && onOpenRow && item.capId && item.returnable > 0 && !item.blocked && (
                        <button
                          type="button"
                          onClick={() => onOpenRow({ id: item.id, mode: "return" })}
                          className="rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted"
                        >
                          Return unused funds
                        </button>
                      )}
                      {canManage && onOpenRow && !finished && !item.blocked && (item.capId || sources.some((source) => source.available > 0)) && (
                        <button
                          type="button"
                          onClick={() => onOpenRow({ id: item.id, mode: "save" })}
                          className="rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted"
                        >
                          {item.capId ? "Adjust budget" : "Set budget"}
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="px-4 py-4 text-center text-xs text-muted-foreground">
              There are no subtasks to fund yet.
            </p>
          )}
        </>
      )}
    </div>
  );
}

interface Draft {
  id: string;
  mode: SubtaskBudgetActionMode;
  source: string;
  amount: string;
  reason: string;
  expectedCapId?: string;
  expectedAmount: number;
}

export function SubtaskBudgetManager({
  context,
  title,
  canManage,
  taskFinished,
  initialDraft,
  readLatestContext,
  onChanged,
  onClose,
}: {
  context: TaskFundingContext;
  title: string;
  canManage: boolean;
  taskFinished: boolean;
  initialDraft?: SubtaskBudgetDraftTrigger;
  readLatestContext?: () => Promise<TaskFundingContext | null>;
  onChanged: () => Promise<void>;
  onClose: () => void;
}) {
  const rows = context.subtaskBudgets ?? [];
  const sources = context.parentSources ?? [];
  const [draft, setDraft] = useState<Draft | undefined>(() =>
    buildInitialDraft(initialDraft, rows, sources),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [touched, setTouched] = useState<{ source?: boolean; amount?: boolean; reason?: boolean }>({});
  const [sourceActive, setSourceActive] = useState(false);
  const sourceRef = useRef<HTMLSelectElement | null>(null);
  const sourceId = useId();
  const sourceTipId = useId();
  const amountId = useId();
  const reasonId = useId();
  const attempt = useRef<{ signature: string; key: string } | undefined>(undefined);
  const row = rows.find((item) => item.id === draft?.id);
  const limits = row && draft
    ? distributionLimits(context, row, draft.source, taskFinished)
    : { minimumCents: 0, maximumCents: 0, sourceLocked: false };
  const floor = fromCents(limits.minimumCents);
  const maximum = fromCents(limits.maximumCents);
  const parsedCents = draft?.amount ? parsePesoCents(draft.amount) : null;
  const sourceError =
    draft?.mode === "save" && !draft.source
      ? "Choose a funding account."
      : "";
  const visibleSourceError = touched.source ? sourceError : "";
  const amountOverMax =
    draft?.mode === "save" && parsedCents !== null && parsedCents > limits.maximumCents;
  const amountError =
    draft?.mode === "save"
      ? !draft.amount.trim()
        ? "Enter a budget amount."
        : parsedCents === null
          ? "Enter a valid amount up to two decimal places."
          : exceedsCentavos(fromCents(parsedCents), INPUT_LIMITS.MONEY_MAX_BUDGET)
            ? `Amount cannot exceed ${formatPeso(INPUT_LIMITS.MONEY_MAX_BUDGET)}.`
            : parsedCents > limits.maximumCents
              ? `This account has only ${formatCents(limits.maximumCents)} for this subtask.`
              : limits.minimumCents > 0 && parsedCents < limits.minimumCents
                ? `Keep at least ${formatCents(limits.minimumCents)} for recorded spending.`
                : ""
      : "";
  const visibleAmountError = touched.amount || amountOverMax ? amountError : "";
  const reasonError = draft
    ? textLengthError(draft.reason, "Reason", {
        required: true,
        min: 5,
        max: INPUT_LIMITS.FUNDING_REASON,
      })
    : "";
  const visibleReasonError =
    touched.reason || Boolean(draft && draft.reason.length > 0) ? reasonError : "";
  const submitBlockers =
    !draft || !row
      ? []
      : [
          !canManage ? "Only the current Task Lead can manage subtask budgets." : "",
          row.blocked ? "Resolve the open cash request to change this budget." : "",
          sourceError,
          amountError,
          reasonError,
        ].filter(Boolean);
  const submitBlockedReason = submitBlockers[0] || "";
  const submitDisabled = busy || !canManage || Boolean(row?.blocked) || Boolean(submitBlockedReason);

  function edit(item: SubtaskBudgetRow, mode: SubtaskBudgetActionMode) {
    setNotice("");
    setError("");
    setTouched({});
    setDraft({
      id: item.id,
      mode,
      source: resolveDefaultSource(item, sources),
      amount: item.amount > 0 ? String(item.amount) : "",
      reason: "",
      expectedCapId: item.capId,
      expectedAmount: item.amount,
    });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!draft || !row || busy || !canManage || row.blocked) return;
    setTouched({ source: true, amount: true, reason: true });
    if (submitBlockedReason) return;
    const signature = JSON.stringify([draft.mode, row.id, draft.expectedCapId, draft.source, draft.amount, draft.reason.trim()]);
    if (attempt.current?.signature !== signature) {
      attempt.current = { signature, key: crypto.randomUUID() };
    }
    setBusy(true);
    setError("");
    try {
      const input = {
        source: draft.source,
        amount: draft.amount,
        reason: draft.reason,
        expectedCapId: draft.expectedCapId,
        expectedAmount: draft.expectedAmount,
      };
      // Validate against local state first so invalid forms never wait on a network verification read.
      let command = buildDistributionCommand(context, row.id, draft.mode, input, attempt.current.key, taskFinished);
      if (readLatestContext) {
        const latest = await readLatestContext();
        if (latest) {
          command = buildDistributionCommand(latest, row.id, draft.mode, input, attempt.current.key, taskFinished);
        }
      }
      if (command.mode === "return") {
        await removeSubtaskBudgetCap({
          capId: command.capId,
          reason: command.reason,
          idempotencyKey: command.idempotencyKey,
        });
      } else {
        await setSubtaskBudgetCap({
          taskId: command.taskId,
          subtaskId: command.subtaskId,
          allocationLineId: command.allocationLineId,
          amount: command.amount,
          reason: command.reason,
          idempotencyKey: command.idempotencyKey,
        });
      }
      attempt.current = undefined;
      setDraft(undefined);
      await onChanged();
      setNotice(command.mode === "return" ? "Unused funding returned to the task." : "Subtask budget saved.");
    } catch (caught) {
      setError(readableUiError(caught, "Could not save this budget change.", "write"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      isOpen
      title="Manage subtask budgets"
      description={title}
      width="max-w-4xl"
      preventClose={busy}
      onClose={onClose}
      footer={<ModalButton disabled={busy} onClick={onClose}>Close</ModalButton>}
    >
      <div className="space-y-4">
        <SubtaskBudgetTotals context={context} />
        <p className="text-sm text-muted-foreground">
          Subtask budgets use the task’s approved funding. Cash requests and releases are handled separately.
        </p>
        {notice && <p role="status" className="rounded-lg bg-primary/10 px-3 py-2 text-sm text-primary">{notice}</p>}
        <ul className="divide-y divide-border rounded-xl border border-border">
          {rows.map((item) => (
            <li key={item.id} className="px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="break-words text-sm font-semibold">{item.title}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.capId
                      ? `${sources.find((source) => source.id === item.sourceId)?.name || "Approved account"} · ${peso.format(item.returnable)} unused`
                      : "Uses parent task budget"}
                  </p>
                  {item.blocked && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Resolve the open cash request to change this budget.
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <strong className="mr-1 text-sm tabular-nums">{peso.format(item.amount)}</strong>
                  {item.capId && item.returnable > 0 && (() => {
                    const returnDisabled = !canManage || busy || item.blocked;
                    const returnBlockers = [
                      !canManage ? "Only the Task Lead can return unused subtask funds." : "",
                      item.blocked ? "Resolve the open cash request before returning unused funds." : "",
                    ];
                    return (
                      <ActionBlockerGroup
                        actionLabel="Return unused"
                        blockers={returnDisabled ? returnBlockers : []}
                        busy={busy}
                        size="sm"
                      >
                        <WorkspaceTooltip
                          content="Returns unused subtask allocation back to the parent task budget."
                          disabled={returnDisabled}
                        >
                          <ModalButton disabled={returnDisabled} onClick={() => edit(item, "return")}>
                            Return unused
                          </ModalButton>
                        </WorkspaceTooltip>
                      </ActionBlockerGroup>
                    );
                  })()}
                  {!(taskFinished || item.finished) && (() => {
                    const editDisabled =
                      !canManage ||
                      busy ||
                      item.blocked ||
                      (!item.capId && !sources.some((source) => source.available > 0));
                    const editBlockers = [
                      !canManage ? "Only the Task Lead can manage subtask budgets." : "",
                      item.blocked ? "Resolve the open cash request to change this budget." : "",
                      !item.capId && !sources.some((source) => source.available > 0)
                        ? "No unallocated parent task funds are available."
                        : "",
                    ];
                    return (
                      <ActionBlockerGroup
                        actionLabel={item.capId ? "Edit budget" : "Allocate"}
                        blockers={editDisabled ? editBlockers : []}
                        busy={busy}
                        size="sm"
                      >
                        <ModalButton disabled={editDisabled} onClick={() => edit(item, "save")}>
                          {item.capId ? "Edit budget" : "Allocate"}
                        </ModalButton>
                      </ActionBlockerGroup>
                    );
                  })()}
                </div>
              </div>
              {row?.id === item.id && draft && (
                <form onSubmit={submit} className="mt-3 space-y-3 rounded-lg border border-border bg-muted/40 p-3">
                  <fieldset disabled={busy || !canManage || row.blocked} className="space-y-3">
                    {draft.mode === "save" ? (
                      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem]">
                        <div className="grid gap-1 text-sm">
                          <label htmlFor={sourceId}>
                            Funding account{" "}
                            <span className="text-[var(--eflow-negative-text)]" aria-hidden="true">
                              *
                            </span>
                          </label>
                          <select
                            ref={sourceRef}
                            id={sourceId}
                            value={draft.source}
                            disabled={limits.sourceLocked}
                            required
                            aria-required="true"
                            aria-invalid={Boolean(visibleSourceError) || undefined}
                            aria-describedby={sourceActive && visibleSourceError ? sourceTipId : undefined}
                            onFocus={() => setSourceActive(true)}
                            onMouseEnter={() => setSourceActive(true)}
                            onMouseLeave={() => setSourceActive(false)}
                            onBlur={() => {
                              setSourceActive(false);
                              setTouched((prev) => ({ ...prev, source: true }));
                            }}
                            onChange={(event) => {
                              setTouched((prev) => ({ ...prev, source: true }));
                              setDraft({ ...draft, source: event.target.value });
                              setError("");
                            }}
                            className={`min-w-0 rounded-md border bg-background px-3 py-2 ${
                              visibleSourceError ? "eflow-field-invalid border-destructive" : "border-border"
                            }`}
                          >
                            <option value="">Choose an account</option>
                            {sources
                              .filter((source) => source.available > 0 || source.id === row.sourceId)
                              .map((source) => (
                                <option key={source.id} value={source.id}>
                                  {source.name} · {peso.format(source.available)} free
                                </option>
                              ))}
                          </select>
                          <FieldValidationTooltip
                            id={sourceTipId}
                            anchorRef={sourceRef}
                            message={visibleSourceError}
                            open={sourceActive && Boolean(visibleSourceError)}
                            tone="error"
                          />
                          {visibleSourceError && (
                            <small role="alert" className="text-destructive">
                              {visibleSourceError}
                            </small>
                          )}
                          {limits.sourceLocked && (
                            <small className="text-muted-foreground">
                              Account locked because this subtask already has cash history or finished work.
                            </small>
                          )}
                        </div>
                        <div className="grid gap-1 text-sm">
                          <label htmlFor={amountId}>
                            New budget{" "}
                            <span className="text-[var(--eflow-negative-text)]" aria-hidden="true">
                              *
                            </span>
                          </label>
                          <MoneyInput
                            id={amountId}
                            required
                            aria-required="true"
                            value={draft.amount}
                            min={Math.max(0.01, floor)}
                            max={INPUT_LIMITS.MONEY_MAX_BUDGET}
                            availableMax={maximum}
                            showCeilingHint
                            externalError={visibleAmountError || undefined}
                            onBlur={() => setTouched((prev) => ({ ...prev, amount: true }))}
                            onValueChange={(raw) => {
                              setTouched((prev) => ({ ...prev, amount: true }));
                              setDraft({ ...draft, amount: raw });
                              setError("");
                            }}
                            className="min-w-0 rounded-md border border-border bg-background px-3 py-2"
                          />
                          {!visibleAmountError && limits.minimumCents > 0 && (
                            <small className="text-muted-foreground">
                              Min {formatCents(limits.minimumCents)}
                            </small>
                          )}
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm">
                        Return {peso.format(item.returnable)} to the parent task’s available budget.
                      </p>
                    )}
                    <div className="grid gap-1 text-sm">
                      <label htmlFor={reasonId}>
                        Reason{" "}
                        <span className="text-[var(--eflow-negative-text)]" aria-hidden="true">
                          *
                        </span>
                      </label>
                      <BoundedTextarea
                        id={reasonId}
                        aria-required="true"
                        value={draft.reason}
                        maxLength={INPUT_LIMITS.FUNDING_REASON}
                        rows={2}
                        error={visibleReasonError || undefined}
                        placeholder="Explain why this subtask budget is being set or returned (at least 5 characters)"
                        onBlur={() => setTouched((prev) => ({ ...prev, reason: true }))}
                        onChange={(event) => {
                          setTouched((prev) => ({ ...prev, reason: true }));
                          setDraft({ ...draft, reason: event.target.value });
                        }}
                        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                      />
                    </div>
                  </fieldset>
                  <div className="flex justify-end gap-2">
                    <ModalButton
                      disabled={busy}
                      onClick={() => {
                        setDraft(undefined);
                        setTouched({});
                        setError("");
                      }}
                    >
                      Cancel
                    </ModalButton>
                    <ActionBlockerGroup
                      actionLabel={draft.mode === "return" ? "Confirm return" : "Save budget"}
                      blockers={submitDisabled ? submitBlockers : []}
                      busy={busy}
                      size="md"
                    >
                      <WorkspaceTooltip
                        content="Returns unused subtask allocation back to the parent task budget."
                        disabled={submitDisabled || draft.mode !== "return"}
                      >
                        <ModalButton variant="primary" type="submit" disabled={submitDisabled}>
                          {busy ? "Saving…" : draft.mode === "return" ? "Confirm return" : "Save budget"}
                        </ModalButton>
                      </WorkspaceTooltip>
                    </ActionBlockerGroup>
                  </div>
                </form>
              )}
            </li>
          ))}
          {!rows.length && (
            <li className="px-4 py-6 text-center text-sm text-muted-foreground">
              There are no subtasks to fund yet.
            </li>
          )}
        </ul>
        {error && (
          <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}

export function SubtaskBudgetButton({ hasAllocation, subtask, secondary = false, onClick }: { hasAllocation: boolean; subtask: boolean; secondary?: boolean; onClick: () => void }) {
  const Icon = subtask && !hasAllocation ? Plus : WalletCards;
  return (
    <button
      type="button"
      className={
        secondary
          ? "inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-[12.5px] font-medium text-foreground transition hover:bg-muted"
          : "inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
      }
      onClick={onClick}
    >
      <Icon size={15} aria-hidden="true" />
      {subtask ? (hasAllocation ? "Manage budget" : "Allocate budget") : "Manage subtask budgets"}
    </button>
  );
}
