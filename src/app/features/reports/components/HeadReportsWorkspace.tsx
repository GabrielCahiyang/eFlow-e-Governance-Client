import { useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  BarChart3,
  BriefcaseBusiness,
  ClipboardCheck,
  FileCheck2,
  FolderKanban,
  History,
  Rows3,
  Users,
} from "lucide-react";
import { TaskDetailDrawer } from "../../task-inspector";
import { useDepartmentTeamAnalytics } from "../../team-management";
import {
  Card,
  ExportMenu,
  SearchInput,
  SectionEmpty,
  WSelect,
} from "../../../components/workflow/primitives";
import { WorkspaceLoadingSkeleton } from "../../../components/workflow/WorkspaceLoadingSkeleton";
import { exportCsv, exportPdf } from "../../../services/reportService";
import { DEPARTMENT_REPORTS } from "../constants";
import {
  buildDepartmentReportRows,
  filterDepartmentReportRows,
} from "../selectors/departmentReportSelectors";
import type { DepartmentReportKind } from "../types";
import { DepartmentReportTable } from "./DepartmentReportTable";
import { ManagementBriefPanel } from "./ManagementBriefPanel";
import {
  buildMonthlyContributionLeaderboard,
  ContributionSummaryCard,
} from "../../productivity";

import { departmentReportColumns } from "../exportColumns";
import { WorkspaceHeader } from "../../../components/ui/workspace";
import "../../../components/ui/workspace/analyticalWorkspace.css";
import { useAuth } from "../../../contexts/AuthContext";
import { useOrgs } from "../../../hooks/useSupabaseData";
import { Button } from "../../../components/ui/button";
import { requestNavigation } from "../../../shared/navigationGuard";
const DAY = 86_400_000;

const reportIcons: Record<DepartmentReportKind, ReactNode> = {
  operations: <Rows3 size={15} />,
  projects: <FolderKanban size={15} />,
  contributions: <Users size={15} />,
  reviews: <ClipboardCheck size={15} />,
  evidence: <FileCheck2 size={15} />,
  risks: <AlertTriangle size={15} />,
  lifecycle: <History size={15} />,
};

const dateInputTime = (value: string, end = false): number | undefined => {
  if (!value) return undefined;
  const time = new Date(
    `${value}T${end ? "23:59:59.999" : "00:00:00"}`,
  ).getTime();
  return Number.isFinite(time) ? time : undefined;
};

export function HeadReportsWorkspace() {
  const { userProfile } = useAuth();
  const { orgs } = useOrgs();
  const office =
    orgs.find((org) => org.id === userProfile?.org_id)?.name ||
    userProfile?.org_id ||
    "Assigned Office";
  const analytics = useDepartmentTeamAnalytics();
  const [kind, setKind] = useState<DepartmentReportKind>("operations");
  const [search, setSearch] = useState("");
  const [personId, setPersonId] = useState("all");
  const [projectId, setProjectId] = useState("all");
  const [status, setStatus] = useState("all");
  const [period, setPeriod] = useState("0");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState<string>();

  const definition =
    DEPARTMENT_REPORTS.find((report) => report.id === kind) ||
    DEPARTMENT_REPORTS[0];
  const allRows = useMemo(
    () =>
      buildDepartmentReportRows(
        kind,
        analytics.tasks,
        analytics.projects,
        analytics.deptEmployees,
        analytics.facts,
        analytics.attention,
      ),
    [
      analytics.attention,
      analytics.deptEmployees,
      analytics.facts,
      analytics.projects,
      analytics.tasks,
      kind,
    ],
  );
  const dateBounds = useMemo(() => {
    if (period === "custom")
      return { from: dateInputTime(fromDate), to: dateInputTime(toDate, true) };
    const days = Number(period);
    return {
      from: days > 0 ? Date.now() - days * DAY : undefined,
      to: undefined,
    };
  }, [fromDate, period, toDate]);
  const rows = useMemo(
    () =>
      filterDepartmentReportRows(allRows, {
        search,
        personId,
        projectId,
        status,
        ...dateBounds,
      }),
    [allRows, dateBounds, personId, projectId, search, status],
  );
  const statuses = useMemo(
    () => Array.from(new Set(allRows.map((row) => row.status))).sort(),
    [allRows],
  );
  const selectedTask =
    analytics.tasks.find((task) => task.id === selectedTaskId) || null;
  const uniquePeople = new Set(rows.map((row) => row.personId).filter(Boolean))
    .size;
  const uniqueProjects = new Set(
    rows.map((row) => row.projectId).filter(Boolean),
  ).size;
  const urgent = rows.filter(
    (row) =>
      ["critical", "high", "overdue", "blocked"].includes(
        row.priority.toLowerCase(),
      ) || ["overdue", "updates needed"].includes(row.status.toLowerCase()),
  ).length;
  const contributionRows = useMemo(
    () =>
      buildMonthlyContributionLeaderboard(
        analytics.deptEmployees,
        analytics.tasks,
        analytics.facts,
      ),
    [analytics.deptEmployees, analytics.facts, analytics.tasks],
  );

  const changeKind = (next: DepartmentReportKind) => {
    void requestNavigation(() => {
      setKind(next);
      setStatus("all");
      setSelectedTaskId(undefined);
    });
  };

  const exportRows = (format: "csv" | "pdf") => {
    const columns = departmentReportColumns;
    const filters = {
      Scope: `${office} · authorized Office scope`,
      Completeness: analytics.error
        ? "Partial workflow facts"
        : "Loaded permitted records",
      Person:
        personId === "all"
          ? "All people"
          : analytics.deptEmployees.find((employee) => employee.id === personId)
              ?.name || personId,
      Project:
        projectId === "all"
          ? "All projects"
          : analytics.projects.find((project) => project.id === projectId)
              ?.title || projectId,
      Status: status === "all" ? "All statuses" : status,
      Period:
        period === "custom"
          ? `${fromDate || "Beginning"} to ${toDate || "Today"}`
          : period === "0"
            ? "All time"
            : `Last ${period} days`,
      Search: search || "None",
    };
    const meta = {
      title: definition.title,
      subtitle: "eFlow · Head reports",
      filters,
      totals: {
        "Visible rows": rows.length,
        People: uniquePeople,
        Projects: uniqueProjects,
        "Urgent signals": urgent,
      },
    };
    format === "csv"
      ? exportCsv(rows, columns, meta)
      : exportPdf(rows, columns, meta);
  };

  return (
    <div className="eflow-page-content eflow-analytics min-w-0">
      <WorkspaceHeader
        title="Reports"
        description="Office reports · Operational, contribution, review, evidence and risk lenses in your authorized scope."
        actions={
          <>
            <ManagementBriefPanel
              title={definition.title}
              rows={analytics.error ? [] : rows}
            />
            <ExportMenu
              onCsv={() => exportRows("csv")}
              onPdf={() => exportRows("pdf")}
              disabled={
                rows.length === 0 || !!analytics.error || analytics.refreshing
              }
            />
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
        <p className="text-sm">
          <strong>{office}</strong> · Authorized Office scope ·{" "}
          {projectId === "all"
            ? "All permitted projects"
            : analytics.projects.find((project) => project.id === projectId)
                ?.title || projectId}
        </p>
        <Button
          variant="outline"
          onClick={analytics.refresh}
          disabled={analytics.refreshing}
        >
          Refresh report facts
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            setSearch("");
            setPersonId("all");
            setProjectId("all");
            setStatus("all");
            setPeriod("0");
            setFromDate("");
            setToDate("");
          }}
        >
          Clear report filters
        </Button>
      </div>
      {analytics.refreshing && <p role="status">Refreshing report facts…</p>}
      {analytics.error && (
        <div role="alert" className="eflow-analytics-error">
          Some workflow facts could not be loaded: {analytics.error}. Totals and
          exports reflect only loaded records; missing facts are not zero
          activity. Use Refresh report facts to retry.
        </div>
      )}

      {analytics.loading ? (
        <WorkspaceLoadingSkeleton
          label="Loading live office reports…"
          rows={6}
        />
      ) : (
        <>
          <div className="mb-4">
            {analytics.error ? (
              <p>Office contribution facts unavailable.</p>
            ) : (
              <ContributionSummaryCard
                rows={contributionRows}
                title="Office contribution this month"
              />
            )}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[250px_minmax(0,1fr)] gap-4">
            <Card
              title="Report library"
              subtitle="Select a live operational lens"
              bodyClassName="p-2 h-fit"
            >
              <div className="space-y-1">
                {DEPARTMENT_REPORTS.map((report) => (
                  <button
                    type="button"
                    key={report.id}
                    onClick={() => changeKind(report.id)}
                    className={`w-full rounded-lg border p-3 text-left transition-colors ${kind === report.id ? "border-primary/25 bg-primary/10 text-primary shadow-sm" : "border-transparent text-foreground hover:bg-accent/70"}`}
                  >
                    <div className="flex items-center gap-2 text-[12px] font-medium">
                      {reportIcons[report.id]} {report.title}
                    </div>
                    <p
                      className={`mt-1 text-[12px] leading-5 ${kind === report.id ? "text-secondary-foreground" : "text-muted-foreground"}`}
                    >
                      {report.description}
                    </p>
                  </button>
                ))}
              </div>
            </Card>

            <div className="min-w-0">
              <div
                className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border border-border bg-card px-4 py-3 shadow-sm"
                aria-label="Report summary"
              >
                <ReportMetric
                  label="Visible rows"
                  value={analytics.error ? "Unavailable" : rows.length}
                  icon={<BarChart3 size={14} />}
                />
                <ReportMetric
                  label="People"
                  value={analytics.error ? "Unavailable" : uniquePeople}
                  icon={<Users size={14} />}
                />
                <ReportMetric
                  label="Projects"
                  value={analytics.error ? "Unavailable" : uniqueProjects}
                  icon={<BriefcaseBusiness size={14} />}
                />
                <ReportMetric
                  label="Urgent signals"
                  value={analytics.error ? "Unavailable" : urgent}
                  icon={<AlertTriangle size={14} />}
                  tone={urgent ? "bad" : "good"}
                />
              </div>

              <Card
                title={definition.title}
                subtitle={definition.description}
                bodyClassName="p-0"
              >
                <div className="eflow-analytics-filters sticky top-3 z-10 space-y-2 border-b border-border bg-card/95 p-3">
                  <div className="flex flex-wrap gap-2">
                    <SearchInput
                      value={search}
                      onChange={setSearch}
                      placeholder="Search visible report fields…"
                      className="min-w-[230px] flex-1"
                    />
                    <WSelect
                      ariaLabel="Report person"
                      value={personId}
                      onChange={setPersonId}
                      options={[
                        { value: "all", label: "All people" },
                        ...analytics.deptEmployees.map((employee) => ({
                          value: employee.id,
                          label: employee.name,
                        })),
                      ]}
                    />
                    <WSelect
                      ariaLabel="Report project"
                      value={projectId}
                      onChange={setProjectId}
                      options={[
                        { value: "all", label: "All projects" },
                        ...analytics.projects.map((project) => ({
                          value: project.id,
                          label: project.title,
                        })),
                      ]}
                    />
                    <WSelect
                      ariaLabel="Report status"
                      value={status}
                      onChange={setStatus}
                      options={[
                        { value: "all", label: "All statuses" },
                        ...statuses.map((value) => ({
                          value,
                          label: value.replace(/_/g, " "),
                        })),
                      ]}
                    />
                    <WSelect
                      ariaLabel="Report period"
                      value={period}
                      onChange={setPeriod}
                      options={[
                        { value: "7", label: "Last 7 days" },
                        { value: "30", label: "Last 30 days" },
                        { value: "90", label: "Last 90 days" },
                        { value: "0", label: "All time" },
                        { value: "custom", label: "Custom dates" },
                      ]}
                    />
                  </div>
                  {period === "custom" && (
                    <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
                      <label className="flex items-center gap-1.5">
                        From{" "}
                        <input
                          type="date"
                          value={fromDate}
                          onChange={(event) => setFromDate(event.target.value)}
                          className="h-[32px] rounded-lg border border-border bg-card px-2 text-[12px] text-foreground"
                        />
                      </label>
                      <label className="flex items-center gap-1.5">
                        To{" "}
                        <input
                          type="date"
                          value={toDate}
                          onChange={(event) => setToDate(event.target.value)}
                          className="h-[32px] rounded-lg border border-border bg-card px-2 text-[12px] text-foreground"
                        />
                      </label>
                    </div>
                  )}
                </div>
                {rows.length ? (
                  <DepartmentReportTable
                    rows={rows}
                    onOpenTask={setSelectedTaskId}
                  />
                ) : (
                  <SectionEmpty
                    icon={<BarChart3 size={28} />}
                    title={
                      analytics.error
                        ? "Report facts unavailable"
                        : "No report rows match"
                    }
                    description="Change the people, project, status, date, or search filters."
                  />
                )}
              </Card>
            </div>
          </div>
        </>
      )}

      <TaskDetailDrawer
        task={selectedTask}
        onClose={() => setSelectedTaskId(undefined)}
        canReview
        canPostProgress={false}
      />
    </div>
  );
}

function ReportMetric({
  icon,
  label,
  tone = "neutral",
  value,
}: {
  icon: ReactNode;
  label: string;
  tone?: "neutral" | "good" | "bad";
  value: number | string;
}) {
  const valueClass =
    tone === "bad"
      ? "text-destructive"
      : tone === "good"
        ? "text-emerald-700"
        : "text-foreground";
  return (
    <div className="inline-flex min-w-[100px] items-center gap-2">
      <span className="text-muted-foreground">{icon}</span>
      <span className="min-w-0">
        <span className="block text-[12px] font-medium text-muted-foreground">
          {label}
        </span>
        <span
          className={`eflow-tabular block text-[16px] font-semibold leading-tight ${valueClass}`}
        >
          {value}
        </span>
      </span>
    </div>
  );
}
