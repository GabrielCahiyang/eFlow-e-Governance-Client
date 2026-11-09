import { useCallback, useEffect, useRef, useState } from "react";
import {
  buildQueryScopeKey,
  evictQueryDomain,
  invalidateQueryDomain,
  loadWithQueryCache,
  readCachedQuery,
} from "../../../shared/queryCache";
import { useVisibleRead } from "../../../shared/useVisibleRead";
import { phase2Request } from "../../../shared/phase2Api";
import { listInvitations, type Invitation } from "../../invitations";
import type { OfficeMember } from "../types";

interface CachedOfficeTeam {
  members: OfficeMember[];
  invitations: Invitation[];
  office: string;
  teamError: string;
  inviteError: string;
}

const DOMAIN = "office-team";
const empty = {
  members: [] as OfficeMember[],
  invitations: [] as Invitation[],
  office: "your Office",
  loading: true,
  refreshing: false,
  teamError: "",
  inviteError: "",
};

function normalizeScopeKey(scope: unknown): string {
  if (typeof scope === "string") return scope;
  try {
    return JSON.stringify(scope ?? "");
  } catch {
    return String(scope ?? "");
  }
}

export function warmOfficeTeam(scope: unknown, forceRefresh = false) {
  return loadWithQueryCache<CachedOfficeTeam>({
    domain: DOMAIN,
    scope: buildQueryScopeKey({ workspaceId: normalizeScopeKey(scope) }),
    forceRefresh,
    fetcher: async () => {
      const [team, invitations] = await Promise.allSettled([
        phase2Request<{ office_name: string; members: OfficeMember[] }>("/office-team"),
        listInvitations(),
      ]);
      return {
        members: team.status === "fulfilled" ? team.value.members : [],
        office: team.status === "fulfilled" ? team.value.office_name : "your Office",
        invitations: invitations.status === "fulfilled" ? invitations.value.invitations : [],
        teamError: team.status === "rejected"
          ? team.reason?.message || "Could not load Office members."
          : "",
        inviteError: invitations.status === "rejected"
          ? invitations.reason?.message || "Could not load invitations."
          : "",
      };
    },
  });
}

export function useOfficeTeam(scope: unknown, enabled: boolean) {
  const scopeKey = normalizeScopeKey(scope);
  const cacheScope = buildQueryScopeKey({ workspaceId: scopeKey });
  const initialCached = enabled
    ? readCachedQuery<CachedOfficeTeam>(DOMAIN, cacheScope)
    : undefined;

  const [state, setState] = useState(() =>
    initialCached?.hit && initialCached.data
      ? {
          ...initialCached.data,
          loading: false,
          refreshing: false,
        }
      : { ...empty, loading: enabled },
  );
  const version = useRef(0);
  const activeScope = useRef(scopeKey);
  activeScope.current = scopeKey;

  const executeLoad = useCallback(
    async (forceRefresh: boolean) => {
      if (!enabled || activeScope.current !== scopeKey) return;
      const request = ++version.current;
      const cached = !forceRefresh
        ? readCachedQuery<CachedOfficeTeam>(DOMAIN, cacheScope)
        : undefined;
      if (cached?.hit && cached.data && cached.fresh) {
        setState({
          ...cached.data,
          loading: false,
          refreshing: false,
        });
        return;
      }
      setState((s) => ({
        ...s,
        loading: !cached?.hit && s.loading,
        refreshing: Boolean(cached?.hit || !s.loading),
      }));
      if (forceRefresh) {
        invalidateQueryDomain(DOMAIN, cacheScope);
      }
      const next = await warmOfficeTeam(scopeKey, forceRefresh);
      if (request !== version.current || activeScope.current !== scopeKey)
        return;
      if (next.teamError && next.inviteError) {
        evictQueryDomain(DOMAIN, cacheScope);
      }
      setState((s) => ({
        ...s,
        loading: false,
        refreshing: false,
        members: next.teamError ? s.members : next.members,
        office: next.teamError ? s.office : next.office,
        invitations: next.inviteError ? s.invitations : next.invitations,
        teamError: next.teamError,
        inviteError: next.inviteError,
      }));
    },
    [cacheScope, enabled, scopeKey],
  );

  const refresh = useCallback(async () => {
    await executeLoad(true);
  }, [executeLoad]);

  useEffect(() => {
    const cached = enabled
      ? readCachedQuery<CachedOfficeTeam>(DOMAIN, cacheScope)
      : undefined;
    setState(
      cached?.hit && cached.data
        ? { ...cached.data, loading: false, refreshing: !cached.fresh }
        : { ...empty, loading: enabled },
    );
    void executeLoad(false);
    return () => {
      ++version.current;
    };
  }, [cacheScope, enabled, executeLoad]);

  useVisibleRead(refresh, enabled);
  return { ...state, refresh };
}
