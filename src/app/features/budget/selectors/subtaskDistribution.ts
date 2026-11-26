import type { SubtaskBudgetRow, TaskFundingContext, WorkCashAssignment } from "../types";

export type SubtaskBudgetActionMode = "save" | "return";

export interface SubtaskDistributionInput {
  source: string;
  amount: string;
  reason: string;
  expectedCapId?: string;
  expectedAmount?: number;
}

export interface SubtaskDistributionLimits {
  /** Minimum budget in integer cents needed to cover recorded/pending cash requests. */
  minimumCents: number;
  /** Maximum budget in integer cents allowed for the selected parent account. */
  maximumCents: number;
  /** Whether the funding account is locked because cash history or completion exists. */
  sourceLocked: boolean;
}

export type SubtaskDistributionCommand =
  | {
      mode: "save";
      taskId: string;
      subtaskId: string;
      allocationLineId: string;
      amount: number;
      reason: string;
      idempotencyKey: string;
    }
  | {
      mode: "return";
      capId: string;
      reason: string;
      idempotencyKey: string;
    };

const MAX_PESOS = 100_000_000_000_000;
const peso = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Convert a peso amount to integer cents without binary floating-point drift. */
export function toCents(amount: number): number {
  if (!Number.isFinite(amount)) return 0;
  return Math.round((amount + Number.EPSILON) * 100);
}

/** Convert integer cents back to a two-decimal peso number. */
export function fromCents(value: number): number {
  return Math.round(value) / 100;
}

/** Format an integer-cent value as Philippine pesos. */
export function formatCents(value: number): string {
  return peso.format(fromCents(value));
}

/** Parse a user-entered peso string into positive integer cents, or null when invalid. */
export function parsePesoCents(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(trimmed)) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed >= MAX_PESOS) return null;
  const value = toCents(parsed);
  return value > 0 ? value : null;
}

export interface EffectiveSubtaskFunding {
  taskCashCents: number;
  pettyCashCents: number;
  recordedSpentCents: number;
  effectiveTaskCents: number;
  sourceLabels: string[];
  allApproved: boolean;
  hasPendingAccounting: boolean;
}

/** Combine pre-release subtask budget caps with active cash-on-hand assignments (centavo-safe, no double counting). */
export function resolveEffectiveSubtaskFunding(
  context: TaskFundingContext,
  assignmentsOverride?: WorkCashAssignment[],
): {
  bySubtaskId: Map<string, EffectiveSubtaskFunding>;
  totalAllocatedCents: number;
  progressPercent: number;
} {
  const assignments = (assignmentsOverride ?? context.cashPools?.assignments ?? []).filter(
    (a) => a.status === "active" && Boolean(a.subtaskId),
  );
  const bySubtaskId = new Map<string, EffectiveSubtaskFunding>();

  for (const a of assignments) {
    const id = a.subtaskId!;
    const prev = bySubtaskId.get(id) ?? {
      taskCashCents: 0,
      pettyCashCents: 0,
      recordedSpentCents: 0,
      effectiveTaskCents: 0,
      sourceLabels: [],
      allApproved: true,
      hasPendingAccounting: false,
    };
    const amtCents = Math.max(0, toCents(a.amount));
    const spentCents = Math.max(0, toCents(a.recordedSpent));
    if (a.sourceKind === "office_petty_cash") {
      prev.pettyCashCents += amtCents;
    } else {
      prev.taskCashCents += amtCents;
    }
    prev.recordedSpentCents += spentCents;
    if (a.sourceLabel && !prev.sourceLabels.includes(a.sourceLabel)) {
      prev.sourceLabels.push(a.sourceLabel);
    }
    if (a.receiptReviewStatus !== "approved") {
      prev.allApproved = false;
    }
    if (a.receiptReviewStatus === "pending_accounting") {
      prev.hasPendingAccounting = true;
    }
    bySubtaskId.set(id, prev);
  }

  const rows = context.subtaskBudgets ?? [];
  let rowSumCents = 0;
  const accountedIds = new Set<string>();
  for (const row of rows) {
    accountedIds.add(row.id);
    const entry = bySubtaskId.get(row.id);
    const capCents = Math.max(0, toCents(row.amount));
    const taskCashCents = entry?.taskCashCents ?? 0;
    const effectiveTaskCents = Math.max(capCents, taskCashCents);
    if (entry) {
      entry.effectiveTaskCents = effectiveTaskCents;
    } else {
      bySubtaskId.set(row.id, {
        taskCashCents: 0,
        pettyCashCents: 0,
        recordedSpentCents: 0,
        effectiveTaskCents,
        sourceLabels: [],
        allApproved: false,
        hasPendingAccounting: false,
      });
    }
    rowSumCents += effectiveTaskCents;
  }

  for (const [id, entry] of bySubtaskId.entries()) {
    if (!accountedIds.has(id)) {
      entry.effectiveTaskCents = entry.taskCashCents;
      rowSumCents += entry.taskCashCents;
    }
  }

  const totalAllocatedCents = Math.max(
    Math.max(0, toCents(context.distribution?.allocated ?? 0)),
    rowSumCents,
  );
  const taskBudgetCents = toCents(context.taskBudget);
  const progressPercent =
    taskBudgetCents <= 0 || totalAllocatedCents <= 0
      ? 0
      : Math.min(100, Math.round((totalAllocatedCents / taskBudgetCents) * 100));

  return { bySubtaskId, totalAllocatedCents, progressPercent };
}

/** Compute allocation percentage (0-100) of the parent task budget distributed to subtasks. */
export function subtaskAllocationProgressPercent(
  context: TaskFundingContext,
  assignmentsOverride?: WorkCashAssignment[],
): number {
  return resolveEffectiveSubtaskFunding(context, assignmentsOverride).progressPercent;
}

/** Compute minimum/maximum cent bounds and account-lock state for a subtask budget row. */
export function distributionLimits(
  context: TaskFundingContext,
  row: SubtaskBudgetRow,
  sourceId: string,
  taskFinished = false,
): SubtaskDistributionLimits {
  const amountCents = Math.max(0, toCents(row.amount));
  const returnableCents = Math.max(0, Math.min(amountCents, toCents(row.returnable)));
  const minimumCents = Math.max(0, amountCents - returnableCents);
  const finished = taskFinished || row.finished;
  const source = (context.parentSources ?? []).find((item) => item.id === sourceId);
  const sourceAvailableCents = Math.max(0, toCents(source?.available ?? 0));
  const creditExistingCents = row.sourceId === sourceId ? amountCents : 0;
  const maximumCents = finished
    ? amountCents
    : source
      ? sourceAvailableCents + creditExistingCents
      : 0;
  const sourceLocked = Boolean(row.capId && (row.hasHistory || finished));
  return { minimumCents, maximumCents, sourceLocked };
}

/** Validate a subtask budget change against fresh funding context and build its RPC command. */
export function buildDistributionCommand(
  context: TaskFundingContext,
  subtaskId: string,
  mode: SubtaskBudgetActionMode,
  input: SubtaskDistributionInput,
  idempotencyKey: string,
  taskFinished = false,
): SubtaskDistributionCommand {
  if (!context.canManageDistribution) {
    throw new Error("Only the current Task Lead can manage this subtask budget.");
  }
  const row = (context.subtaskBudgets ?? []).find((item) => item.id === subtaskId);
  if (!row) {
    throw new Error("This subtask could not be found in the current task funding context.");
  }
  if ((row.capId ?? undefined) !== (input.expectedCapId ?? undefined)) {
    throw new Error("This allocation changed before your update was sent. Review the current balance and try again.");
  }
  if (
    input.expectedAmount !== undefined &&
    toCents(row.amount) !== toCents(input.expectedAmount)
  ) {
    throw new Error("This allocation changed before your update was sent. Review the current balance and try again.");
  }
  if (row.blocked) {
    throw new Error("Resolve the open cash request to change this budget.");
  }
  const reason = input.reason.trim();
  if (!reason) {
    throw new Error("Enter a reason for this budget change.");
  }
  if (reason.length > 3000) {
    throw new Error("Keep the budget reason within 3,000 characters.");
  }

  if (mode === "return") {
    if (!row.capId || toCents(row.returnable) <= 0) {
      throw new Error("This subtask has no unused funding to return.");
    }
    return {
      mode: "return",
      capId: row.capId,
      reason,
      idempotencyKey,
    };
  }

  const finished = taskFinished || row.finished;
  if (finished && !row.capId) {
    throw new Error("Finished work can only return unused funding.");
  }
  const source = (context.parentSources ?? []).find((item) => item.id === input.source);
  if (!source) {
    throw new Error("Choose an eligible funding account from the parent task.");
  }
  if ((row.hasHistory || finished) && row.capId && row.sourceId && source.id !== row.sourceId) {
    throw new Error("Choose the eligible account already used by this subtask.");
  }

  const parsedCents = parsePesoCents(input.amount);
  if (parsedCents === null) {
    throw new Error("Enter an amount greater than zero with up to two decimal places.");
  }
  const limits = distributionLimits(context, row, source.id, taskFinished);
  if (limits.minimumCents > 0 && parsedCents < limits.minimumCents) {
    throw new Error(`Keep at least ${formatCents(limits.minimumCents)} to cover recorded spending on this subtask.`);
  }
  if (parsedCents > limits.maximumCents) {
    throw new Error(
      finished
        ? `Only ${formatCents(limits.maximumCents)} can be kept on finished work; enter at most ${formatCents(limits.maximumCents)}.`
        : `Only ${formatCents(limits.maximumCents)} is available from ${source.name} for this subtask.`,
    );
  }

  return {
    mode: "save",
    taskId: context.taskId,
    subtaskId: row.id,
    allocationLineId: source.id,
    amount: fromCents(parsedCents),
    reason,
    idempotencyKey,
  };
}
