import { useEffect, useState } from "react";
import { fetchActivityPage } from "./activityService";
import type { ActivityFilters, ActivityPage } from "./types";

export function useActivityPage(
  project: string,
  filters: ActivityFilters,
  size: number,
) {
  const key = JSON.stringify([project, filters, size]);
  const [request, setRequest] = useState<{
    key: string;
    page: number;
    snapshot?: string;
    revision: number;
  }>({ key, page: 0, revision: 0 });
  const [state, setState] = useState<{
    key: string;
    data?: ActivityPage;
    loading: boolean;
    error: string;
  }>({ key, loading: true, error: "" });
  const active = request.key === key ? request : { key, page: 0, revision: 0 };
  useEffect(() => {
    let live = true;
    setState({ key, loading: true, error: "" });
    const timer = window.setTimeout(
      () =>
        void fetchActivityPage(
          project,
          filters,
          size,
          active.page,
          active.snapshot,
        )
          .then((data) => {
            if (live) setState({ key, data, loading: false, error: "" });
          })
          .catch((reason) => {
            if (live)
              setState({
                key,
                loading: false,
                error:
                  reason instanceof Error
                    ? reason.message
                    : "History unavailable.",
              });
          }),
      active.snapshot ? 0 : 250,
    );
    return () => {
      window.clearTimeout(timer);
      live = false;
    };
  }, [key, active.page, active.snapshot, active.revision]);
  const refresh = () =>
    setRequest({ key, page: 0, revision: active.revision + 1 });
  useEffect(() => {
    window.addEventListener("eflow-project-access-changed", refresh);
    const revalidate = () => {
      const current = state.key === key ? state.data : undefined;
      setRequest({
        key,
        page: current?.page ?? active.page,
        snapshot: current?.snapshot ?? active.snapshot,
        revision: active.revision + 1,
      });
    };
    window.addEventListener("focus", revalidate);
    return () => {
      window.removeEventListener("eflow-project-access-changed", refresh);
      window.removeEventListener("focus", revalidate);
    };
  }, [
    key,
    active.page,
    active.snapshot,
    active.revision,
    state.data?.snapshot,
    state.data?.page,
  ]);
  useEffect(() => {
    const current = state.key === key ? state.data : undefined;
    if (!current) return;
    let live = true,
      busy = false;
    const verify = async () => {
      if (busy) return;
      busy = true;
      try {
        await fetchActivityPage(
          project,
          filters,
          size,
          current.page,
          current.snapshot,
        );
      } catch (reason) {
        if (live)
          setState({
            key,
            loading: false,
            error:
              reason instanceof Error
                ? reason.message
                : "History access unavailable.",
          });
      } finally {
        busy = false;
      }
    };
    const timer = window.setInterval(() => void verify(), 15_000);
    return () => {
      live = false;
      window.clearInterval(timer);
    };
  }, [key, state.data?.snapshot, state.data?.page]);
  const visible = state.key === key ? state : { key, loading: true, error: "" };
  return {
    ...visible,
    refresh,
    retry: () => setRequest({ ...active, revision: active.revision + 1 }),
    go: (page: number) => {
      if (visible.data)
        setRequest({
          key,
          page,
          snapshot: visible.data.snapshot,
          revision: active.revision,
        });
    },
  };
}
