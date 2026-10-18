import { isTaskLead, type Task } from "../../tasks";
import type { Subtask } from "../../subtasks";
import {buildWorkNodeDisplayMetadata,mergeWorkDisplayMetadata,type WorkTreeSnapshot} from "../../nested-work";
import type { WorkRow, WorkSnapshot } from "../types";
type OfficeContext = Pick<
  WorkRow,
  | "projectId"
  | "projectTitle"
  | "workspaceId"
  | "workspaceName"
  | "officeName"
  | "timezone"
>;
/** Assignment of a descendant never promotes its root to the actor's own assignments. */
export function appendOfficeRows(
  out: WorkSnapshot,
  userId: string,
  offices: Task[],
  officeContext: (task: Task) => OfficeContext,
  treeMap: Map<string, WorkTreeSnapshot>,
  subtaskMap: Map<string, Subtask>,
  projectMap: Map<string, Record<string, unknown>>,
  denied: Set<string>,
) {
  for (const task of offices) {
    const context = officeContext(task),
      tree = treeMap.get(task.id);
    if (denied.has(task.id)) continue;
    const history =
      !!task.archivedAt ||
      ["completed", "cancelled"].includes(task.status) ||
      ["completed", "archived"].includes(
        String(projectMap.get(task.linkedProjectId || "")?.status),
      );
    const eligible =
      !tree || tree.people.some((p) => p.id === userId && p.eligible);
    const leading = isTaskLead(task, userId),
      contributor = task.teamMemberIds?.includes(userId),
      recommended = task.recommendationLeadId === userId;
    const mine = !!(leading || contributor || recommended);
    const open = tree ? tree.root.open : !history;
    out.rows.push({
      ...context,
      key: `office-task:${task.id}`,
      id: task.id,
      rootId: task.id,
      title: task.title,
      kind: "office-task",
      blocker:tree?.root.blocker,
      status: task.status,
      due: task.deadline || task.dueDate,
      progress: task.percentComplete || 0,
      updatedAt: task.updatedAt,
      mine,
      leading: leading && eligible,
      actionable: open && (!mine || eligible),
      history,
      relation: leading
        ? "Task Lead"
        : contributor
          ? "Contributor"
          : recommended
            ? "Recommended lead"
            : !task.assigneeId && !task.recommendationLeadId
              ? "Needs reassignment"
              : "Office work",
      task,
      tree,
    });
    if (tree) {
      const metadata=buildWorkNodeDisplayMetadata(tree.nodes,{rootId:task.id,rootTitle:task.title,people:tree.people});
      for (const node of tree.nodes) {
        const workContext=metadata.get(node.id);
        if(!workContext)continue;
        const record=subtaskMap.get(node.id);
        const sub=record?.taskId===task.id?mergeWorkDisplayMetadata(record,workContext):undefined;
        const mine =
          node.lead_id === userId || node.assigned_to_ids.includes(userId);
        out.rows.push({
          ...context,
          key: `office-node:${node.id}`,
          id: node.id,
          rootId: task.id,
          title: node.title,
          rootTitle: task.title,
          workContext,
          kind: "office-node",
          blocker:node.blocker,
          status: node.status,
          due: node.due_date,
          progress: node.percent_complete,
          updatedAt: sub?.updatedAt,
          mine,
          leading: node.lead_id === userId && eligible,
          actionable: tree.root.open && (!mine || eligible),
          history: history || node.status === "completed",
          relation: !node.lead_id
            ? "Needs reassignment"
            : node.lead_id === userId
              ? "Subitem Lead"
              : "Contributor",
          task,
          subtask: sub,
          node,
          tree,
        });
      }
    } else {
      for (const sub of subtaskMap.values()) {
        if (sub.taskId !== task.id) continue;
        const mine = sub.assignedToIds.includes(userId);
        out.rows.push({
          ...context,
          key: `office-node:${sub.id}`,
          id: sub.id,
          rootId: task.id,
          title: sub.title,
          rootTitle: task.title,
          kind: "office-node",
          status: sub.status,
          due: sub.dueDate,
          progress: sub.percentComplete,
          updatedAt: sub.updatedAt,
          mine,
          leading: false,
          actionable: !history,
          history: history || sub.isCompleted,
          relation: "Assigned subtask",
          task,
          subtask: sub,
        });
      }
    }
  }
}
