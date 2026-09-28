import type { Task } from "../taskTypes";

export type LeaderWorkspaceScopeOption = {
  value: string;
  label: string;
};

const ALL_LEADER_SCOPES: LeaderWorkspaceScopeOption = {
  value: "all",
  label: "All Projects / Activities",
};

function normalizedIdentity(value: string | undefined, fallback: string): string {
  const cleaned = value?.trim();
  return cleaned ? cleaned.toLowerCase() : fallback;
}

export function getLeaderTaskScopeOption(task: Task): LeaderWorkspaceScopeOption {
  const projectTitle = task.projectTitle?.trim() || "";
  const activityTitle = task.activityTitle?.trim() || "";
  const projectIdentity = normalizedIdentity(
    task.linkedProjectId || task.projectId || projectTitle,
    "unassigned-project",
  );
  const activityIdentity = normalizedIdentity(
    task.activityId || activityTitle,
    "all-project-activities",
  );

  return {
    value: `${projectIdentity}::${activityIdentity}`,
    label: projectTitle && activityTitle
      ? `${projectTitle} · ${activityTitle}`
      : projectTitle || activityTitle || "Unassigned work",
  };
}

export function buildLeaderTaskScopeOptions(
  tasks: Task[],
): LeaderWorkspaceScopeOption[] {
  const options = new Map<string, LeaderWorkspaceScopeOption>();
  tasks.forEach((task) => {
    const option = getLeaderTaskScopeOption(task);
    if (!options.has(option.value)) options.set(option.value, option);
  });

  return [
    ALL_LEADER_SCOPES,
    ...Array.from(options.values()).sort((left, right) =>
      left.label.localeCompare(right.label, undefined, {
        numeric: true,
        sensitivity: "base",
      }),
    ),
  ];
}
