import type { WorkspaceSnapshot } from "../workspaces";

export interface StartupReadScope {
  actorId: string;
  role: string;
  officeId: string;
  activeSection?: string;
  fiscalYear?: number;
  sections: ReadonlySet<string>;
  workspace?: WorkspaceSnapshot;
  officeTaskIds: string[];
}

/** Populate only lightweight and active-route snapshots after the shell renders. */
export async function warmStartupReads(scope: StartupReadScope, isCurrent: () => boolean) {
  const { actorId, role, officeId, activeSection, sections, workspace, officeTaskIds } = scope;
  const jobs: Array<() => Promise<unknown>> = [];
  const add = <T,>(load: () => Promise<T>, read: (module: T) => Promise<unknown>) => {
    jobs.push(async () => {
      const module = await load();
      if (isCurrent()) await read(module);
    });
  };

  // Warm only the active feed route to avoid duplicate r7_work_tree fan-outs across hidden tabs.
  if (activeSection === "personal_work" || (role === "member" && !activeSection && sections.has("personal_work"))) {
    add(() => import("../personal-work"), module => module.warmWorkFeed(actorId));
  } else if (workspace && activeSection === "dashboard" && role !== "member" && sections.has("dashboard")) {
    const projectIds = workspace.projects
      .filter(project => workspace.workspace.kind === "personal" ? !project.shortcut : project.kind === "office")
      .map(project => project.id);
    add(() => import("../personal-work"), module =>
      module.warmWorkFeed(actorId, { workspace: workspace.workspace, projectIds }),
    );
  }

  if (activeSection === "inbox" && sections.has("inbox")) {
    add(() => Promise.all([
      import("../action-center"),
      import("../../services/notificationService"),
    ]), ([inbox, notifications]) => inbox.warmPersonalFeed(actorId, notifications.fetchRecentNotifications));
  }
  if (activeSection === "reviews" && sections.has("reviews") && role !== "admin") {
    add(() => Promise.all([
      import("../action-center"),
      import("../subtasks"),
    ]), ([inbox, subtasks]) => inbox.warmPersonalFeed(actorId, subtasks.fetchPersonalSubtaskReviews));
    add(() => import("../interdepartment-collaboration"), module => module.fetchMyCollaborationMemberships(actorId));
  }

  const viewingAccounting = Boolean(activeSection?.startsWith("accounting_"));
  const viewingBudget = activeSection === "budget" || viewingAccounting;
  if (officeId && viewingBudget && (sections.has("budget") || viewingAccounting)) {
    add(() => import("../budget"), async module => {
      const year = scope.fiscalYear ?? module.getCurrentFiscalYear();
      await Promise.allSettled([
        module.warmDepartmentBudget(officeId, year, actorId),
        viewingAccounting || sections.has("budget")
          ? module.warmGeneralJournal(officeId, year, actorId)
          : Promise.resolve(),
      ]);
    });
  }
  if (role === "head" && sections.has("team")) {
    add(() => import("../office-team"), module => module.warmOfficeTeam(`${actorId}:${officeId}`));
  }
  if (["team", "intelligence", "reports", "tasks"].includes(activeSection || "") &&
      (sections.has("team") || sections.has("intelligence") || sections.has("reports") || sections.has("tasks"))) {
    add(() => import("../../../lib/supabaseService"), module => module.fetchAllProfiles());
    add(() => import("../../services/employeeService"), module => module.fetchEmployees());
  }
  if (role === "head" && ["team", "intelligence", "tasks"].includes(activeSection || "") &&
      (sections.has("team") || sections.has("intelligence") || sections.has("tasks"))) {
    add(() => import("../../services/employeeNotesService"), module => module.fetchEmployeeNotesMap());
  }
  if (role === "head" && officeTaskIds.length && ["team", "reports", "intelligence"].includes(activeSection || "") &&
      (sections.has("team") || sections.has("reports") || sections.has("intelligence"))) {
    add(() => import("../team-management"), module => module.warmTeamWorkflowFacts(officeTaskIds));
  }
  if (activeSection === "users" && sections.has("users")) {
    add(() => import("../../../lib/supabaseService"), module => module.fetchAllProfiles());
  }

  let next = 0;
  await Promise.all(Array.from({ length: 2 }, async () => {
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
