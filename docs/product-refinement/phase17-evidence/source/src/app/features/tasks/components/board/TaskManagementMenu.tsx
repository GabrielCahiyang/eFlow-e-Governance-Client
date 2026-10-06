import {
  Archive,
  ArchiveRestore,
  Pencil,
  Play,
  RotateCcw,
  Send,
  Trash2,
  UserRoundCog,
  XCircle,
} from "lucide-react";
import type { ReactNode } from "react";
import {
  ActionMenu,
  type WorkspaceAction,
} from "../../../../components/ui/workspace/ActionMenu";
import { MoreActions } from "@vibe/icons";
import type { Task } from "../../../../services/taskService";

export function TaskManagementMenu({
  task,
  onEdit,
  onEditTeam,
  onArchive,
  onCancel,
  onDelete,
  onReopen,
  onStart,
  onSubmit,
  onApprove,
  onReject,
  menuPlacement = "bottom",
}: {
  task: Task;
  onEdit?: (task: Task) => void;
  onEditTeam?: (task: Task) => void;
  onArchive?: (task: Task) => void;
  onCancel?: (task: Task) => void;
  onDelete?: (task: Task) => void;
  onReopen?: (task: Task) => void;
  onStart?: (task: Task) => void;
  onSubmit?: (task: Task) => void;
  onApprove?: (task: Task) => void;
  onReject?: (task: Task) => void;
  menuPlacement?: "top" | "bottom";
}) {
  const actions: WorkspaceAction[] = [];
  const add = (
    id: string,
    label: string,
    icon: ReactNode,
    handler?: (task: Task) => void,
  ) => {
    if (handler)
      actions.push({
        id,
        label,
        icon,
        variant: id === "delete" ? "destructive" : "default",
        onSelect: () => handler(task),
      });
  };
  add("start", "Start task", <Play size={14} />, onStart);
  add("submit", "Submit for review", <Send size={14} />, onSubmit);
  if (task.status === "for_review") {
    add("approve", "Approve", <span aria-hidden="true">✓</span>, onApprove);
    add(
      "reject",
      "Request changes",
      <span aria-hidden="true">×</span>,
      onReject,
    );
  }
  if (task.status !== "completed")
    add("edit", "Edit task details", <Pencil size={13} />, onEdit);
  add("team", "Edit team and lead", <UserRoundCog size={13} />, onEditTeam);
  if (task.status === "completed")
    add("reopen", "Reopen task", <RotateCcw size={13} />, onReopen);
  if (
    !task.archivedAt &&
    !["completed", "cancelled", "for_review"].includes(task.status)
  )
    add("cancel", "Cancel task", <XCircle size={13} />, onCancel);
  add(
    "archive",
    task.archivedAt ? "Restore from archive" : "Archive task",
    task.archivedAt ? <ArchiveRestore size={13} /> : <Archive size={13} />,
    onArchive,
  );
  add("delete", "Delete task", <Trash2 size={13} />, onDelete);
  if (!actions.length) return null;
  return (
    <div
      data-placement={menuPlacement}
      onClick={(event) => event.stopPropagation()}
    >
      <ActionMenu
        side={menuPlacement}
        actions={actions}
        trigger={
          <button
            type="button"
            aria-label={`Open actions for ${task.title}`}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
          >
            <MoreActions size={16} />
          </button>
        }
      />
    </div>
  );
}
