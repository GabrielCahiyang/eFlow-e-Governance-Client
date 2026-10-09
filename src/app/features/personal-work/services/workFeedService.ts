import { readWorkTable, settledMap, message } from "./workSourceReads";
export { readWorkTable } from "./workSourceReads";
import { appendOfficeRows } from "./officeWorkRows";
import { appendPersonalRows } from "./personalWorkSource";
import { rowToTask, type Task } from "../../tasks";
import { rowToSubtask } from "../../subtasks";
import {
  fetchOfficeWorkRoots,
  fetchWorkTree,
  WorkTreeUnavailable,
  type WorkTreeSnapshot,
} from "../../nested-work";
import {
  listWorkspaces,
  selectWorkspace,
  WorkspaceApiUnavailable,
  type Workspace,
} from "../../workspaces";
import type { WorkSnapshot, WorkScope } from "../types";

export async function loadWorkFeed(
  userId: string,
  scope?: WorkScope,
): Promise<WorkSnapshot> {
  const out: WorkSnapshot = {
    rows: [],
    projects: [],
    workspaces: [],
    issues: [],
    unavailable: [],
    loadedAt: Date.now(),
  };
  if (!userId) return out;
  const personalOnly = scope?.workspace.kind === "personal";
  const initial = await Promise.allSettled([
    personalOnly ? Promise.resolve([]) : readWorkTable("tasks"),
    personalOnly ? Promise.resolve([]) : readWorkTable("projects"),
    scope ? Promise.resolve([scope.workspace]) : listWorkspaces(),
    personalOnly ? Promise.resolve([]) : readWorkTable("subtasks"),
    personalOnly ? Promise.resolve([]) : fetchOfficeWorkRoots(),
  ]);
  const labels = [
    "Office tasks",
    "Project context",
    "Workspaces",
    "Office subitems",
    "Assigned branches",
  ];
  const records = initial.map((result, index) => {
    if (result.status === "fulfilled") return result.value;
    if (result.reason instanceof WorkspaceApiUnavailable) {
      out.unavailable.push(
        "Personal workspace aggregation requires the R3 migration.",
      );
    } else out.issues.push(`${labels[index]}: ${message(result.reason)}`);
    return [];
  });
  out.workspaces = records[2] as Workspace[];
  const selections = await settledMap(out.workspaces, (w) =>
    selectWorkspace(w.id),
  );
  selections.forEach((result, index) => {
    const w = out.workspaces[index];
    if (result.status === "fulfilled") {
      for (const project of result.value.projects) {
        if (project.shortcut) continue;
        if (scope?.projectIds && !scope.projectIds.includes(project.id))
          continue;
        if (!out.projects.some((p) => p.id === project.id))
          out.projects.push({
            ...project,
            workspace_name: w.name,
            timezone: w.timezone,
          });
      }
    } else if (result.reason instanceof WorkspaceApiUnavailable)
      (personalOnly ? out.issues : out.unavailable).push(
        personalOnly
          ? "Personal workspace sources require the R3 migration."
          : "Workspace totals use legacy Office sources until R3 is installed.",
      );
    else out.issues.push(`${w.name}: ${message(result.reason)}`);
  });
  const projectRecords = records[1] as Record<string, unknown>[];
  const projectMap = new Map(projectRecords.map((p) => [String(p.id), p]));
  const rawTasks = records[0] as Record<string, unknown>[];
  const taskMap = new Map(
    [...rawTasks.map(rowToTask), ...(records[4] as Task[])].map((t) => [
      t.id,
      t,
    ]),
  );
  const subtaskMap = new Map(
    (records[3] as Record<string, unknown>[]).map((raw) => {
      const sub = rowToSubtask(raw);
      return [sub.id, sub] as const;
    }),
  );
  const officeContext = (task: Task) => {
    const project = projectMap.get(task.linkedProjectId || "");
    const home = out.projects.find((p) => p.id === task.linkedProjectId);
    const workspace =
      out.workspaces.find((w) => w.id === home?.home_workspace_id) ||
      out.workspaces.find(
        (w) => w.kind === "office" && w.office_id === task.orgId,
      );
    return {
      projectId: task.linkedProjectId,
      projectTitle: String(
        project?.title ||
          task.projectTitle ||
          task.activityTitle ||
          "Office work",
      ),
      workspaceId: home?.home_workspace_id || workspace?.id,
      workspaceName:
        workspace?.name ||
        home?.workspace_name ||
        task.teamName ||
        task.department ||
        "Office work",
      officeName: task.teamName || task.department,
      timezone: workspace?.timezone || home?.timezone || "Asia/Singapore",
    };
  };
  const offices = [...taskMap.values()].filter(
    (task) =>
      !scope ||
      (scope.projectIds
        ? task.linkedProjectId
          ? scope.projectIds.includes(task.linkedProjectId)
          : task.orgId === scope.workspace.office_id
        : task.orgId === scope.workspace.office_id),
  );
  const trees = await settledMap(
    offices.filter(
      (t) =>
        !!t.linkedProjectId &&
        !t.sourceCollaborationDraftId &&
        !t.proposedOfficeIdentityId,
    ),
    async (task) => ({ id: task.id, tree: await fetchWorkTree(task.id) }),
  );
  const treeMap = new Map<string, WorkTreeSnapshot>();
  const denied = new Set<string>();
  const treeTasks = offices.filter(
    (t) =>
      !!t.linkedProjectId &&
      !t.sourceCollaborationDraftId &&
      !t.proposedOfficeIdentityId,
  );
  trees.forEach((r, i) => {
    if (r.status === "fulfilled") treeMap.set(r.value.id, r.value.tree);
    else if (!(r.reason instanceof WorkTreeUnavailable)) {
      denied.add(treeTasks[i].id);
      out.issues.push(
        `Work tree · ${treeTasks[i].title}: ${message(r.reason)}`,
      );
    }
  });
  appendOfficeRows(
    out,
    userId,
    offices,
    officeContext,
    treeMap,
    subtaskMap,
    projectMap,
    denied,
  );
  // Legacy servers lack workspace RPCs but still have authorized Office project records.
  if (!personalOnly)
    for (const raw of projectRecords) {
      const id = String(raw.id);
      if (
        (scope &&
          (scope.projectIds
            ? !scope.projectIds.includes(id)
            : raw.org_id !== scope.workspace.office_id)) ||
        out.projects.some((p) => p.id === id)
      )
        continue;
      const w = out.workspaces.find((w) => w.office_id === raw.org_id);
      out.projects.push({
        id,
        title: String(raw.title),
        status: String(raw.status),
        kind: "office",
        home_workspace_id: w?.id || null,
        workspace_name: w?.name || "Office workspace",
        timezone: w?.timezone || "Asia/Singapore",
      });
    }
  await appendPersonalRows(out, userId);
  return {
    ...out,
    rows: [...new Map(out.rows.map((row) => [row.key, row])).values()],
    loadedAt: Date.now(),
  };
}
