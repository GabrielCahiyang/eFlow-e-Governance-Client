import { buildHierarchyIds, type DraftTask } from "../components/draftModel";

export function createManualPlanTask({
  proposalTitle,
  programIdx,
  projectIdx,
  activityIdx,
  programTitle = `Program ${programIdx + 1}`,
  projectTitle = `Project ${projectIdx + 1}`,
  activityTitle = `Activity ${activityIdx + 1}`,
  activitySchedule = "",
  taskIdx = 0,
  taskTitle = "New Task",
}: {
  proposalTitle: string;
  programIdx: number;
  projectIdx: number;
  activityIdx: number;
  programTitle?: string;
  projectTitle?: string;
  activityTitle?: string;
  activitySchedule?: string;
  taskIdx?: number;
  taskTitle?: string;
}): DraftTask {
  const hierarchyIds = buildHierarchyIds(
    proposalTitle,
    programTitle,
    projectTitle,
    activityTitle,
    programIdx,
    projectIdx,
    activityIdx,
  );

  return {
    key: `manual-${programIdx}-${projectIdx}-${activityIdx}-${taskIdx}`,
    proposalTitle,
    proposalId: hierarchyIds.proposalId,
    programIdx,
    projectIdx,
    activityIdx,
    taskIdx,
    programId: hierarchyIds.programId,
    programTitle,
    projectId: hierarchyIds.projectId,
    projectTitle,
    activityId: hierarchyIds.activityId,
    activityTitle,
    activitySchedule,
    title: taskTitle,
    description: "",
    deadline: activitySchedule,
    priority: "medium",
    requiredSkills: [],
    assignedMemberIds: [],
    leadMemberId: null,
    burnoutWarning: false,
    reasoning: "",
    budgetDecision: "missing",
    budgetLines: [],
    enabled: true,
  };
}

function nextIndex(tasks: DraftTask[], predicate: (task: DraftTask) => boolean) {
  return tasks.reduce(
    (highest, task) => (predicate(task) ? Math.max(highest, task.taskIdx) : highest),
    -1,
  ) + 1;
}

function refreshHierarchy(task: DraftTask): DraftTask {
  const hierarchyIds = buildHierarchyIds(
    task.proposalTitle,
    task.programTitle,
    task.projectTitle,
    task.activityTitle,
    task.programIdx,
    task.projectIdx,
    task.activityIdx,
  );

  return {
    ...task,
    proposalId: hierarchyIds.proposalId,
    programId: hierarchyIds.programId,
    projectId: hierarchyIds.projectId,
    activityId: hierarchyIds.activityId,
  };
}

export function addManualProgram(tasks: DraftTask[], proposalTitle: string): DraftTask[] {
  const programIdx = tasks.reduce((highest, task) => Math.max(highest, task.programIdx), -1) + 1;
  return [
    ...tasks,
    createManualPlanTask({ proposalTitle, programIdx, projectIdx: 0, activityIdx: 0 }),
  ];
}

export function addManualProject(tasks: DraftTask[], programIdx: number): DraftTask[] {
  const sibling = tasks.find((task) => task.programIdx === programIdx);
  if (!sibling) return tasks;
  const projectIdx = tasks.reduce(
    (highest, task) => task.programIdx === programIdx ? Math.max(highest, task.projectIdx) : highest,
    -1,
  ) + 1;

  return [
    ...tasks,
    createManualPlanTask({
      proposalTitle: sibling.proposalTitle,
      programIdx,
      projectIdx,
      activityIdx: 0,
      programTitle: sibling.programTitle,
    }),
  ];
}

export function addManualActivity(
  tasks: DraftTask[],
  programIdx: number,
  projectIdx: number,
): DraftTask[] {
  const sibling = tasks.find(
    (task) => task.programIdx === programIdx && task.projectIdx === projectIdx,
  );
  if (!sibling) return tasks;
  const activityIdx = tasks.reduce(
    (highest, task) =>
      task.programIdx === programIdx && task.projectIdx === projectIdx
        ? Math.max(highest, task.activityIdx)
        : highest,
    -1,
  ) + 1;

  return [
    ...tasks,
    createManualPlanTask({
      proposalTitle: sibling.proposalTitle,
      programIdx,
      projectIdx,
      activityIdx,
      programTitle: sibling.programTitle,
      projectTitle: sibling.projectTitle,
    }),
  ];
}

export function addManualTask(
  tasks: DraftTask[],
  programIdx: number,
  projectIdx: number,
  activityIdx: number,
): DraftTask[] {
  const sibling = tasks.find(
    (task) =>
      task.programIdx === programIdx &&
      task.projectIdx === projectIdx &&
      task.activityIdx === activityIdx,
  );
  if (!sibling) return tasks;
  const taskIdx = nextIndex(
    tasks,
    (task) =>
      task.programIdx === programIdx &&
      task.projectIdx === projectIdx &&
      task.activityIdx === activityIdx,
  );

  return [
    ...tasks,
    createManualPlanTask({
      proposalTitle: sibling.proposalTitle,
      programIdx,
      projectIdx,
      activityIdx,
      programTitle: sibling.programTitle,
      projectTitle: sibling.projectTitle,
      activityTitle: sibling.activityTitle,
      activitySchedule: sibling.activitySchedule,
      taskIdx,
    }),
  ];
}

export function renameManualPlan(tasks: DraftTask[], proposalTitle: string): DraftTask[] {
  return tasks.map((task) => refreshHierarchy({ ...task, proposalTitle }));
}

export function renameManualProgram(
  tasks: DraftTask[],
  programIdx: number,
  programTitle: string,
): DraftTask[] {
  return tasks.map((task) =>
    task.programIdx === programIdx
      ? refreshHierarchy({ ...task, programTitle })
      : task,
  );
}

export function renameManualProject(
  tasks: DraftTask[],
  programIdx: number,
  projectIdx: number,
  projectTitle: string,
): DraftTask[] {
  return tasks.map((task) =>
    task.programIdx === programIdx && task.projectIdx === projectIdx
      ? refreshHierarchy({ ...task, projectTitle })
      : task,
  );
}

export function updateManualActivity(
  tasks: DraftTask[],
  programIdx: number,
  projectIdx: number,
  activityIdx: number,
  changes: Pick<DraftTask, "activityTitle" | "activitySchedule">,
): DraftTask[] {
  return tasks.map((task) =>
    task.programIdx === programIdx &&
    task.projectIdx === projectIdx &&
    task.activityIdx === activityIdx
      ? refreshHierarchy({
          ...task,
          ...changes,
          deadline: task.deadline || changes.activitySchedule,
        })
      : task,
  );
}
