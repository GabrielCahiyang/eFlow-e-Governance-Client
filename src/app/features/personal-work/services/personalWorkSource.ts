import { fetchPersonalProject } from "../../workspaces";
import { fetchWorkTree, WorkTreeUnavailable } from "../../nested-work";
import type { WorkSnapshot } from "../types";
import { settledMap, message } from "./workSourceReads";
/** Personal projects use their own membership and completion contract. */
export async function appendPersonalRows(out: WorkSnapshot, userId: string) {
  const personalProjects = out.projects.filter((p) => p.kind === "personal");
  const personalResults = await settledMap(
    personalProjects,
    async (project) => ({
      project,
      snapshot: await fetchPersonalProject(project.id),
    }),
  );
  for (let i = 0; i < personalResults.length; i++) {
    const r = personalResults[i];
    if (r.status === "rejected") {
      out.issues.push(
        `Personal project · ${personalProjects[i].title}: ${message(r.reason)}`,
      );
      continue;
    }
    const { project, snapshot } = r.value;
    const w = out.workspaces.find(
      (w) => w.id === snapshot.project.workspace_id,
    );
    const eligible =
      snapshot.owner === userId ||
      snapshot.members.some(
        (m) => m.user_id === userId && m.eligible && m.state === "active",
      );
    const personalTrees = await settledMap(snapshot.tasks, (t) =>
      fetchWorkTree(t.id),
    );
    snapshot.tasks.forEach((task, index) => {
      const tr = personalTrees[index];
      if (
        tr.status === "rejected" &&
        !(tr.reason instanceof WorkTreeUnavailable)
      ) {
        out.issues.push(`Personal tree · ${task.title}: ${message(tr.reason)}`);
        return;
      }
      const tree = tr.status === "fulfilled" ? tr.value : undefined,
        history =
          snapshot.project.status !== "active" || task.status === "done";
      const context = {
        projectId: project.id,
        projectTitle: project.title,
        workspaceId: w?.id || snapshot.project.workspace_id,
        workspaceName: w?.name || project.workspace_name,
        timezone: w?.timezone || project.timezone,
      };
      out.rows.push({
        ...context,
        key: `personal-task:${task.id}`,
        id: task.id,
        rootId: task.id,
        title: task.title,
        kind: "personal-task",
        status: task.status === "done" ? "completed" : task.status,
        due: tree?.root.due,
        progress: task.progress,
        mine: task.lead_id === userId,
        leading: task.lead_id === userId && eligible,
        actionable: !history && eligible,
        history,
        relation: !task.lead_id ? "Needs reassignment" : "Task Lead",
        personalTask: task,
        personal: snapshot,
        tree,
      });
      if (tree)
        for (const node of tree.nodes) {
          const mine =
            node.lead_id === userId || node.assigned_to_ids.includes(userId);
          out.rows.push({
            ...context,
            key: `personal-node:${node.id}`,
            id: node.id,
            rootId: task.id,
            title: node.title,
            rootTitle: task.title,
            kind: "personal-node",
            status: node.status,
            due: node.due_date,
            progress: node.percent_complete,
            mine,
            leading: node.lead_id === userId && eligible,
            actionable: tree.root.open && eligible,
            history: history || node.status === "completed",
            relation: !node.lead_id
              ? "Needs reassignment"
              : node.lead_id === userId
                ? "Subitem Lead"
                : "Contributor",
            node,
            tree,
            personal: snapshot,
          });
        }
    });
  }
}
