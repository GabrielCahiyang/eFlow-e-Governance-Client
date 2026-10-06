import { requestNavigation } from "../../../../shared/navigationGuard";
import { FeedbackState } from "../../../../components/ui/FeedbackState";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Skeleton, Tab, TabList, TabsContext } from "@vibe/core";
import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import {
  Archive,
  BarChart2,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Columns,
  GitBranch,
  History,
  Layers,
  List,
  Plus,
  UserRound,
  X,
  AlertTriangle,
} from "lucide-react";
import * as SelectPrimitive from "@radix-ui/react-select";
import {
  buildProjectFilterOptions,
  filterTasksByRecordScope,
  filterTasksByBoardView,
  filterTasksByProject,
  isBoardFilterView,
  STATUS_ORDER,
  statusMeta,
  uniqueValues,
  type BoardView,
  type MondayBoardProps,
  type TaskRecordScope,
  type TaskStatusFilter,
} from "./model";
import { AssignmentModal } from "./AssignmentModal";
import { TaskEditorModal } from "./TaskEditorModal";
import {
  SubmitForReviewModal,
  UndoCompletedModal,
} from "./TaskSubmissionModals";
import { HierarchyBoardView } from "./HierarchyBoardView";
import { KanbanBoardView } from "./KanbanBoardView";
import { ListBoardView } from "./ListBoardView";
import { TimelineView } from "./TimelineView";
import { WorkloadBoardView } from "./WorkloadBoardView";
import { CalendarBoardView } from "./CalendarBoardView";
import { DependenciesBoardView } from "./DependenciesBoardView";
import { TaskActivityHistoryView } from "./TaskActivityHistoryView";
import { useMondayBoardController } from "./useMondayBoardController";
import { useNotificationNavigationIntent } from "../../../notifications";
import { motionTransition } from "../../../../shared/motion";

const recordScopeOptions = [
  { value: "active", label: "Active work" },
  { value: "archived", label: "Archived work" },
];

const statusFilterOptions: { value: TaskStatusFilter; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "active", label: "Open statuses" },
  ...STATUS_ORDER.map((status) => ({
    value: status,
    label: statusMeta[status].label,
  })),
];

const coreBoardViewOptions: {
  id: BoardView;
  label: string;
  icon: React.ReactNode;
}[] = [
  { id: "list", icon: <List size={13} />, label: "List" },
  { id: "kanban", icon: <Columns size={13} />, label: "Kanban" },
  { id: "timeline", icon: <BarChart2 size={13} />, label: "Timeline" },
  { id: "activity", icon: <History size={13} />, label: "Activity history" },
];

const addableBoardViewOptions: {
  id: BoardView;
  label: string;
  description: string;
  icon: React.ReactNode;
}[] = [
  {
    id: "hierarchy",
    icon: <Layers size={13} />,
    label: "Work breakdown",
    description: "Project → activity or milestone → task → subtask.",
  },
  {
    id: "calendar",
    icon: <CalendarDays size={13} />,
    label: "Calendar",
    description: "See the same scoped tasks by real due date.",
  },
  {
    id: "workload",
    icon: <UserRound size={13} />,
    label: "Workload",
    description: "Compare ownership, open work, and review load.",
  },
  {
    id: "dependencies",
    icon: <GitBranch size={13} />,
    label: "Dependencies",
    description: "Inspect prerequisites without changing task rules.",
  },
  {
    id: "my_work",
    icon: <UserRound size={13} />,
    label: "My focus",
    description: "Tasks assigned to or led by the current user.",
  },
  {
    id: "due_soon",
    icon: <CalendarClock size={13} />,
    label: "Due soon",
    description: "Open tasks due within the next seven days.",
  },
  {
    id: "overdue",
    icon: <AlertTriangle size={13} />,
    label: "Overdue",
    description: "Open tasks whose real calendar deadline has passed.",
  },
  {
    id: "for_review",
    icon: <CheckCircle2 size={13} />,
    label: "Review queue",
    description: "Tasks waiting for a formal review decision.",
  },
  {
    id: "completed",
    icon: <CheckCircle2 size={13} />,
    label: "Completed",
    description: "Tasks that have reached the completed state.",
  },
];

function TaskBoardLoadingSkeleton() {
  return (
    <div
      aria-label="Loading board records"
      aria-live="polite"
      className="space-y-4 rounded-[10px] border border-border bg-card p-5 shadow-[0_4px_6px_-4px_rgba(0,0,0,0.10)]"
      role="status"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <Skeleton type="text" width={220} />
          <Skeleton type="text" width={310} />
        </div>
        <Skeleton type="rectangle" size="custom" width={160} height={34} />
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <Skeleton
            key={item}
            type="rectangle"
            size="custom"
            height={56}
            fullWidth
          />
        ))}
      </div>
      <Skeleton type="rectangle" size="custom" height={260} fullWidth />
    </div>
  );
}

export function MondayBoard({
  tasks,
  loading = false,
  projects,
  selectedProjectId,
  onSelectProject,
  employees = [],
  allEmployees = [],
  employeeNotes,
  role,
  departmentFilter,
  currentUserId,
  currentUserName,
  onAssign,
  onExecute,
  onSubmit,
  onVerify,
  onUpdateTask,
  onDeleteTask,
}: MondayBoardProps) {
  const [recordScope, setRecordScope] = useState<TaskRecordScope>("active");
  const [statusFilter, setStatusFilter] = useState<TaskStatusFilter>("all");
  const [internalProjectId, setInternalProjectId] = useState<string>("all");
  const [enabledBoardViews, setEnabledBoardViews] = useState<BoardView[]>([
    "hierarchy",
  ]);
  const [addViewOpen, setAddViewOpen] = useState(false);
  const [moreViewOpen, setMoreViewOpen] = useState(false);
  const [viewBarPinned, setViewBarPinned] = useState(false);
  const [visibleOptionalViewCount, setVisibleOptionalViewCount] = useState(
    addableBoardViewOptions.length,
  );
  const addViewRef = useRef<HTMLDivElement>(null);
  const moreViewRef = useRef<HTMLDivElement>(null);
  const viewBarSentinelRef = useRef<HTMLDivElement>(null);
  const viewTabsRef = useRef<HTMLDivElement>(null);
  const viewTabsScrollerRef = useRef<HTMLDivElement>(null);
  const observedViewTabsWidthRef = useRef<number | undefined>(undefined);
  const activeProjectId = selectedProjectId ?? internalProjectId;
  const handleSelectProject = (projectId: string) => {
    void requestNavigation(() => {
      if (onSelectProject) onSelectProject(projectId);
      else setInternalProjectId(projectId);
    });
  };

  const scopedTasks = useMemo(
    () => filterTasksByRecordScope(tasks, recordScope, statusFilter),
    [recordScope, statusFilter, tasks],
  );

  const projectOptions = useMemo(
    () => buildProjectFilterOptions(scopedTasks, projects),
    [scopedTasks, projects],
  );

  const filteredTasks = useMemo(
    () => filterTasksByProject(scopedTasks, activeProjectId),
    [scopedTasks, activeProjectId],
  );
  const projectContext = useMemo(() => {
    const selected = projectOptions.find(
      (option) => option.value === activeProjectId,
    );
    const open = filteredTasks.filter(
      (task) => !["completed", "cancelled"].includes(task.status),
    ).length;
    const review = filteredTasks.filter(
      (task) => task.status === "for_review",
    ).length;
    const overdue = filteredTasks.filter(
      (task) =>
        task.status !== "completed" &&
        task.status !== "cancelled" &&
        (task.deadline || task.dueDate) &&
        new Date(task.deadline || task.dueDate || "").getTime() < Date.now(),
    ).length;
    return {
      title: selected?.label.replace(/ \(\d+\)$/, "") || "All projects",
      open,
      review,
      overdue,
    };
  }, [activeProjectId, filteredTasks, projectOptions]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        addViewRef.current &&
        !addViewRef.current.contains(event.target as Node)
      ) {
        setAddViewOpen(false);
      }
      if (
        moreViewRef.current &&
        !moreViewRef.current.contains(event.target as Node)
      ) {
        setMoreViewOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // When the shared view bar reaches the top of the workspace, give it a
  // stronger surface and primary Add view action. This makes the pinned state
  // obvious without changing the board's filters or navigation behavior.
  useEffect(() => {
    const sentinel = viewBarSentinelRef.current;
    if (!sentinel || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => setViewBarPinned(!entry.isIntersecting),
      { threshold: 1 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  // ── View & composer state ─────────────────────────────────────
  const controller = useMondayBoardController({
    tasks: filteredTasks,
    employees,
    allEmployees,
    employeeNotes,
    role,
    departmentFilter,
    currentUserId,
    currentUserName,
    onAssign,
    onExecute,
    onSubmit,
    onVerify,
    onUpdateTask,
    onDeleteTask,
  });
  const {
    boardView,
    setBoardView,
    deptEmployees,
    employeeById,
    taskEditorOpen,
    taskEditorDraft,
    setTaskEditorDraft,
    taskEditorSaving,
    taskEditorError,
    taskEditorAssignOpen,
    setTaskEditorAssignOpen,
    submitModalOpen,
    submitModalTask,
    submitNote,
    setSubmitNote,
    submitFiles,
    setSubmitFiles,
    submitError,
    submitSaving,
    undoModalOpen,
    undoModalTask,
    undoReason,
    setUndoReason,
    undoError,
    undoSaving,
    deptTasks,
    editingTask,
    openTaskEditor,
    closeTaskEditor,
    openSubmitModal,
    closeSubmitModal,
    handleRemoveAttachment,
    handleSubmitConfirm,
    openUndoModal,
    closeUndoModal,
    handleUndoConfirm,
    handleTaskEditorSave,
    handleTaskDeleteRequest,
    handleTaskCancelRequest,
    handleTaskArchiveRequest,
    handleTaskEditorDelete,
  } = controller;

  const boardViewOptions = useMemo(
    () => [
      ...coreBoardViewOptions,
      ...enabledBoardViews
        .map((id) => addableBoardViewOptions.find((view) => view.id === id))
        .filter((view): view is (typeof addableBoardViewOptions)[number] =>
          Boolean(view),
        ),
    ],
    [enabledBoardViews],
  );
  const optionalBoardViews = boardViewOptions.filter(
    (view) => !coreBoardViewOptions.some((coreView) => coreView.id === view.id),
  );
  // Keep the same overflow contract as Plans & Projects: More appears only
  // when the real tab lane cannot accommodate every open optional view.
  const visibleOptionalBoardViews = optionalBoardViews.slice(
    0,
    visibleOptionalViewCount,
  );
  const overflowBoardViews = optionalBoardViews.slice(visibleOptionalViewCount);
  const visibleBoardViews = [
    ...coreBoardViewOptions,
    ...visibleOptionalBoardViews,
  ];
  const isOverflowViewActive = overflowBoardViews.some(
    (view) => view.id === boardView,
  );
  const availableBoardViews = addableBoardViewOptions.filter(
    (view) => !enabledBoardViews.includes(view.id),
  );
  const boardTasks = isBoardFilterView(boardView)
    ? filterTasksByBoardView(deptTasks, boardView, currentUserId)
    : deptTasks;
  const openBoardView = (view: BoardView) => {
    if (
      !coreBoardViewOptions.some((item) => item.id === view) &&
      !enabledBoardViews.includes(view)
    ) {
      setEnabledBoardViews((current) => [...current, view]);
    }
    setBoardView(view);
    setAddViewOpen(false);
  };
  const closeBoardView = (view: BoardView) => {
    setEnabledBoardViews((current) => current.filter((id) => id !== view));
    if (boardView === view) setBoardView("list");
  };

  // Start with every open view visible after a view is added/removed or the
  // workspace width changes. The layout pass below moves only the excess
  // optional views into More, leaving core views untouched.
  useEffect(() => {
    setVisibleOptionalViewCount(optionalBoardViews.length);
  }, [optionalBoardViews.length]);

  useEffect(() => {
    const viewTabs = viewTabsRef.current;
    if (!viewTabs || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(([entry]) => {
      const width = Math.round(entry.contentRect.width);
      if (width > 0 && width !== observedViewTabsWidthRef.current) {
        observedViewTabsWidthRef.current = width;
        setVisibleOptionalViewCount(optionalBoardViews.length);
      }
    });
    observer.observe(viewTabs);
    return () => observer.disconnect();
  }, [optionalBoardViews.length]);

  useLayoutEffect(() => {
    const scroller = viewTabsScrollerRef.current;
    if (!scroller || visibleOptionalViewCount === 0) return;

    if (scroller.scrollWidth > scroller.clientWidth + 1) {
      setVisibleOptionalViewCount((count) => Math.max(0, count - 1));
    }
  }, [optionalBoardViews.length, visibleOptionalViewCount]);

  useNotificationNavigationIntent(
    (intent) => role === "head" && intent.kind === "task",
    (intent) => {
      const match = tasks.find((task) => task.id === intent.taskId);
      if (match) {
        setRecordScope(match.archivedAt ? "archived" : "active");
        setStatusFilter(match.archivedAt ? "all" : match.status);
        openTaskEditor(match);
      }
      return true;
    },
    [role, tasks, openTaskEditor],
  );

  return (
    <div className="eflow-operational-workspace flex w-full flex-col gap-5">
      <h1 className="sr-only">Board</h1>
      <div className="grid min-w-0 gap-4 lg:grid-cols-[236px_minmax(0,1fr)]">
        <aside
          className="h-fit rounded-[10px] border border-border bg-card p-3 shadow-[0_4px_6px_-4px_rgba(0,0,0,0.10)] lg:sticky lg:top-4"
          aria-label="Task board context"
        >
          <div className="rounded-[14px] bg-muted/50 px-2.5 py-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-400">
              Project context
            </div>
            <div className="mt-1 break-words text-[13px] font-semibold leading-snug text-neutral-900">
              {projectContext.title}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-1.5 text-center">
              <div className="rounded-lg bg-white px-1.5 py-2">
                <strong className="block text-[12px] text-neutral-900">
                  {projectContext.open}
                </strong>
                <span className="text-[9px] text-neutral-500">Open</span>
              </div>
              <div className="rounded-lg bg-white px-1.5 py-2">
                <strong className="block text-[12px] text-violet-800">
                  {projectContext.review}
                </strong>
                <span className="text-[9px] text-neutral-500">Review</span>
              </div>
              <div className="rounded-lg bg-white px-1.5 py-2">
                <strong className="block text-[12px] text-rose-700">
                  {projectContext.overdue}
                </strong>
                <span className="text-[9px] text-neutral-500">Overdue</span>
              </div>
            </div>
          </div>
          <div className="px-2 pb-2 pt-4">
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-400">
              Switch project
            </div>
            <p className="mt-1 text-xs leading-relaxed text-neutral-500">
              All views keep this selected scope.
            </p>
          </div>
          <div className="space-y-1">
            {projectOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-current={
                  activeProjectId === option.value ? "page" : undefined
                }
                onClick={() => handleSelectProject(option.value)}
                className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition ${activeProjectId === option.value ? "bg-violet-50 font-semibold text-violet-900" : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"}`}
              >
                <span className="min-w-0 break-words leading-snug">
                  {option.label.replace(/ \(\d+\)$/, "")}
                </span>
                <span className="shrink-0 rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-500">
                  {option.count}
                </span>
              </button>
            ))}
          </div>
          <div className="mt-4 border-t border-neutral-100 pt-3">
            <div className="flex items-center gap-1.5 px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-400">
              <Archive size={12} /> Record scope
            </div>
            <p className="mt-1 px-2 text-[11px] leading-relaxed text-neutral-500">
              Active work excludes completed, cancelled, archived, and deleted
              records unless you explicitly filter for a status.
            </p>
          </div>
        </aside>

        {/* ─── Task Board ──────────────────────────────────────────── */}
        <div className="min-w-0">
          {/* Shared workspace shell: context → tabbed views → board canvas. */}
          <div ref={viewBarSentinelRef} aria-hidden="true" className="h-px" />
          <div
            className={`eflow-task-board__toolbar relative z-30 mb-4 bg-white lg:sticky lg:top-0 ${viewBarPinned ? "eflow-task-board__toolbar--pinned" : ""}`}
          >
            {controller.lifecycle.message && (
              <FeedbackState
                tone={controller.lifecycle.tone}
                title="Task action result"
              >
                <p>{controller.lifecycle.message}</p>
              </FeedbackState>
            )}
            <div className="flex min-w-0 flex-col gap-3">
              <div className="order-2 flex flex-wrap shrink-0 items-center justify-end gap-1.5 border-t border-neutral-100 pt-3 text-[11.5px] text-neutral-500">
                <Archive size={13} className="shrink-0" />
                <SelectPrimitive.Root
                  value={recordScope}
                  onValueChange={(v) => setRecordScope(v as typeof recordScope)}
                >
                  <SelectPrimitive.Trigger
                    aria-label="Task record scope"
                    className="flex h-[28px] w-[155px] items-center justify-between gap-1 rounded-[4px] border border-[#c5c7d0] bg-white px-2 text-[13px] text-[#323338] outline-none hover:border-[#1f76c2] focus:border-[#1f76c2] data-[placeholder]:text-[#676879]"
                  >
                    <SelectPrimitive.Value />
                    <SelectPrimitive.Icon asChild>
                      <ChevronDown
                        size={14}
                        className="shrink-0 text-[#676879]"
                      />
                    </SelectPrimitive.Icon>
                  </SelectPrimitive.Trigger>
                  <SelectPrimitive.Portal>
                    <SelectPrimitive.Content
                      position="popper"
                      sideOffset={4}
                      className="z-[9999] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-[4px] border border-[#c5c7d0] bg-white shadow-[0_6px_20px_rgba(0,0,0,0.2)]"
                    >
                      <SelectPrimitive.Viewport>
                        {recordScopeOptions.map((opt) => (
                          <SelectPrimitive.Item
                            key={opt.value}
                            value={opt.value}
                            className="flex cursor-pointer select-none items-center px-3 py-[6px] text-[13px] text-[#323338] outline-none hover:bg-[#e8f0fe] data-[state=checked]:bg-[#e8f0fe] data-[state=checked]:text-[#1f76c2]"
                          >
                            <SelectPrimitive.ItemText>
                              {opt.label}
                            </SelectPrimitive.ItemText>
                          </SelectPrimitive.Item>
                        ))}
                      </SelectPrimitive.Viewport>
                    </SelectPrimitive.Content>
                  </SelectPrimitive.Portal>
                </SelectPrimitive.Root>
                <span className="ml-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-400">
                  Status
                </span>
                <SelectPrimitive.Root
                  value={statusFilter}
                  onValueChange={(v) => setStatusFilter(v as TaskStatusFilter)}
                >
                  <SelectPrimitive.Trigger
                    aria-label="Filter task board by status"
                    className="flex h-[28px] w-[175px] items-center justify-between gap-1 rounded-[4px] border border-[#c5c7d0] bg-white px-2 text-[13px] text-[#323338] outline-none hover:border-[#1f76c2] focus:border-[#1f76c2]"
                  >
                    <SelectPrimitive.Value />
                    <SelectPrimitive.Icon asChild>
                      <ChevronDown
                        size={14}
                        className="shrink-0 text-[#676879]"
                      />
                    </SelectPrimitive.Icon>
                  </SelectPrimitive.Trigger>
                  <SelectPrimitive.Portal>
                    <SelectPrimitive.Content
                      position="popper"
                      sideOffset={4}
                      className="z-[9999] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-[4px] border border-[#c5c7d0] bg-white shadow-[0_6px_20px_rgba(0,0,0,0.2)]"
                    >
                      <SelectPrimitive.Viewport>
                        {statusFilterOptions.map((option) => (
                          <SelectPrimitive.Item
                            key={option.value}
                            value={option.value}
                            className="flex cursor-pointer select-none items-center px-3 py-[6px] text-[13px] text-[#323338] outline-none hover:bg-[#e8f0fe] data-[state=checked]:bg-[#e8f0fe] data-[state=checked]:text-[#1f76c2]"
                          >
                            <SelectPrimitive.ItemText>
                              {option.label}
                            </SelectPrimitive.ItemText>
                          </SelectPrimitive.Item>
                        ))}
                      </SelectPrimitive.Viewport>
                    </SelectPrimitive.Content>
                  </SelectPrimitive.Portal>
                </SelectPrimitive.Root>
              </div>

              <div
                ref={viewTabsRef}
                className="eflow-task-board__view-tabs order-1 min-w-0 flex-1"
              >
                <div
                  ref={viewTabsScrollerRef}
                  className="eflow-task-board__view-tabs-scroller"
                >
                  <TabsContext
                    id="task-board-view-tabs"
                    activeTabId={Math.max(
                      0,
                      visibleBoardViews.findIndex(
                        (view) => view.id === boardView,
                      ),
                    )}
                  >
                    <TabList id="task-board-view-list">
                      {visibleBoardViews.map((view) => (
                        <Tab
                          key={view.id}
                          id={`task-board-${view.id}`}
                          active={boardView === view.id}
                          onClick={() => setBoardView(view.id)}
                        >
                          <span className="inline-flex items-center gap-1.5">
                            {view.icon}
                            <span>{view.label}</span>
                          </span>
                        </Tab>
                      ))}
                    </TabList>
                  </TabsContext>
                </div>

                <div className="eflow-task-board__view-tabs-actions relative shrink-0">
                  {!coreBoardViewOptions.some(
                    (view) => view.id === boardView,
                  ) &&
                    (() => {
                      const current = optionalBoardViews.find(
                        (view) => view.id === boardView,
                      );
                      return current ? (
                        <button
                          type="button"
                          aria-label={`Close ${current.label} view`}
                          onClick={() => closeBoardView(current.id)}
                          className="inline-flex h-9 items-center gap-1 rounded px-2 text-xs text-neutral-600 hover:bg-neutral-100"
                        >
                          <X size={14} /> Close view
                        </button>
                      ) : null;
                    })()}
                  {overflowBoardViews.length > 0 && (
                    <div className="relative shrink-0" ref={moreViewRef}>
                      <button
                        type="button"
                        aria-haspopup="menu"
                        aria-expanded={moreViewOpen}
                        onClick={() => setMoreViewOpen((open) => !open)}
                        className={`eflow-task-board__more-button ${isOverflowViewActive ? "bg-[#f4f4f4] font-semibold" : ""}`}
                      >
                        <span>More ({overflowBoardViews.length})</span>
                        <ChevronDown size={13} className="text-neutral-400" />
                      </button>
                      {moreViewOpen && (
                        <div
                          role="menu"
                          aria-label="More task board views"
                          className="absolute right-0 top-full z-[100] mt-1.5 w-60 rounded-[14px] border border-border bg-card p-1.5 shadow-[0_4px_6px_-4px_rgba(0,0,0,0.10)]"
                        >
                          <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-400">
                            Open task views
                          </div>
                          {overflowBoardViews.map((view) => (
                            <div
                              key={view.id}
                              role="menuitem"
                              tabIndex={0}
                              onClick={() => {
                                setBoardView(view.id);
                                setMoreViewOpen(false);
                              }}
                              onKeyDown={(event) => {
                                if (
                                  event.key === "Enter" ||
                                  event.key === " "
                                ) {
                                  event.preventDefault();
                                  setBoardView(view.id);
                                  setMoreViewOpen(false);
                                }
                              }}
                              className={`flex cursor-pointer items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-xs font-medium ${boardView === view.id ? "bg-violet-50 font-semibold text-violet-900" : "text-neutral-700 hover:bg-neutral-50"}`}
                            >
                              <span className="inline-flex min-w-0 items-center gap-2">
                                <span className="text-neutral-500">
                                  {view.icon}
                                </span>
                                <span className="truncate">{view.label}</span>
                              </span>
                              <button
                                type="button"
                                aria-label={`Close ${view.label} view`}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  closeBoardView(view.id);
                                }}
                                className="shrink-0 rounded p-0.5 text-neutral-400 hover:bg-neutral-200 hover:text-neutral-700"
                              >
                                <X size={11} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="relative shrink-0" ref={addViewRef}>
                    <button
                      type="button"
                      aria-haspopup="menu"
                      aria-expanded={addViewOpen}
                      onClick={() => setAddViewOpen((open) => !open)}
                      className="eflow-task-board__add-view inline-flex h-9 items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 text-xs font-semibold text-neutral-700 shadow-sm transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-800"
                    >
                      <Plus size={14} /> Add view
                    </button>
                    {addViewOpen && (
                      <div
                        role="menu"
                        aria-label="Add task board view"
                        className="absolute right-0 top-full z-[100] mt-2 w-[300px] rounded-[14px] border border-border bg-card p-2 shadow-[0_4px_6px_-4px_rgba(0,0,0,0.10)]"
                      >
                        <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-400">
                          Additional views
                        </div>
                        {availableBoardViews.length === 0 ? (
                          <div className="px-2 py-3 text-xs text-neutral-500">
                            All available views are already open.
                          </div>
                        ) : (
                          availableBoardViews.map((view) => (
                            <button
                              key={view.id}
                              type="button"
                              role="menuitem"
                              onClick={() => openBoardView(view.id)}
                              className="flex w-full items-start gap-2.5 rounded-lg px-2 py-2 text-left transition hover:bg-neutral-50"
                            >
                              <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-neutral-100 text-neutral-600">
                                {view.icon}
                              </span>
                              <span className="min-w-0">
                                <span className="block text-xs font-semibold text-neutral-800">
                                  {view.label}
                                </span>
                                <span className="mt-0.5 block text-[11px] leading-relaxed text-neutral-500">
                                  {view.description}
                                </span>
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {loading ? (
            <TaskBoardLoadingSkeleton />
          ) : (
            <AnimatePresence mode="wait" initial={false}>
              <m.div
                key={boardView}
                className="relative z-0"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={motionTransition.productive}
              >
                {boardView === "list" && (
                  <ListBoardView
                    tasks={boardTasks}
                    role={role}
                    employees={deptEmployees}
                    employeeNotes={employeeNotes}
                    onAssign={onAssign}
                    onUpdateTask={onUpdateTask}
                    onVerify={onVerify}
                    onExecute={onExecute}
                    onSubmitRequest={openSubmitModal}
                    onOpenTaskEditor={
                      role === "head" ? openTaskEditor : undefined
                    }
                    onDeleteTaskRequest={
                      role === "head" ? handleTaskDeleteRequest : undefined
                    }
                    onArchiveTaskRequest={
                      role === "head" ? handleTaskArchiveRequest : undefined
                    }
                    onCancelTaskRequest={
                      role === "head" ? handleTaskCancelRequest : undefined
                    }
                    departmentFilter={departmentFilter}
                    currentUserId={currentUserId}
                    currentUserName={currentUserName}
                    onUndoRequest={role === "head" ? openUndoModal : undefined}
                  />
                )}
                {boardView === "kanban" && (
                  <KanbanBoardView
                    tasks={boardTasks}
                    employees={deptEmployees}
                    role={role}
                    onVerify={onVerify}
                    onExecute={onExecute}
                    onSubmitRequest={openSubmitModal}
                    onOpenTaskEditor={
                      role === "head" ? openTaskEditor : undefined
                    }
                    onDeleteTaskRequest={
                      role === "head" ? handleTaskDeleteRequest : undefined
                    }
                    onArchiveTaskRequest={
                      role === "head" ? handleTaskArchiveRequest : undefined
                    }
                    onCancelTaskRequest={
                      role === "head" ? handleTaskCancelRequest : undefined
                    }
                    currentUserId={currentUserId}
                    currentUserName={currentUserName}
                    onUndoRequest={role === "head" ? openUndoModal : undefined}
                  />
                )}
                {boardView === "timeline" && (
                  <TimelineView
                    tasks={boardTasks}
                    role={role}
                    onOpenTaskEditor={
                      role === "head" ? openTaskEditor : undefined
                    }
                  />
                )}
                {boardView === "activity" && (
                  <TaskActivityHistoryView
                    tasks={boardTasks}
                    onOpenTaskEditor={
                      role === "head" ? openTaskEditor : undefined
                    }
                  />
                )}
                {boardView === "hierarchy" && (
                  <HierarchyBoardView
                    tasks={boardTasks}
                    employees={deptEmployees}
                    role={role}
                    onVerify={onVerify}
                    onExecute={onExecute}
                    onSubmitRequest={openSubmitModal}
                    onOpenTaskEditor={
                      role === "head" ? openTaskEditor : undefined
                    }
                    onDeleteTaskRequest={
                      role === "head" ? handleTaskDeleteRequest : undefined
                    }
                    onArchiveTaskRequest={
                      role === "head" ? handleTaskArchiveRequest : undefined
                    }
                    onCancelTaskRequest={
                      role === "head" ? handleTaskCancelRequest : undefined
                    }
                    currentUserId={currentUserId}
                    onUndoRequest={role === "head" ? openUndoModal : undefined}
                  />
                )}
                {boardView === "workload" && (
                  <WorkloadBoardView
                    tasks={boardTasks}
                    employees={deptEmployees}
                    role={role}
                    onOpenTaskEditor={
                      role === "head" ? openTaskEditor : undefined
                    }
                  />
                )}
                {boardView === "calendar" && (
                  <CalendarBoardView
                    tasks={boardTasks}
                    onOpenTaskEditor={
                      role === "head" ? openTaskEditor : undefined
                    }
                  />
                )}
                {boardView === "dependencies" && (
                  <DependenciesBoardView
                    tasks={boardTasks}
                    onOpenTaskEditor={
                      role === "head" ? openTaskEditor : undefined
                    }
                  />
                )}
                {isBoardFilterView(boardView) && (
                  <ListBoardView
                    tasks={boardTasks}
                    role={role}
                    employees={deptEmployees}
                    employeeNotes={employeeNotes}
                    onAssign={onAssign}
                    onUpdateTask={onUpdateTask}
                    onVerify={onVerify}
                    onExecute={onExecute}
                    onSubmitRequest={openSubmitModal}
                    onOpenTaskEditor={
                      role === "head" ? openTaskEditor : undefined
                    }
                    onDeleteTaskRequest={
                      role === "head" ? handleTaskDeleteRequest : undefined
                    }
                    onArchiveTaskRequest={
                      role === "head" ? handleTaskArchiveRequest : undefined
                    }
                    onCancelTaskRequest={
                      role === "head" ? handleTaskCancelRequest : undefined
                    }
                    departmentFilter={departmentFilter}
                    currentUserId={currentUserId}
                    currentUserName={currentUserName}
                    onUndoRequest={role === "head" ? openUndoModal : undefined}
                  />
                )}
              </m.div>
            </AnimatePresence>
          )}
        </div>
      </div>

      {/* ─── Assignment Modal — PDF draft tasks ──────────────────── */}
      {taskEditorOpen && !editingTask && taskEditorError && (
        <FeedbackState tone="warning" title="Task draft retained">
          <p>{taskEditorError}</p>
          <p>{controller.taskEditorDraft?.title}</p>
          <button type="button" onClick={closeTaskEditor}>
            Close retained draft
          </button>
        </FeedbackState>
      )}
      {controller.lifecycle.dialog}

      <TaskEditorModal
        open={taskEditorOpen}
        task={editingTask}
        draft={taskEditorDraft}
        onChange={(patch) =>
          setTaskEditorDraft((prev) => (prev ? { ...prev, ...patch } : prev))
        }
        onClose={closeTaskEditor}
        onSave={handleTaskEditorSave}
        onDelete={handleTaskEditorDelete}
        onCancelTask={() => editingTask && handleTaskCancelRequest(editingTask)}
        onOpenTeamEditor={() => setTaskEditorAssignOpen(true)}
        saving={taskEditorSaving}
        error={
          controller.lifecycle.tone === "error" && controller.lifecycle.message
            ? controller.lifecycle.message
            : taskEditorError
        }
        employees={deptEmployees}
        availableTasks={deptTasks}
        employeeById={employeeById}
        currentUserId={currentUserId}
        currentUserName={currentUserName}
      />

      <SubmitForReviewModal
        open={submitModalOpen}
        task={submitModalTask}
        note={submitNote}
        attachments={submitFiles}
        onNoteChange={setSubmitNote}
        onAttachmentsChange={setSubmitFiles}
        onRemoveAttachment={handleRemoveAttachment}
        onClose={closeSubmitModal}
        onSubmit={handleSubmitConfirm}
        submitting={submitSaving}
        error={
          controller.lifecycle.tone === "error" && controller.lifecycle.message
            ? controller.lifecycle.message
            : submitError
        }
      />

      <UndoCompletedModal
        open={undoModalOpen}
        task={undoModalTask}
        reason={undoReason}
        onReasonChange={setUndoReason}
        onClose={closeUndoModal}
        onSubmit={handleUndoConfirm}
        saving={undoSaving}
        error={
          controller.lifecycle.tone === "error" && controller.lifecycle.message
            ? controller.lifecycle.message
            : undoError
        }
      />

      <AssignmentModal
        open={taskEditorAssignOpen && taskEditorOpen}
        onClose={() => setTaskEditorAssignOpen(false)}
        employees={deptEmployees}
        employeeNotes={employeeNotes}
        selectedIds={taskEditorDraft?.teamMemberIds || []}
        leadId={taskEditorDraft?.leadMemberId || null}
        onConfirm={(memberIds, leadId) => {
          setTaskEditorDraft((prev) =>
            prev
              ? {
                  ...prev,
                  teamMemberIds: uniqueValues(memberIds),
                  leadMemberId: leadId,
                }
              : prev,
          );
        }}
      />

      {/* ─── Assignment Modal — Manual composer ──────────────────── */}
    </div>
  );
}
