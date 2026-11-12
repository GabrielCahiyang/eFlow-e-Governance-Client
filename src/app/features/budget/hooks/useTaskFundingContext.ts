import { useCallback, useEffect, useRef, useState } from "react";
import type { TaskFundingContext } from "../types";
import { fetchTaskFundingContext } from "../services/budgetService";

export function useTaskFundingContext(taskId: string, subtaskId?: string, version = "") {
  const scope = `${taskId}:${subtaskId ?? ""}`;
  const [loaded, setLoaded] = useState<{ scope: string; context: TaskFundingContext | null }>();
  const [loading, setLoading] = useState(Boolean(taskId));
  const [error, setError] = useState("");
  const latestRequest = useRef(0);

  const refresh = useCallback(async () => {
    const request = ++latestRequest.current;
    if (!taskId) {
      setLoaded(undefined);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const context = await fetchTaskFundingContext(taskId, subtaskId);
      if (request === latestRequest.current) setLoaded({ scope, context });
    } catch (caught) {
      if (request === latestRequest.current) {
        setLoaded({ scope, context: null });
        setError(caught instanceof Error ? caught.message : "Task funding could not be loaded.");
      }
    } finally {
      if (request === latestRequest.current) setLoading(false);
    }
  }, [scope, subtaskId, taskId]);

  useEffect(() => {
    void refresh();
    return () => { latestRequest.current += 1; };
  }, [refresh, version]);

  return { context: loaded?.scope === scope ? loaded.context : null, loading, error, refresh };
}
