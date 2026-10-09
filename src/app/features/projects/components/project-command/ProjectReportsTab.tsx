import { useMemo, useState } from "react";
import { useOrgs } from "../../../../hooks/useSupabaseData";
import { Button } from "../../../../components/ui/button";
import {
  WorkspaceHeader,
  WorkspaceSkeleton,
  EmptyWorkspaceState,
} from "../../../../components/ui/workspace";
import { exportCsv, exportPdf } from "../../../../services/reportService";
import { peso } from "../../../budget";
import { buildProjectExecutionFinancialRows } from "../../selectors/projectFinancialReportSelectors";
import { COLUMNS } from "../../selectors/projectReportColumns";
import { financialOfficeUnavailable } from "../../selectors/projectReportAvailability";
import {
  EMPTY_REPORT_FILTERS,
  selectProjectReportScope,
} from "../../selectors/projectReportScope";
import { ExecutionRow, ReceiptRegister } from "./ProjectReportRegisters";
import type { ProjectCommandData } from "./types";
import "../../../../components/ui/workspace/analyticalWorkspace.css";
export function ProjectReportsTab({
  data: source,
  canExport,
  onOpenTask,
}: {
  data: ProjectCommandData;
  canExport: boolean;
  onOpenTask?: (id: string) => void;
}) {
  const { orgs } = useOrgs();
  const [filters, setFilters] = useState(EMPTY_REPORT_FILTERS);
  const data = useMemo(
    () => selectProjectReportScope(source, filters),
    [source, filters],
  );
  const rows = useMemo(
    () =>
      buildProjectExecutionFinancialRows(
        data.tasks,
        data.facts.subtasks,
        data.financial,
        data.facts,
      ),
    [data],
  );
  const roots = rows.filter((row) => row.level === "task");
  const budget = roots.reduce((sum, row) => sum + row.budgetAmount, 0),
    reserved = roots.reduce((sum, row) => sum + row.reservedAmount, 0),
    spent = roots.reduce((sum, row) => sum + row.spentAmount, 0),
    returned = roots.reduce((sum, row) => sum + row.returnedAmount, 0),
    available = roots.reduce((sum, row) => sum + row.availableAmount, 0);
  const progress = roots.length
    ? Math.round(
        roots.reduce((sum, row) => sum + row.progress, 0) / roots.length,
      )
    : source.project.status === "completed"
      ? 100
      : 0;
  const missingOffice = data.tasks.some((task) =>
    financialOfficeUnavailable(data, task.id),
  );
  const unavailable =
    !!source.error ||
    !!data.financialError ||
    data.financialLoading ||
    missingOffice;
  const money = (value: number) =>
    unavailable ? "Unavailable" : peso.format(value);
  const receiptCount = data.financial.liquidations.reduce(
    (sum, item) => sum + item.receipts.length,
    0,
  );
  const meta = {
    title: `${data.project.title} Execution and Financial Register`,
    subtitle:
      "Task families, nested hierarchy, accountability, cash reservations, expenses, returns and evidence",
    filters: {
      Project: data.project.title,
      Scope: "Matching task families with all descendants",
      Office:
        filters.office === "all"
          ? "All permitted Offices"
          : orgs.find((org) => org.id === filters.office)?.name ||
            "Office unavailable",
      Status: filters.status,
      Search: filters.search || "None",
      From: filters.from || "Beginning",
      To: filters.to || "Present",
    },
    totals: {
      Progress: `${progress}%`,
      Budget: money(budget),
      Reserved: money(reserved),
      "Actual spent": money(spent),
      Returned: money(returned),
      Available: money(available),
      Receipts: unavailable ? "Unavailable" : receiptCount,
    },
  };
  const change = (patch: Partial<typeof filters>) =>
    setFilters((current) => ({ ...current, ...patch }));
  return (
    <div
      className="eflow-analytics"
      role="region"
      aria-label="Project execution and financial register"
    >
      <WorkspaceHeader
        title="Project execution and financial register"
        description="Trace delivery, funding, cash release, receipts, returned balance and settlement."
        actions={
          canExport && (
            <>
              <Button
                disabled={unavailable || source.loading || !!source.error}
                onClick={() => exportCsv(rows, COLUMNS, meta)}
              >
                Export CSV
              </Button>
              <Button
                variant="outline"
                disabled={unavailable || source.loading || !!source.error}
                onClick={() => exportPdf(rows, COLUMNS, meta)}
              >
                Export PDF
              </Button>
            </>
          )
        }
      />
      <div className="eflow-analytics-filters">
        <label>
          Search register
          <input
            value={filters.search}
            onChange={(e) => change({ search: e.target.value })}
          />
        </label>
        <label>
          Report Office
          <select
            value={filters.office}
            onChange={(e) => change({ office: e.target.value })}
          >
            <option value="all">All permitted Offices</option>
            {Array.from(
              new Set(source.tasks.map((t) => t.orgId).filter(Boolean)),
            ).map((id) => (
              <option key={id} value={id}>
                {orgs.find((org) => org.id === id)?.name ||
                  "Office unavailable"}
              </option>
            ))}
          </select>
        </label>
        <label>
          Report status
          <select
            value={filters.status}
            onChange={(e) => change({ status: e.target.value })}
          >
            <option value="all">All statuses</option>
            {Array.from(
              new Set(
                [...source.tasks, ...source.facts.subtasks].map(
                  (t) => t.status,
                ),
              ),
            )
              .sort()
              .map((status) => (
                <option key={status} value={status}>
                  {status.replace(/_/g, " ")}
                </option>
              ))}
          </select>
        </label>
        <label>
          Deadline from
          <input
            type="date"
            value={filters.from}
            onChange={(e) => change({ from: e.target.value })}
          />
        </label>
        <label>
          Deadline to
          <input
            type="date"
            value={filters.to}
            onChange={(e) => change({ to: e.target.value })}
          />
        </label>
        <Button
          variant="ghost"
          onClick={() => setFilters(EMPTY_REPORT_FILTERS)}
        >
          Clear register filters
        </Button>
      </div>
      <p className="eflow-analytics-caption">
        Filters select matching task families with all descendants. Totals count
        each parent funding pool once; subtask caps and shared pools remain
        separate in the register.
      </p>
      {(source.error || source.financialError || missingOffice) && (
        <p role="alert" className="eflow-analytics-error">
          Report facts unavailable:{" "}
          {source.error ||
            source.financialError ||
            (missingOffice
              ? "Financial facts for an included Office are outside the loaded budget scope. Select a funded Office to export its verified register."
              : "")}
          . Missing facts are unavailable. Retry using the project refresh
          controls.
        </p>
      )}
      {source.loading || source.financialLoading ? (
        <WorkspaceSkeleton label="Loading project report facts" />
      ) : (
        <>
          <div className="eflow-health-strip">
            {[
              [
                "Weighted progress",
                source.error ? "Unavailable" : `${progress}%`,
              ],
              ["Task budget", money(budget)],
              ["Reserved cash", money(reserved)],
              ["Actual spent", money(spent)],
              ["Returned balance", money(returned)],
              ["Remaining balance", money(available)],
              [
                "Evidence health",
                `${unavailable ? "Unavailable" : receiptCount} receipts · ${source.error ? "Unavailable" : data.facts.evidence.length} files · ${source.error ? "Unavailable" : rows.filter((r) => r.schedule === "overdue").length} overdue`,
              ],
            ].map(([label, value]) => (
              <div className="eflow-health-item" key={label}>
                <span className="eflow-health-item-label">{label}</span>
                <span className="eflow-health-item-value">{value}</span>
              </div>
            ))}
          </div>
          <section className="eflow-section-card">
            <header>
              <h3>Task and subtask execution register</h3>
              <p>
                Subtasks without a set cap draw from the shared parent-task
                pool.
              </p>
            </header>
            <div
              className="eflow-analytics-table"
              role="region"
              aria-label="Execution register rows"
              tabIndex={0}
            >
              <table className="min-w-[1100px]">
                <thead>
                  <tr>
                    {[
                      "Work hierarchy",
                      "Accountability",
                      "Status / progress",
                      "Schedule",
                      "Budget mode",
                      "Reserved / spent / returned",
                      "Evidence",
                    ].map((label) => (
                      <th key={label}>{label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <ExecutionRow
                      key={`${row.level}-${row.id}`}
                      row={row}
                      data={data}
                      onOpenTask={onOpenTask}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            {!rows.length && (
              <EmptyWorkspaceState
                title={
                  source.error
                    ? "Report facts unavailable"
                    : "No work matches these filters"
                }
                description="Change the Office, status, dates or search."
              />
            )}
          </section>
          <ReceiptRegister data={data} />
        </>
      )}
    </div>
  );
}
