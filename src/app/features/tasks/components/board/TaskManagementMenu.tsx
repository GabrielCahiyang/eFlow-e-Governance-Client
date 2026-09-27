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
import { useEffect, useRef, useState, type ReactNode } from "react";
import { IconButton } from "@vibe/core";
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
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const invoke = (action: ((task: Task) => void) | undefined) => {
    setOpen(false);
    action?.(task);
  };
  const hasWorkflowActions = Boolean(
    onStart || onSubmit || (task.status === "for_review" && (onApprove || onReject)),
  );
  const hasManagementActions = Boolean(
    (task.status !== "completed" && onEdit) ||
      onEditTeam ||
      (task.status === "completed" && onReopen) ||
      (!task.archivedAt && !["completed", "cancelled", "for_review"].includes(task.status) && onCancel) ||
      onArchive ||
      onDelete,
  );

  useEffect(() => {
    if (!open) return;

    const closeOnOutsidePointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", closeOnOutsidePointerDown);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointerDown);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  if (!hasWorkflowActions && !hasManagementActions) return null;

  return (
    <div ref={menuRef} className="relative">
      <IconButton
        aria-label={`Open actions for ${task.title}`}
        icon={MoreActions}
        kind="tertiary"
        size="small"
        onClick={(event) => { event.stopPropagation(); setOpen((value) => !value); }}
      />
      {open && (
          <div
            data-placement={menuPlacement}
            className={`absolute right-0 z-40 w-[180px] overflow-hidden rounded-lg border border-border bg-background p-2 shadow-[0_6px_10px_rgba(0,0,0,0.2)] ${
              menuPlacement === "top" ? "bottom-8" : "top-8"
            }`}
          >
            {onStart && <MenuItem icon={<Play size={14} />} label="Start task" onClick={() => invoke(onStart)} />}
            {onSubmit && <MenuItem icon={<Send size={14} />} label="Submit for review" onClick={() => invoke(onSubmit)} />}
            {task.status === "for_review" && onApprove && <MenuItem icon={<span aria-hidden="true">✓</span>} label="Approve" tone="positive" onClick={() => invoke(onApprove)} />}
            {task.status === "for_review" && onReject && <MenuItem icon={<span aria-hidden="true">×</span>} label="Request changes" tone="danger" onClick={() => invoke(onReject)} />}
            {hasWorkflowActions && hasManagementActions && <div className="my-1 border-t border-border" />}
            {task.status !== "completed" && onEdit && <MenuItem icon={<Pencil size={13} />} label="Edit task details" onClick={() => invoke(onEdit)} />}
            {onEditTeam && <MenuItem icon={<UserRoundCog size={13} />} label="Edit team and lead" onClick={() => invoke(onEditTeam)} />}
            {task.status === "completed" && onReopen && <MenuItem icon={<RotateCcw size={13} />} label="Reopen task" tone="warn" onClick={() => invoke(onReopen)} />}
            {!task.archivedAt && !["completed", "cancelled", "for_review"].includes(task.status) && onCancel && (
              <MenuItem icon={<XCircle size={13} />} label="Cancel task" tone="warn" onClick={() => invoke(onCancel)} />
            )}
            {onArchive && (
              <MenuItem
                icon={task.archivedAt ? <ArchiveRestore size={13} /> : <Archive size={13} />}
                label={task.archivedAt ? "Restore from archive" : "Archive task"}
                onClick={() => invoke(onArchive)}
              />
            )}
            {onDelete && (
              <>
                <div className="my-1 border-t border-border" />
                <MenuItem icon={<Trash2 size={13} />} label="Delete task" tone="danger" onClick={() => invoke(onDelete)} />
              </>
            )}
          </div>
      )}
    </div>
  );
}

function MenuItem({ icon, label, tone = "default", onClick }: { icon: ReactNode; label: string; tone?: "default" | "positive" | "warn" | "danger"; onClick: () => void }) {
  const toneClass = tone === "danger"
    ? "text-destructive hover:bg-destructive/10"
    : tone === "positive"
      ? "text-[#00854d] hover:bg-[#e5f7ef]"
    : tone === "warn"
      ? "text-[#b65b08] hover:bg-[#fff1d8]"
      : "text-foreground hover:bg-accent";
  return <button type="button" onClick={onClick} className={`flex h-8 w-full items-center gap-2 rounded px-2 text-left text-sm ${toneClass}`}>{icon}<span>{label}</span></button>;
}
