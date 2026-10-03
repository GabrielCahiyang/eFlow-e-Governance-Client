export const sameRoleAccessFixture = {
  role: "head",
  rolePermissions: [
    { role: "head", permission: "tasks.assign", allowed: true },
    { role: "head", permission: "reports.export", allowed: true },
  ],
  heads: [
    {
      id: "head-standard",
      overrides: [],
    },
    {
      id: "head-with-exception",
      overrides: [
        { userId: "head-with-exception", permission: "reports.export", allowed: false },
        { userId: "head-with-exception", permission: "audit.read", allowed: true },
      ],
    },
  ],
} as const;

export const orderedProjectWorkflowFixture = {
  projectId: "project-1",
  milestones: [{ id: "milestone-1", projectId: "project-1" }],
  tasks: [{ id: "task-1", linkedProjectId: "project-1", milestoneId: "milestone-1" }],
  subtasks: [
    { id: "subtask-invite", taskId: "task-1", position: 0, title: "Invite participants" },
    { id: "subtask-slides", taskId: "task-1", position: 1, title: "Prepare presentation" },
    { id: "subtask-minutes", taskId: "task-1", position: 2, title: "Submit minutes and evidence" },
  ],
} as const;

export const monthlyContributionFixture = {
  timezone: "Asia/Manila",
  periods: ["2026-07", "2026-08"],
  employees: ["employee-1", "employee-2"],
} as const;

