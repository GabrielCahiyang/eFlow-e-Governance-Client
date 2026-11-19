import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  GitBranch,
  History,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  Workflow,
} from "lucide-react";
import { DateInput } from "../../../components/ui/DateInput";
import { Button } from "../../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";
import { getPhilippineCalendarDate } from "../../../shared/calendarDates";
import type { AnalyticsProject } from "../../analytics";
import { useProcessMiningAnalysis } from "../hooks/useProcessMiningAnalysis";
import { ProcessFlowGraph } from "./ProcessFlowGraph";
import { ProcessMiningLoader } from "./ProcessMiningLoader";
import type {
  ActivityEdge,
  ProcessEventItem,
  ProcessRecommendation,
  ProjectProcessSummary,
  ReworkDeviationItem,
  StageBreakdownItem,
  WorkflowVariant,
} from "../types";
import "../processMining.css";

type DetailTab = "projects" | "issues" | "paths" | "handoffs" | "timeline";

const numberFmt = new Intl.NumberFormat("en-PH", { maximumFractionDigits: 1 });
const pesoFmt = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 0,
});
const dateTimeFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Manila",
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

function formatDurationHours(hours: number | null | undefined): string {
  if (hours == null || !Number.isFinite(hours)) return "—";
  if (hours <= 0) return "0 min";
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  if (hours < 24) return `${numberFmt.format(hours)} hr`;
  const days = numberFmt.format(hours / 24);
  return `${days} ${days === "1" ? "day" : "days"}`;
}

function formatPriorityLabel(priority: "high" | "medium" | "low"): string {
  if (priority === "high") return "High priority";
  if (priority === "medium") return "Needs attention";
  return "On track";
}

function priorityBadgeClass(level: "high" | "medium" | "low"): string {
  if (level === "high") return "pm-badge pm-badge--high";
  if (level === "medium") return "pm-badge pm-badge--medium";
  return "pm-badge pm-badge--low";
}

function cleanStageTokenLabel(token: string): string {
  return token.replace(/\s*\(Rework\)/gi, " (Sent back)");
}

function cleanMetricLabel(label: string): string {
  return label
    .replace(/Task rework loops/gi, "Sent back")
    .replace(/Conformance exceptions/gi, "Alerts")
    .replace(/Median wait/gi, "Typical wait");
}

function complianceBadgeClass(rate: number): string {
  if (rate >= 90) return "pm-badge pm-badge--low";
  if (rate >= 75) return "pm-badge pm-badge--medium";
  return "pm-badge pm-badge--high";
}

export function DeepAnalysisPanel({
  projects,
  cacheScopeKey = "office",
  orgId,
  userId,
  userName,
  onOpenProject,
  onOpenTaskId,
}: {
  projects: AnalyticsProject[];
  cacheScopeKey?: string;
  orgId?: string;
  userId?: string;
  userName?: string;
  onOpenProject?: (projectId: string) => void;
  onOpenTaskId?: (taskId: string) => void;
}) {
  const {
    filters,
    updateFilters,
    clearFilters,
    refresh,
    report,
    savedAt,
    savedByName,
    isCachedSnapshot,
    loading,
    refreshing,
    progress,
    error,
    invalidDateRange,
  } = useProcessMiningAnalysis("", cacheScopeKey, { orgId, userId, userName });

  const [detailTab, setDetailTab] = useState<DetailTab>("projects");
  const [inspectedStage, setInspectedStage] = useState<string | null>(null);

  const today = getPhilippineCalendarDate();
  const maxStageHours = useMemo(() => {
    if (!report?.stageBreakdown.length) return 1;
    return Math.max(
      1,
      ...report.stageBreakdown.map((item) => item.medianWaitHours),
    );
  }, [report]);

  const sortedProjects = useMemo(
    () => [...projects].sort((a, b) => a.title.localeCompare(b.title)),
    [projects],
  );

  const taskTitleLookup = useMemo(() => {
    const map = new Map<string, string>();
    if (!report) return map;
    for (const item of report.reworkAndDeviations) {
      if (item.taskId && item.taskTitle) map.set(item.taskId, item.taskTitle);
    }
    for (const ev of report.recentEvents) {
      if (ev.taskId && ev.taskTitle && !map.has(ev.taskId)) {
        map.set(ev.taskId, ev.taskTitle);
      }
    }
    return map;
  }, [report]);

  const isBusy = loading || refreshing;
  const formattedStamp = savedAt
    ? dateTimeFmt.format(new Date(savedAt))
    : report?.summary.generatedAt
      ? dateTimeFmt.format(new Date(report.summary.generatedAt))
      : null;

  const activeDetailTab: DetailTab =
    detailTab === "paths" && (filters.projectId || !report?.variants.length)
      ? "projects"
      : detailTab;

  return (
    <div className="pm-workspace" aria-label="Deep Process Analysis" aria-busy={isBusy}>
      <section className="pm-toolbar" aria-label="Process mining filters">
        <div className="pm-filters">
          <label className="pm-field">
            <span>Project</span>
            <select
              aria-label="Analysis project scope"
              value={filters.projectId}
              onChange={(event) => updateFilters({ projectId: event.target.value })}
            >
              <option value="">All Office projects</option>
              {sortedProjects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.title}
                </option>
              ))}
            </select>
          </label>

          <label className="pm-field">
            <span>From</span>
            <DateInput
              aria-label="Process mining from date"
              max={filters.toDate || today}
              value={filters.fromDate}
              onChange={(event) => updateFilters({ fromDate: event.target.value })}
              className="h-9 rounded-lg border border-border bg-card px-2.5 text-[13px] text-foreground"
            />
          </label>

          <label className="pm-field">
            <span>To</span>
            <DateInput
              aria-label="Process mining to date"
              min={filters.fromDate || undefined}
              max={today}
              value={filters.toDate}
              onChange={(event) => updateFilters({ toDate: event.target.value })}
              className="h-9 rounded-lg border border-border bg-card px-2.5 text-[13px] text-foreground"
            />
          </label>

          <label className="pm-checkbox">
            <input
              type="checkbox"
              checked={filters.includeCompleted}
              disabled={Boolean(filters.projectId)}
              onChange={(event) =>
                updateFilters({ includeCompleted: event.target.checked })
              }
            />
            <span>Include completed &amp; archived</span>
          </label>
        </div>

        <div className="pm-actions">
          {formattedStamp && !isCachedSnapshot && !isBusy && (
            <span className="text-[12px] text-muted-foreground">
              Last saved: {formattedStamp}
              {savedByName ? ` · ${savedByName}` : ""}
            </span>
          )}
          {(filters.projectId ||
            !filters.includeCompleted ||
            filters.fromDate ||
            filters.toDate) && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              disabled={isBusy}
            >
              Reset
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={refresh}
            disabled={isBusy || invalidDateRange}
          >
            <RefreshCw size={14} className={isBusy ? "pm-spin mr-1.5" : "mr-1.5"} />
            {isBusy ? "Analyzing…" : "Refresh"}
          </Button>
        </div>
      </section>

      {isCachedSnapshot && !loading && (
        <div role="status" className="pm-stale-banner">
          <div className="flex items-center gap-2">
            <AlertTriangle size={15} className="shrink-0 text-amber-700" aria-hidden="true" />
            <span>
              <strong>Saved report · May be outdated.</strong>{" "}
              Live server offline
              {formattedStamp ? ` · Last saved update: ${formattedStamp}` : ""}
              {savedByName ? ` (by ${savedByName})` : ""}.
            </span>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={refresh}>
            Retry live analysis
          </Button>
        </div>
      )}

      {error && (
        <div role="alert" className="ea-warning ea-error flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} aria-hidden="true" />
            <span>{error}</span>
          </div>
          {!invalidDateRange && (
            <Button type="button" variant="outline" size="sm" onClick={refresh}>
              Retry
            </Button>
          )}
        </div>
      )}

      {loading && <ProcessMiningLoader progress={progress} />}

      {!loading && refreshing && <ProcessMiningLoader progress={progress} compact />}

      {!loading && !report && !error && (
        <section className="ea-panel">
          <p className="ea-empty">
            No workflow activity found for the selected project or dates.
          </p>
        </section>
      )}

      {!loading && report && (
        <>
          <div className="pm-kpi-grid" aria-label="Process mining summary">
            <div className="pm-kpi-card">
              <div className="pm-kpi-head">
                <span>Projects analyzed</span>
                <Workflow size={14} aria-hidden="true" />
              </div>
              <div className="pm-kpi-value">{report.summary.projectsAnalyzed}</div>
              <div className="pm-kpi-sub">
                {report.summary.totalTasks} tasks tracked
              </div>
            </div>

            <div className="pm-kpi-card">
              <div className="pm-kpi-head">
                <span>Actions recorded</span>
                <History size={14} aria-hidden="true" />
              </div>
              <div className="pm-kpi-value">{report.summary.totalEvents}</div>
              <div className="pm-kpi-sub">
                {report.summary.variantCount} workflow path
                {report.summary.variantCount === 1 ? "" : "s"}
              </div>
            </div>

            <div className="pm-kpi-card">
              <div className="pm-kpi-head">
                <span>Slowest stage</span>
                <Clock3 size={14} aria-hidden="true" />
              </div>
              <div className="pm-kpi-value">
                {report.summary.longestWaitStage
                  ? report.summary.longestWaitStage.label
                  : "—"}
              </div>
              <div className="pm-kpi-sub truncate">
                {report.summary.longestWaitStage
                  ? report.summary.longestWaitStage.stage
                  : "No stage waits recorded"}
              </div>
            </div>

            <div className="pm-kpi-card">
              <div className="pm-kpi-head">
                <span>Sent back for fixes</span>
                <RotateCcw size={14} aria-hidden="true" />
              </div>
              <div className="pm-kpi-value">{report.summary.reworkLoops}</div>
              <div className="pm-kpi-sub">
                {report.summary.deviationCount} schedule or step alert
                {report.summary.deviationCount === 1 ? "" : "s"}
              </div>
            </div>

            <div className="pm-kpi-card">
              <div className="pm-kpi-head">
                <span>Workflow compliance</span>
                <ShieldCheck size={14} aria-hidden="true" />
              </div>
              <div className="pm-kpi-value">
                {numberFmt.format(report.summary.conformanceRate)}%
              </div>
              <div className="pm-kpi-sub">Followed standard steps</div>
            </div>
          </div>

          <section className="ea-panel space-y-3" aria-label="Actual workflow discovery">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="!mb-1">How projects moved across stages</h2>
                <p className="ea-help">
                  Shows the real sequence from kickoff to closeout, highlighting slow stages and items sent back for fixes.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-[12px] text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block h-0.5 w-4 bg-[#0c6f6b]" /> Main flow
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block h-0.5 w-4 bg-[#d97706]" /> Slow transition
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block h-0.5 w-4 border-t-2 border-dashed border-[#dc2626]" /> Sent back
                </span>
                {filters.projectId && onOpenProject && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onOpenProject(filters.projectId)}
                  >
                    Open project <ArrowUpRight size={14} className="ml-1" />
                  </Button>
                )}
              </div>
            </div>
            <ProcessFlowGraph
              nodes={report.dfg.nodes}
              edges={report.dfg.edges}
              layoutScopeKey={cacheScopeKey}
              onInspectStage={(stageName) => setInspectedStage(stageName)}
            />
          </section>

          <div className="ea-grid">
            <section className="ea-panel space-y-3" aria-label="Bottleneck analysis">
              <div>
                <h2 className="!mb-1">Time spent per stage</h2>
                <p className="ea-help">
                  Typical time items waited in each stage before moving forward.
                </p>
              </div>
              <StageBars items={report.stageBreakdown} maxHours={maxStageHours} />
            </section>

            <section className="ea-panel space-y-3" aria-label="Improvement recommendations">
              <div>
                <h2 className="!mb-1">Key findings &amp; next steps</h2>
                <p className="ea-help">
                  Practical actions based on delays, returned items, and schedule changes.
                </p>
              </div>
              <RecommendationsList
                items={report.recommendations}
                taskTitleLookup={taskTitleLookup}
                onSelectProject={(pid) => updateFilters({ projectId: pid })}
                onOpenTaskId={onOpenTaskId}
              />
            </section>
          </div>

          <section className="ea-panel space-y-4" aria-label="Detailed breakdown">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="!mb-1">Detailed breakdown</h2>
                <p className="ea-help">
                  Switch views below to inspect individual projects, returned work, stage paths, or recorded actions.
                </p>
              </div>
            </div>

            <div className="pm-subtabs" role="tablist" aria-label="Analysis breakdown tabs">
              <button
                type="button"
                role="tab"
                aria-selected={activeDetailTab === "projects"}
                className="pm-subtab"
                onClick={() => setDetailTab("projects")}
              >
                Projects
                <span className="pm-subtab-count">{report.projects.length}</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeDetailTab === "issues"}
                className="pm-subtab"
                onClick={() => setDetailTab("issues")}
              >
                Sent back &amp; alerts
                <span className="pm-subtab-count">{report.reworkAndDeviations.length}</span>
              </button>
              {!filters.projectId && report.variants.length > 0 && (
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeDetailTab === "paths"}
                  className="pm-subtab"
                  onClick={() => setDetailTab("paths")}
                >
                  Workflow paths
                  <span className="pm-subtab-count">{report.variants.length}</span>
                </button>
              )}
              <button
                type="button"
                role="tab"
                aria-selected={activeDetailTab === "handoffs"}
                className="pm-subtab"
                onClick={() => setDetailTab("handoffs")}
              >
                Slowest handoffs
                <span className="pm-subtab-count">{report.dfg.activityEdges.length}</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeDetailTab === "timeline"}
                className="pm-subtab"
                onClick={() => setDetailTab("timeline")}
              >
                Activity timeline
                <span className="pm-subtab-count">{report.recentEvents.length}</span>
              </button>
            </div>

            {activeDetailTab === "projects" && (
              <ProjectProcessTable
                items={report.projects}
                selectedProjectId={filters.projectId}
                onSelectProject={(pid) => updateFilters({ projectId: pid })}
                onOpenProject={onOpenProject}
              />
            )}

            {activeDetailTab === "issues" && (
              <ReturnedWorkList
                items={report.reworkAndDeviations}
                onSelectProject={(pid) => updateFilters({ projectId: pid })}
                onOpenTaskId={onOpenTaskId}
              />
            )}

            {activeDetailTab === "paths" && !filters.projectId && (
              <WorkflowPathsTable
                variants={report.variants}
                onSelectProject={(pid) => updateFilters({ projectId: pid })}
              />
            )}

            {activeDetailTab === "handoffs" && (
              <SlowHandoffsTable edges={report.dfg.activityEdges} />
            )}

            {activeDetailTab === "timeline" && (
              <EventTraceTable
                events={report.recentEvents}
                onOpenTaskId={onOpenTaskId}
              />
            )}
          </section>

          <StageActionsModal
            stageName={inspectedStage}
            events={report.recentEvents}
            stageNode={report.dfg.nodes.find((n) => n.stage === inspectedStage) || null}
            onClose={() => setInspectedStage(null)}
            onSelectProject={(pid) => {
              setInspectedStage(null);
              updateFilters({ projectId: pid });
            }}
            onOpenTaskId={
              onOpenTaskId
                ? (taskId) => {
                    setInspectedStage(null);
                    onOpenTaskId(taskId);
                  }
                : undefined
            }
          />
        </>
      )}
    </div>
  );
}

function StageBars({
  items,
  maxHours,
}: {
  items: StageBreakdownItem[];
  maxHours: number;
}) {
  const timed = items.filter((item) => item.transitionSamples > 0);
  const untimed = items.filter(
    (item) => item.transitionSamples === 0 && item.eventCount > 0,
  );

  if (!timed.length && !untimed.length) {
    return <p className="ea-empty">No stage timing recorded yet.</p>;
  }

  return (
    <div className="space-y-4">
      {timed.length > 0 && (
        <div className="space-y-3.5">
          {timed.map((item) => {
            const widthPct = Math.max(
              6,
              Math.min(100, Math.round((item.medianWaitHours / maxHours) * 100)),
            );
            return (
              <div key={item.stage} className="space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2 text-[12.5px]">
                  <span className="font-medium text-foreground flex items-center gap-2">
                    {item.stage}
                    {item.isBottleneck && (
                      <span className="pm-badge pm-badge--medium">Slowest</span>
                    )}
                    {item.activeWaitingCount > 0 && (
                      <span className="pm-badge pm-badge--neutral">
                        {item.activeWaitingCount} active
                      </span>
                    )}
                  </span>
                  <span className="eflow-tabular text-muted-foreground">
                    <strong className="font-semibold text-foreground">
                      {formatDurationHours(item.medianWaitHours)}
                    </strong>{" "}
                    typical · max {formatDurationHours(item.maxWaitHours)}
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-neutral-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      item.isBottleneck ? "bg-amber-500" : "bg-[#0c6f6b]"
                    }`}
                    style={{ width: `${widthPct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {untimed.length > 0 && (
        <div className="pt-2 border-t border-border/60 space-y-1.5">
          {untimed.map((item) => (
            <div
              key={item.stage}
              className="flex items-center justify-between text-[12px] text-muted-foreground"
            >
              <span>{item.stage}</span>
              <span>{item.eventCount} actions · No wait delay recorded</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RecommendationsList({
  items,
  taskTitleLookup,
  onSelectProject,
  onOpenTaskId,
}: {
  items: ProcessRecommendation[];
  taskTitleLookup: Map<string, string>;
  onSelectProject: (projectId: string) => void;
  onOpenTaskId?: (taskId: string) => void;
}) {
  if (!items.length) {
    return (
      <p className="ea-empty">
        No follow-up actions needed for the current selection.
      </p>
    );
  }

  return (
    <div className="pm-rec-list">
      {items.map((rec) => {
        const cardTone =
          rec.priority === "high"
            ? "pm-rec-card--high"
            : rec.priority === "medium"
              ? "pm-rec-card--medium"
              : "pm-rec-card--low";
        const resolvedTasks =
          rec.affectedTasks && rec.affectedTasks.length > 0
            ? rec.affectedTasks
            : rec.affectedTaskIds.map((id, idx) => ({
                id,
                title: taskTitleLookup.get(id) || `Task #${idx + 1}`,
              }));

        return (
          <article key={rec.id} className={`pm-rec-card ${cardTone} space-y-2.5`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="space-y-1">
                <span className={priorityBadgeClass(rec.priority)}>
                  {formatPriorityLabel(rec.priority)}
                </span>
                <h3 className="text-[13.5px] font-semibold text-foreground">
                  {rec.title}
                </h3>
              </div>
              <span className="pm-badge pm-badge--neutral">
                {cleanMetricLabel(rec.metricLabel)}: {rec.metricValue}
              </span>
            </div>

            <p className="text-[12.5px] text-muted-foreground leading-relaxed">
              {rec.finding}
            </p>

            <div className="pm-next-step">
              <CheckCircle2
                size={15}
                className="shrink-0 mt-0.5 text-[#0c6f6b]"
                aria-hidden="true"
              />
              <span>
                <strong className="font-medium">Next step:</strong> {rec.recommendation}
              </span>
            </div>

            {(rec.affectedProjects.length > 0 || resolvedTasks.length > 0) && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 pt-0.5 text-[12px]">
                {rec.affectedProjects.map((proj) => (
                  <button
                    key={proj.id}
                    type="button"
                    className="ea-link"
                    onClick={() => onSelectProject(proj.id)}
                  >
                    Filter: {proj.title}
                  </button>
                ))}
                {onOpenTaskId &&
                  resolvedTasks.slice(0, 2).map((task) => (
                    <button
                      key={task.id}
                      type="button"
                      className="ea-link"
                      onClick={() => onOpenTaskId(task.id)}
                    >
                      Open: {task.title}
                    </button>
                  ))}
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}

function ProjectProcessTable({
  items,
  selectedProjectId,
  onSelectProject,
  onOpenProject,
}: {
  items: ProjectProcessSummary[];
  selectedProjectId: string;
  onSelectProject: (projectId: string) => void;
  onOpenProject?: (projectId: string) => void;
}) {
  if (!items.length) {
    return <p className="ea-empty">No projects in scope.</p>;
  }
  return (
    <div className="pm-table-wrap">
      <table className="pm-table">
        <thead>
          <tr>
            <th>Project</th>
            <th>Tasks &amp; activity</th>
            <th>Sent back / Alerts</th>
            <th>Compliance score</th>
            <th>Budget used</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {items.map((proj) => (
            <tr key={proj.projectId}>
              <td>
                <button
                  type="button"
                  className="ea-link font-medium text-left"
                  onClick={() =>
                    onSelectProject(
                      selectedProjectId === proj.projectId ? "" : proj.projectId,
                    )
                  }
                >
                  {proj.title}
                </button>
                <div className="text-[11.5px] text-muted-foreground mt-0.5">
                  {proj.variantId
                    ? `Path ${proj.variantId.replace(/^V/i, "")} · `
                    : ""}
                  {proj.topBottleneckStage
                    ? `Slowest: ${proj.topBottleneckStage}`
                    : proj.status}
                </div>
              </td>
              <td className="eflow-tabular">
                <div className="font-medium text-foreground">
                  {proj.completedTasks}/{proj.taskCount} tasks done
                </div>
                <div className="text-[11.5px] text-muted-foreground">
                  {proj.eventCount} recorded actions
                </div>
              </td>
              <td>
                <div className="flex flex-wrap items-center gap-1.5">
                  {proj.reworkLoops > 0 && (
                    <span className="pm-badge pm-badge--high">
                      {proj.reworkLoops} sent back
                    </span>
                  )}
                  {proj.deviationCount > 0 && (
                    <span className="pm-badge pm-badge--medium">
                      {proj.deviationCount} alert
                      {proj.deviationCount === 1 ? "" : "s"}
                    </span>
                  )}
                  {proj.reworkLoops === 0 && proj.deviationCount === 0 && (
                    <span className="pm-badge pm-badge--low">Clean</span>
                  )}
                </div>
              </td>
              <td className="eflow-tabular">
                <span className={complianceBadgeClass(proj.conformanceRate)}>
                  {numberFmt.format(proj.conformanceRate)}%
                </span>
              </td>
              <td className="eflow-tabular">
                <div className="font-medium text-foreground">
                  {pesoFmt.format(proj.cashSpent)}
                </div>
                <div className="text-[11.5px] text-muted-foreground">
                  of {pesoFmt.format(proj.budgetAllocated)} allocated
                </div>
              </td>
              <td className="text-right">
                {onOpenProject && (
                  <button
                    type="button"
                    className="ea-link text-[12px] whitespace-nowrap"
                    onClick={() => onOpenProject(proj.projectId)}
                  >
                    Open
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReturnedWorkList({
  items,
  onSelectProject,
  onOpenTaskId,
}: {
  items: ReworkDeviationItem[];
  onSelectProject: (projectId: string) => void;
  onOpenTaskId?: (taskId: string) => void;
}) {
  if (!items.length) {
    return (
      <p className="ea-empty">
        No returned items or unusual changes detected in this scope.
      </p>
    );
  }
  return (
    <div className="pm-table-wrap">
      <table className="pm-table">
        <thead>
          <tr>
            <th>Type</th>
            <th>Details</th>
            <th>Project / Task</th>
          </tr>
        </thead>
        <tbody>
          {items.slice(0, 25).map((item) => (
            <tr key={item.id}>
              <td>
                <span className={priorityBadgeClass(item.severity)}>
                  {item.category === "rework" ? "Sent back" : "Alert"}
                </span>
              </td>
              <td>
                <div className="font-medium text-foreground">{item.title}</div>
                <div className="text-[12px] text-muted-foreground mt-0.5">
                  {item.description}
                </div>
              </td>
              <td>
                <div className="flex flex-col items-start gap-1">
                  <button
                    type="button"
                    className="ea-link text-left"
                    onClick={() => onSelectProject(item.projectId)}
                  >
                    {item.projectTitle}
                  </button>
                  {item.taskId && onOpenTaskId && (
                    <button
                      type="button"
                      className="ea-link text-[12px] text-left"
                      onClick={() => onOpenTaskId(item.taskId!)}
                    >
                      Open task: {item.taskTitle || "Work item"}
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function WorkflowPathsTable({
  variants,
  onSelectProject,
}: {
  variants: WorkflowVariant[];
  onSelectProject: (projectId: string) => void;
}) {
  if (!variants.length) {
    return <p className="ea-empty">No workflow paths discovered yet.</p>;
  }
  return (
    <div className="pm-table-wrap">
      <table className="pm-table">
        <thead>
          <tr>
            <th>Path</th>
            <th>Stage sequence</th>
            <th>Avg duration</th>
            <th>Projects</th>
          </tr>
        </thead>
        <tbody>
          {variants.map((variant) => (
            <tr key={variant.variantId}>
              <td className="font-semibold text-foreground whitespace-nowrap">
                <span className="inline-flex items-center gap-1.5">
                  <GitBranch size={13} className="text-[#0c6f6b]" aria-hidden="true" />
                  Path {variant.variantId.replace(/^V/i, "")}
                </span>
                <div className="text-[11.5px] font-normal text-muted-foreground mt-0.5">
                  {variant.projectCount} project{variant.projectCount === 1 ? "" : "s"} ({variant.sharePercent}%)
                </div>
              </td>
              <td>
                <div className="pm-path-chain">
                  {variant.stages.map((rawStage, idx) => {
                    const label = cleanStageTokenLabel(rawStage);
                    const hasReturn = label.includes("Sent back");
                    return (
                      <span key={`${variant.variantId}:${idx}:${label}`} className="inline-flex items-center gap-1.5">
                        {idx > 0 && (
                          <ArrowRight size={12} className="text-muted-foreground" aria-hidden="true" />
                        )}
                        <span
                          className={`pm-variant-chip ${
                            hasReturn ? "pm-variant-chip--returned" : ""
                          }`}
                        >
                          {label}
                        </span>
                      </span>
                    );
                  })}
                </div>
              </td>
              <td className="eflow-tabular whitespace-nowrap">
                {numberFmt.format(variant.medianCycleDays)} days
              </td>
              <td>
                <div className="flex flex-wrap gap-2">
                  {variant.projects.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="ea-link text-[12px]"
                      onClick={() => onSelectProject(p.id)}
                    >
                      {p.title}
                    </button>
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SlowHandoffsTable({ edges }: { edges: ActivityEdge[] }) {
  if (!edges.length) {
    return <p className="ea-empty">No handoff timings recorded yet.</p>;
  }
  return (
    <div className="pm-table-wrap">
      <table className="pm-table">
        <thead>
          <tr>
            <th>Step handoff</th>
            <th>Stages</th>
            <th>Times seen</th>
            <th>Typical wait</th>
            <th>Longest wait</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {edges.slice(0, 12).map((edge) => (
            <tr key={`${edge.fromActivity}->${edge.toActivity}`}>
              <td className="font-medium text-foreground">
                {edge.fromActivity}{" "}
                <ArrowRight size={12} className="inline mx-1 text-muted-foreground" />
                {edge.toActivity}
              </td>
              <td className="text-muted-foreground">
                {edge.stageFrom === edge.stageTo
                  ? edge.stageFrom
                  : `${edge.stageFrom} → ${edge.stageTo}`}
              </td>
              <td className="eflow-tabular">{edge.count}×</td>
              <td className="eflow-tabular font-medium">
                {formatDurationHours(edge.medianHours)}
              </td>
              <td className="eflow-tabular text-muted-foreground">
                {formatDurationHours(edge.maxHours)}
              </td>
              <td>
                {edge.isRework ? (
                  <span className="pm-badge pm-badge--high">Sent back</span>
                ) : edge.isBottleneck ? (
                  <span className="pm-badge pm-badge--medium">Slow</span>
                ) : (
                  <span className="pm-badge pm-badge--low">Normal</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EventTraceTable({
  events,
  onOpenTaskId,
}: {
  events: ProcessEventItem[];
  onOpenTaskId?: (taskId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return events;
    return events.filter((ev) =>
      [
        ev.activity,
        ev.stage,
        ev.actorName,
        ev.projectTitle,
        ev.taskTitle || "",
        ev.detail,
      ]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [events, query]);

  if (!events.length) {
    return <p className="ea-empty">No workflow actions recorded.</p>;
  }
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="relative flex-1 min-w-[220px] max-w-sm">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter by project, task, person, or action…"
            maxLength={120}
            aria-label="Filter activity timeline"
            className="h-9 w-full rounded-lg border border-border bg-card pl-8 pr-3 text-[12.5px] text-foreground"
          />
        </label>
        <span className="text-[12px] text-muted-foreground">
          Showing {filtered.length} of {events.length} actions
        </span>
      </div>

      <div className="pm-table-wrap">
        <table className="pm-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Stage</th>
              <th>Action</th>
              <th>Person</th>
              <th>Project / Task</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((ev) => (
              <tr key={ev.id}>
                <td className="whitespace-nowrap text-muted-foreground eflow-tabular">
                  {dateTimeFmt.format(new Date(ev.timestamp))}
                </td>
                <td className="whitespace-nowrap">{ev.stage}</td>
                <td className="font-medium text-foreground">
                  {ev.activity}{" "}
                  {ev.isRework && (
                    <span className="pm-badge pm-badge--high ml-1">Sent back</span>
                  )}
                  {ev.isDeviation && (
                    <span className="pm-badge pm-badge--medium ml-1">Alert</span>
                  )}
                </td>
                <td>{ev.actorName}</td>
                <td>
                  <div>{ev.projectTitle}</div>
                  {ev.taskId && onOpenTaskId && (
                    <button
                      type="button"
                      className="ea-link text-[11.5px]"
                      onClick={() => onOpenTaskId(ev.taskId!)}
                    >
                      {ev.taskTitle || "Open task"}
                    </button>
                  )}
                </td>
                <td className="text-muted-foreground max-w-[320px] break-words">
                  {ev.detail}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StageActionsModal({
  stageName,
  events,
  stageNode,
  onClose,
  onSelectProject,
  onOpenTaskId,
}: {
  stageName: string | null;
  events: ProcessEventItem[];
  stageNode: {
    eventCount: number;
    medianWaitHours: number;
    reworkCount: number;
    activeWaitingCount: number;
  } | null;
  onClose: () => void;
  onSelectProject: (projectId: string) => void;
  onOpenTaskId?: (taskId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [filterKind, setFilterKind] = useState<"all" | "returned" | "alerts">("all");

  const stageEvents = useMemo(
    () => (stageName ? events.filter((ev) => ev.stage === stageName) : []),
    [events, stageName],
  );

  const returnedCount = useMemo(
    () => stageEvents.filter((ev) => ev.isRework).length,
    [stageEvents],
  );
  const alertCount = useMemo(
    () => stageEvents.filter((ev) => ev.isDeviation).length,
    [stageEvents],
  );

  const visibleEvents = useMemo(() => {
    const q = query.trim().toLowerCase();
    return stageEvents.filter((ev) => {
      if (filterKind === "returned" && !ev.isRework) return false;
      if (filterKind === "alerts" && !ev.isDeviation) return false;
      if (!q) return true;
      return [
        ev.activity,
        ev.actorName,
        ev.projectTitle,
        ev.taskTitle || "",
        ev.detail,
      ]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [filterKind, query, stageEvents]);

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setQuery("");
      setFilterKind("all");
      onClose();
    }
  };

  const totalRecorded = stageNode?.eventCount ?? stageEvents.length;

  return (
    <Dialog open={Boolean(stageName)} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[680px] p-0 gap-0 overflow-hidden">
        <div className="border-b border-border/70 px-6 py-4 pr-12">
          <DialogHeader className="gap-1 text-left">
            <DialogTitle className="text-[16px] font-semibold text-foreground">
              {stageName || "Stage actions"}
            </DialogTitle>
            <DialogDescription className="text-[12.5px] text-muted-foreground">
              {totalRecorded} recorded action{totalRecorded === 1 ? "" : "s"}
              {stageNode
                ? ` · ${formatDurationHours(stageNode.medianWaitHours)} typical wait`
                : ""}
              {stageNode && stageNode.reworkCount > 0
                ? ` · ${stageNode.reworkCount} sent back`
                : ""}
              {stageNode && stageNode.activeWaitingCount > 0
                ? ` · ${stageNode.activeWaitingCount} active`
                : ""}
            </DialogDescription>
          </DialogHeader>
        </div>

        {stageEvents.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-border/60 bg-muted/30 px-6 py-3">
            <label className="relative flex-1 min-w-[200px]">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search person, project, task, or note…"
                maxLength={120}
                aria-label="Search stage actions"
                className="h-9 w-full rounded-lg border border-border bg-card pl-8 pr-3 text-[12.5px] text-foreground"
              />
            </label>

            {(returnedCount > 0 || alertCount > 0) && (
              <div className="flex items-center gap-1.5 text-[12px]">
                <button
                  type="button"
                  onClick={() => setFilterKind("all")}
                  className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                    filterKind === "all"
                      ? "bg-foreground text-background"
                      : "bg-card text-muted-foreground border border-border hover:text-foreground"
                  }`}
                >
                  All ({stageEvents.length})
                </button>
                {returnedCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setFilterKind("returned")}
                    className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                      filterKind === "returned"
                        ? "bg-rose-600 text-white"
                        : "bg-card text-rose-700 border border-rose-200 hover:bg-rose-50"
                    }`}
                  >
                    Sent back ({returnedCount})
                  </button>
                )}
                {alertCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setFilterKind("alerts")}
                    className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                      filterKind === "alerts"
                        ? "bg-amber-600 text-white"
                        : "bg-card text-amber-800 border border-amber-200 hover:bg-amber-50"
                    }`}
                  >
                    Alerts ({alertCount})
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        <div className="max-h-[56vh] overflow-y-auto px-6 py-2">
          {visibleEvents.length === 0 ? (
            <p className="py-10 text-center text-[13px] text-muted-foreground">
              {stageEvents.length === 0
                ? "No individual action details were included in this snapshot for this stage."
                : "No actions match your search."}
            </p>
          ) : (
            <ul className="divide-y divide-border/60" aria-label="Stage action details">
              {visibleEvents.map((ev) => (
                <li key={ev.id} className="py-3.5 space-y-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[13px] font-medium text-foreground">
                        {ev.activity}
                      </span>
                      {ev.isRework && (
                        <span className="pm-badge pm-badge--high">Sent back</span>
                      )}
                      {ev.isDeviation && (
                        <span className="pm-badge pm-badge--medium">Alert</span>
                      )}
                    </div>
                    <time className="text-[11.5px] text-muted-foreground eflow-tabular shrink-0">
                      {dateTimeFmt.format(new Date(ev.timestamp))}
                    </time>
                  </div>

                  {ev.detail && (
                    <p className="text-[12.5px] text-muted-foreground leading-relaxed break-words">
                      {ev.detail}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-0.5 text-[11.5px] text-muted-foreground">
                    <span>{ev.actorName}</span>
                    <span aria-hidden="true">·</span>
                    <button
                      type="button"
                      className="ea-link"
                      onClick={() => onSelectProject(ev.projectId)}
                    >
                      {ev.projectTitle}
                    </button>
                    {ev.taskId && onOpenTaskId && (
                      <>
                        <span aria-hidden="true">·</span>
                        <button
                          type="button"
                          className="ea-link"
                          onClick={() => onOpenTaskId(ev.taskId!)}
                        >
                          Open task: {ev.taskTitle || "Work item"}
                        </button>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {totalRecorded > stageEvents.length && (
          <div className="border-t border-border/60 bg-muted/20 px-6 py-2.5 text-[11.5px] text-muted-foreground">
            Showing the {stageEvents.length} most recent actions captured for this stage ({totalRecorded} total).
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
