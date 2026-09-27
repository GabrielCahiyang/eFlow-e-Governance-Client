import { useEffect, useMemo, useRef, useState } from "react";
import { Calendar } from "@fullcalendar/core";
import dayGridPlugin from "@fullcalendar/daygrid";
import listPlugin from "@fullcalendar/list";
import interactionPlugin from "@fullcalendar/interaction";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import type { UserProfile } from "../../../../types";
import type { ProjectCommandData } from "./types";
import { isOverdue } from "../../../tasks";
import { parseCalendarDate } from "../../../../shared/scheduling/relativeSchedule";

interface CalendarEventItem {
  id: string;
  title: string;
  start: string;
  end?: string;
  allDay: boolean;
  className: string;
  extendedProps: {
    kind: "milestone" | "task";
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
}: {
  data: ProjectCommandData;
  profiles?: UserProfile[];
  onOpenTask: (taskId: string) => void;
}) {
  const calendarContainerRef = useRef<HTMLDivElement>(null);
  const calendarInstanceRef = useRef<Calendar | null>(null);
  const [currentTitle, setCurrentTitle] = useState("");
  const [viewType, setViewType] = useState<"dayGridMonth" | "listMonth">("dayGridMonth");

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
      // Tasks do not have a persisted start date in eFlow. Keep the calendar
      // truthful by rendering only an authoritative deadline/target date.
      if (!taskDueStr) return;

      const isCompleted = task.status === "completed";
      const isTaskOverdue = !isCompleted && isOverdue(task);

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
          isOverdue: Boolean(isOverdue),
        },
      });
    });

    return list;
  }, [data.milestones, data.tasks, ownerNames]);
  const unscheduledCount = data.tasks.filter((task) => !task.deadline && !task.dueDate).length
    + data.milestones.filter((milestone) => !milestone.dueDate).length;

  // Mount FullCalendar instance directly to avoid React wrapper ES module class issues in Vite
  useEffect(() => {
    if (!calendarContainerRef.current) return;

    const calendar = new Calendar(calendarContainerRef.current, {
      plugins: [dayGridPlugin, listPlugin, interactionPlugin],
      initialView: viewType,
      headerToolbar: false,
      events: events as any,
      dayMaxEvents: 3,
      height: "auto",
      fixedWeekCount: false,
      dayHeaderFormat: { weekday: "short" },
      datesSet: (dateInfo) => {
        setCurrentTitle(dateInfo.view.title);
      },
      eventClick: (info) => {
        info.jsEvent.preventDefault();
        const props = info.event.extendedProps;
        if (props?.kind === "task" && props?.taskId) {
          onOpenTask(props.taskId);
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
        const ownerHtml = props.assigneeName
          ? `<span class="eflow-cal-event-owner truncate text-[9.5px] opacity-75">${escapeHtml(props.assigneeName)}</span>`
          : "";

        return {
          html: `
            <div class="${cardClass}" title="${title}">
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
      {/* Calendar Header & Custom Toolbar */}
      <div className="eflow-project-view-heading">
        <div>
          <span className="eflow-project-view-heading__eyebrow">
            <CalendarIcon size={14} /> Project Schedule Calendar
          </span>
          <h2>Scheduled tasks and activity dates</h2>
          <p>
            {events.length} schedule dates recorded across active project tasks and milestones
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
      {unscheduledCount > 0 && (
        <div className="eflow-calendar-unscheduled" role="note">
          <strong>{unscheduledCount} unscheduled item{unscheduledCount === 1 ? "" : "s"}</strong>
          <span>Items without an authoritative target date stay off the calendar.</span>
        </div>
      )}
    </section>
  );
}
