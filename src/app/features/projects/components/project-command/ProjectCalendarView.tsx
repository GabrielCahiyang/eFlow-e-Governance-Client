import { useEffect, useMemo, useRef, useState } from "react";
import { Calendar } from "@fullcalendar/core";
import dayGridPlugin from "@fullcalendar/daygrid";
import listPlugin from "@fullcalendar/list";
import interactionPlugin from "@fullcalendar/interaction";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import type { UserProfile, Organization } from "../../../../types";
import type { ProjectCommandData } from "./types";
import { isOverdue, type Task } from "../../../tasks";
import { STATUS_COLORS } from '../../../project-table';
import { useProjectViewActions, useProjectReviewDates, shiftedTaskDates, calendarDay, dayString, TaskDatesDialog } from '../../../project-views';
import { parseCalendarDate } from "../../../../shared/scheduling/relativeSchedule";

interface CalendarEventItem {
  id: string;
  title: string;
  start: string;
  end?: string;
  allDay: boolean;
  className: string;
  startEditable?: boolean;
  extendedProps: {
    kind: "milestone" | "task" | "project" | "review";
    taskId?: string;
    milestoneId?: string;
    status: string;
    priority?: string;
    assigneeName?: string;
    isOverdue: boolean;
  };
}

function parseYMD(value?: string | null | number): string | null {
  if (!value) return null;
  if (typeof value === 'string') { const day = calendarDay(value); return day === null ? null : dayString(day); }
  const d = typeof value === "number" ? new Date(value) : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function ProjectCalendarView({
  data,
  profiles = [],
  onOpenTask,
  canManage = false,
  onOpenPlan,
  onOpenReviews,
  offices = [],
  officeFilter = '',
}: {
  data: ProjectCommandData;
  profiles?: UserProfile[];
  onOpenTask: (taskId: string) => void;
  canManage?: boolean;
  onOpenPlan?: () => void;
  onOpenReviews?: () => void;
  offices?: Organization[];
  officeFilter?: string;
}) {
  const calendarContainerRef = useRef<HTMLDivElement>(null);
  const calendarInstanceRef = useRef<Calendar | null>(null);
  const [currentTitle, setCurrentTitle] = useState("");
  const [viewType, setViewType] = useState<"dayGridMonth" | "listMonth">("dayGridMonth");
  const [editing, setEditing] = useState<Task | null>(null);
  const actions = useProjectViewActions(data.project, canManage);
  const reviews = useProjectReviewDates(data.project.sourceCollaborationDraftId);
  const callbacks = useRef({ actions, data, onOpenTask, onOpenPlan, onOpenReviews });
  callbacks.current = { actions, data, onOpenTask, onOpenPlan, onOpenReviews };
  const viewedDate = useRef<Date | undefined>(undefined);
  const pendingSave = useRef(false);

  const ownerNames = useMemo(
    () =>
      new Map(
        profiles.map((p) => [
          p.id,
          p.full_name || p.fullName || p.email || "Assigned lead",
        ]),
      ),
    [profiles],
  );

  const events = useMemo<CalendarEventItem[]>(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const list: CalendarEventItem[] = [];

    // Map tasks
    data.tasks.forEach((task) => {
      const taskDueStr = parseYMD(task.deadline || task.dueDate);
      // The calendar displays the authoritative due date, not creation time.
      if (!taskDueStr) return;

      const isCompleted = task.status === "completed";
      const isTaskOverdue = !isCompleted && task.status !== 'cancelled' && isOverdue(task);

      const owner = task.assigneeId ? ownerNames.get(task.assigneeId) : undefined;

      let eventClass = "eflow-cal-event eflow-cal-event--task";
      if (isCompleted) eventClass += " eflow-cal-event--completed";
      else if (isTaskOverdue) eventClass += " eflow-cal-event--overdue";
      else if (task.status === "in_progress") eventClass += " eflow-cal-event--in-progress";

      list.push({
        id: `task-${task.id}`,
        title: task.title,
        start: taskDueStr,
        end: taskDueStr || undefined,
        allDay: true,
        className: eventClass,
        startEditable: actions.canEditDates(task),
        extendedProps: {
          kind: "task",
          taskId: task.id,
          status: task.status,
          priority: task.priority,
          assigneeName: owner,
          isOverdue: Boolean(isTaskOverdue),
        },
      });
    });

    // Map delivery activities / milestones
    data.milestones.forEach((milestone) => {
      const dueStr = parseYMD(milestone.dueDate);
      if (!dueStr) return;

      const isCompleted = milestone.status === "completed";
      const milestoneDue = milestone.dueDate ? (parseCalendarDate(milestone.dueDate) ?? new Date(milestone.dueDate).getTime()) : null;
      const isMilestoneOverdue = !isCompleted && milestoneDue !== null && milestoneDue < today.getTime();

      let eventClass = "eflow-cal-event eflow-cal-event--milestone";
      if (isCompleted) eventClass += " eflow-cal-event--completed";
      else if (isMilestoneOverdue) eventClass += " eflow-cal-event--overdue";
      else if (milestone.status === "at_risk") eventClass += " eflow-cal-event--at-risk";
      else if (milestone.status === "in_progress") eventClass += " eflow-cal-event--in-progress";

      list.push({
        id: `milestone-${milestone.id}`,
        title: `Activity: ${milestone.title}`,
        start: dueStr,
        allDay: true,
        className: eventClass,
        extendedProps: {
          kind: "milestone",
          milestoneId: milestone.id,
          status: milestone.status,
          isOverdue: Boolean(isMilestoneOverdue),
        },
      });
    });

    for (const [key, title, date] of [['project-start', 'Project start', data.project.startDate], ['project-target', 'Project target', data.project.targetDate]]) {
      const start = parseYMD(date);
      if (start) list.push({ id: key!, title: title!, start, allDay: true, className: 'eflow-cal-event eflow-cal-event--milestone', startEditable: false, extendedProps: { kind: 'project', status: data.project.status, isOverdue: false } });
    }
    for (const review of reviews.dates.filter(r => !officeFilter || r.id === officeFilter)) {
      list.push({ id: 'review-'+review.id, title: (offices.find(o=>o.id===review.id)?.name || 'Office') + ' review deadline', start: review.date, allDay: true, startEditable: false, className: 'eflow-cal-event eflow-cal-event--milestone', extendedProps: { kind: 'review', status: review.status, isOverdue: review.overdue } });
    }
    return list;
  }, [data.milestones, data.tasks, data.project.startDate, data.project.targetDate, data.project.status, ownerNames, canManage, reviews.dates, offices, officeFilter]);
  const unscheduledCount = data.tasks.filter((task) => !parseYMD(task.deadline || task.dueDate)).length
    + data.milestones.filter((milestone) => !parseYMD(milestone.dueDate)).length;

  // Mount FullCalendar instance directly to avoid React wrapper ES module class issues in Vite
  useEffect(() => {
    if (!calendarContainerRef.current) return;

    const calendar = new Calendar(calendarContainerRef.current, {
      plugins: [dayGridPlugin, listPlugin, interactionPlugin],
      initialView: viewType,
      initialDate: viewedDate.current,
      headerToolbar: false,
      events: events as any,
      editable: true,
      eventDurationEditable: false,
      eventAllow: (_drop, event) => {
        const task = callbacks.current.data.tasks.find(task => task.id === event?.extendedProps.taskId);
        return !pendingSave.current && !!task && callbacks.current.actions.canEditDates(task);
      },
      eventDrop: info => {
        const { data: latest, actions: current } = callbacks.current;
        const task = latest.tasks.find(t => t.id === info.event.extendedProps.taskId);
        const before = task && calendarDay(task.deadline || task.dueDate);
        const after = calendarDay(info.event.startStr);
        if (pendingSave.current || !task || before === null || before === undefined || after === null || !current.canEditDates(task)) { info.revert(); return; }
        pendingSave.current = true;
        void Promise.resolve().then(() => current.saveDates(task, shiftedTaskDates(task, after - before, 'move'))).catch(error => { info.revert(); current.setNotice(error instanceof Error ? error.message : 'Could not save dates.'); }).finally(() => { pendingSave.current = false; });
      },
      dayMaxEvents: 3,
      height: "auto",
      fixedWeekCount: false,
      dayHeaderFormat: { weekday: "short" },
      datesSet: (dateInfo) => {
        setCurrentTitle(dateInfo.view.title);
        viewedDate.current = dateInfo.view.currentStart;
      },
      eventClick: (info) => {
        info.jsEvent.preventDefault();
        const props = info.event.extendedProps;
        if (props?.kind === "task" && props?.taskId) {
          callbacks.current.onOpenTask(props.taskId);
        } else if (props.kind === 'review') {
          callbacks.current.onOpenReviews?.();
        } else {
          callbacks.current.onOpenPlan?.();
        }
      },
      eventContent: (eventInfo) => {
        const props = eventInfo.event.extendedProps || {};
        const isTask = props.kind === "task";
        const isCompleted = props.status === "completed";
        const isOverdue = props.isOverdue;

        const dotColor = isCompleted
          ? "bg-emerald-500"
          : isOverdue
            ? "bg-rose-500"
            : isTask
              ? "bg-blue-500"
              : "bg-indigo-600";

        const cardClass = isTask
          ? "eflow-cal-event-card eflow-cal-event-card--task"
          : "eflow-cal-event-card eflow-cal-event-card--milestone";

        const title = escapeHtml(eventInfo.event.title || "");
        const color = isTask ? (STATUS_COLORS[props.status] || '#579bfc') : '#8b6be8';
        const ownerHtml = props.assigneeName
          ? `<span class="eflow-cal-event-owner truncate text-[9.5px] opacity-75">${escapeHtml(props.assigneeName)}</span>`
          : "";

        return {
          html: `
            <div class="${cardClass} pv-calendar-pill" style="background:${color};color:white" title="${title}${isOverdue ? ' · Overdue' : ''}">
              <div class="flex items-center gap-1 min-w-0">
                <span class="eflow-cal-event-dot ${dotColor}"></span>
                <span class="eflow-cal-event-title truncate font-medium">${title}</span>
              </div>
              ${ownerHtml}
            </div>
          `,
        };
      },
    });

    calendar.render();
    calendarInstanceRef.current = calendar;
    setCurrentTitle(calendar.view.title);

    return () => {
      calendar.destroy();
      calendarInstanceRef.current = null;
    };
  }, [events, onOpenTask, viewType]);

  const handlePrev = () => {
    calendarInstanceRef.current?.prev();
    if (calendarInstanceRef.current) {
      setCurrentTitle(calendarInstanceRef.current.view.title);
    }
  };

  const handleNext = () => {
    calendarInstanceRef.current?.next();
    if (calendarInstanceRef.current) {
      setCurrentTitle(calendarInstanceRef.current.view.title);
    }
  };

  const handleToday = () => {
    calendarInstanceRef.current?.today();
    if (calendarInstanceRef.current) {
      setCurrentTitle(calendarInstanceRef.current.view.title);
    }
  };

  const handleViewChange = (newView: "dayGridMonth" | "listMonth") => {
    setViewType(newView);
    calendarInstanceRef.current?.changeView(newView);
    if (calendarInstanceRef.current) {
      setCurrentTitle(calendarInstanceRef.current.view.title);
    }
  };

  return (
    <section className="eflow-project-calendar" aria-label="Project calendar">
      {actions.notice && <p className="pv-error" role="alert">{actions.notice}</p>}
      {reviews.error && <p className="pv-error" role="alert">Office review dates could not be loaded: {reviews.error}</p>}
      {/* Calendar Header & Custom Toolbar */}
      <div className="eflow-project-view-heading">
        <div>
          <span className="eflow-project-view-heading__eyebrow">
            <CalendarIcon size={14} /> Project Schedule Calendar
          </span>
          <h2>Scheduled tasks and activity dates</h2>
          <p>
            {events.length} recorded task, milestone, project and review dates
            {unscheduledCount > 0 ? ` · ${unscheduledCount} unscheduled` : ""}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Navigation Controls */}
          <div className="flex items-center gap-1 rounded-lg border border-neutral-200 bg-white p-0.5 shadow-2xs">
            <button
              type="button"
              className="eflow-cal-nav-btn"
              onClick={handlePrev}
              aria-label="Previous period"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              className="eflow-cal-today-btn px-2.5 py-1 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 rounded-md transition"
              onClick={handleToday}
            >
              Today
            </button>
            <button
              type="button"
              className="eflow-cal-nav-btn"
              onClick={handleNext}
              aria-label="Next period"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Current Month / Period Display */}
          <strong className="text-sm font-semibold text-neutral-800 px-2 min-w-[140px] text-center">
            {currentTitle || "Project Calendar"}
          </strong>

          {/* View Mode Switching */}
          <div className="eflow-timeline-view-modes" role="group" aria-label="Calendar view">
            <button
              type="button"
              className={`eflow-timeline-mode-btn ${viewType === "dayGridMonth" ? "eflow-timeline-mode-btn--active" : ""}`}
              onClick={() => handleViewChange("dayGridMonth")}
            >
              Month
            </button>
            <button
              type="button"
              className={`eflow-timeline-mode-btn ${viewType === "listMonth" ? "eflow-timeline-mode-btn--active" : ""}`}
              onClick={() => handleViewChange("listMonth")}
            >
              List
            </button>
          </div>
        </div>
      </div>

      {/* FullCalendar Wrapper Surface */}
      <div className="eflow-fullcalendar-surface">
        <div ref={calendarContainerRef} />
      </div>
      <details className="pv-calendar-dates"><summary>Task dates · keyboard editing</summary>{data.tasks.map(task => <div key={task.id}><button onClick={() => onOpenTask(task.id)}>{task.title}</button><button disabled={!actions.canEditDates(task)} onClick={() => setEditing(task)} aria-label={'Calendar dates for ' + task.title}>Edit dates</button></div>)}</details>
      {editing && <TaskDatesDialog key={editing.id} task={editing} onClose={() => setEditing(null)} onSave={actions.saveDates}/>}
      {unscheduledCount > 0 && (
        <div className="eflow-calendar-unscheduled" role="note">
          <strong>{unscheduledCount} unscheduled item{unscheduledCount === 1 ? "" : "s"}</strong>
          <span>Items without an authoritative target date stay off the calendar.</span>
        </div>
      )}
    </section>
  );
}
