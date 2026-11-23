import type {
  OfficePettyCashReleasePool,
  PettyCashRelease,
  PettyCashRequest,
  TaskCashPools,
  TaskCashReleasePool,
  TaskFundingContext,
  WorkCashAssignment,
  WorkCashSourceKind,
} from "../types";
import { toCents, fromCents, formatCents } from "./subtaskDistribution";

export type UnifiedFundingOptionKind =
  | "task_cash_release"
  | "office_petty_cash"
  | "budget_cap";

export interface UnifiedFundingOption {
  /** Composite key `${kind}:${id}` safe for `<select>` values. */
  key: string;
  kind: UnifiedFundingOptionKind;
  /** `petty_cash_request_id`, `office_cash_request_id`, or `allocation_line_id`. */
  sourceId: string;
  label: string;
  subtitle: string;
  /** Unassigned / free amount currently available in this pool (in PHP). */
  available: number;
  /** Maximum amount allowed when editing an existing assignment/cap for a specific target. */
  maxForTarget: number;
  /** Minimum floor (already logged receipts or spent cap) when editing an existing assignment. */
  minForTarget: number;
  /** True when the user can assign this pool to the task itself (`subtaskId = null`). */
  supportsTaskSelf: boolean;
  /** Existing assignment amount on the current target (0 if none). */
  existingTargetAmount: number;
  /** Existing assignment id when updating an active cash assignment. */
  existingAssignmentId?: string;
  /** Existing cap id when updating a subtask budget cap. */
  existingCapId?: string;
}

const OPEN_RELEASED_STATES = new Set([
  "released",
  "changes_requested",
  "overdue_liquidation",
]);

/**
 * Derive fallback cash-on-hand totals when the server has not yet returned `cashPools`
 * (for example while the new DB migration is pending deployment).
 */
export function resolveCashPools(
  context: TaskFundingContext | null | undefined,
  options?: {
    taskId?: string;
    requests?: PettyCashRequest[];
    releases?: PettyCashRelease[];
    currentUserId?: string;
  },
): TaskCashPools {
  if (context?.cashPools) return context.cashPools;

  const taskId = context?.taskId || options?.taskId || "";
  const requests = (options?.requests ?? []).filter(
    (r) =>
      r.taskId === taskId &&
      !r.subtaskId &&
      OPEN_RELEASED_STATES.has(r.status) &&
      (r.releasedAmount ?? 0) > 0,
  );
  const releases = options?.releases ?? [];
  const currentUserId = options?.currentUserId ?? "";

  const taskCashReleases: TaskCashReleasePool[] = requests.map((r) => {
    const reqReleases = releases.filter((rel) => rel.requestId === r.id);
    const hasUnack = reqReleases.some(
      (rel) => rel.status === "released" && !rel.acknowledgedAt,
    );
    const releasedAmount = Number(r.releasedAmount ?? 0);
    return {
      requestId: r.id,
      requestNumber: r.requestNumber,
      purpose: r.purpose,
      status: r.status,
      sourceLabels: (r.fundingLines ?? []).map(
        (line) => line.sourceName || "Approved source",
      ),
      fundingLines: r.fundingLines ?? [],
      releasedAmount,
      assignedToTask: 0,
      assignedToSubtasks: 0,
      unassignedAmount: releasedAmount,
      recordedReceiptsTotal: 0,
      liquidationDueAt: r.liquidationDueAt
        ? new Date(r.liquidationDueAt).toISOString()
        : null,
      holderId: r.cashRecipientId,
      holderName: r.cashRecipientName || "",
      isCurrentHolder: Boolean(
        currentUserId && r.cashRecipientId === currentUserId,
      ),
      acknowledged: !hasUnack,
    };
  });

  const cashOnHandTaskCents = taskCashReleases
    .filter((r) => r.acknowledged)
    .reduce((sum, r) => sum + toCents(r.releasedAmount), 0);

  return {
    canAssignCash: Boolean(context?.canManageDistribution),
    taskCashReleases,
    officePettyCashReleases: [],
    assignments: [],
    totals: {
      cashOnHandTask: fromCents(cashOnHandTaskCents),
      cashOnHandAssigned: 0,
      cashOnHandUnassigned: fromCents(cashOnHandTaskCents),
      officePettyCashOnHand: 0,
      officePettyCashAssigned: 0,
      subtaskTaskCashAssigned: 0,
      subtaskOfficePettyCashAssigned: 0,
      unrequestedBudget: Number(
        context?.distribution?.available ?? context?.available ?? 0,
      ),
    },
  };
}

/**
 * Build the 3-bucket funding options (Released Task Cash, Released Office Petty Cash,
 * and Unrequested Task Budget) for either `This task` (`subtaskId = null`) or a specific subtask.
 */
export function buildUnifiedFundingOptions(
  context: TaskFundingContext | null | undefined,
  targetSubtaskId: string | null,
  options?: {
    includeUnrequestedBudgetCap?: boolean;
  },
): {
  taskCashOptions: UnifiedFundingOption[];
  officePettyCashOptions: UnifiedFundingOption[];
  budgetCapOptions: UnifiedFundingOption[];
  allOptions: UnifiedFundingOption[];
} {
  const pools = resolveCashPools(context);
  const assignments = pools.assignments ?? [];
  const includeBudgetCap =
    options?.includeUnrequestedBudgetCap ?? targetSubtaskId !== null;

  const findExistingAssignment = (
    sourceKind: WorkCashSourceKind,
    sourceRequestId: string,
  ): WorkCashAssignment | undefined =>
    assignments.find(
      (a) =>
        a.status === "active" &&
        a.sourceKind === sourceKind &&
        a.sourceRequestId === sourceRequestId &&
        (a.subtaskId ?? null) === targetSubtaskId,
    );

  const taskCashOptions: UnifiedFundingOption[] = pools.taskCashReleases
    .filter((pool) => pool.isCurrentHolder && pool.acknowledged)
    .map((pool) => {
      const existing = findExistingAssignment("task_cash_release", pool.requestId);
      const existingCents = toCents(existing?.amount ?? 0);
      const unassignedCents = toCents(pool.unassignedAmount);
      const maxCents = unassignedCents + existingCents;
      const minCents = toCents(existing?.recordedSpent ?? 0);
      const frCode = `FR-${String(pool.requestNumber).padStart(5, "0")}`;
      const sourcesText = pool.sourceLabels.length
        ? pool.sourceLabels.join(", ")
        : pool.purpose;
      return {
        key: `task_cash_release:${pool.requestId}`,
        kind: "task_cash_release",
        sourceId: pool.requestId,
        label: `${frCode} · ${sourcesText}`,
        subtitle: existing
          ? `${formatCents(existingCents)} already assigned here · ${formatCents(unassignedCents)} unassigned`
          : `${formatCents(unassignedCents)} unassigned of ${formatCents(toCents(pool.releasedAmount))} released`,
        available: fromCents(unassignedCents),
        maxForTarget: fromCents(maxCents),
        minForTarget: fromCents(minCents),
        supportsTaskSelf: true,
        existingTargetAmount: fromCents(existingCents),
        existingAssignmentId: existing?.id,
      };
    });

  const officePettyCashOptions: UnifiedFundingOption[] = pools.officePettyCashReleases
    .filter((pool: OfficePettyCashReleasePool) => pool.isCurrentHolder)
    .map((pool) => {
      const existing = findExistingAssignment(
        "office_petty_cash",
        pool.officeCashRequestId,
      );
      const existingCents = toCents(existing?.amount ?? 0);
      const unassignedCents = toCents(pool.unassignedAmount);
      const maxCents = unassignedCents + existingCents;
      const minCents = toCents(existing?.recordedSpent ?? 0);
      return {
        key: `office_petty_cash:${pool.officeCashRequestId}`,
        kind: "office_petty_cash",
        sourceId: pool.officeCashRequestId,
        label: `Office Petty Cash · ${pool.purpose}`,
        subtitle: existing
          ? `${formatCents(existingCents)} already assigned here · ${formatCents(unassignedCents)} unassigned (separate ₱30k fund)`
          : `${formatCents(unassignedCents)} unassigned of ${formatCents(toCents(pool.releasedAmount))} released (separate ₱30k fund)`,
        available: fromCents(unassignedCents),
        maxForTarget: fromCents(maxCents),
        minForTarget: fromCents(minCents),
        supportsTaskSelf: true,
        existingTargetAmount: fromCents(existingCents),
        existingAssignmentId: existing?.id,
      };
    });

  const existingSubtaskRow = targetSubtaskId
    ? (context?.subtaskBudgets ?? []).find((row) => row.id === targetSubtaskId)
    : undefined;

  const budgetCapOptions: UnifiedFundingOption[] =
    includeBudgetCap && targetSubtaskId !== null
      ? (context?.parentSources ?? []).map((src) => {
          const isExistingCapLine = existingSubtaskRow?.sourceId === src.id;
          const existingCapCents = isExistingCapLine
            ? toCents(existingSubtaskRow?.amount ?? 0)
            : 0;
          const returnableCents = isExistingCapLine
            ? toCents(existingSubtaskRow?.returnable ?? 0)
            : 0;
          const minCents = Math.max(0, existingCapCents - returnableCents);
          const availCents = toCents(src.available);
          const maxCents = availCents + existingCapCents;
          return {
            key: `budget_cap:${src.id}`,
            kind: "budget_cap",
            sourceId: src.id,
            label: src.name,
            subtitle: `${formatCents(availCents)} unrequested task budget · requires cash request & Accounting release`,
            available: fromCents(availCents),
            maxForTarget: fromCents(maxCents),
            minForTarget: fromCents(minCents),
            supportsTaskSelf: false,
            existingTargetAmount: fromCents(existingCapCents),
            existingCapId: isExistingCapLine ? existingSubtaskRow?.capId : undefined,
          };
        })
      : [];

  return {
    taskCashOptions,
    officePettyCashOptions,
    budgetCapOptions,
    allOptions: [...taskCashOptions, ...officePettyCashOptions, ...budgetCapOptions],
  };
}

/** Pick the best default funding option: Released Task Cash first, then Released Office Petty Cash, then Unrequested Task Budget. */
export function pickDefaultFundingOption(
  options: UnifiedFundingOption[],
): UnifiedFundingOption | undefined {
  return (
    options.find((opt) => opt.kind === "task_cash_release" && opt.maxForTarget > 0) ||
    options.find((opt) => opt.kind === "office_petty_cash" && opt.maxForTarget > 0) ||
    options.find((opt) => opt.kind === "budget_cap" && opt.maxForTarget > 0) ||
    options[0]
  );
}

/** Validate an amount entered for a chosen UnifiedFundingOption using exact integer centavos. */
export function validateCashAssignmentAmount(
  rawAmount: string,
  option: UnifiedFundingOption | undefined,
  options?: { allowBlank?: boolean },
): string {
  const trimmed = rawAmount.trim();
  if (!trimmed) {
    return options?.allowBlank ? "" : "Enter an amount greater than ₱0.00.";
  }
  if (!option) {
    return "Choose a funding source first.";
  }
  if (!/^\d+(?:\.\d{1,2})?$/.test(trimmed)) {
    return "Enter a valid peso amount with up to two decimal places.";
  }
  const numeric = Number(trimmed);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return "Enter an amount greater than ₱0.00.";
  }
  const enteredCents = toCents(numeric);
  const maxCents = toCents(option.maxForTarget);
  const minCents = toCents(option.minForTarget);
  if (minCents > 0 && enteredCents < minCents) {
    return `Keep at least ${formatCents(minCents)} to cover receipts already logged on this assignment.`;
  }
  if (enteredCents > maxCents) {
    return `Amount exceeds the ${formatCents(maxCents)} available in ${option.label}.`;
  }
  return "";
}
