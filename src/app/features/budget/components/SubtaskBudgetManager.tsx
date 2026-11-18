import { readableUiError } from "../../../shared/userFacingError";
import { useRef, useState, type FormEvent } from "react";
import { Plus, WalletCards } from "lucide-react";
import { Modal, ModalButton } from "../../../components/ui/Modal";
import { MoneyInput } from "../../../components/ui/MoneyInput";
import {
  buildDistributionCommand,
  distributionLimits,
  formatCents,
  fromCents,
  parsePesoCents,
  subtaskAllocationProgressPercent,
  type SubtaskBudgetActionMode,
} from "../selectors/subtaskDistribution";
import { removeSubtaskBudgetCap, setSubtaskBudgetCap } from "../services/budgetService";
import type { SubtaskBudgetRow, TaskFundingContext } from "../types";
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
}: {
  context: TaskFundingContext;
  subtaskId?: string;
  canManage: boolean;
  taskFinished: boolean;
  onOpenRow?: (trigger: SubtaskBudgetDraftTrigger) => void;
}) {
  const totals = context.distribution;
  if (!context.funded || !totals) return null;

  const rows = context.subtaskBudgets ?? [];
  const sources = context.parentSources ?? [];
  const focusedRow = subtaskId ? rows.find((item) => item.id === subtaskId) : undefined;
  const progress = subtaskAllocationProgressPercent(context);

  return (
    <div className="mt-3 space-y-3">
      {!subtaskId && context.taskBudget > 0 && (
        <div className="rounded-lg border border-border bg-muted/35 px-3 py-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-medium text-foreground">Subtask allocation progress</span>
            <span className="tabular-nums text-muted-foreground">
              {progress}% · {peso.format(totals.allocated)} of {peso.format(context.taskBudget)}
            </span>
          </div>
          <div
            className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted"
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

      <SubtaskBudgetTotals context={context} subtask={Boolean(subtaskId)} />

      {subtaskId ? (
        focusedRow && (
          <div className="rounded-xl border border-border bg-muted/25 px-3 py-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-xs font-semibold text-foreground">Allocation details</div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {focusedRow.capId
                    ? `${sources.find((source) => source.id === focusedRow.sourceId)?.name || "Approved account"} · ${peso.format(focusedRow.returnable)} unused`
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
                <div className="text-sm font-semibold tabular-nums">{peso.format(focusedRow.amount)}</div>
                <div className="text-[11px] text-muted-foreground">
                  {focusedRow.capId ? "Allocated cap" : "Unallocated"}
                </div>
              </div>
            </div>
          </div>
        )
      ) : (
        <div className="rounded-xl border border-border">
          <div className="flex items-center justify-between border-b border-border bg-muted/35 px-3 py-2">
            <span className="text-xs font-semibold text-foreground">Subtask allocations</span>
            <span className="text-xs text-muted-foreground">
              {rows.length} {rows.length === 1 ? "subtask" : "subtasks"}
            </span>
          </div>
          {rows.length > 0 ? (
            <ul className="divide-y divide-border">
              {rows.map((item) => {
                const finished = taskFinished || item.finished;
                const sourceName = sources.find((source) => source.id === item.sourceId)?.name;
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
                        {item.blocked && (
                          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] text-amber-800">
                            Open cash request
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {item.capId
                          ? `${sourceName || "Approved account"} · ${peso.format(item.returnable)} unused`
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
                      <strong className="text-sm tabular-nums text-foreground">{peso.format(item.amount)}</strong>
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
            <p className="px-3 py-4 text-center text-xs text-muted-foreground">
              There are no subtasks to fund yet.
            </p>
          )}
        </div>
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
  const attempt = useRef<{ signature: string; key: string } | undefined>(undefined);
  const row = rows.find((item) => item.id === draft?.id);
  const limits = row && draft
    ? distributionLimits(context, row, draft.source, taskFinished)
    : { minimumCents: 0, maximumCents: 0, sourceLocked: false };
  const floor = fromCents(limits.minimumCents);
  const maximum = fromCents(limits.maximumCents);
  const parsedCents = draft?.amount ? parsePesoCents(draft.amount) : null;
  const amountError = draft?.mode === "save" && draft.amount
    ? parsedCents === null
      ? "Enter a valid amount up to two decimal places."
      : parsedCents > limits.maximumCents
        ? `This account has only ${formatCents(limits.maximumCents)} for this subtask.`
        : limits.minimumCents > 0 && parsedCents < limits.minimumCents
          ? `Keep at least ${formatCents(limits.minimumCents)} for recorded spending.`
          : ""
    : "";

  function edit(item: SubtaskBudgetRow, mode: SubtaskBudgetActionMode) {
    setNotice("");
    setError("");
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
                  {item.capId && item.returnable > 0 && (
                    <ModalButton disabled={!canManage || busy || item.blocked} onClick={() => edit(item, "return")}>
                      Return unused
                    </ModalButton>
                  )}
                  {!(taskFinished || item.finished) && (
                    <ModalButton
                      disabled={!canManage || busy || item.blocked || (!item.capId && !sources.some((source) => source.available > 0))}
                      onClick={() => edit(item, "save")}
                    >
                      {item.capId ? "Edit budget" : "Allocate"}
                    </ModalButton>
                  )}
                </div>
              </div>
              {row?.id === item.id && draft && (
                <form onSubmit={submit} className="mt-3 space-y-3 rounded-lg border border-border bg-muted/40 p-3">
                  <fieldset disabled={busy || !canManage || row.blocked} className="space-y-3">
                    {draft.mode === "save" ? (
                      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem]">
                        <label className="grid gap-1 text-sm">
                          Funding account
                          <select
                            value={draft.source}
                            disabled={limits.sourceLocked}
                            required
                            onChange={(event) => {
                              setDraft({ ...draft, source: event.target.value });
                              setError("");
                            }}
                            className="min-w-0 rounded-md border border-border bg-background px-3 py-2"
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
                          {limits.sourceLocked && (
                            <small className="text-muted-foreground">
                              Account locked because this subtask already has cash history or finished work.
                            </small>
                          )}
                        </label>
                        <label className="grid gap-1 text-sm">
                          New budget
                          <MoneyInput
                            required
                            value={draft.amount}
                            min={Math.max(0.01, floor)}
                            max={maximum}
                            onValueChange={(raw) => {
                              setDraft({ ...draft, amount: raw });
                              setError("");
                            }}
                            className="min-w-0 rounded-md border border-border bg-background px-3 py-2"
                          />
                          <small className={amountError ? "text-destructive" : "text-muted-foreground"}>
                            {amountError ||
                              (limits.minimumCents > 0
                                ? `Min ${formatCents(limits.minimumCents)} · Max ${formatCents(limits.maximumCents)}`
                                : `Maximum ${formatCents(limits.maximumCents)}`)}
                          </small>
                        </label>
                      </div>
                    ) : (
                      <p className="text-sm">
                        Return {peso.format(item.returnable)} to the parent task’s available budget.
                      </p>
                    )}
                    <label className="grid gap-1 text-sm">
                      Reason
                      <input
                        value={draft.reason}
                        required
                        maxLength={3000}
                        onChange={(event) => setDraft({ ...draft, reason: event.target.value })}
                        className="rounded-md border border-border bg-background px-3 py-2"
                      />
                    </label>
                    <div className="flex justify-end gap-2">
                      <ModalButton
                        onClick={() => {
                          setDraft(undefined);
                          setError("");
                        }}
                      >
                        Cancel
                      </ModalButton>
                      <ModalButton variant="primary" type="submit">
                        {busy ? "Saving…" : draft.mode === "return" ? "Confirm return" : "Save budget"}
                      </ModalButton>
                    </div>
                  </fieldset>
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

export function SubtaskBudgetButton({ hasAllocation, subtask, onClick }: { hasAllocation: boolean; subtask: boolean; onClick: () => void }) {
  const Icon = subtask && !hasAllocation ? Plus : WalletCards;
  return (
    <button
      type="button"
      className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
      onClick={onClick}
    >
      <Icon size={15} aria-hidden="true" />
      {subtask ? (hasAllocation ? "Manage budget" : "Allocate budget") : "Manage subtask budgets"}
    </button>
  );
}
