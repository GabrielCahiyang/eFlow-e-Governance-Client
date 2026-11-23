import { useMemo, useRef, useState, type FormEvent } from "react";
import {
  AlertCircle,
  ArrowRightLeft,
  Banknote,
  RotateCcw,
  Wallet,
} from "lucide-react";
import { Modal, ModalButton } from "../../../components/ui/Modal";
import { MoneyInput } from "../../../components/ui/MoneyInput";
import { readableUiError } from "../../../shared/userFacingError";
import {
  buildUnifiedFundingOptions,
  pickDefaultFundingOption,
  validateCashAssignmentAmount,
  type UnifiedFundingOption,
} from "../selectors/workCashPools";
import { formatCents, fromCents, toCents } from "../selectors/subtaskDistribution";
import { setSubtaskBudgetCap } from "../services/budgetService";
import { assignWorkCash, recallWorkCash } from "../services/workCashAssignmentService";
import type { TaskCashPools, TaskFundingContext, WorkCashAssignment } from "../types";
import { peso } from "./budgetUi";

export interface AssignMoneyModalProps {
  taskTitle: string;
  context: TaskFundingContext;
  pools: TaskCashPools;
  initialTarget?: { kind: "task" } | { kind: "subtask"; subtaskId: string };
  lockTarget?: boolean;
  onChanged: () => Promise<void>;
  onClose: () => void;
}

const TASK_SELF_VALUE = "__task__";

export function AssignMoneyModal({
  taskTitle,
  context,
  pools,
  initialTarget,
  lockTarget = false,
  onChanged,
  onClose,
}: AssignMoneyModalProps) {
  const openSubtasks = useMemo(
    () => (context.subtaskBudgets ?? []).filter((row) => !row.finished),
    [context.subtaskBudgets],
  );

  const initialTargetKey =
    initialTarget?.kind === "subtask" ? initialTarget.subtaskId : TASK_SELF_VALUE;

  const [targetKey, setTargetKey] = useState<string>(initialTargetKey);
  const targetSubtaskId = targetKey === TASK_SELF_VALUE ? null : targetKey;

  const {
    taskCashOptions,
    officePettyCashOptions,
    budgetCapOptions,
    allOptions,
  } = useMemo(
    () =>
      buildUnifiedFundingOptions(
        { ...context, cashPools: pools },
        targetSubtaskId,
        { includeUnrequestedBudgetCap: targetSubtaskId !== null },
      ),
    [context, pools, targetSubtaskId],
  );

  const [selectedSourceKey, setSelectedSourceKey] = useState<string>(() => {
    const first = pickDefaultFundingOption(allOptions);
    return first?.key ?? "";
  });

  const selectedOption: UnifiedFundingOption | undefined = useMemo(() => {
    const exact = allOptions.find((opt) => opt.key === selectedSourceKey);
    return exact ?? pickDefaultFundingOption(allOptions);
  }, [allOptions, selectedSourceKey]);

  const [amount, setAmount] = useState<string>(() => {
    const first = pickDefaultFundingOption(allOptions);
    return first && first.existingTargetAmount > 0
      ? String(first.existingTargetAmount)
      : "";
  });
  const [note, setNote] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [recallingId, setRecallingId] = useState<string>("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const attemptRef = useRef<{ signature: string; key: string } | undefined>(undefined);

  const handleTargetChange = (nextTarget: string) => {
    setTargetKey(nextTarget);
    setError("");
    setNotice("");
    const nextSubtaskId = nextTarget === TASK_SELF_VALUE ? null : nextTarget;
    const nextGroups = buildUnifiedFundingOptions(
      { ...context, cashPools: pools },
      nextSubtaskId,
      { includeUnrequestedBudgetCap: nextSubtaskId !== null },
    );
    const keep = nextGroups.allOptions.find((opt) => opt.key === selectedSourceKey);
    const chosen = keep ?? pickDefaultFundingOption(nextGroups.allOptions);
    setSelectedSourceKey(chosen?.key ?? "");
    setAmount(chosen && chosen.existingTargetAmount > 0 ? String(chosen.existingTargetAmount) : "");
  };

  const handleSourceChange = (nextKey: string) => {
    setSelectedSourceKey(nextKey);
    setError("");
    setNotice("");
    const chosen = allOptions.find((opt) => opt.key === nextKey);
    setAmount(chosen && chosen.existingTargetAmount > 0 ? String(chosen.existingTargetAmount) : "");
  };

  const amountError = amount.trim()
    ? validateCashAssignmentAmount(amount, selectedOption)
    : "";

  const enteredCents = useMemo(() => {
    const trimmed = amount.trim();
    if (!trimmed || !/^\d+(?:\.\d{1,2})?$/.test(trimmed)) return 0;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) && parsed > 0 ? toCents(parsed) : 0;
  }, [amount]);

  const remainingAfterSaveCents = useMemo(() => {
    if (!selectedOption) return 0;
    const maxCents = toCents(selectedOption.maxForTarget);
    return Math.max(0, maxCents - enteredCents);
  }, [selectedOption, enteredCents]);

  const reasonRequired = selectedOption?.kind === "budget_cap";
  const reasonError =
    reasonRequired && !note.trim() ? "Enter a brief reason for this subtask budget allocation." : "";

  const visibleAssignments = useMemo(() => {
    const all = pools.assignments.filter((a) => a.status === "active");
    if (lockTarget && targetSubtaskId) {
      return all.filter((a) => a.subtaskId === targetSubtaskId);
    }
    return all;
  }, [pools.assignments, lockTarget, targetSubtaskId]);

  const handleEditAssignment = (assignment: WorkCashAssignment) => {
    setError("");
    setNotice("");
    const nextTarget = assignment.subtaskId || TASK_SELF_VALUE;
    if (!lockTarget) setTargetKey(nextTarget);
    setSelectedSourceKey(`${assignment.sourceKind}:${assignment.sourceRequestId}`);
    setAmount(String(assignment.amount));
    setNote(assignment.note || "");
  };

  const handleRecall = async (assignment: WorkCashAssignment) => {
    if (busy || recallingId) return;
    setRecallingId(assignment.id);
    setError("");
    setNotice("");
    try {
      await recallWorkCash({
        assignmentId: assignment.id,
        taskId: assignment.taskId,
        subtaskId: assignment.subtaskId,
        reason: "Returned unspent cash back to cash holder's unassigned pool",
      });
      await onChanged();
      setNotice(
        `Returned ${peso.format(assignment.unspentAmount)} back to ${assignment.sourceLabel}'s unassigned pool.`,
      );
    } catch (caught) {
      setError(readableUiError(caught, "Could not return unspent cash to the pool.", "write"));
    } finally {
      setRecallingId("");
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || !selectedOption) return;
    const validationErr = validateCashAssignmentAmount(amount, selectedOption);
    if (validationErr) {
      setError(validationErr);
      return;
    }
    if (reasonRequired && !note.trim()) {
      setError("Enter a brief reason for this subtask budget allocation.");
      return;
    }

    const numericAmount = fromCents(enteredCents);
    const signature = JSON.stringify([
      targetSubtaskId,
      selectedOption.key,
      numericAmount,
      note.trim(),
    ]);
    if (attemptRef.current?.signature !== signature) {
      attemptRef.current = { signature, key: crypto.randomUUID() };
    }

    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (selectedOption.kind === "budget_cap") {
        if (!targetSubtaskId) {
          throw new Error("Choose a subtask for an unrequested budget cap, or use Request cash at the task level.");
        }
        await setSubtaskBudgetCap({
          taskId: context.taskId,
          subtaskId: targetSubtaskId,
          allocationLineId: selectedOption.sourceId,
          amount: numericAmount,
          reason: note.trim(),
          idempotencyKey: attemptRef.current.key,
        });
      } else {
        await assignWorkCash({
          taskId: context.taskId,
          subtaskId: targetSubtaskId,
          sourceKind: selectedOption.kind,
          sourceRequestId: selectedOption.sourceId,
          amount: numericAmount,
          note: note.trim(),
          idempotencyKey: attemptRef.current.key,
        });
      }
      attemptRef.current = undefined;
      await onChanged();
      const targetName = targetSubtaskId
        ? openSubtasks.find((s) => s.id === targetSubtaskId)?.title || "subtask"
        : `this task (${taskTitle})`;
      setNotice(
        selectedOption.kind === "budget_cap"
          ? `Allocated ${peso.format(numericAmount)} budget cap to ${targetName}.`
          : `Assigned ${peso.format(numericAmount)} from ${selectedOption.label} to ${targetName}.`,
      );
      setAmount("");
      setNote("");
    } catch (caught) {
      setError(readableUiError(caught, "Could not save this funding assignment.", "write"));
    } finally {
      setBusy(false);
    }
  };

  const hasAnyPool = allOptions.length > 0;
  const targetLabel = targetSubtaskId
    ? openSubtasks.find((s) => s.id === targetSubtaskId)?.title || "Selected subtask"
    : `This task (${taskTitle})`;

  return (
    <Modal
      isOpen
      title="Assign money"
      description="Distribute released task cash or released office petty cash directly to this task or to any subtask."
      width="max-w-3xl"
      preventClose={busy || Boolean(recallingId)}
      onClose={onClose}
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">
            Receipts from assigned cash roll up automatically into the cash holder’s liquidation.
          </span>
          <ModalButton disabled={busy || Boolean(recallingId)} onClick={onClose}>
            Close
          </ModalButton>
        </div>
      }
    >
      <div className="space-y-4">
        {/* 3-bucket summary strip */}
        <dl
          aria-label="Available funding pools"
          className="grid grid-cols-1 gap-2.5 sm:grid-cols-3"
        >
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 px-3.5 py-2.5">
            <dt className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-900">
              <Banknote size={13} aria-hidden="true" />
              Released task cash on hand
            </dt>
            <dd className="mt-1 text-[16px] font-semibold tabular-nums text-emerald-950">
              {peso.format(pools.totals.cashOnHandUnassigned)}
            </dd>
            <p className="mt-0.5 text-[11px] text-emerald-800/90 tabular-nums">
              unassigned of {peso.format(pools.totals.cashOnHandTask)} released
            </p>
          </div>

          <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 px-3.5 py-2.5">
            <dt className="flex items-center gap-1.5 text-[11px] font-medium text-indigo-900">
              <Wallet size={13} aria-hidden="true" />
              Released office petty cash
            </dt>
            <dd className="mt-1 text-[16px] font-semibold tabular-nums text-indigo-950">
              {peso.format(
                pools.officePettyCashReleases.reduce(
                  (sum, p) => sum + p.unassignedAmount,
                  0,
                ),
              )}
            </dd>
            <p className="mt-0.5 text-[11px] text-indigo-800/90">
              Separate ₱30k fund · does not charge task budget
            </p>
          </div>

          <div className="rounded-xl border border-border bg-muted/35 px-3.5 py-2.5">
            <dt className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
              <ArrowRightLeft size={13} aria-hidden="true" />
              Unrequested task budget
            </dt>
            <dd className="mt-1 text-[16px] font-semibold tabular-nums text-foreground">
              {peso.format(pools.totals.unrequestedBudget)}
            </dd>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Not yet drawn from Accounting
            </p>
          </div>
        </dl>

        {notice && (
          <p
            role="status"
            className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12.5px] font-medium text-emerald-900"
          >
            {notice}
          </p>
        )}

        {error && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-destructive/35 bg-destructive/10 px-3 py-2.5 text-[12.5px] text-destructive"
          >
            <AlertCircle size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        {!hasAnyPool ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-6 text-center text-[13px] text-muted-foreground">
            No released task cash, released office petty cash, or unrequested budget is currently available to assign.
            Request cash from the task budget or open Office Petty Cash first.
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="space-y-3.5 rounded-xl border border-border bg-card p-4"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-[12px] font-medium text-foreground">
                <span>Assign money to</span>
                {lockTarget ? (
                  <div className="flex h-9 items-center rounded-lg border border-border bg-muted/40 px-3 text-[12.5px] font-medium text-foreground">
                    {targetLabel}
                  </div>
                ) : (
                  <select
                    aria-label="Assign money to"
                    value={targetKey}
                    disabled={busy}
                    onChange={(e) => handleTargetChange(e.target.value)}
                    className="h-9 rounded-lg border border-border bg-background px-3 text-[12.5px] text-foreground outline-none focus:border-primary"
                  >
                    <option value={TASK_SELF_VALUE}>
                      This task ({taskTitle}) — direct use, no subtask needed
                    </option>
                    {openSubtasks.length > 0 && (
                      <optgroup label="Existing subtasks">
                        {openSubtasks.map((sub) => {
                          const assignedHere = pools.assignments
                            .filter((a) => a.status === "active" && a.subtaskId === sub.id)
                            .reduce((s, a) => s + a.amount, 0);
                          return (
                            <option key={sub.id} value={sub.id}>
                              Subtask: {sub.title}
                              {assignedHere > 0 ? ` (${peso.format(assignedHere)} cash assigned)` : ""}
                              {sub.capId ? ` · Cap ${peso.format(sub.amount)}` : ""}
                            </option>
                          );
                        })}
                      </optgroup>
                    )}
                  </select>
                )}
              </label>

              <label className="grid gap-1 text-[12px] font-medium text-foreground">
                <span>Funding source</span>
                <select
                  aria-label="Funding source"
                  value={selectedOption?.key || ""}
                  disabled={busy}
                  onChange={(e) => handleSourceChange(e.target.value)}
                  className="h-9 rounded-lg border border-border bg-background px-3 text-[12.5px] text-foreground outline-none focus:border-primary"
                >
                  {taskCashOptions.length > 0 && (
                    <optgroup label="Released task cash (ready to use)">
                      {taskCashOptions.map((opt) => (
                        <option key={opt.key} value={opt.key}>
                          {opt.label} — {peso.format(opt.available)} unassigned
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {officePettyCashOptions.length > 0 && (
                    <optgroup label="Released office petty cash (₱30k fund)">
                      {officePettyCashOptions.map((opt) => (
                        <option key={opt.key} value={opt.key}>
                          {opt.label} — {peso.format(opt.available)} unassigned
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {budgetCapOptions.length > 0 && (
                    <optgroup label="Unrequested task budget (requires cash request & release)">
                      {budgetCapOptions.map((opt) => (
                        <option key={opt.key} value={opt.key}>
                          {opt.label} — {peso.format(opt.available)} available
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </label>
            </div>

            {selectedOption && (
              <p
                className={`rounded-lg border px-3 py-2 text-[11.5px] leading-relaxed ${
                  selectedOption.kind === "office_petty_cash"
                    ? "border-indigo-200 bg-indigo-50/60 text-indigo-950"
                    : selectedOption.kind === "task_cash_release"
                      ? "border-emerald-200 bg-emerald-50/60 text-emerald-950"
                      : "border-amber-200 bg-amber-50/70 text-amber-950"
                }`}
              >
                {selectedOption.kind === "task_cash_release" ? (
                  <>
                    <strong>Cash already on hand:</strong> {selectedOption.subtitle}. No second Accounting cash request
                    is created — receipts logged here roll up straight into this release’s liquidation package.
                  </>
                ) : selectedOption.kind === "office_petty_cash" ? (
                  <>
                    <strong>Separate ₱30,000 Office Petty Cash fund:</strong> {selectedOption.subtitle}. Does not deduct
                    from or inflate this task’s approved project budget. Each receipt must be ₱5,000.00 or less and
                    settles in Office Petty Cash.
                  </>
                ) : (
                  <>
                    <strong>Unrequested task budget cap:</strong> {selectedOption.subtitle}. Setting this cap reserves
                    approved task budget so this subtask can submit its own cash request to Project Lead and Accounting.
                  </>
                )}
              </p>
            )}

            <div className="grid gap-3 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
              <div className="grid gap-1">
                <div className="flex items-center justify-between gap-2 text-[12px] font-medium text-foreground">
                  <label htmlFor="assign-money-amount">Amount (PHP)</label>
                  {selectedOption && selectedOption.maxForTarget > 0 && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setAmount(String(selectedOption.maxForTarget));
                        setError("");
                      }}
                      className="text-[11px] font-medium text-primary underline hover:text-primary/80"
                    >
                      Use max ({peso.format(selectedOption.maxForTarget)})
                    </button>
                  )}
                </div>
                <MoneyInput
                  id="assign-money-amount"
                  required
                  value={amount}
                  min={Math.max(0.01, selectedOption?.minForTarget ?? 0.01)}
                  max={selectedOption?.maxForTarget ?? undefined}
                  disabled={busy || !selectedOption || selectedOption.maxForTarget <= 0}
                  onValueChange={(raw) => {
                    setAmount(raw);
                    setError("");
                  }}
                  className="h-9 w-full rounded-lg border border-border bg-background px-3 text-[12.5px] tabular-nums"
                />
                {amountError ? (
                  <p role="alert" className="text-[11px] text-destructive">
                    {amountError}
                  </p>
                ) : selectedOption ? (
                  <p className="text-[11px] text-muted-foreground tabular-nums">
                    {selectedOption.minForTarget > 0
                      ? `Min ${formatCents(toCents(selectedOption.minForTarget))} · `
                      : ""}
                    Max {formatCents(toCents(selectedOption.maxForTarget))}
                    {enteredCents > 0 && !amountError
                      ? ` · ${formatCents(remainingAfterSaveCents)} left unassigned after save`
                      : ""}
                  </p>
                ) : null}
              </div>

              <label className="grid gap-1 text-[12px] font-medium text-foreground">
                <span>
                  Note / purpose {reasonRequired ? "(required)" : "(optional)"}
                </span>
                <input
                  type="text"
                  maxLength={1000}
                  required={reasonRequired}
                  disabled={busy}
                  value={note}
                  onChange={(e) => {
                    setNote(e.target.value);
                    setError("");
                  }}
                  placeholder={
                    selectedOption?.kind === "budget_cap"
                      ? "Why this subtask needs this budget cap"
                      : "e.g. Materials and transport for this step"
                  }
                  className="h-9 rounded-lg border border-border bg-background px-3 text-[12.5px] text-foreground outline-none focus:border-primary"
                />
                {reasonError && (
                  <span className="text-[11px] text-muted-foreground">{reasonError}</span>
                )}
              </label>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
              <ModalButton
                variant="primary"
                type="submit"
                disabled={
                  busy ||
                  !selectedOption ||
                  !amount.trim() ||
                  Boolean(amountError) ||
                  (reasonRequired && !note.trim())
                }
              >
                {busy
                  ? "Saving…"
                  : selectedOption?.existingTargetAmount
                    ? "Update assignment"
                    : selectedOption?.kind === "budget_cap"
                      ? "Allocate budget cap"
                      : "Assign cash"}
              </ModalButton>
            </div>
          </form>
        )}

        {/* Active assignments list */}
        <section aria-label="Active cash assignments" className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-[12.5px] font-semibold text-foreground">
              Active cash-on-hand assignments ({visibleAssignments.length})
            </h4>
            <span className="text-[11px] text-muted-foreground">
              Unspent subtask cash returns automatically to your pool on subtask completion
            </span>
          </div>

          {!visibleAssignments.length ? (
            <p className="rounded-xl border border-dashed border-border px-3 py-4 text-center text-[12px] text-muted-foreground">
              No cash has been assigned to this {lockTarget ? "subtask" : "task or its subtasks"} yet.
            </p>
          ) : (
            <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
              {visibleAssignments.map((assignment) => (
                <li
                  key={assignment.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[12.5px] font-semibold text-foreground">
                        {assignment.subtaskId
                          ? `Subtask: ${assignment.subtaskTitle || "Subtask"}`
                          : `This task (${taskTitle})`}
                      </span>
                      <span
                        className={`rounded-md px-1.5 py-0.5 text-[10.5px] font-medium ${
                          assignment.sourceKind === "office_petty_cash"
                            ? "bg-indigo-100 text-indigo-800"
                            : "bg-emerald-100 text-emerald-800"
                        }`}
                      >
                        {assignment.sourceLabel}
                      </span>
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11.5px] text-muted-foreground tabular-nums">
                      <span>Assigned {peso.format(assignment.amount)}</span>
                      <span>·</span>
                      <span>Logged receipts {peso.format(assignment.recordedSpent)}</span>
                      <span>·</span>
                      <span>Unspent {peso.format(assignment.unspentAmount)}</span>
                    </div>
                    {assignment.note && (
                      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                        {assignment.note}
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      disabled={busy || Boolean(recallingId)}
                      onClick={() => handleEditAssignment(assignment)}
                      className="rounded-md border border-border bg-background px-2.5 py-1 text-[11.5px] font-medium text-foreground hover:bg-muted disabled:opacity-50"
                    >
                      Adjust
                    </button>
                    {assignment.canRecall && assignment.unspentAmount > 0 && (
                      <button
                        type="button"
                        disabled={busy || Boolean(recallingId)}
                        onClick={() => void handleRecall(assignment)}
                        className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1 text-[11.5px] font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50"
                      >
                        <RotateCcw size={11} aria-hidden="true" />
                        {recallingId === assignment.id ? "Returning…" : "Return unused"}
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Modal>
  );
}
