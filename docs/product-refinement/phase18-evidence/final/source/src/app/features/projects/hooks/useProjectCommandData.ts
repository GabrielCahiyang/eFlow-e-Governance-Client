import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import type { Project, ProjectMember, Milestone } from "../services/types";
import type { Task } from "../../tasks";
import { buildTeamAttentionItems, subscribeToTeamWorkflowFacts, type TeamWorkflowFacts } from "../../team-management";
import { fetchProjectMembers } from "../services/projectMemberService";
import { subscribeToMilestones } from "../services/milestoneService";
import { buildProjectActivity, buildProjectCommandMetrics } from "../selectors/projectCommandSelectors";
import type { ProjectActivityItem, ProjectCommandData } from "../components/project-command/types";
import { fetchProjectAuditActivity } from "../services/projectActivityService";
import { getCurrentFiscalYear, getTaskScopedBudgetBundle, useDepartmentBudget } from "../../budget";
import { useAuth } from "../../../contexts/AuthContext";
import { createProjectCommandCache, type ProjectCommandCacheScope } from "../services/projectCommandCache";
import { registerAuthCacheReset } from "../../../shared/authCacheReset";

const EMPTY_FACTS: TeamWorkflowFacts = { subtasks: [], progress: [], submissions: [], statusHistory: [], evidence: [] };

type ProjectCommandCacheEntry = {
  taskKey: string;
  milestones: Milestone[];
  members: ProjectMember[];
  facts: TeamWorkflowFacts;
  projectEvents: ProjectActivityItem[];
};

// Project detail mounts are intentionally keyed by project so the shell can
// preserve each workspace's view. Retaining the last loaded command data here
// lets a project render immediately when the user switches back to it, while
// the existing subscriptions continue to refresh the cached snapshot.
const projectCommandCache = createProjectCommandCache<ProjectCommandCacheEntry>();
const unregisterCacheReset = registerAuthCacheReset(() => projectCommandCache.reset());
import.meta.hot?.dispose(unregisterCacheReset);

function getCachedProjectCommandData(scope: ProjectCommandCacheScope, projectId: string, taskKey: string) {
  const cached = projectCommandCache.get(scope, projectId);
  return cached?.taskKey === taskKey ? cached : undefined;
}

function updateProjectCommandCache(
  scope: ProjectCommandCacheScope,
  projectId: string,
  taskKey: string,
  patch: Partial<Omit<ProjectCommandCacheEntry, "taskKey">>,
) {
  const current = projectCommandCache.get(scope, projectId);
  projectCommandCache.set(scope, projectId, {
    taskKey,
    milestones: patch.milestones ?? (current?.taskKey === taskKey ? current.milestones : []),
    members: patch.members ?? (current?.taskKey === taskKey ? current.members : []),
    facts: patch.facts ?? (current?.taskKey === taskKey ? current.facts : EMPTY_FACTS),
    projectEvents: patch.projectEvents ?? (current?.taskKey === taskKey ? current.projectEvents : []),
  });
}

export function useProjectCommandData(project: Project, tasks: Task[]): ProjectCommandData & { retryWorkflowFacts: () => void } {
  const { user, userProfile } = useAuth();
  const scope = projectCommandCache.selectScope(`${userProfile?.id || user?.id || ''}:${userProfile?.org_id || userProfile?.departmentId || ''}:${userProfile?.role || ''}`);
  const budget = useDepartmentBudget(project.orgId || tasks.find((task) => task.orgId)?.orgId || "", getCurrentFiscalYear());
  const taskKey = useMemo(() => tasks.map((task) => task.id).sort().join(","), [tasks]);
  const cached = getCachedProjectCommandData(scope, project.id, taskKey);
  // Refresh newly added tasks without unmounting the working table and losing
  // its expanded groups, filters, or unsaved inline drafts.
  const ready = useRef({ projectId: project.id, loaded: Boolean(cached) });
  if (ready.current.projectId !== project.id) ready.current = { projectId: project.id, loaded: Boolean(cached) };
  const [milestones, setMilestones] = useState<Milestone[]>(() => cached?.milestones || []);
  const [members, setMembers] = useState<ProjectMember[]>(() => cached?.members || []);
  const [facts, setFacts] = useState<TeamWorkflowFacts>(() => cached?.facts || EMPTY_FACTS);
  const [loading, setLoading] = useState(() => !cached);
  const [error, setError] = useState("");
  const [factsRevision, setFactsRevision] = useState(0);
  const [projectEvents, setProjectEvents] = useState<ProjectActivityItem[]>(() => cached?.projectEvents || []);

  const refreshMembers = useCallback(async () => {
    const nextMembers = await fetchProjectMembers(project.id);
    setMembers(nextMembers);
    updateProjectCommandCache(scope, project.id, taskKey, { members: nextMembers });
  }, [scope, project.id, taskKey]);

  useEffect(() => {
    const existing = getCachedProjectCommandData(scope, project.id, taskKey);
    if (existing) {
      setMilestones(existing.milestones);
      setMembers(existing.members);
      setFacts(existing.facts);
      setProjectEvents(existing.projectEvents);
      setLoading(false);
      ready.current.loaded = true;
    } else {
      if (!ready.current.loaded) setLoading(true);
      updateProjectCommandCache(scope, project.id, taskKey, {});
    }
    void refreshMembers();
    return subscribeToMilestones(project.id, (rows) => {
      setMilestones(rows);
      updateProjectCommandCache(scope, project.id, taskKey, { milestones: rows });
    });
  }, [scope, project.id, refreshMembers, taskKey]);

  useEffect(() => {
    if (!ready.current.loaded && !getCachedProjectCommandData(scope, project.id, taskKey)) setLoading(true);
    setError("");
    return subscribeToTeamWorkflowFacts(
      taskKey ? taskKey.split(",") : [],
      (nextFacts) => {
        setFacts(nextFacts);
        updateProjectCommandCache(scope, project.id, taskKey, { facts: nextFacts });
        setLoading(false);
        ready.current.loaded = true;
      },
      (message) => { setError(message); setLoading(false); },
    );
  }, [scope, project.id, taskKey, factsRevision]);

  useEffect(() => {
    const entityIds = [project.id, ...tasks.map((task) => task.id), ...milestones.map((milestone) => milestone.id)];
    void fetchProjectAuditActivity(entityIds).then((events) => {
      setProjectEvents(events);
      updateProjectCommandCache(scope, project.id, taskKey, { projectEvents: events });
    });
  }, [scope, milestones, project.id, project.updatedAt, taskKey]);

  const attention = useMemo(() => buildTeamAttentionItems(tasks, facts), [facts, tasks]);
  const metrics = useMemo(() => buildProjectCommandMetrics(project, tasks, milestones, facts, attention), [attention, facts, milestones, project, tasks]);
  const activity = useMemo(() => buildProjectActivity(facts, projectEvents), [facts, projectEvents]);
  const financial = useMemo(() => getTaskScopedBudgetBundle(budget, tasks.map((task) => task.id)), [budget, taskKey]);

  return {
    project, tasks, milestones, members, facts, attention, metrics, activity,
    financial, financialLoading: budget.loading, financialError: budget.error,
    loading, error, refreshMembers, retryWorkflowFacts: () => setFactsRevision(revision => revision + 1),
  };
}
