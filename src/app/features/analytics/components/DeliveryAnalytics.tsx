import { useMemo, useState } from "react";
import { BarChart3, FilterX, FolderKanban, UsersRound } from "lucide-react";
import { useAnalyticsFunding } from "../hooks/useAnalyticsFunding";
import {
  deliveryRows,
  filterDeliveryRows,
  peopleDelivery,
  completionTrend,
  deadlineBucket,
} from "../selectors/deliveryAnalytics";
import { AnalyticsDonut, AnalyticsBars } from "./AnalyticsCharts";
import { AnalyticsTables } from "./AnalyticsTables";
import { ProjectAnalysis } from "./ProjectAnalysis";
import {
  EMPTY_ANALYTICS_FILTERS,
  type AnalyticsInput,
  type AnalyticsFilters,
} from "../types";
import { orderedStatusLabels, resolveStatus, useWorkStatuses } from "../../work-status";
import type { Task } from "../../tasks";
import "../analytics.css";
const labels: Record<string, string> = {
  todo: "Not started",
  pending_assignment: "Unassigned",
  in_progress: "In progress",
  stuck: "Stuck",
  for_review: "Awaiting approval",
  changes_requested: "Changes requested",
  completed: "Completed",
};
const colors: Record<string, string> = {
  todo: "#8ba5a0",
  pending_assignment: "#9a7dba",
  in_progress: "#3b82f6",
  stuck: "#d65a67",
  for_review: "#e3a11a",
  changes_requested: "#bb7350",
  completed: "#00857a",
};
export function DeliveryAnalytics({
  input,
  onOpenTask,
  onOpenProject,
  onSelectPerson,
  overview = false,
  projectAnalysis = false,
  initialTable = "projects",
  fixedProject,
  error,
  loading = false,
}: {
  input: AnalyticsInput;
  onOpenTask: (task: Task) => void;
  onOpenProject?: (id: string) => void;
  onSelectPerson?: (id: string) => void;
  overview?: boolean;
  projectAnalysis?: boolean;
  initialTable?: "projects" | "people" | "tasks";
  fixedProject?: string;
  error?: string;
  loading?: boolean;
}) {
  const [filters, setFilters] = useState<AnalyticsFilters>({
      ...EMPTY_ANALYTICS_FILTERS,
      project: fixedProject || "",
    }),
    [table, setTable] = useState(initialTable),
    [trendIds, setTrendIds] = useState<string[] | null>(null),
    [limit, setLimit] = useState(25),
    [showDetails, setShowDetails] = useState(!overview),
    [special, setSpecial] = useState(""),
    [showFilteredAnalytics, setShowFilteredAnalytics] = useState(false);
  const selectedProject = (projectAnalysis || fixedProject)
    ? input.projects.find(project => project.id === (fixedProject || filters.project))
    : undefined;
  const showProjectAnalysis = !!selectedProject && !error && !loading;
  const all = useMemo(() => deliveryRows(input), [input]),
    rows = useMemo(() => filterDeliveryRows(all, filters), [all, filters]);
  const people = useMemo(
      () =>
        peopleDelivery(rows, input.people).filter(
          (p) => !filters.person || p.id === filters.person,
        ),
      [rows, input.people, filters.person],
    ),
    trend = completionTrend(rows, input.now);
  const update = (patch: Partial<AnalyticsFilters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setTrendIds(null);
    setSpecial("");
    setLimit(25);
  };
  const showTasks = (patch: Partial<AnalyticsFilters>) => {
    update(patch);
    setShowDetails(true);
    setTable("tasks");
  };
  const projectSelector = (
    <label>
      Project
      <select aria-label="Project" value={filters.project} onChange={event => update({ project: event.target.value })}>
        <option value="">All projects</option>
        {input.projects.map(project => <option key={project.id} value={project.id}>{project.title}</option>)}
      </select>
    </label>
  );
  const invalidRange =
    !!filters.from && !!filters.to && filters.from > filters.to;
  const trusted = !error && !loading && !invalidRange,
    shown = (
      trendIds ? rows.filter((r) => trendIds.includes(r.task.id)) : rows
    ).filter((r) => {
      if (!special) return true;
      if (special === "prerequisites")
        return r.prerequisites.length > 0 || r.missingPrerequisites > 0;
      if (special === "active") return r.state !== "completed";
    if (special === "unassigned")
        return !r.task.assigneeId && !r.task.recommendationLeadId;
      return deadlineBucket(r, input.now) === special;
    });
  const {definitions}=useWorkStatuses();
  const states = orderedStatusLabels(definitions,labels).map(({id,label}) => ({
    id,
    label,
    color: resolveStatus(definitions,id,label).color ?? colors[id],
    value: rows.filter((r) => r.state === id).length,
  }));
  const projects = input.projects
    .filter(
      (p) =>
        (!fixedProject || p.id === fixedProject) &&
        (!filters.project || p.id === filters.project),
    )
    .map((project) => {
      const own = rows.filter((r) => r.project?.id === project.id);
      return {
        project,
        own,
        done: own.filter((r) => r.state === "completed").length,
      };
    });
  const funding = useAnalyticsFunding(
    trusted && showDetails && (!showProjectAnalysis || showFilteredAnalytics)
      ? table === "projects"
        ? projects.slice(0, limit).map((p) => p.project.id)
        : table === "tasks"
          ? shown
              .slice(0, limit)
              .flatMap((r) => (r.project ? [r.project.id] : []))
          : []
      : [],
  );
  const metrics = [
    {
      label: "Active projects",
      value: projects.filter(
        (p) => !["completed", "archived"].includes(p.project.status),
      ).length,
      click: () => {
        setShowDetails(true);
        setTable("projects");
      },
    },
    {
      label: "Completed tasks",
      value: rows.filter((r) => r.state === "completed").length,
      click: () => showTasks({ status: "completed" }),
    },
    {
      label: "Overdue tasks",
      value: rows.filter((r) => r.overdue).length,
      click: () => showTasks({ status: "", overdue: true }),
    },
    {
      label: "Awaiting approval",
      value: rows.filter((r) => r.state === "for_review").length,
      click: () => showTasks({ status: "for_review" }),
    },
    {
      label: "Prerequisites pending",
      value: rows.filter(
        (r) => r.prerequisites.length || r.missingPrerequisites,
      ).length,
      click: () => {
        showTasks({});
        setSpecial("prerequisites");
      },
    },
    {
      label: "Needs a task lead",
      value: rows.filter(
        (r) => !r.task.assigneeId && !r.task.recommendationLeadId,
      ).length,
      click: () => {
        showTasks({ status: "" });
        setSpecial("unassigned");
      },
    },
  ];
  return (
    <div
      className="ea-workspace"
      aria-label="Delivery analytics"
      aria-busy={loading}
    >
      {error && (
        <div role="alert" className="ea-warning ea-error">
          Analytics could not be fully loaded. {error} Charts and comparisons
          are hidden until the source records can be verified.
        </div>
      )}
      {invalidRange && (!showProjectAnalysis || showFilteredAnalytics) && (
        <p role="alert" className="ea-warning ea-error">
          The end date must be on or after the start date.
        </p>
      )}
      {loading && (
        <p role="status" className="ea-help">
          Loading analytics…
        </p>
      )}
      {showProjectAnalysis && selectedProject && (
        <>
          {!fixedProject && <div className="ea-filters ea-project-picker">{projectSelector}</div>}
          <ProjectAnalysis key={selectedProject.id} project={selectedProject} input={input} onOpenTask={onOpenTask}
            onOpenProject={onOpenProject && (() => onOpenProject(selectedProject.id))} />
          <button type="button" className="ea-button ea-analysis-filter-toggle" aria-expanded={showFilteredAnalytics}
            onClick={() => setShowFilteredAnalytics(value => !value)}>{showFilteredAnalytics ? "Hide" : "Show"} filters and funding</button>
        </>
      )}
      {(!showProjectAnalysis || showFilteredAnalytics) && <>
      <div className="ea-metrics">
        {metrics.map((item) => (
          <button
            key={item.label}
            type="button"
            disabled={!trusted}
            onClick={item.click}
          >
            <span>{item.label}</span>
            <strong>{trusted ? item.value : "—"}</strong>
          </button>
        ))}
      </div>
      {!overview && (
        <div className="ea-filters" role="group" aria-label="Analytics filters">
          {!fixedProject && !showProjectAnalysis && projectSelector}
          <label>
            Person
            <select
              value={filters.person}
              onChange={(e) => update({ person: e.target.value })}
            >
              <option value="">All people</option>
              {input.people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select
              value={filters.status}
              onChange={(e) => update({ status: e.target.value })}
            >
              <option value="">All statuses</option>
              {states.map(({ id, label }) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Deadline from
            <input
              type="date"
              value={filters.from}
              max={filters.to || undefined}
              onChange={(e) => update({ from: e.target.value })}
            />
          </label>
          <label>
            Deadline to
            <input
              type="date"
              min={filters.from || undefined}
              value={filters.to}
              onChange={(e) => update({ to: e.target.value })}
            />
          </label>
          <label>
            Search
            <input
              type="search"
              placeholder="Task, project or lead"
              value={filters.query}
              onChange={(e) => update({ query: e.target.value })}
            />
          </label>
          <label className="ea-checkbox">
            <input
              type="checkbox"
              checked={filters.overdue}
              onChange={(e) => update({ overdue: e.target.checked })}
            />
            Overdue only
          </label>
          <button
            type="button"
            className="ea-button"
            onClick={() => {
              setFilters({
                ...EMPTY_ANALYTICS_FILTERS,
                project: fixedProject || "",
              });
              setTrendIds(null);
              setSpecial("");
            }}
          >
            <FilterX size={15} />
            Clear filters
          </button>
        </div>
      )}
      {trusted && (
        <>
          <div className="ea-grid">
            <AnalyticsDonut
              title="Task status"
              items={states}
              onSelect={(id) => showTasks({ status: id, overdue: false })}
            />
            <AnalyticsBars
              title="Project completion"
              unit="completed"
              items={projects
                .slice(0, 8)
                .map(({ project, own, done }) => ({
                  id: project.id,
                  label: project.title,
                  value: done,
                  total: own.length,
                  secondary: `${done} complete, ${own.length - done} remaining of ${own.length} tasks · ${own.length ? Math.round((done / own.length) * 100) : 0}% completed`,
                }))}
              onSelect={(id) => {
                showTasks({ project: id, status: "" });
              }}
            />
            <AnalyticsBars
              title="Team workload"
              items={people
                .slice()
                .sort(
                  (a, b) => b.active - a.active || a.name.localeCompare(b.name),
                )
                .slice(0, 8)
                .map((p) => ({
                  id: p.id,
                  label: p.name,
                  value: p.active,
                  secondary: `${p.overdue} overdue · ${p.contributing} contributing · ${p.estimatedHours} estimated hours as lead`,
                }))}
              onSelect={(id) => {
                showTasks({ person: id, status: "" });
              setSpecial("active");
              }}
            />
            <AnalyticsBars
              title="Weekly completions"
              unit="completed"
              items={trend.map((week) => ({
                id: week.from,
                label: week.label,
                value: week.count,
                secondary: `${week.from} to ${week.to}`,
              }))}
              onSelect={(id) => {
                setTrendIds(trend.find((w) => w.from === id)?.ids || []);
                setSpecial("");
                setShowDetails(true);
                setTable("tasks");
              }}
            />
          </div>
          <div className="ea-grid">
            <AnalyticsBars
              title="Typical completion time"
              unit="hours"
              items={people
                .filter((p) => p.medianHours !== null)
                .sort((a, b) => a.medianHours! - b.medianHours!)
                .slice(0, 8)
                .map((p) => ({
                  id: p.id,
                  label: p.name,
                  value: Math.round(p.medianHours! * 10) / 10,
                  secondary: `${p.samples} timed completed tasks · ${p.active} active · approval waiting excluded`,
                }))}
              onSelect={(id) => {
                update({ person: id });
                setShowDetails(true);
                setTable("people");
              }}
            />
            <AnalyticsBars
              title="Deadline reliability"
              unit="late submissions"
              items={people
                .filter((p) => p.dated > 0 || p.overdue > 0)
                .sort((a, b) => b.late - a.late || b.overdue - a.overdue)
                .slice(0, 8)
                .map((p) => ({
                  id: p.id,
                  label: p.name,
                  value: p.late,
                  secondary: `${p.dated} dated submissions · ${p.lateRate === null ? "No late rate" : p.lateRate + "% late"} · ${p.overdue} currently overdue`,
                }))}
              onSelect={(id) => {
                update({ person: id });
                setShowDetails(true);
                setTable("people");
              }}
            />
          </div>
          <p className="ea-help">
            Counts follow the selected task filters; funding shows full project
            totals. Charts count parent tasks once. Subtask activity stays
            separate. Date filters use task deadlines. Weekly completions use
            recorded approval dates;{" "}
            {
              rows.filter((r) => r.state === "completed" && !r.completedAt)
                .length
            }{" "}
            completed tasks have no recorded approval date. Select a chart to
            inspect its records below.
          </p>
          {overview && (
            <div className="ea-grid">
              <AnalyticsBars
                title="Deadline overview"
                items={[
                  {
                    id: "overdue",
                    label: "Overdue",
                    value: rows.filter((r) => r.overdue).length,
                  },
                  {
                    id: "today",
                    label: "Due today",
                    value: rows.filter(
                      (r) => deadlineBucket(r, input.now) === "today",
                    ).length,
                  },
                  {
                    id: "soon",
                    label: "Due in the next 7 days",
                    value: rows.filter(
                      (r) => deadlineBucket(r, input.now) === "soon",
                    ).length,
                  },
                ]}
                onSelect={(id) => {
                  showTasks({ overdue: id === "overdue", status: "" });
                  if (id !== "overdue") setSpecial(id);
                }}
              />
              <section className="ea-panel">
                <h2>Needs attention</h2>
                {rows
                  .filter(
                    (r) =>
                      r.overdue ||
                      r.state === "stuck" ||
                      r.prerequisites.length ||
                      r.state === "for_review",
                  )
                  .slice(0, 6)
                  .map((r) => (
                    <p key={r.task.id}>
                      <button
                        type="button"
                        className="ea-link"
                        onClick={() => onOpenTask(r.task)}
                      >
                        {r.task.title}
                      </button>
                      <small className="ea-help">
                        {" "}
                        ·{" "}
                        {r.overdue
                          ? `${r.overdueDays} days overdue`
                          : r.prerequisites.length
                            ? "Prerequisites pending"
                            : resolveStatus(definitions,r.state,labels[r.state],r.task.customStatusId).label}
                      </small>
                    </p>
                  ))}
                {!rows.some(
                  (r) =>
                    r.overdue ||
                    r.state === "stuck" ||
                    r.prerequisites.length ||
                    r.state === "for_review",
                ) && <p className="ea-empty">No tasks need attention.</p>}
              </section>
            </div>
          )}
          {showDetails && (
            <>
              <div
                className="ea-tabs"
                role="group"
                aria-label="Analytics tables"
              >
                {[
                  { id: "projects", label: "Projects", icon: FolderKanban },
                  { id: "people", label: "People", icon: UsersRound },
                  { id: "tasks", label: "Tasks", icon: BarChart3 },
                ].map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={table === id}
                    onClick={() => {
                      setTable(id as typeof table);
                      setLimit(25);
                    }}
                  >
                    <Icon size={16} />
                    {label}
                  </button>
                ))}
              </div>
              <AnalyticsTables
                table={table}
                projects={projects}
                people={people}
                shown={shown}
                limit={limit}
                input={input}
                funding={funding}
                trendIds={trendIds}
                onOpenProject={(id) =>
                  onOpenProject ? onOpenProject(id) : showTasks({ project: id })
                }
                onSelectPerson={onSelectPerson}
                onOpenTask={onOpenTask}
                showTasks={showTasks}
                clearWeek={() => setTrendIds(null)}
              />
              {(table === "projects"
                ? projects.length
                : table === "people"
                  ? people.length
                  : shown.length) > limit && (
                <button
                  type="button"
                  className="ea-button"
                  onClick={() => setLimit((n) => n + 25)}
                >
                  Show 25 more rows
                </button>
              )}
            </>
          )}
        </>
      )}
      </>}
    </div>
  );
}
