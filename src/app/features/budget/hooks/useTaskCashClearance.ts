import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../../../../lib/supabase";
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
    const fallback = window.setInterval(() => { if (document.visibilityState !== "hidden") onFocus(); }, 15_000);
    // Each mounted reviewer owns a fresh channel; never append handlers to an
    // already-subscribed channel shared with another funding card.
    const channel = supabase.channel(`task-cash-clearance:${taskId}:${crypto.randomUUID()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "petty_cash_requests", filter: `task_id=eq.${taskId}` }, onFocus)
      .subscribe();
    return () => {
      generation.current += 1;
      window.removeEventListener("focus", onFocus);
      window.clearInterval(fallback);
      void supabase.removeChannel(channel);
    };
  }, [refresh, taskId]);

  return {
    blockers: state.taskId === taskId ? state.blockers : [],
    loading: state.taskId !== taskId || state.loading,
    error: state.taskId === taskId ? state.error : "",
    refresh,
  };
}
