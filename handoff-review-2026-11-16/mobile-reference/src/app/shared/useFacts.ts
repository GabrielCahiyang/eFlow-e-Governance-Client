import { useCallback, useEffect, useRef, useState } from "react";
import {
  displayCacheEpoch,
  authoritativeReadEpoch,
  displayCacheFresh,
  displayFreshFor,
  displayCacheOwns,
  loadDisplayData,
  readDisplayCache,
  subscribeDisplayCache,
  type DisplayCachePolicy,
} from "./displayCache";
import { readWithTimeout } from "./readTimeout";
import { beginOperation, isPermissionRead } from "./operationActivity";

type State<T> = {
  key: string;
  data?: T;
  error?: Error;
  loading: boolean;
  stale: boolean;
};
export function useFacts<T>(
  key: string,
  load: () => Promise<T>,
  enabled = true,
  cache?: DisplayCachePolicy<T>,
) {
  const loader = useRef(load),
    policy = useRef(cache),
    scope = useRef({ key, enabled });
  loader.current = load;
  policy.current = cache;
  scope.current = { key, enabled };
  const sequence = useRef(0),
    lastRead = useRef(0);
  const [state, setState] = useState<State<T>>(() => ({
    key,
    data: enabled ? readDisplayCache(key, cache) : undefined,
    loading: enabled,
    stale: !!cache,
  }));
  const refresh = useCallback(async () => {
    if (!enabled || scope.current.key !== key || !scope.current.enabled) return;
    const generation = ++sequence.current,
      epoch = policy.current ? displayCacheEpoch() : authoritativeReadEpoch();
    const stillCurrent = () =>
      generation === sequence.current &&
      scope.current.key === key &&
      scope.current.enabled &&
      epoch ===
        (policy.current ? displayCacheEpoch() : authoritativeReadEpoch());
    setState((old) => ({
      key,
      data: old.key === key ? old.data : undefined,
      loading: true,
      stale: old.key === key && old.stale,
    }));
    const started = Date.now();
    const operation = /^[a-z][a-z-]{1,40}(?=:)/i.exec(key)?.[0] ?? "read";
    const finish = isPermissionRead(key) ? beginOperation("permissions") : undefined;
    try {
      const requestLoader = loader.current;
      const data = await loadDisplayData(
        key,
        () => readWithTimeout(requestLoader),
        policy.current,
      );
      if (stillCurrent()) {
        if (__DEV__)
          console.info("eFlow read", {
            operation,
            outcome: "ok",
            durationMs: Date.now() - started,
          });
        lastRead.current = Date.now();
        setState({ key, data, loading: false, stale: false });
      }
    } catch (e) {
      if (__DEV__) {
        const failure = e as {
          name?: string;
          code?: string;
          status?: number;
        } | null;
        console.warn("eFlow read", {
          operation,
          outcome: "failed",
          errorClass: failure?.name || "Unknown",
          code: failure?.code || failure?.status || "unknown",
          durationMs: Date.now() - started,
        });
      }
      if (stillCurrent())
        setState((old) => ({
          key,
          data: old.key === key ? old.data : undefined,
          loading: false,
          stale: !!old.data,
          error:
            e instanceof Error
              ? e
              : e &&
                  typeof e === "object" &&
                  "message" in e &&
                  typeof e.message === "string"
                ? Object.assign(new Error(e.message), {
                    cause: e,
                    status: "status" in e ? e.status : undefined,
                    code: "code" in e ? e.code : undefined,
                  })
                : new Error("Could not load this view."),
        }));
    } finally { finish?.(); }
  }, [key, enabled]);
  const refreshIfStale = useCallback(async () => {
    if (
      policy.current &&
      (Date.now() - lastRead.current < displayFreshFor ||
        displayCacheFresh(key, policy.current.actor))
    )
      return;
    await refresh();
  }, [key, refresh]);
  useEffect(() => {
    lastRead.current = 0;
    const fresh = displayCacheFresh(key, policy.current?.actor);
    setState({
      key,
      data: enabled ? readDisplayCache(key, policy.current) : undefined,
      loading: enabled && !fresh,
      stale: !!policy.current,
    });
    if (!fresh) void refresh();
    const unsubscribe = subscribeDisplayCache((reason) => {
      if (!policy.current && reason === "data") return;
      ++sequence.current;
      lastRead.current = 0;
      const owned = !policy.current || displayCacheOwns(policy.current.actor);
      setState((old) => ({
        key,
        data: reason === "data" && old.key === key ? old.data : undefined,
        loading: enabled && owned && reason !== "identity",
        stale: reason === "data" && !!old.data,
      }));
      if (enabled && owned && reason !== "identity") void refresh();
    });
    return () => {
      ++sequence.current;
      unsubscribe();
    };
  }, [refresh, key, enabled, cache?.actor]);
  return {
    ...(enabled && state.key === key
      ? state
      : { key, loading: enabled, stale: false }),
    refresh,
    refreshIfStale,
  };
}
