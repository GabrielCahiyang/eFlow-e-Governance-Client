import * as React from "react";
import {
  fetchCollaborationDrafts,
  fetchMyCollaborationMemberships,
  getCachedCollaborationDrafts,
  getCachedMyCollaborationMemberships,
  subscribeToCollaborationDraftChanges,
} from "../services/collaborationDraftService";
import type { CollaborationDraft } from "../types";
import { useAuth } from "../../../contexts/AuthContext";
import { runGovernanceEscalations } from "../services/governanceService";

export function useCollaborationDrafts() {
  const { userProfile } = useAuth();
  const [drafts, setDrafts] = React.useState<CollaborationDraft[]>(
    () => getCachedCollaborationDrafts() ?? [],
  );
  const [loading, setLoading] = React.useState<boolean>(
    () => !getCachedCollaborationDrafts(),
  );
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [membershipOrgIds, setMembershipOrgIds] = React.useState<string[]>(() => {
    if (!userProfile?.id) return [];
    const cached = getCachedMyCollaborationMemberships(userProfile.id);
    return cached ? cached.map((row) => row.organizationId) : [];
  });
  const refreshSequence = React.useRef(0);

  const refresh = React.useCallback(async () => {
    const sequence = ++refreshSequence.current;
    if (getCachedCollaborationDrafts()) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    try {
      const nextDrafts = await fetchCollaborationDrafts();
      if (sequence !== refreshSequence.current) return;
      setDrafts(nextDrafts);
      setError(null);
    } catch (reason) {
      if (sequence !== refreshSequence.current) return;
      setError(reason instanceof Error ? reason.message : "Could not load collaboration drafts.");
    } finally {
      if (sequence === refreshSequence.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  React.useEffect(() => {
    void refresh();
    return subscribeToCollaborationDraftChanges(() => { void refresh(); });
  }, [refresh]);

  React.useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [refresh]);

  React.useEffect(() => {
    if (!userProfile?.id) {
      setMembershipOrgIds([]);
      return;
    }
    let active = true;
    void runGovernanceEscalations().catch(() => undefined);
    void fetchMyCollaborationMemberships(userProfile.id)
      .then((rows) => {
        if (active) setMembershipOrgIds(rows.map((row) => row.organizationId));
      })
      .catch(() => {
        if (active) setMembershipOrgIds([]);
      });
    return () => {
      active = false;
    };
  }, [userProfile?.id]);

  return { drafts, loading, refreshing, error, refresh, membershipOrgIds };
}
