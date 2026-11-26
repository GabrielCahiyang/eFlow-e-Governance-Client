import { useMemo, useRef, useState, type FormEvent } from "react";
import { AlertCircle, Banknote, RotateCcw, Wallet } from "lucide-react";
import { Modal, ModalButton } from "../../../components/ui/Modal";
import { BoundedTextInput } from "../../../components/ui/BoundedInput";
import { MoneyInput } from "../../../components/ui/MoneyInput";
import { exceedsCentavos } from "../../../shared/currency";
import { INPUT_LIMITS } from "../../../shared/inputLimits";
import { readableUiError } from "../../../shared/userFacingError";
import {
  buildUnifiedFundingOptions,
  fundingOptionKeyForAssignment,
  pickDefaultFundingOption,
  validateCashAssignmentAmount,
  type UnifiedFundingOption,
} from "../selectors/workCashPools";
import { fromCents, toCents } from "../selectors/subtaskDistribution";
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

  const { taskCashOptions, officePettyCashOptions, allOptions } = useMemo(
    () =>
      buildUnifiedFundingOptions(
        { ...context, cashPools: pools },
        targetSubtaskId,
        { includeUnrequestedBudgetCap: false },
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
      { includeUnrequestedBudgetCap: false },
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

  const rawAmount = amount.trim();
  const parsedAmount = rawAmount ? Number(rawAmount) : NaN;
  const amountError = rawAmount
    ? validateCashAssignmentAmount(rawAmount, selectedOption)
    : "";
  const overAvailable = Boolean(
    rawAmount &&
      selectedOption &&
      Number.isFinite(parsedAmount) &&
      exceedsCentavos(parsedAmount, selectedOption.maxForTarget),
  );
  const amountExternalError = overAvailable ? "" : amountError;

  const enteredCents = useMemo(() => {
    if (!rawAmount || !/^\d+(?:\.\d{1,2})?$/.test(rawAmount)) return 0;
    const parsed = Number(rawAmount);
    return Number.isFinite(parsed) && parsed > 0 ? toCents(parsed) : 0;
  }, [rawAmount]);

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
    setSelectedSourceKey(fundingOptionKeyForAssignment(assignment));
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
        reason: "Returned unspent cash back to unassigned pool",
      });
      await onChanged();
      setNotice(
        `Returned ${peso.format(assignment.unspentAmount)} back to ${assignment.sourceLabel}.`,
      );
    } catch (caught) {
      setError(readableUiError(caught, "Could not return unspent cash to the pool.", "write"));
    } finally {
      setRecallingId("");
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || !selectedOption || selectedOption.kind === "budget_cap") return;
    const validationErr = validateCashAssignmentAmount(rawAmount, selectedOption);
    if (validationErr) {
      setError(validationErr);
      return;
    }

    const numericAmount = fromCents(enteredCents);
    if (exceedsCentavos(numericAmount, selectedOption.maxForTarget)) {
      setError(`Amount exceeds the ${peso.format(selectedOption.maxForTarget)} available in ${selectedOption.label}.`);
      return;
    }

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
      await assignWorkCash({
        taskId: context.taskId,
        subtaskId: targetSubtaskId,
        sourceKind: selectedOption.kind,
        sourceRequestId: selectedOption.sourceId,
        allocationLineId: selectedOption.allocationLineId ?? null,
        amount: numericAmount,
        note: note.trim(),
        idempotencyKey: attemptRef.current.key,
      });
      attemptRef.current = undefined;
      await onChanged();
      const targetName = targetSubtaskId
        ? openSubtasks.find((s) => s.id === targetSubtaskId)?.title || "subtask"
        : `${taskTitle} (This task)`;
      setNotice(
        `Assigned ${peso.format(numericAmount)} from ${selectedOption.label} to ${targetName}.`,
      );
      setAmount("");
      setNote("");
    } catch (caught) {
      setError(readableUiError(caught, "Could not save this cash assignment.", "write"));
    } finally {
      setBusy(false);
    }
  };

  const hasAnyPool = allOptions.length > 0;
  const selfTaskLabel = `${taskTitle} (This task)`;
  const targetLabel = targetSubtaskId
    ? openSubtasks.find((s) => s.id === targetSubtaskId)?.title || "Selected subtask"
    : selfTaskLabel;

  return (
    <Modal
      isOpen
      title="Assign money"
      width="max-w-2xl"
      preventClose={busy || Boolean(recallingId)}
      onClose={onClose}
      footer={
        <div className="flex w-full items-center justify-end gap-2">
          <ModalButton disabled={busy || Boolean(recallingId)} onClick={onClose}>
            Close
          </ModalButton>
        </div>
      }
    >
      <div className="min-w-0 space-y-4">
        <div
          aria-label="Available cash pools"
          className="grid grid-cols-1 gap-2.5 sm:grid-cols-2"
        >
          <div className="min-w-0 rounded-xl border border-emerald-200/80 bg-emerald-50/45 p-3">
            <div className="flex items-center gap-1.5 text-[11.5px] font-semibold text-emerald-900">
              <Banknote size={13} aria-hidden="true" />
              <span>Released task cash</span>
            </div>
            {taskCashOptions.length > 0 ? (
              <ul className="mt-2 space-y-1.5">
                {taskCashOptions.map((opt) => {
                  const active = selectedOption?.key === opt.key;
                  return (
                    <li key={opt.key}>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleSourceChange(opt.key)}
                        className={`flex w-full items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-left transition ${
                          active
                            ? "border-emerald-500 bg-white shadow-xs"
                            : "border-emerald-200/70 bg-white/70 hover:bg-white"
                        }`}
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-[12px] font-semibold text-emerald-950">
                            {opt.sourceName || opt.label}
                          </span>
                          <span className="block text-[10.5px] tabular-nums text-emerald-800/85">
                            {opt.requestCode ? `${opt.requestCode} · ` : ""}
                            {peso.format(opt.releasedAmount ?? opt.available)} released
                            {opt.unrequestedAmount !== undefined
                              ? ` · ${peso.format(opt.unrequestedAmount)} unrequested`
                              : ""}
                          </span>
                        </span>
                        <strong className="shrink-0 text-[13px] font-semibold tabular-nums text-emerald-950">
                          {peso.format(opt.available)}
                        </strong>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-2 text-[12px] text-emerald-900/70">
                No released task cash yet.
              </p>
            )}
          </div>

          <div className="min-w-0 rounded-xl border border-indigo-200/80 bg-indigo-50/40 p-3">
            <div className="flex items-center justify-between gap-2 text-[11.5px] font-semibold text-indigo-900">
              <span className="flex items-center gap-1.5">
                <Wallet size={13} aria-hidden="true" />
                <span>Office petty cash</span>
              </span>
              <span className="text-[10.5px] font-normal text-indigo-800/80">
                Separate ₱30k fund
              </span>
            </div>
            {officePettyCashOptions.length > 0 ? (
              <ul className="mt-2 space-y-1.5">
                {officePettyCashOptions.map((opt) => {
                  const active = selectedOption?.key === opt.key;
                  return (
                    <li key={opt.key}>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleSourceChange(opt.key)}
                        className={`flex w-full items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-left transition ${
                          active
                            ? "border-indigo-500 bg-white shadow-xs"
                            : "border-indigo-200/70 bg-white/70 hover:bg-white"
                        }`}
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-[12px] font-semibold text-indigo-950">
                            {opt.sourceName || opt.label}
                          </span>
                          <span className="block text-[10.5px] tabular-nums text-indigo-800/85">
                            of {peso.format(opt.releasedAmount ?? opt.available)} released
                          </span>
                        </span>
                        <strong className="shrink-0 text-[13px] font-semibold tabular-nums text-indigo-950">
                          {peso.format(opt.available)}
                        </strong>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-2 text-[12px] text-indigo-900/70">
                No released office petty cash.
              </p>
            )}
          </div>
        </div>

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
            No released task cash or office petty cash is available to assign.
          </div>
        ) : (
          <form
            noValidate
            onSubmit={handleSubmit}
            className="min-w-0 space-y-3.5 rounded-xl border border-border bg-card p-4"
          >
            <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2">
              <div className="grid min-w-0 gap-1.5 text-[12px] font-medium text-foreground">
                <label htmlFor="assign-money-target">Assign to</label>
                {lockTarget ? (
                  <div className="flex h-9 min-w-0 items-center truncate rounded-lg border border-border bg-muted/40 px-3 text-[12.5px] font-medium text-foreground">
                    <span className="truncate">{targetLabel}</span>
                  </div>
                ) : (
                  <select
                    id="assign-money-target"
                    aria-label="Assign money to"
                    value={targetKey}
                    disabled={busy}
                    onChange={(e) => handleTargetChange(e.target.value)}
                    className="h-9 w-full min-w-0 max-w-full truncate rounded-lg border border-border bg-background px-3 text-[12.5px] text-foreground outline-none focus:border-primary"
                  >
                    <option value={TASK_SELF_VALUE}>{selfTaskLabel}</option>
                    {openSubtasks.length > 0 && (
                      <optgroup label="Subtasks">
                        {openSubtasks.map((sub) => {
                          const assignedHere = pools.assignments
                            .filter((a) => a.status === "active" && a.subtaskId === sub.id)
                            .reduce((s, a) => s + a.amount, 0);
                          return (
                            <option key={sub.id} value={sub.id}>
                              {sub.title}
                              {assignedHere > 0 ? ` · ${peso.format(assignedHere)}` : ""}
                            </option>
                          );
                        })}
                      </optgroup>
                    )}
                  </select>
                )}
              </div>

              <div className="grid min-w-0 gap-1.5 text-[12px] font-medium text-foreground">
                <label htmlFor="assign-money-source">Funding source</label>
                <select
                  id="assign-money-source"
                  aria-label="Funding source"
                  value={selectedOption?.key || ""}
                  disabled={busy}
                  onChange={(e) => handleSourceChange(e.target.value)}
                  className="h-9 w-full min-w-0 max-w-full truncate rounded-lg border border-border bg-background px-3 text-[12.5px] text-foreground outline-none focus:border-primary"
                >
                  {taskCashOptions.length > 0 && (
                    <optgroup label="Task cash">
                      {taskCashOptions.map((opt) => (
                        <option key={opt.key} value={opt.key}>
                          {opt.label} — {peso.format(opt.available)}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {officePettyCashOptions.length > 0 && (
                    <optgroup label="Office petty cash">
                      {officePettyCashOptions.map((opt) => (
                        <option key={opt.key} value={opt.key}>
                          {opt.label} — {peso.format(opt.available)}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-[minmax(0,13.5rem)_minmax(0,1fr)]">
              <div className="grid min-w-0 gap-1.5">
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
                      className="text-[11px] font-medium text-primary hover:underline"
                    >
                      Use max
                    </button>
                  )}
                </div>
                <MoneyInput
                  id="assign-money-amount"
                  required
                  value={amount}
                  min={0}
                  max={INPUT_LIMITS.MONEY_MAX_BUDGET}
                  availableMax={selectedOption?.maxForTarget}
                  showCeilingHint
                  externalError={amountExternalError || undefined}
                  placeholder="0.00"
                  disabled={busy || !selectedOption || selectedOption.maxForTarget <= 0}
                  onValueChange={(raw) => {
                    setAmount(raw);
                    setError("");
                  }}
                  className="h-9 w-full rounded-lg border border-border bg-background px-3 text-[12.5px] tabular-nums"
                />
              </div>

              <div className="grid min-w-0 gap-1.5 text-[12px] font-medium text-foreground">
                <label htmlFor="assign-money-note">Note (optional)</label>
                <BoundedTextInput
                  id="assign-money-note"
                  maxLength={INPUT_LIMITS.TASK_TITLE}
                  disabled={busy}
                  value={note}
                  onChange={(e) => {
                    setNote(e.target.value);
                    setError("");
                  }}
                  placeholder="e.g. Materials and transport"
                  className="h-9 w-full rounded-lg border border-border bg-background px-3 text-[12.5px] text-foreground outline-none focus:border-primary"
                />
              </div>
            </div>

            <div className="flex items-center justify-end pt-0.5">
              <ModalButton
                variant="primary"
                type="submit"
                disabled={
                  busy ||
                  !selectedOption ||
                  !rawAmount ||
                  Boolean(amountError) ||
                  overAvailable
                }
              >
                {busy
                  ? "Saving…"
                  : selectedOption?.existingTargetAmount
                    ? "Update assignment"
                    : "Assign cash"}
              </ModalButton>
            </div>
          </form>
        )}

        <section aria-label="Active cash assignments" className="min-w-0 space-y-2">
          <h4 className="text-[12.5px] font-semibold text-foreground">
            Active assignments ({visibleAssignments.length})
          </h4>

          {!visibleAssignments.length ? (
            <p className="rounded-xl border border-dashed border-border px-3 py-3.5 text-center text-[12px] text-muted-foreground">
              No cash assigned yet.
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
                      <span className="truncate text-[12.5px] font-semibold text-foreground">
                        {assignment.subtaskId
                          ? assignment.subtaskTitle || "Subtask"
                          : selfTaskLabel}
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
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11.5px] tabular-nums text-muted-foreground">
                      <span>Assigned {peso.format(assignment.amount)}</span>
                      <span>·</span>
                      <span>Spent {peso.format(assignment.recordedSpent)}</span>
                      <span>·</span>
                      <span>Left {peso.format(assignment.unspentAmount)}</span>
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
