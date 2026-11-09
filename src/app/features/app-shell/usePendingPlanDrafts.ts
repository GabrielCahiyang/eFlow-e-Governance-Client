import { useEffect, useState } from "react";
import {
  fetchCollaborationDrafts,
  getCachedCollaborationDrafts,
  subscribeToCollaborationDraftChanges,
  type CollaborationDraft,
} from "../interdepartment-collaboration";

export function usePendingPlanDrafts(userId?: string, enabled = true) {
  const [drafts, setDrafts] = useState<CollaborationDraft[]>(
    () => (userId && enabled ? getCachedCollaborationDrafts() ?? [] : []),
  );

  useEffect(() => {
    if (!userId || !enabled) { setDrafts([]); return; }
    let active = true;
    const refresh = () => {
      void fetchCollaborationDrafts()
        .then((rows) => { if (active) setDrafts(rows); })
        .catch(() => { if (active) setDrafts([]); });
    };
    refresh();
    const unsubscribe = subscribeToCollaborationDraftChanges(refresh);
    return () => { active = false; unsubscribe(); };
  }, [userId, enabled]);

  return drafts;
}
