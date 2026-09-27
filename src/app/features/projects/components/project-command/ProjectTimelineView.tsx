import { useEffect, useMemo, useRef, useState } from "react";
import Gantt from "frappe-gantt";
// frappe-gantt exposes its stylesheet through a conditional `style` export,
// which Vite's CSS import resolver does not select reliably. Keep the
// renderer's official base styles alongside our scoped overrides.
import "../../../../../../node_modules/frappe-gantt/dist/frappe-gantt.css";
import { Settings } from "@vibe/icons";
import { CalendarDays, CheckCircle2, Clock, Flag } from "lucide-react";
import type { UserProfile } from "../../../../types";
import { ProjectPlanInspector } from "./ProjectPlanInspector";
import type { ProjectCommandData } from "./types";
import { isOverdue } from "../../../tasks";
import { parseCalendarDate } from "../../../../shared/scheduling/relativeSchedule";

interface GanttWorkItem {
  id: string;
  name: string;
  start: string;
  end: string;
  progress: number;
  dependencies?: string;
  custom_class?: string;
  _kind: "milestone" | "task";
  _taskId?: string;
  _milestoneId?: string;
  _ownerName?: string;
  _status: string;
  _dueDateStr?: string;
  _isOverdue?: boolean;
}

type ViewMode = "Day" | "Week" | "Month";

function formatDateYMD(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDate(value?: string | null | number): Date | null {
  if (!value) return null;
  if (typeof value === "string") {
    const cal = parseCalendarDate(value);
    if (cal !== null) return new Date(cal);
  }
  const d = typeof value === "number" ? new Date(value) : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function ProjectTimelineView({
  data,
  profiles,
  canManage,
  onOpenTask,
}: {
  data: ProjectCommandData;
  profiles: UserProfile[];
  canManage: boolean;
  onOpenTask: (taskId: string) => void;
}) {
  const [viewMode, setViewMode] = useState<ViewMode>("Month");
  const [showPlanInspector, setShowPlanInspector] = useState(false);
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const ganttInstanceRef = useRef<Gantt | null>(null);

  const ownerNames = useMemo(
    () =>
      new Map(
        profiles.map((profile) => [
          profile.id,
          profile.full_name || profile.fullName || profile.email || "Assigned lead",
        ]),
      ),
    [profiles],
  );

  // Map milestones and tasks into normalized Gantt items with readable spans
  const ganttItems = useMemo<GanttWorkItem[]>(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const projectStart = parseDate(data.project.startDate) || new Date();
    const items: GanttWorkItem[] = [];

    // 1. Map Activities / Milestones
    data.milestones.forEach((milestone, index) => {
      const dueDate = parseDate(milestone.dueDate);
      if (!dueDate) return;

      const prevDueDate = index > 0 ? parseDate(data.milestones[index - 1]?.dueDate) : null;
      let start = prevDueDate && prevDueDate < dueDate ? prevDueDate : new Date(dueDate.getTime() - 14 * 86400000);
      if (start < projectStart) {
        start = projectStart;
      }
      let end = dueDate;

      // Ensure minimum readable span of 7 days
      if (end.getTime() <= start.getTime()) {
        start = new Date(end.getTime() - 7 * 86400000);
      }

      const isCompleted = milestone.status === "completed";
      const isOverdue = !isCompleted && dueDate < today;

      let statusClass = "gantt-bar-activity";
      if (isCompleted) statusClass = "gantt-bar-activity-completed";
      else if (isOverdue) statusClass = "gantt-bar-activity-overdue";
      else if (milestone.status === "at_risk") statusClass = "gantt-bar-activity-at-risk";
      else if (milestone.status === "in_progress") statusClass = "gantt-bar-activity-in-progress";

      const progress = isCompleted
        ? 100
        : milestone.status === "in_progress"
          ? 50
          : 0;

      items.push({
        id: `activity-${milestone.id}`,
        name: milestone.title,
        start: formatDateYMD(start),
        end: formatDateYMD(end),
        progress,
        custom_class: statusClass,
        _kind: "milestone",
        _milestoneId: milestone.id,
        _status: milestone.status,
        _dueDateStr: milestone.dueDate || undefined,
        _isOverdue: Boolean(isOverdue),
      });
    });

    // 2. Map Tasks
    data.tasks.forEach((task) => {
      const taskDue = parseDate(task.deadline || task.dueDate);
      if (!taskDue) return;

      const created = parseDate(task.createdAt);
      let taskStart = created && created < taskDue ? created : new Date(taskDue.getTime() - 7 * 86400000);
      let end = taskDue;

      // Ensure minimum readable span of 5 days
      if (end.getTime() <= taskStart.getTime()) {
        taskStart = new Date(end.getTime() - 5 * 86400000);
      }

      const isCompleted = task.status === "completed";
      const isTaskOverdue = !isCompleted && isOverdue(task);

      let statusClass = "gantt-bar-task";
      if (isCompleted) statusClass = "gantt-bar-task-completed";
      else if (isTaskOverdue) statusClass = "gantt-bar-task-overdue";
      else if (task.status === "in_progress") statusClass = "gantt-bar-task-in-progress";

      const progress = isCompleted
        ? 100
        : Math.max(0, Math.min(100, task.percentComplete || 0));

      const owner = task.assigneeId ? ownerNames.get(task.assigneeId) : undefined;

      items.push({
        id: `task-${task.id}`,
        name: task.title,
        start: formatDateYMD(taskStart),
        end: formatDateYMD(end),
        progress,
        custom_class: statusClass,
        _kind: "task",
        _taskId: task.id,
        _ownerName: owner,
        _status: task.status,
        _dueDateStr: task.deadline || task.dueDate || undefined,
        _isOverdue: Boolean(isTaskOverdue),
      });
    });

    return items;
  }, [data.milestones, data.project.startDate, data.tasks, ownerNames]);

  const unscheduledItems = useMemo(
    () => [
      ...data.milestones
        .filter((milestone) => !milestone.dueDate)
        .map((milestone) => ({
          id: `milestone-${milestone.id}`,
          kind: "Delivery activity",
          title: milestone.title,
          status: milestone.status,
        })),
      ...data.tasks
        .filter((task) => !task.deadline && !task.dueDate)
        .map((task) => ({
          id: `task-${task.id}`,
          kind: "Task",
          title: task.title,
          status: task.status,
        })),
    ],
    [data.milestones, data.tasks],
  );

  const scheduledTaskCount = data.tasks.filter((task) => Boolean(task.deadline || task.dueDate)).length;
  const scheduledActivityCount = data.milestones.filter((milestone) => Boolean(milestone.dueDate)).length;

  // Handle bar clicks
  const handleItemClick = (item: any) => {
    const customItem = item as GanttWorkItem;
    if (customItem._kind === "task" && customItem._taskId) {
      onOpenTask(customItem._taskId);
    } else if (customItem._kind === "milestone" && customItem._milestoneId) {
      setSelectedActivityId(customItem._milestoneId);
      setShowPlanInspector(true);
    }
  };

  // Initialize or update Frappe Gantt instance
  useEffect(() => {
    if (!svgRef.current) return;
    if (ganttItems.length === 0) {
      svgRef.current.innerHTML = "";
      ganttInstanceRef.current = null;
      return;
    }

    try {
      if (!ganttInstanceRef.current) {
        ganttInstanceRef.current = new Gantt(svgRef.current, ganttItems as any, {
          column_width: viewMode === "Day" ? 44 : viewMode === "Week" ? 84 : 160,
          bar_height: 28,
          bar_corner_radius: 6,
          arrow_curve: 5,
          padding: 22,
          view_mode: viewMode,
          date_format: "YYYY-MM-DD",
          readonly: true,
          readonly_dates: true,
          popup: (task: any) => {
            const custom = task as GanttWorkItem;
            const typeLabel = custom._kind === "milestone" ? "Delivery Activity" : "Task";
            const ownerLine = custom._ownerName ? `<div class="gantt-popup-owner">${custom._ownerName}</div>` : "";
            const statusLine = `<div class="gantt-popup-status status-${custom._status}">${custom._status.replace(/_/g, " ")}</div>`;
            return `
              <div class="eflow-gantt-popup">
                <div class="gantt-popup-type">${typeLabel}</div>
                <div class="gantt-popup-title">${task.name}</div>
                <div class="gantt-popup-dates">${task._start ? formatDateYMD(task._start) : task.start} &rarr; ${task._end ? formatDateYMD(task._end) : task.end}</div>
                <div class="gantt-popup-progress">Progress: <strong>${task.progress}%</strong></div>
                ${statusLine}
                ${ownerLine}
              </div>
            `;
          },
          on_click: handleItemClick,
        });
      } else {
        ganttInstanceRef.current.refresh(ganttItems as any);
        ganttInstanceRef.current.change_view_mode(viewMode);
      }
    } catch (e) {
      console.error("Gantt initialization error:", e);
    }
  }, [ganttItems, viewMode]);

  // Scroll to today helper
  const scrollToToday = () => {
    if (!containerRef.current) return;
    const todayElement = containerRef.current.querySelector(".today-highlight, .current-date-highlight");
    if (todayElement) {
      todayElement.scrollIntoView({ behavior: "smooth", inline: "center" });
    } else {
      const scrollMax = containerRef.current.scrollWidth - containerRef.current.clientWidth;
      containerRef.current.scrollTo({ left: scrollMax / 2, behavior: "smooth" });
    }
  };

  const changeView = (mode: ViewMode) => {
    setViewMode(mode);
    if (ganttInstanceRef.current) {
      (ganttInstanceRef.current as any).change_view_mode(mode);
    }
  };

  return (
    <div className="eflow-timeline-layout">
      <section className="eflow-project-timeline flex-1 min-w-0" aria-label="Project timeline">
        {/* Timeline Header & Unified Toolbar */}
        <div className="eflow-project-view-heading eflow-project-view-heading--timeline">
          <div>
            <span className="eflow-project-view-heading__eyebrow">
              <CalendarDays size={14} /> Planning Gantt Timeline
            </span>
            <h2>Milestones and delivery schedule</h2>
            <p>
              {scheduledActivityCount} activities · {scheduledTaskCount} tasks with target dates
              {unscheduledItems.length > 0 ? ` · ${unscheduledItems.length} unscheduled` : ""}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* View Mode Switching */}
            <div className="eflow-timeline-view-modes" role="group" aria-label="Timeline scale">
              <button
                type="button"
                className={`eflow-timeline-mode-btn ${viewMode === "Day" ? "eflow-timeline-mode-btn--active" : ""}`}
                onClick={() => changeView("Day")}
              >
                Day
              </button>
              <button
                type="button"
                className={`eflow-timeline-mode-btn ${viewMode === "Week" ? "eflow-timeline-mode-btn--active" : ""}`}
                onClick={() => changeView("Week")}
              >
                Week
              </button>
              <button
                type="button"
                className={`eflow-timeline-mode-btn ${viewMode === "Month" ? "eflow-timeline-mode-btn--active" : ""}`}
                onClick={() => changeView("Month")}
              >
                Month
              </button>
            </div>

            {/* Jump to Today */}
            <button
              className="eflow-project-tool-button"
              type="button"
              onClick={scrollToToday}
              title="Jump timeline to current date"
            >
              <Clock size={14} /> Today
            </button>

            {/* Manage Plan Drawer Toggle */}
            <button
              className={`eflow-project-tool-button ${
                showPlanInspector ? "eflow-project-tool-button--active" : ""
              }`}
              type="button"
              onClick={() => setShowPlanInspector((open) => !open)}
            >
              <Settings size={15} />
              {showPlanInspector ? "Hide plan controls" : "Manage plan"}
            </button>
          </div>
        </div>

        {/* Legend / Status Strip */}
        <div className="eflow-timeline-legend">
          <div className="flex items-center gap-1.5 text-xs text-neutral-600">
            <span className="h-2.5 w-5 rounded-xs bg-indigo-600" />
            <span>Activity Phase</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-neutral-600">
            <span className="h-2.5 w-5 rounded-xs bg-blue-500" />
            <span>Task</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-neutral-600">
            <span className="h-2.5 w-5 rounded-xs bg-emerald-500" />
            <span>Completed</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-neutral-600">
            <span className="h-2.5 w-5 rounded-xs bg-rose-500" />
            <span>Overdue</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-neutral-600">
            <span className="h-2.5 w-5 rounded-xs bg-amber-500" />
            <span>In Progress / At Risk</span>
          </div>
        </div>

        {/* Split Gantt Structure: Synchronized Work Breakdown Panel + Gantt Timeline Canvas */}
        {ganttItems.length > 0 ? (
          <div className="eflow-gantt-split-board">
            {/* Left Hierarchy Panel */}
            <div className="eflow-gantt-hierarchy-panel">
              <div className="eflow-gantt-hierarchy-header">
                <span>Work Item</span>
                <span>Status & Target</span>
              </div>
              <div className="eflow-gantt-hierarchy-body">
                {ganttItems.map((item) => (
                  <div
                    key={item.id}
                    className={`eflow-gantt-hierarchy-row ${hoveredItemId === item.id ? "eflow-gantt-hierarchy-row--hovered" : ""}`}
                    onClick={() => handleItemClick(item)}
                    onMouseEnter={() => setHoveredItemId(item.id)}
                    onMouseLeave={() => setHoveredItemId(null)}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className={`eflow-gantt-item-icon eflow-gantt-item-icon--${item._kind}`}>
                        {item._kind === "milestone" ? <Flag size={12} /> : <CheckCircle2 size={12} />}
                      </span>
                      <span className="eflow-gantt-item-name truncate font-medium text-xs text-neutral-800" title={item.name}>
                        {item.name}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={`eflow-gantt-status-pill eflow-gantt-status-pill--${item._status}`}>
                        {item._status.replace(/_/g, " ")}
                      </span>
                      {item._dueDateStr && (
                        <span className="text-[10.5px] text-neutral-500 font-mono">
                          {item._dueDateStr.slice(5)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Gantt Canvas */}
            <div className="eflow-gantt-canvas-container" ref={containerRef}>
              <svg ref={svgRef} id={`gantt-svg-${data.project.id}`} />
            </div>
          </div>
        ) : (
          <div className="eflow-project-empty-state">
            <CalendarDays size={32} className="mx-auto mb-2 text-neutral-400" />
            <p className="font-semibold text-neutral-800">No scheduled activities or tasks yet</p>
            <p className="text-xs text-neutral-500">
              Click &quot;Manage plan&quot; above to add your first delivery activity and schedule target dates.
            </p>
          </div>
        )}

        {unscheduledItems.length > 0 && (
          <section className="eflow-timeline-unscheduled" aria-label="Unscheduled work">
            <div className="eflow-timeline-unscheduled__header">
              <div>
                <h3>Unscheduled work</h3>
                <p>These items have no authoritative target date yet.</p>
              </div>
              <span>{unscheduledItems.length}</span>
            </div>
            <div className="eflow-timeline-unscheduled__list">
              {unscheduledItems.map((item) => (
                <div key={item.id} className="eflow-timeline-unscheduled__item">
                  <span className="eflow-timeline-unscheduled__dot" aria-hidden="true" />
                  <span className="eflow-timeline-unscheduled__copy">
                    <strong>{item.title}</strong>
                    <small>{item.kind} · {item.status.replace(/_/g, " ")}</small>
                  </span>
                  <span className="eflow-timeline-unscheduled__date">No target</span>
                </div>
              ))}
            </div>
          </section>
        )}
      </section>

      {/* In-Place Slide-Over Plan Inspector */}
      <ProjectPlanInspector
        data={data}
        profiles={profiles}
        canManage={canManage}
        isOpen={showPlanInspector}
        onClose={() => setShowPlanInspector(false)}
        selectedActivityId={selectedActivityId}
        onSelectActivity={setSelectedActivityId}
      />
    </div>
  );
}
