import { ListChecks } from "lucide-react";
import type { Employee } from "../../../../services/employeeService";
import type { EmployeeNotesMap } from "../../../../services/employeeNotesService";
import type {
  CreateTaskPayload,
  Task,
  TaskAssignmentDetails,
  TaskStatus,
  UpdateTaskPayload,
} from "../../../../services/taskService";

export type BoardView =
  | "list"
  | "kanban"
  | "timeline"
  | "activity"
  | "hierarchy"
  | "calendar"
  | "workload"
  | "dependencies"
  | "my_work"
  | "due_soon"
  | "overdue"
  | "for_review"
  | "completed";

export type BoardFilterView =
  | "my_work"
  | "due_soon"
  | "overdue"
  | "for_review"
  | "completed";

export const isBoardFilterView = (view: BoardView): view is BoardFilterView =>
  ["my_work", "due_soon", "overdue", "for_review", "completed"].includes(view);

/** The record scope controls archived records; the status filter controls lifecycle state. */
export type TaskRecordScope = "active" | "archived";
export type TaskStatusFilter = "all" | "active" | TaskStatus;

const CLOSED_TASK_STATUSES: readonly TaskStatus[] = ["completed", "cancelled"];

export const filterTasksByRecordScope = (
  tasks: Task[],
  recordScope: TaskRecordScope,
  statusFilter: TaskStatusFilter = "all",
): Task[] =>
  tasks.filter((task) => {
    if (recordScope === "archived") {
      return Boolean(task.archivedAt) &&
        (statusFilter === "all" || statusFilter === "active" || task.status === statusFilter);
    }

    if (task.archivedAt) return false;
    if (statusFilter === "all") return true;
    if (statusFilter === "active") return !CLOSED_TASK_STATUSES.includes(task.status);
    return task.status === statusFilter;
  });

export interface MondayBoardProps {
  tasks: Task[];
  loading?: boolean;
  projects?: Array<{ id: string; title: string }>;
  selectedProjectId?: string;
  onSelectProject?: (projectId: string) => void;
  employees?: Employee[];
  allEmployees?: Employee[];
  employeeNotes?: EmployeeNotesMap;
  role: "depthead" | "employee";
  departmentFilter?: string;
  currentUserId?: string;
  currentUserName?: string;
  onAssign?: (
    taskId: string,
    assigneeId: string,
    assigneeName: string,
    assignment?: TaskAssignmentDetails,
  ) => void;
  onExecute?: (taskId: string) => void;
  onSubmit?: (taskId: string, submission: TaskSubmissionDraft) => void;
  onVerify?: (taskId: string, approve: boolean, feedback?: string) => void;
  onCreateTask?: (
    titleOrPayload: string | CreateTaskPayload,
    description?: string,
    deadline?: string,
  ) => void;
  onUpdateTask?: (
    taskId: string,
    payload: UpdateTaskPayload,
  ) => Promise<void> | void;
  onDeleteTask?: (taskId: string) => Promise<void> | void;
}

export interface TaskEditorDraft {
  title: string;
  description: string;
  deadline: string;
  priority: "low" | "medium" | "high";
  tagsText: string;
  proposalTitle: string;
  programTitle: string;
  projectTitle: string;
  activityTitle: string;
  activitySchedule: string;
  teamMemberIds: string[];
  leadMemberId: string | null;
  reviewerId: string | null;
  backupReviewerId: string | null;
  acceptanceCriteriaText: string;
  definitionOfDone: string;
  dependencyIds: string[];
}

export type TaskSubmissionDraft = {
  note: string;
  attachments: File[];
};

// ─── Constants ────────────────────────────────────────────────────

export const STATUS_ORDER: TaskStatus[] = [
  "pending_assignment",
  "todo",
  "in_progress",
  "changes_requested",
  "for_review",
  "completed",
  "cancelled",
];

export const statusMeta: Record<
  TaskStatus,
  { label: string; color: string; dot: string; colBg: string }
> = {
  pending_assignment: {
    label: "Pending",
    color: "bg-slate-100 text-slate-600 border-slate-200",
    dot: "bg-slate-400",
    colBg: "bg-slate-50",
  },
  todo: {
    label: "To Do",
    color: "bg-blue-50 text-blue-700 border-blue-200",
    dot: "bg-blue-500",
    colBg: "bg-blue-50/40",
  },
  in_progress: {
    label: "In Progress",
    color: "bg-amber-50 text-amber-700 border-amber-200",
    dot: "bg-amber-500",
    colBg: "bg-amber-50/40",
  },
  changes_requested: {
    label: "Changes Requested",
    color: "bg-rose-50 text-rose-700 border-rose-200",
    dot: "bg-rose-500",
    colBg: "bg-rose-50/40",
  },
  for_review: {
    label: "For Review",
    color: "bg-violet-50 text-violet-700 border-violet-200",
    dot: "bg-violet-500",
    colBg: "bg-violet-50/40",
  },
  completed: {
    label: "Completed",
    color: "bg-emerald-50 text-emerald-700 border-emerald-200",
    dot: "bg-emerald-500",
    colBg: "bg-emerald-50/40",
  },
  cancelled: {
    label: "Cancelled",
    color: "bg-neutral-100 text-neutral-500 border-neutral-200",
    dot: "bg-neutral-400",
    colBg: "bg-neutral-50",
  },
};

export const priorityMeta: Record<
  string,
  { bar: string; badge: string; label: string; kanbanBar: string }
> = {
  high: {
    bar: "bg-red-500",
    badge: "bg-red-100 text-red-700",
    label: "High",
    kanbanBar: "bg-red-400",
  },
  medium: {
    bar: "bg-amber-400",
    badge: "bg-amber-100 text-amber-700",
    label: "Med",
    kanbanBar: "bg-amber-400",
  },
  low: {
    bar: "bg-emerald-400",
    badge: "bg-emerald-100 text-emerald-700",
    label: "Low",
    kanbanBar: "bg-emerald-400",
  },
};

// ─── Helpers ─────────────────────────────────────────────────────

export const getInitials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();



export function SubtaskProgressChip({ task }: { task: Task }) {
  const total = task.subtaskCount ?? 0;
  const done = task.subtaskCompletedCount ?? 0;
  if (total === 0) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[9px] text-neutral-600">
      <ListChecks size={10} className={done === total ? "text-emerald-600" : "text-neutral-400"} />
      {done}/{total}
    </span>
  );
}



export type HierarchyDisplay = {
  proposalTitle: string;
  programTitle: string;
  projectTitle: string;
  activityTitle: string;
  activitySchedule?: string;
  path: string;
};

export const getHierarchyDisplay = (task: Task): HierarchyDisplay => {
  const proposalTitle = task.proposalTitle || "Imported Proposal";
  const programTitle = task.programTitle || "Uncategorized Program";
  const projectTitle = task.projectTitle || "Uncategorized Project";
  const activityTitle = task.activityTitle || "Uncategorized Activity";
  const path =
    task.hierarchyPath ||
    [proposalTitle, programTitle, projectTitle, activityTitle]
      .filter(Boolean)
      .join(" > ");

  return {
    proposalTitle,
    programTitle,
    projectTitle,
    activityTitle,
    activitySchedule: task.activitySchedule,
    path,
  };
};

export const uniqueValues = (items: readonly unknown[]): string[] =>
  Array.from(new Set(
    items
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean),
  ));

export const getTaskMemberIds = (task: Task) =>
  uniqueValues([
    ...(task.teamMemberIds || []),
    ...(task.assigneeId ? [task.assigneeId] : []),
    ...(task.recommendedEmployeeIds || []),
  ]);

export const getDirectBoardTransitionError = (
  task: Task,
  newStatus: TaskStatus,
  role: MondayBoardProps["role"],
  currentUserId?: string,
): string | null => {
  if (task.status === newStatus) return null;
  const isParticipant = Boolean(
    currentUserId &&
      (task.assigneeId === currentUserId ||
        task.recommendationLeadId === currentUserId ||
        getTaskMemberIds(task).includes(currentUserId)),
  );
  if (role !== "depthead" && !isParticipant) {
    return "Only a task participant can start or resume this work.";
  }
  if (
    newStatus === "in_progress" &&
    (task.status === "todo" || task.status === "changes_requested")
  ) {
    return null;
  }
  if (newStatus === "for_review") {
    return "Use Submit for Review so the required completion note and evidence are recorded.";
  }
  if (newStatus === "completed" || newStatus === "changes_requested") {
    return "Review decisions must be made from the Reviews workspace.";
  }
  if (newStatus === "todo" || newStatus === "pending_assignment") {
    return "Use Edit Team to assign or reassign this task.";
  }
  return "That lifecycle change is not available from the board.";
};

export const canDragTask = (
  task: Task,
  role: MondayBoardProps["role"],
  currentUserId?: string,
) =>
  (task.status === "todo" || task.status === "changes_requested") &&
  (role === "depthead" ||
    Boolean(
      currentUserId &&
        (task.assigneeId === currentUserId ||
          task.recommendationLeadId === currentUserId ||
          getTaskMemberIds(task).includes(currentUserId)),
    ));

export const getTaskMemberNames = (
  task: Task,
  employeeById: Record<string, Employee>,
) =>
  uniqueValues([
    ...(task.assigneeName ? [task.assigneeName] : []),
    ...(task.teamMemberNames || []),
    ...getTaskMemberIds(task).map((id) => employeeById[id]?.name || ""),
  ]);

export const buildTaskEditorDraft = (task: Task): TaskEditorDraft => ({
  title: task.title || "",
  description: task.description || "",
  deadline: task.deadline || task.dueDate || "",
  priority: task.priority || "medium",
  tagsText: (task.tags || []).join(", "),
  proposalTitle: task.proposalTitle || "",
  programTitle: task.programTitle || "",
  projectTitle: task.projectTitle || "",
  activityTitle: task.activityTitle || "",
  activitySchedule: task.activitySchedule || "",
  teamMemberIds: getTaskMemberIds(task),
  leadMemberId: task.assigneeId || getTaskMemberIds(task)[0] || null,
  reviewerId: task.reviewerId || null,
  backupReviewerId: task.backupReviewerId || null,
  acceptanceCriteriaText: (task.acceptanceCriteria || []).join("\n"),
  definitionOfDone: task.definitionOfDone || "",
  dependencyIds: task.dependencyIds || [],
});

export const parseTaskDeadline = (raw: string): Date | null => {
  const value = raw.trim();
  if (!value) return null;

  // A proposal-relative schedule is not a calendar deadline. Showing it on a
  // date axis would invent a date and make Timeline disagree with reports.
  const monthMatch = value.match(/^(?:month|phase)\s*(\d+)(?:\s*-\s*(\d+))?/i);
  if (monthMatch) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

export const getDeadlineInfo = (task: Task) => {
  const dl = task.deadline || task.dueDate;
  if (!dl) return null;
  const parsedDeadline = parseTaskDeadline(dl);
  if (!parsedDeadline) return null;

  const diff = parsedDeadline.getTime() - Date.now();
  const days = Math.ceil(diff / 86400000);
  if (days < 0)
    return {
      label: `${Math.abs(days)}d overdue`,
      cls: "text-red-600 bg-red-50 border-red-200",
    };
  if (days === 0)
    return {
      label: "Due today",
      cls: "text-amber-600 bg-amber-50 border-amber-200",
    };
  if (days <= 3)
    return {
      label: `${days}d left`,
      cls: "text-amber-600 bg-amber-50 border-amber-200",
    };
  return {
    label: `${days}d left`,
    cls: "text-slate-500 bg-slate-50 border-slate-200",
  };
};

/**
 * Derive additive work views from the existing task records. These are
 * presentation filters only; lifecycle transitions remain owned by the
 * existing task services and board actions.
 */
export const filterTasksByBoardView = (
  tasks: Task[],
  view: BoardFilterView,
  currentUserId?: string,
  now = Date.now(),
): Task[] => {
  if (view === "my_work") {
    if (!currentUserId) return [];
    return tasks.filter((task) => getTaskMemberIds(task).includes(currentUserId));
  }

  if (view === "for_review") {
    return tasks.filter((task) => task.status === "for_review");
  }

  if (view === "completed") {
    return tasks.filter((task) => task.status === "completed");
  }

  return tasks.filter((task) => {
    const deadline = parseTaskDeadline(task.deadline || task.dueDate || "");
    if (!deadline) return false;
    const timestamp = deadline.getTime();
    if (view === "overdue") {
      return timestamp < now && !["completed", "cancelled"].includes(task.status);
    }
    return (
      timestamp >= now &&
      timestamp <= now + 7 * 86400000 &&
      !["completed", "cancelled"].includes(task.status)
    );
  });
};

export const formatShortDateTime = (value?: number) => {
  if (!value) return "";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export interface TaskProjectOption {
  value: string;
  label: string;
  count: number;
}

export function getTaskProjectKey(task: Task): string {
  const explicitId = task.projectId?.trim() || task.linkedProjectId?.trim();
  if (explicitId) return explicitId;
  const explicitTitle = task.projectTitle?.trim() || task.proposalTitle?.trim();
  if (explicitTitle) return `title:${explicitTitle.toLowerCase()}`;
  return "unassigned";
}

export function getTaskProjectLabel(
  task: Task,
  projectTitleById?: Map<string, string>,
): string {
  const explicitId = task.projectId?.trim() || task.linkedProjectId?.trim();
  if (explicitId && projectTitleById?.has(explicitId)) {
    return projectTitleById.get(explicitId)!;
  }
  if (task.projectTitle?.trim()) {
    return task.projectTitle.trim();
  }
  if (task.proposalTitle?.trim()) {
    return task.proposalTitle.trim();
  }
  if (explicitId) {
    return `Project (${explicitId.slice(0, 8)})`;
  }
  return "Unlinked / No project";
}

export function buildProjectFilterOptions(
  tasks: Task[],
  knownProjects?: Array<{ id: string; title: string }>,
): TaskProjectOption[] {
  const projectTitleById = new Map<string, string>();
  if (knownProjects) {
    for (const p of knownProjects) {
      if (p.id && p.title) {
        projectTitleById.set(p.id.trim(), p.title.trim());
      }
    }
  }

  const countsByKey = new Map<string, { label: string; count: number }>();

  for (const task of tasks) {
    const key = getTaskProjectKey(task);
    const label = getTaskProjectLabel(task, projectTitleById);
    const existing = countsByKey.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      countsByKey.set(key, { label, count: 1 });
    }
  }

  const sortedKeys = Array.from(countsByKey.entries()).sort((a, b) => {
    if (a[0] === "unassigned") return 1;
    if (b[0] === "unassigned") return -1;
    return a[1].label.localeCompare(b[1].label);
  });

  return [
    {
      value: "all",
      label: `All projects (${tasks.length})`,
      count: tasks.length,
    },
    ...sortedKeys.map(([key, item]) => ({
      value: key,
      label: `${item.label} (${item.count})`,
      count: item.count,
    })),
  ];
}

export function filterTasksByProject(tasks: Task[], selectedProjectId?: string): Task[] {
  if (!selectedProjectId || selectedProjectId === "all") return tasks;
  return tasks.filter((task) => getTaskProjectKey(task) === selectedProjectId);
}
