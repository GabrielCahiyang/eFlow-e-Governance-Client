import { useCallback, useEffect, useRef, useState } from "react";
import { readableUiError } from "../../../shared/userFacingError";
import type { SubtaskAllocationContext, TaskFundingContext } from "../types";
import { fetchSubtaskAllocationContext, fetchTaskFundingContext, SUBTASK_BUDGET_CHANGED_EVENT } from "../services/budgetService";

export function useTaskFundingContext(taskId: string, subtaskId?: string, version = "", includeAllocation = false) {
  const scope = `${taskId}:${subtaskId ?? ""}:${includeAllocation}`;
  const [loaded, setLoaded] = useState<{scope: string; context: TaskFundingContext | null; allocation?: SubtaskAllocationContext}>();
  const [loading, setLoading] = useState(Boolean(taskId));
  const [error, setError] = useState("");
  const generation = useRef(0);

  const refresh = useCallback(async () => {
    const run = ++generation.current;
    if (!taskId) {
      setLoaded(undefined);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const [funding, planning] = await Promise.allSettled([
        fetchTaskFundingContext(taskId, subtaskId),
        includeAllocation && subtaskId ? fetchSubtaskAllocationContext(taskId, subtaskId) : undefined,
      ]);
      if (run !== generation.current) return;
      if (funding.status === "rejected") throw funding.reason;
      setLoaded({scope, context: funding.value, allocation: planning.status === "fulfilled" ? planning.value : undefined});
      if (planning.status === "rejected") setError(planning.reason instanceof Error ? planning.reason.message : "Allocation authority could not be verified.");
    } catch (caught) {
      if (run !== generation.current) return;
      setLoaded({scope, context: null});
      setError(readableUiError(caught, "Couldn't load task funding.", "read"));
    } finally {
      if (run === generation.current) setLoading(false);
    }
  }, [subtaskId, taskId, includeAllocation, scope]);

  useEffect(() => () => {
    generation.current++;
  }, [scope]);

  useEffect(() => {
    void refresh();
  }, [refresh, version]);

  useEffect(() => {
    if (!taskId || typeof window === "undefined") return;
    const onBudgetChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ taskId?: string }>).detail;
      if (!detail?.taskId || detail.taskId === taskId) void refresh();
    };
    window.addEventListener(SUBTASK_BUDGET_CHANGED_EVENT, onBudgetChanged);
    return () => window.removeEventListener(SUBTASK_BUDGET_CHANGED_EVENT, onBudgetChanged);
  }, [refresh, taskId]);

  const readLatest = useCallback(async () => {
    if (!taskId) return null;
    return fetchTaskFundingContext(taskId, subtaskId);
  }, [subtaskId, taskId]);

  const current = loaded?.scope === scope ? loaded : undefined;
  return { context: current?.context ?? null, allocation: current?.allocation, loading, error, refresh, readLatest };
}
