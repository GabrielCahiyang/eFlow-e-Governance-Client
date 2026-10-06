import { useEffect, useMemo, useState } from "react";
import { useTasks } from "../../../hooks/useFirebaseData";
import {
  useProjectsData,
  useScopedOrgIds,
} from "../../../hooks/useSupabaseData";
import { useDeptDirectoryEmployees } from "../../members";
import { scopeProjects, scopeTasks } from "../../tasks";
import { buildTeamAttentionItems } from "../selectors/attentionSelectors";
import { buildTeamHealthSummary } from "../selectors/healthSelectors";
import { buildTeamMemberMetrics } from "../selectors/teamMemberSelectors";
import { subscribeToTeamWorkflowFacts } from "../services/teamWorkflowFactsService";
import type { TeamWorkflowFacts } from "../types";

const EMPTY_FACTS: TeamWorkflowFacts = {
  subtasks: [],
  progress: [],
  submissions: [],
  statusHistory: [],
  evidence: [],
};

type DirectoryOptions = NonNullable<
  Parameters<typeof useDeptDirectoryEmployees>[0]
>;

export function useDepartmentTeamAnalytics(
  directoryOptions: DirectoryOptions = {},
) {
  const { tasks, loading: tasksLoading } = useTasks();
  const { projects, loading: projectsLoading } = useProjectsData();
  const { scopedOrgIds } = useScopedOrgIds();
  const directory = useDeptDirectoryEmployees({
    includeDepartmentHeads: true,
    activeOnly: true,
    excludeAdmins: true,
    ...directoryOptions,
  });
  const scopedTasks = useMemo(
    () => scopeTasks(tasks, scopedOrgIds),
    [scopedOrgIds, tasks],
  );
  const scopedProjects = useMemo(
    () => scopeProjects(projects, scopedOrgIds),
    [projects, scopedOrgIds],
  );
  const taskKey = useMemo(
    () =>
      scopedTasks
        .map((task) => task.id)
        .sort()
        .join(","),
    [scopedTasks],
  );
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [hasFacts, setHasFacts] = useState(false);
  const factsScope = useState(() => ({ key: taskKey }))[0];
  const [facts, setFacts] = useState<TeamWorkflowFacts>(EMPTY_FACTS);
  const [factsLoading, setFactsLoading] = useState(true);
  const [factsError, setFactsError] = useState("");

  useEffect(() => {
    if (factsScope.key !== taskKey) {
      setFacts(EMPTY_FACTS);
      setHasFacts(false);
      factsScope.key = taskKey;
    }
    let live = true;
    setFactsLoading(true);
    setFactsError("");
    const stop = subscribeToTeamWorkflowFacts(
      taskKey ? taskKey.split(",") : [],
      (nextFacts) => {
        if (!live) return;
        setHasFacts(true);
        setFacts(nextFacts);
        setFactsLoading(false);
      },
      (message) => {
        if (!live) return;
        setFactsError(message);
        setFactsLoading(false);
      },
    );
    return () => {
      live = false;
      stop();
    };
  }, [taskKey, refreshVersion, factsScope]);

  const memberMetrics = useMemo(
    () => buildTeamMemberMetrics(directory.deptEmployees, scopedTasks, facts),
    [directory.deptEmployees, facts, scopedTasks],
  );
  const attention = useMemo(
    () => buildTeamAttentionItems(scopedTasks, facts),
    [facts, scopedTasks],
  );
  const health = useMemo(
    () => buildTeamHealthSummary(scopedTasks, facts, attention),
    [attention, facts, scopedTasks],
  );

  return {
    ...directory,
    tasks: scopedTasks,
    projects: scopedProjects,
    facts,
    memberMetrics,
    attention,
    health,
    loading:
      tasksLoading ||
      projectsLoading ||
      directory.directoryLoading ||
      (factsLoading && !hasFacts),
    error: factsError,
    refreshing: factsLoading && hasFacts,
    refresh: () => setRefreshVersion((version) => version + 1),
  };
}
