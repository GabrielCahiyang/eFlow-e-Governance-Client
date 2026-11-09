import type { WorkspaceSnapshot } from "../workspaces";

export interface StartupReadScope {
  actorId: string;
  role: string;
  officeId: string;
  fiscalYear?: number;
  sections: ReadonlySet<string>;
  workspace?: WorkspaceSnapshot;
  officeTaskIds: string[];
}

/** Populate the same snapshots the visible screens consume, using read-only calls. */
export async function warmStartupReads(scope: StartupReadScope, isCurrent: () => boolean) {
  const { actorId, role, officeId, sections, workspace, officeTaskIds } = scope;
  const jobs: Array<() => Promise<unknown>> = [];
  const add = <T,>(load: () => Promise<T>, read: (module: T) => Promise<unknown>) => {
    jobs.push(async () => {
      const module = await load();
      if (isCurrent()) await read(module);
    });
  };

  if (sections.has("personal_work") || role === "member") {
    add(() => import("../personal-work"), module => module.warmWorkFeed(actorId));
  }
  if (workspace && sections.has("dashboard") && role !== "member") {
    const projectIds = workspace.projects
      .filter(project => workspace.workspace.kind === "personal" ? !project.shortcut : project.kind === "office")
      .map(project => project.id);
    add(() => import("../personal-work"), module =>
      module.warmWorkFeed(actorId, { workspace: workspace.workspace, projectIds }),
    );
  }
  add(() => import("../chat-calls"), module => module.warmConversations(actorId));
  if (sections.has("inbox")) {
    add(() => Promise.all([
      import("../action-center"),
      import("../../services/notificationService"),
    ]), ([inbox, notifications]) => inbox.warmPersonalFeed(actorId, notifications.fetchRecentNotifications));
  }
  if (sections.has("reviews") && role !== "admin") {
    add(() => Promise.all([
      import("../action-center"),
      import("../subtasks"),
    ]), ([inbox, subtasks]) => inbox.warmPersonalFeed(actorId, subtasks.fetchPersonalSubtaskReviews));
    add(() => import("../interdepartment-collaboration"), module => module.fetchMyCollaborationMemberships(actorId));
  }

  const hasBudget = sections.has("budget") || sections.has("reviews") && role === "head";
  const hasAccounting = Array.from(sections).some(section => section.startsWith("accounting_"));
  if (officeId && (hasBudget || hasAccounting)) {
    add(() => import("../budget"), async module => {
      const year = scope.fiscalYear ?? module.getCurrentFiscalYear();
      await Promise.allSettled([
        module.warmDepartmentBudget(officeId, year, actorId),
        hasAccounting || sections.has("budget")
          ? module.warmGeneralJournal(officeId, year, actorId)
          : Promise.resolve(),
      ]);
    });
  }
  if (role === "head" && sections.has("team")) {
    add(() => import("../office-team"), module => module.warmOfficeTeam(`${actorId}:${officeId}`));
  }
  if (sections.has("team") || sections.has("intelligence") || sections.has("reports") || sections.has("tasks")) {
    add(() => import("../../../lib/supabaseService"), module => module.fetchAllProfiles());
    add(() => import("../../services/employeeService"), module => module.fetchEmployees());
  }
  if (role === "head" && (sections.has("team") || sections.has("intelligence") || sections.has("tasks"))) {
    add(() => import("../../services/employeeNotesService"), module => module.fetchEmployeeNotesMap());
  }
  if (role === "head" && officeTaskIds.length && (sections.has("team") || sections.has("reports") || sections.has("intelligence"))) {
    add(() => import("../team-management"), module => module.warmTeamWorkflowFacts(officeTaskIds));
  }
  if (sections.has("users")) {
    add(() => import("../../../lib/supabaseService"), module => module.fetchAllProfiles());
  }

  let next = 0;
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (isCurrent() && next < jobs.length) {
      const job = jobs[next++];
      try {
        await job();
      } catch {
        // The destination keeps its own error and retry behavior.
      }
    }
  }));
}
