import { useEffect, useRef, useState } from "react";
import { useAuth } from "../../../contexts/AuthContext";
import { projectFlowCall, type ProjectFlow } from "../../project-setup";
/** One checked snapshot per visible project, shared by its table rows. */
export function useAnalyticsFunding(projectIds: string[]) {
  const { user } = useAuth(),
    key = JSON.stringify([user?.id, [...new Set(projectIds)].sort()]),
    scope = useRef(key);
  scope.current = key;
  const [state, setState] = useState<{
    key: string;
    data: Map<string, ProjectFlow>;
    errors: Set<string>;
  }>({ key: "", data: new Map(), errors: new Set() });
  useEffect(() => {
    let active = true,
      reading = false,
      again = false;
    const ids = [...new Set(projectIds)];
    const load = async () => {
      if (reading) {
        again = true;
        return;
      }
      reading = true;
      do {
        again = false;
        const data = new Map<string, ProjectFlow>(),
          errors = new Set<string>();
        let index = 0;
        await Promise.all(
          Array.from({ length: Math.min(3, ids.length) }, async () => {
            while (index < ids.length) {
              const id = ids[index++];
              try {
                const snapshot = await projectFlowCall<ProjectFlow>(
                  "project_flow_snapshot",
                  { p_project: id },
                );
                if (
                  snapshot?.project?.id !== id ||
                  !Array.isArray(snapshot.taskFunding) ||
                  !["total", "allocated", "released", "spent"].every(
                    (field) =>
                      typeof snapshot[field as "total"] === "number" &&
                      Number.isFinite(snapshot[field as "total"]),
                  )
                )
                  throw new Error("Funding snapshot is unavailable.");
                data.set(id, snapshot);
              } catch {
                errors.add(id);
              }
            }
          }),
        );
        if (active && scope.current === key) setState({ key, data, errors });
      } while (again && active);
      reading = false;
    };
    void load();
    const refresh = () => void load(),
      timer = window.setInterval(refresh, 15000);
    window.addEventListener("focus", refresh);
    window.addEventListener("eflow:project-setup", refresh);
    window.addEventListener("eflow:work-updated", refresh);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("eflow:project-setup", refresh);
      window.removeEventListener("eflow:work-updated", refresh);
    };
  }, [key]);
  return state.key === key
    ? state
    : { data: new Map<string, ProjectFlow>(), errors: new Set<string>() };
}
