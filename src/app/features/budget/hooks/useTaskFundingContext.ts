import { useCallback, useEffect, useRef, useState } from "react";
import type { SubtaskAllocationContext, TaskFundingContext } from "../types";
import { fetchSubtaskAllocationContext, fetchTaskFundingContext } from "../services/budgetService";

export function useTaskFundingContext(taskId: string, subtaskId?: string, version = "", includeAllocation = false) {
  const [context, setContext] = useState<TaskFundingContext | null>(null);
  const [allocation, setAllocation] = useState<SubtaskAllocationContext>();
  const [loading, setLoading] = useState(Boolean(taskId));
  const [error, setError] = useState("");
  const generation = useRef(0);

  const refresh = useCallback(async () => {
    const run = ++generation.current;
    setAllocation(undefined);
    if (!taskId) {
      setContext(null);
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
      setContext(funding.value);
      if (planning.status === "fulfilled") setAllocation(planning.value);
      else setError(planning.reason instanceof Error ? planning.reason.message : "Allocation authority could not be verified.");
    } catch (caught) {
      if (run !== generation.current) return;
      setContext(null);
      setError(caught instanceof Error ? caught.message : "Task funding could not be loaded.");
    } finally {
      if (run === generation.current) setLoading(false);
    }
  }, [subtaskId, taskId, includeAllocation]);

  useEffect(() => {
    void refresh();
    return () => { generation.current++; };
  }, [refresh, version]);

  return { context, allocation, loading, error, refresh };
}
