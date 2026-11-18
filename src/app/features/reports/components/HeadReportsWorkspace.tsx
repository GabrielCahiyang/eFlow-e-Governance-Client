import { getPhilippineCalendarDate } from '../../../shared/calendarDates';
import { DateInput } from '../../../components/ui/DateInput';
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

export function HeadReportsWorkspace({ embedded = false }: { embedded?: boolean } = {}) {
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

  const headerActions = (
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
  );

  return (
    <div className="eflow-page-content eflow-analytics min-w-0">
      {embedded ? (
        <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
          {headerActions}
        </div>
      ) : (
        <WorkspaceHeader
          title="Reports"
          description="See work, contributions, reviews, evidence, and risks for your Offices."
          actions={headerActions}
        />
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--eflow-border)] bg-[var(--eflow-surface)] px-4 py-3">
        <p className="text-[13px] text-[var(--eflow-text)]">
          <strong>{office}</strong>
          <span className="text-[var(--eflow-text-muted)]"> · Offices included · </span>
          <span>
            {projectId === "all"
              ? "All permitted projects"
              : analytics.projects.find((project) => project.id === projectId)
                  ?.title || projectId}
          </span>
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={analytics.refresh}
            disabled={analytics.refreshing}
          >
            Refresh reports
          </Button>
          <Button
            variant="ghost"
            size="sm"
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
            Clear filters
          </Button>
        </div>
      </div>
      {analytics.refreshing && <p role="status">Refreshing reports…</p>}
      {analytics.error && (
        <div role="alert" className="eflow-analytics-error">
          Some report data couldn’t load. Totals and exports cover the records eFlow could load. Select Refresh reports to check again.
        </div>
      )}

      {analytics.loading ? (
        <HeadReportsWorkspaceSkeleton
          definition={definition}
          kind={kind}
          onSelectKind={changeKind}
        />
      ) : (
        <>
          <div className="mb-4">
            {analytics.error ? (
              <p>We couldn’t load Office contributions.</p>
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
              subtitle="Choose a report"
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
                        ...statuses.map((value) => {
                          const readable = value.replace(/_/g, " ");
                          return {
                            value,
                            label: readable.charAt(0).toUpperCase() + readable.slice(1),
                          };
                        }),
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
                    <div className="flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
                      <label className="flex items-center gap-1.5 [&_.eflow-date-input-wrap]:w-[132px]">
                        <span>From</span>
                        <DateInput
                          max={toDate || getPhilippineCalendarDate()}
                          value={fromDate}
                          onChange={(event) => { const day = event.target.value; if (day > getPhilippineCalendarDate()) return; setFromDate(day); if (toDate && day > toDate) setToDate(day); }}
                          className="h-[34px] rounded-lg border border-border bg-card pl-2.5 text-[12px] text-foreground"
                        />
                      </label>
                      <label className="flex items-center gap-1.5 [&_.eflow-date-input-wrap]:w-[132px]">
                        <span>To</span>
                        <DateInput
                          min={fromDate || undefined} max={getPhilippineCalendarDate()}
                          value={toDate}
                          onChange={(event) => { const day = event.target.value; if (day > getPhilippineCalendarDate()) return; setToDate(day); if (day && fromDate > day) setFromDate(day); }}
                          className="h-[34px] rounded-lg border border-border bg-card pl-2.5 text-[12px] text-foreground"
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
                  <SectionEmpty illustration={analytics.error ? false : "search"}
                    icon={<BarChart3 size={28} />}
                    title={
                      analytics.error
                        ? "Report data unavailable"
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

function HeadReportsWorkspaceSkeleton({
  definition,
  kind,
  onSelectKind,
}: {
  definition: (typeof DEPARTMENT_REPORTS)[number];
  kind: DepartmentReportKind;
  onSelectKind: (next: DepartmentReportKind) => void;
}) {
  return (
    <WorkspaceLoadingSkeleton label="Loading live office reports…">
      <div className="mb-4 rounded-xl border border-border bg-card p-4 shadow-sm" aria-hidden="true">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-1.5">
            <div className="h-4 w-48 rounded bg-neutral-200/80" />
            <div className="h-3 w-72 rounded bg-neutral-100" />
          </div>
          <div className="flex gap-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-10 w-28 rounded-lg bg-neutral-100" />
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[250px_minmax(0,1fr)] gap-4">
        <Card
          title="Report library"
          subtitle="Choose a report"
          bodyClassName="p-2 h-fit"
        >
          <div className="space-y-1">
            {DEPARTMENT_REPORTS.map((report) => (
              <button
                type="button"
                key={report.id}
                onClick={() => onSelectKind(report.id)}
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

        <div className="min-w-0" aria-hidden="true">
          <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border border-border bg-card px-4 py-3 shadow-sm">
            {[
              { label: "Visible rows", icon: <BarChart3 size={14} /> },
              { label: "People", icon: <Users size={14} /> },
              { label: "Projects", icon: <BriefcaseBusiness size={14} /> },
              { label: "Urgent signals", icon: <AlertTriangle size={14} /> },
            ].map((metric) => (
              <div key={metric.label} className="inline-flex min-w-[100px] items-center gap-2">
                <span className="text-muted-foreground">{metric.icon}</span>
                <span className="min-w-0 space-y-1">
                  <span className="block text-[12px] font-medium text-muted-foreground">
                    {metric.label}
                  </span>
                  <span className="block h-5 w-10 rounded bg-neutral-200/80" />
                </span>
              </div>
            ))}
          </div>

          <Card title={definition.title} subtitle={definition.description} bodyClassName="p-0">
            <div className="eflow-analytics-filters border-b border-border bg-card/95 p-3">
              <div className="flex flex-wrap gap-2">
                <div className="h-9 min-w-[230px] flex-1 rounded-lg bg-neutral-100" />
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="h-9 w-36 rounded-lg bg-neutral-100" />
                ))}
              </div>
            </div>
            <div className="eflow-analytics-table max-w-full overflow-x-auto">
              <table className="w-full min-w-[980px] table-fixed">
                <thead>
                  <tr className="bg-muted border-b border-border">
                    {[
                      "Work item",
                      "Person / role",
                      "Project",
                      "Status",
                      "Signal",
                      "Event / due",
                      "Detail",
                    ].map((header) => (
                      <th
                        key={header}
                        className="px-4 py-3 text-left text-[12px] font-semibold text-muted-foreground"
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[0, 1, 2, 3, 4, 5].map((row) => (
                    <tr key={row} className="border-b border-border align-top">
                      <td className="px-4 py-3 space-y-1.5">
                        <div className="h-3.5 w-44 rounded bg-neutral-200/80" />
                        <div className="h-2.5 w-32 rounded bg-neutral-100" />
                      </td>
                      <td className="px-4 py-3 space-y-1.5">
                        <div className="h-3.5 w-28 rounded bg-neutral-200/80" />
                        <div className="h-2.5 w-20 rounded bg-neutral-100" />
                      </td>
                      <td className="px-4 py-3">
                        <div className="h-3 w-32 rounded bg-neutral-100" />
                      </td>
                      <td className="px-4 py-3 space-y-1.5">
                        <div className="h-6 w-20 rounded-[6px] bg-neutral-200/70" />
                        <div className="h-1.5 w-24 rounded-[6px] bg-neutral-100" />
                      </td>
                      <td className="px-4 py-3 space-y-1.5">
                        <div className="h-6 w-16 rounded-[6px] bg-neutral-200/70" />
                        <div className="h-2.5 w-20 rounded bg-neutral-100" />
                      </td>
                      <td className="px-4 py-3 space-y-1.5">
                        <div className="h-3 w-20 rounded bg-neutral-100" />
                        <div className="h-2.5 w-24 rounded bg-neutral-100" />
                      </td>
                      <td className="px-4 py-3 space-y-1.5">
                        <div className="h-3 w-48 rounded bg-neutral-100" />
                        <div className="h-3 w-36 rounded bg-neutral-100" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </WorkspaceLoadingSkeleton>
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
