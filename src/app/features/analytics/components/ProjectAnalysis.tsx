import { useMemo, useRef, useState } from "react";
import { ArrowUpRight, CalendarDays, ChartNoAxesCombined, ListChecks } from "lucide-react";
import { workDateLabel } from "../../../shared/workCalendar";
import { builtInStatuses, resolveStatus, useWorkStatuses } from "../../work-status";
import type { Task } from "../../tasks";
import { analyzeProject, type ProjectAnalysisRow } from "../selectors/projectAnalysis";
import type { AnalyticsInput, AnalyticsProject } from "../types";
import { AnalyticsBars, AnalyticsDonut } from "./AnalyticsCharts";
import { ProjectAnalysisTable, type AnalysisColumn } from "./ProjectAnalysisTable";
import { ProjectAssignmentHistory } from "./ProjectAssignmentHistory";
import "../projectAnalysis.css";

const zone = "Asia/Manila";
const dateTime = new Intl.DateTimeFormat("en-PH", { timeZone: zone, dateStyle: "medium", timeStyle: "short" });
const dateOnly = new Intl.DateTimeFormat("en-PH", { timeZone: zone, dateStyle: "medium" });
const number = new Intl.NumberFormat("en-PH", { maximumFractionDigits: 1 });
const timestamp = (value: number) => dateTime.format(new Date(value));
const duration = (hours: number) => {
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  if (hours < 24) return `${number.format(hours)} hr`;
  const days = number.format(hours / 24);
  return `${days} ${days === "1" ? "day" : "days"}`;
};
const taskCount = (count: number) => `${count} task${count === 1 ? "" : "s"}`;
const slices = [
  { id: "open", label: "Open tasks", match: (row: ProjectAnalysisRow) => !row.completed },
  { id: "completed", label: "Completed tasks", match: (row: ProjectAnalysisRow) => row.completed },
  { id: "late", label: "Submitted late", match: (row: ProjectAnalysisRow) => row.late === true },
  { id: "overdue", label: "Overdue without a submission", match: (row: ProjectAnalysisRow) => row.unsubmittedOverdue },
  { id: "review", label: "Awaiting approval", match: (row: ProjectAnalysisRow) => row.task.status === "for_review" },
  { id: "review-late", label: "Submitted on time, approved after deadline", match: (row: ProjectAnalysisRow) =>
    row.late === false && row.approvedAt != null && row.deadline != null && row.approvedAt > row.deadline },
];

export function ProjectAnalysis({ project, input, onOpenTask, onOpenProject }: {
  project: AnalyticsProject;
  input: AnalyticsInput;
  onOpenTask: (task: Task) => void;
  onOpenProject?: () => void;
}) {
  const { rows, people, schedule, closed } = useMemo(() => analyzeProject(project, input), [project, input]);
  const { definitions } = useWorkStatuses();
  const [slice, setSlice] = useState("");
  const [personId, setPersonId] = useState("");
  const [historyId, setHistoryId] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  const selection = slices.find(item => item.id === slice);
  const person = people.find(item => item.id === personId);
  const drillDown = (nextSlice: string, nextPerson = "") => {
    setSlice(nextSlice);
    setPersonId(nextPerson);
    setHistoryId("");
    heading.current?.focus();
  };
  const displayed = rows.filter(row => (!selection || selection.match(row)) && (!person ||
    row.submitterId === person.id || row.leadId === person.id || row.contributorIds.includes(person.id)));
  const counts = slices.map(item => ({ ...item, value: rows.filter(item.match).length }));
  const [open, complete, late, overdue, review] = counts;
  const longestReview = Math.max(0, ...rows.flatMap(row => [row.reviewHours ?? 0, row.pendingHours ?? 0]));
  const hasReview = rows.some(row => row.reviewHours !== null || row.pendingHours !== null);
  const taskStatus = (row: ProjectAnalysisRow) => resolveStatus(definitions, row.task.status, builtInStatuses[row.task.status], row.task.customStatusId).label;
  const peopleColumns: AnalysisColumn<(typeof people)[number]>[] = [
    { label: "Person", value: row => row.name, render: row => <button type="button" className="ea-link" onClick={() => drillDown("", row.id)}>{row.name}</button> },
    { label: "Tasks as lead", value: row => row.leading },
    { label: "Contributing", value: row => row.contributing },
    { label: "On-time submissions", value: row => row.onTime },
    { label: "Late submissions", value: row => row.late },
    { label: "Overdue as lead", value: row => row.overdue },
    { label: "Median time to submit", value: row => row.typicalHours, render: row => row.typicalHours === null ? "—" : <>{duration(row.typicalHours)}<small>{taskCount(row.samples)} timed</small></> },
    { label: "Median review time", value: row => row.reviewHours, render: row => row.reviewHours === null ? "—" : duration(row.reviewHours) },
  ];
  const taskColumns: AnalysisColumn<ProjectAnalysisRow>[] = [
    { label: "Task", value: row => row.task.title, render: row => <>
      <button type="button" className="ea-link" onClick={() => onOpenTask(row.task)}>{row.task.title}</button>
      <small>{taskStatus(row)}</small>
    </> },
    { label: "Assignment", value: row => row.leadName, render: row => <>
      {row.leadName}<small>{row.contributorIds.length} contributor{row.contributorIds.length === 1 ? "" : "s"}</small>
      {row.submitterChanged && <small>First submitted by {row.submitterName || "a different team member"}.</small>}
      <button type="button" className="ea-link ea-history-toggle" aria-expanded={historyId === row.task.id}
        aria-label={`Assignment history for ${row.task.title}`}
        onClick={() => setHistoryId(historyId === row.task.id ? "" : row.task.id)}>Assignment history</button>
      {historyId === row.task.id && <ProjectAssignmentHistory key={row.task.id} taskId={row.task.id} projectId={project.id} />}
    </> },
    { label: "Deadline", value: row => row.deadline, render: row => row.deadline === null ? "No deadline recorded" : dateOnly.format(new Date(row.deadline)) },
    { label: "First submission", value: row => row.submittedAt, render: row => row.submittedAt == null
      ? row.latestSubmittedAt == null ? "No submission recorded" : <>First submission unavailable<small>Latest {timestamp(row.latestSubmittedAt)}</small></>
      : <>{timestamp(row.submittedAt)}{row.late !== null && <small className={row.late ? "ea-timing-late" : ""}>{row.late ? "Late" : "On time"}</small>}</> },
    { label: "Approved", value: row => row.approvedAt, render: row => row.approvedAt != null ? timestamp(row.approvedAt) : row.completed ? "No approval date recorded" : "—" },
    { label: "Review time", value: row => row.pendingHours ?? row.reviewHours, render: row => row.pendingHours != null
      ? `${duration(row.pendingHours)} waiting` : row.reviewHours == null ? "—" : duration(row.reviewHours) },
    { label: "Blockers", value: row => row.activeBlocker || row.prerequisites.join(", ") || row.blocker?.blocker, render: row => <>
      {row.prerequisites.length > 0 && !row.completed && <small>Waiting for {row.prerequisites.join(", ")}</small>}
      {row.unavailablePrerequisites > 0 && !row.completed && <small>{row.unavailablePrerequisites} prerequisite record{row.unavailablePrerequisites === 1 ? "" : "s"} unavailable</small>}
      {row.blocker?.blocker ? <>{row.blocker.blocker}<small>{row.activeBlocker && !row.completed ? "Reported" : "Previously reported"} {timestamp(row.blocker.createdAt)}</small></>
        : (!row.prerequisites.length && !row.unavailablePrerequisites) || row.completed ? "No blocker recorded" : null}
    </> },
  ];

  return (
    <div className="ea-workspace ea-project-analysis" aria-label={`Project analysis for ${project.title}`}>
      <section className="ea-panel ea-project-summary" aria-label="Project summary">
        <div className="ea-analysis-heading">
          <span className="ea-analysis-icon"><ChartNoAxesCombined size={20} aria-hidden="true" /></span>
          <div><h2>Project analysis</h2><p>{project.title}</p></div>
          {onOpenProject && <button type="button" className="ea-button" onClick={onOpenProject}>Open project <ArrowUpRight size={15} /></button>}
        </div>
        <div className="ea-schedule-result"><CalendarDays size={19} aria-hidden="true" /><strong>{schedule}</strong></div>
        <dl className="ea-project-dates">
          <div><dt>Start date</dt><dd>{workDateLabel(project.startDate, zone)}</dd></div>
          <div><dt>Target date</dt><dd>{workDateLabel(project.targetDate, zone)}</dd></div>
          <div><dt>Actual completion</dt><dd>{closed ? workDateLabel(project.completedAt, zone) : "Project open"}</dd></div>
        </dl>
        <p className="ea-help">{complete.value} of {taskCount(rows.length)} complete. {late.value} submitted late. {overdue.value} overdue without a submission. {review.value} awaiting approval.
          {hasReview && ` Longest recorded review wait: ${duration(longestReview)}.`}</p>
        {open.value > 0 && <button type="button" className="ea-link ea-open-work" onClick={() => drillDown("open")}><ListChecks size={16} /> View {taskCount(open.value)} still open</button>}
      </section>
      <div className="ea-grid">
        <AnalyticsDonut title="Task completion" items={[{ ...complete, color: "#00857a" }, { ...open, color: "#8ba5a0" }]} onSelect={drillDown} />
        <AnalyticsBars title="Delivery delays" items={counts.slice(2)} onSelect={drillDown} />
      </div>
      <section className="ea-panel ea-analysis-section">
        <h2>Team comparison</h2>
        <p className="ea-help">Submission timing uses the person who first sent the work. Median time to submit uses tasks with a recorded start by that person. Review time and contributor assignments are shown separately.</p>
        {people.length ? <ProjectAnalysisTable label="Team comparison" rows={people} columns={peopleColumns} rowKey={row => row.id} />
          : <p className="ea-empty">No task assignments or submissions to compare.</p>}
      </section>
      <section className="ea-panel ea-analysis-section">
        <div className="ea-analysis-drilldown">
          <div>
            <h2 ref={heading} tabIndex={-1}>Task records</h2>
            <p className="ea-help" aria-live="polite">{selection?.label || "All tasks"}{person && ` · ${person.name}`} · {taskCount(displayed.length)}</p>
          </div>
          {(selection || person) && <button type="button" className="ea-button" onClick={() => drillDown("")}>Show all tasks</button>}
        </div>
        {displayed.length ? <ProjectAnalysisTable label="Task records" rows={displayed} columns={taskColumns} rowKey={row => row.task.id} />
          : <p className="ea-empty">No tasks match this view.</p>}
      </section>
    </div>
  );
}
