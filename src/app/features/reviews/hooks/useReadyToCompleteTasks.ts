import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Task } from "../../../services/taskService";
import {
  fetchWorkFinancialClearance,
  type WorkFinancialClearance,
} from "../../budget";

export interface ReadyToCompleteItem {
  task: Task;
  clearance: WorkFinancialClearance;
}

function itemRank(item: ReadyToCompleteItem): number {
  if (!item.clearance.cashOutstanding && item.clearance.canFinalize) return 0;
  if (!item.clearance.cashOutstanding) return 1;
  return 2;
}

export function useReadyToCompleteTasks(
  tasks: Task[],
  actorId?: string | null,
) {
  const candidates = useMemo(
    () =>
      tasks.filter(
        (task) => task.status === "for_review" && !task.archivedAt,
      ),
    [tasks],
  );
  const candidateKey = useMemo(
    () =>
      candidates
        .map((task) => `${task.id}:${task.updatedAt}:${task.latestSubmission?.id ?? ""}`)
        .join("|"),
    [candidates],
  );

  const [items, setItems] = useState<ReadyToCompleteItem[]>([]);
  const [loading, setLoading] = useState(false);
  const versionRef = useRef(0);

  const refresh = useCallback(async () => {
    if (
      !actorId ||
      candidates.length === 0 ||
      typeof fetchWorkFinancialClearance !== "function"
    ) {
      setItems([]);
      setLoading(false);
      return;
    }
    const run = ++versionRef.current;
    setLoading(true);
    try {
      const results = await Promise.allSettled(
        candidates.map(async (task) => ({
          task,
          clearance: await fetchWorkFinancialClearance(task.id),
        })),
      );
      if (run !== versionRef.current) return;
      const accepted = results
        .filter(
          (result): result is PromiseFulfilledResult<ReadyToCompleteItem> =>
            result.status === "fulfilled" &&
            result.value.clearance.workAccepted &&
            !result.value.clearance.completed,
        )
        .map((result) => result.value)
        .sort(
          (a, b) =>
            itemRank(a) - itemRank(b) ||
            (b.task.updatedAt || 0) - (a.task.updatedAt || 0),
        );
      setItems(accepted);
    } finally {
      if (run === versionRef.current) setLoading(false);
    }
  }, [actorId, candidateKey]);

  useEffect(() => {
    void refresh();
    if (typeof window === "undefined") return;
    const reload = () => {
      void refresh();
    };
    window.addEventListener("eflow:work-updated", reload);
    window.addEventListener("eflow:finance-updated", reload);
    window.addEventListener("eflow:expenses-updated", reload);
    return () => {
      versionRef.current++;
      window.removeEventListener("eflow:work-updated", reload);
      window.removeEventListener("eflow:finance-updated", reload);
      window.removeEventListener("eflow:expenses-updated", reload);
    };
  }, [refresh]);

  const readyCount = useMemo(
    () => items.filter((item) => !item.clearance.cashOutstanding).length,
    [items],
  );

  return { items, readyCount, loading, refresh };
}
