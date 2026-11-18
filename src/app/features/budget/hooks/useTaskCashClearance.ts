import { useCallback, useEffect, useRef, useState } from "react";
import { subscribeCashRequestChanges } from '../services/cashRequestUpdates';
import { fetchTaskCashBlockers } from "../services/taskCashClearanceService";
import type { TaskCashBlocker } from "../types";

export function useTaskCashClearance(taskId: string) {
  const [state, setState] = useState<{ taskId: string; blockers: TaskCashBlocker[]; loading: boolean; error: string }>({
    taskId, blockers: [], loading: true, error: "",
  });
  const generation = useRef(0);
  const refresh = useCallback(async () => {
    const current = ++generation.current;
    setState((previous) => ({ taskId, blockers: previous.taskId === taskId ? previous.blockers : [], loading: true, error: "" }));
    try {
      const blockers = await fetchTaskCashBlockers(taskId);
      if (current !== generation.current) return null;
      setState({ taskId, blockers, loading: false, error: "" });
      return blockers;
    } catch (caught) {
      if (current !== generation.current) return null;
      setState({ taskId, blockers: [], loading: false, error: caught instanceof Error ? caught.message : "Cash details could not be loaded." });
      return null;
    }
  }, [taskId]);

  useEffect(() => {
    void refresh();
    const onFocus = () => { void refresh(); };
    window.addEventListener("focus", onFocus);
    const fallback = window.setInterval(() => { if (document.visibilityState !== "hidden") onFocus(); }, 60_000);
    const unsubscribe = subscribeCashRequestChanges(taskId, onFocus);
    return () => {
      generation.current += 1;
      window.removeEventListener("focus", onFocus);
      window.clearInterval(fallback);
      unsubscribe();
    };
  }, [refresh, taskId]);

  return {
    blockers: state.taskId === taskId ? state.blockers : [],
    loading: state.taskId !== taskId || state.loading,
    error: state.taskId === taskId ? state.error : "",
    refresh,
  };
}
