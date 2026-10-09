import { useCallback, useEffect, useRef, useState } from "react";
import type { AuditEvent } from "../../../services/auditService";
import {
  fetchAdministrativeAuditWindow,
  subscribeAdministrativeAuditInvalidation,
} from "../services/administrativeAuditWindow";

export function useAdministrativeAuditWindow() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [total, setTotal] = useState<number>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const mounted = useRef(false);
  const revision = useRef(0);
  const pending = useRef(false);
  const load = useCallback(async () => {
    const current = ++revision.current;
    try {
      const next = await fetchAdministrativeAuditWindow();
      if (!mounted.current || current !== revision.current) return;
      setEvents(next.events);
      setTotal(next.total);
      setError("");
    } catch (reason) {
      if (!mounted.current || current !== revision.current) return;
      setEvents([]);
      setTotal(undefined);
      setError(reason instanceof Error ? reason.message : "Audit unavailable");
    } finally {
      if (mounted.current && current === revision.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    mounted.current = true;
    void load();
    const stop = subscribeAdministrativeAuditInvalidation(() => void load());
    return () => {
      mounted.current = false;
      revision.current++;
      stop();
    };
  }, [load]);
  const refresh = async () => {
    if (pending.current) return;
    pending.current = true;
    setRefreshing(true);
    try {
      await load();
    } finally {
      pending.current = false;
      if (mounted.current) setRefreshing(false);
    }
  };
  return { events, total, loading, refreshing, error, refresh };
}
