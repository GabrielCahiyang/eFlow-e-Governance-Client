import { useState } from "react";
import { useAuth } from "../../../contexts/AuthContext";
import { TaskInspector } from "../../task-inspector";
import { isTaskLead } from "../../tasks";
import { canUserReviewTask } from "../../reviews";
import { SubtaskWorkDrawer, getSubtaskPrerequisite } from "../../subtasks";
import { WorkTree } from "../../nested-work";
import { PersonalWorkInspector } from "../../workspaces";
import { FeatureDialog } from "../../../components/ui/FeatureDialog";
import { requestNavigation } from "../../../shared/navigationGuard";
import type { WorkRow } from "../types";
export function useWorkInspector() {
  const [selection, setSelection] = useState<{
    row: WorkRow;
    element: HTMLElement;
  }>();
  const open = (row: WorkRow, element: HTMLElement) =>
    void requestNavigation(() => setSelection({ row, element }));
  const close = () => {
    const key = selection?.row.key,
      element = selection?.element;
    setSelection(undefined);
    requestAnimationFrame(() => {
      if (element?.isConnected) element.focus();
      else {
        const rows = [
          ...document.querySelectorAll<HTMLElement>("[data-work-key]"),
        ];
        (
          rows.find((r) => r.dataset.workKey === key) ||
          document.getElementById("personal-work-search")
        )?.focus();
      }
    });
  };
  return { selection, open, close };
}
export function WorkInspector({
  selected,
  current,
  onClose,
}: {
  selected: ReturnType<typeof useWorkInspector>["selection"];
  current: WorkRow[];
  onClose: () => void;
}) {
  const { user, userProfile } = useAuth();
  if (!selected) return null;
  const row = current.find((r) => r.key === selected.row.key) || selected.row;
  const unavailable = !current.some((r) => r.key === row.key);
  const readOnly = unavailable || row.history || !row.actionable;
  if (row.kind === "office-task")
    return (
      <TaskInspector
        task={row.task || null}
        taskId={row.id}
        origin={{
          view: "My Work",
          returnFocus: selected.element,
          restoreFocus: () =>
            document.getElementById("personal-work-search")?.focus(),
        }}
        onClose={onClose}
        readOnly={readOnly}
        canDiscuss
        canPostProgress
        canSubmitForReview={
          !readOnly && !!row.task && isTaskLead(row.task, user?.id)
        }
        canReview={
          !readOnly &&
          !!row.task &&
          canUserReviewTask(row.task, user?.id, userProfile?.role)
        }
      />
    );
  if (row.kind === "office-node")
    return (
      <SubtaskWorkDrawer
        key={row.key}
        subtask={row.subtask || null}
        parentTask={row.task}
        readOnly={
          readOnly || (!!row.node && !row.node.can_work && !row.node.can_review)
        }
        currentReviewerId={row.node?.current_reviewer || undefined}
        prerequisite={
          row.tree && row.subtask
            ? getSubtaskPrerequisite(
                row.subtask,
                row.tree.nodes
                  .filter(
                    (n) => n.parent_subtask_id === row.node?.parent_subtask_id,
                  )
                  .map((n) => ({
                    ...row.subtask!,
                    id: n.id,
                    position: n.sibling_order,
                    isStandalone: n.is_standalone,
                    status: n.status,
                    isCompleted: n.status === "completed",
                  })),
              )
            : undefined
        }
        onClose={onClose}
      />
    );
  if (row.kind === "personal-task")
    return (
      <PersonalWorkInspector
        key={row.key}
        workspace={row.workspaceId!}
        project={row.projectId!}
        task={row.id}
        userId={user?.id || ""}
        onClose={onClose}
      />
    );
  return (
    <FeatureDialog
      title={`Personal subitem · ${row.title}`}
      onClose={() => void requestNavigation(onClose)}
      contentClassName="r10-personal-inspector"
    >
      <h2>{row.title}</h2>
      <p>
        {row.workspaceName} · {row.projectTitle} · {row.rootTitle}
      </p>
      {unavailable && (
        <p role="alert">
          This work is no longer available. Close and refresh your work.
        </p>
      )}
      <WorkTree
        rootId={row.rootId}
        readOnly={readOnly}
        focusedNodeId={row.id}
      />
    </FeatureDialog>
  );
}
