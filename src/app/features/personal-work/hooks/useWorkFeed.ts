import { useCallback, useEffect, useRef, useState } from "react";
import { ACCESS_CHANGED_EVENT } from "../../project-access";
import { loadWorkFeed } from "../services/workFeedService";
import type { WorkScope, WorkSnapshot } from "../types";
export function useWorkFeed(userId: string, scope?: WorkScope) {
  const key = JSON.stringify([
    userId,
    scope?.workspace.id || "all",
    scope?.workspace.timezone,
    scope?.projectIds?.slice().sort() ?? null,
  ]);
  const [state, setState] = useState<{
    key: string;
    data?: WorkSnapshot;
    loading: boolean;
    error?: string;
  }>({ key: "", loading: true });
  const generation = useRef(0);
  const inFlight = useRef<number | undefined>(undefined);
  const refresh = useCallback(async () => {
    const token = ++generation.current;
    inFlight.current = token;
    setState((previous) =>
      previous.key === key
        ? { ...previous, loading: true, error: undefined }
        : { key, loading: true },
    );
    try {
      const data = await loadWorkFeed(userId, scope);
      if (token === generation.current) setState({ key, data, loading: false });
    } catch (error) {
      if (token === generation.current)
        setState({ key, loading: false, error: (error as Error).message });
    } finally {
      if (inFlight.current === token) inFlight.current = undefined;
    }
  }, [key]);
  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => {
      if (!inFlight.current) void refresh();
    }, 15000);
    window.addEventListener("focus", refresh);
    window.addEventListener(ACCESS_CHANGED_EVENT, refresh);
    return () => {
      ++generation.current;
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener(ACCESS_CHANGED_EVENT, refresh);
    };
  }, [refresh]);
  return { ...(state.key === key ? state : { key, loading: true }), refresh };
}
