import { ArrowRight } from 'lucide-react';
import type { Task } from '../../services/taskService';
import { formatDate, relativeDays } from '../workflow/primitives';
import { TaskStatusBadge } from '../workflow/StatusBadges';

export function TaskRow({ task, onOpen }: { task: Task; onOpen: () => void }) {
  const rel = relativeDays(task.deadline || task.dueDate);
  return (
    <button onClick={onOpen} className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/60">
      <div className="flex-1 min-w-0">
        <div className="truncate text-[12.5px] font-medium text-foreground">{task.title}</div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="truncate text-[10.5px] font-medium text-muted-foreground">
            {task.assigneeName || "Unassigned"}{task.teamMemberNames && task.teamMemberNames.length > 1 ? ` + ${task.teamMemberNames.length - 1}` : ""}
          </span>
          <span className="text-border">·</span>
          <span className={`text-[10.5px] font-medium ${rel.overdue ? "text-destructive" : "text-muted-foreground"}`}>
            {formatDate(task.deadline || task.dueDate)}
          </span>
        </div>
      </div>
      <TaskStatusBadge status={task.status} size="sm" />
      <ArrowRight size={14} className="shrink-0 text-muted-foreground/60" />
    </button>
  );
}
