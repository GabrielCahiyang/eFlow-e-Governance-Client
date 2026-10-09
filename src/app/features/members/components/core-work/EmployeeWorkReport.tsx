import { useMemo, useState } from "react";
import { FileText } from "lucide-react";
import { useAuth } from "../../../../contexts/AuthContext";
import type { Task } from "../../../../services/taskService";
import {
  exportCsv,
  exportPdf,
  type ReportColumn,
} from "../../../../services/reportService";
import {
  Card,
  ExportMenu,
  SectionEmpty,
  StatCard,
  WSelect,
  formatDate,
} from "../../../../components/workflow/primitives";
import { TaskStatusBadge } from "../../../../components/workflow/StatusBadges";
import {
  WorkspaceHeader,
  WorkspaceSkeleton,
} from "../../../../components/ui/workspace";
import { Button } from "../../../../components/ui/button";
import "../../../../components/ui/workspace/analyticalWorkspace.css";
import { useMyTasks } from "./useMyTasks";

export function EmployeeWorkReport() {
  const { mine, loading, error, retry } = useMyTasks();
  const { userProfile } = useAuth();
  const [statusFilter, setStatusFilter] = useState("all");
  const [period, setPeriod] = useState("30");

  const rows = useMemo(() => {
    let r = mine;
    if (statusFilter !== "all") r = r.filter((t) => t.status === statusFilter);
    const days = Number(period);
    if (days > 0) {
      const since = Date.now() - days * 86400000;
      r = r.filter((t) => t.createdAt >= since || t.updatedAt >= since);
    }
    return r;
  }, [mine, statusFilter, period]);

  const completed = rows.filter((t) => t.status === "completed").length;
  const rate = rows.length ? Math.round((completed / rows.length) * 100) : 0;

  const doExport = (kind: "csv" | "pdf") => {
    const cols: ReportColumn<Task>[] = [
      { key: "title", header: "Task", value: (t) => t.title },
      { key: "status", header: "Status", value: (t) => t.status },
      {
        key: "priority",
        header: "Priority",
        value: (t) => t.priority || "medium",
      },
      {
        key: "percent",
        header: "% complete",
        value: (t) => t.percentComplete ?? 0,
      },
      {
        key: "deadline",
        header: "Deadline",
        value: (t) => formatDate(t.deadline || t.dueDate),
      },
      {
        key: "updated",
        header: "Last update",
        value: (t) => formatDate(t.updatedAt),
      },
    ];
    const meta = {
      title: `My work report — ${userProfile?.full_name || "Me"}`,
      subtitle: "My Workspace · Personal report",
      filters: {
        Status: statusFilter === "all" ? "All" : statusFilter,
        Period: period === "0" ? "All time" : `Last ${period} days`,
      },
      totals: {
        Tasks: rows.length,
        Completed: completed,
        "Completion rate": `${rate}%`,
      },
    };
    kind === "csv" ? exportCsv(rows, cols, meta) : exportPdf(rows, cols, meta);
  };

  if (loading)
    return (
      <div className="p-8">
        <WorkspaceSkeleton label="Preparing your report" />
      </div>
    );

  return (
    <div className="eflow-analytics min-h-full p-4 sm:p-8">
      <WorkspaceHeader
        title="My Work Report"
        description="A personal summary of authorized tasks and progress."
        actions={
          <ExportMenu
            onCsv={() => doExport("csv")}
            onPdf={() => doExport("pdf")}
            disabled={rows.length === 0 || !!error}
          />
        }
      />

      {error && (
        <div role="alert" className="eflow-analytics-error">
          Work report unavailable: {error.message}
          <Button onClick={retry}>Retry work report</Button>
        </div>
      )}
      <div className="eflow-analytics-filters">
        <WSelect
          ariaLabel="Work report status"
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: "all", label: "All statuses" },
            { value: "in_progress", label: "In Progress" },
            { value: "for_review", label: "In Review" },
            { value: "completed", label: "Completed" },
          ]}
        />
        <WSelect
          ariaLabel="Work report period"
          value={period}
          onChange={setPeriod}
          options={[
            { value: "7", label: "Last 7 days" },
            { value: "30", label: "Last 30 days" },
            { value: "90", label: "Last 90 days" },
            { value: "0", label: "All time" },
          ]}
        />
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Tasks"
          value={error ? "Unavailable" : rows.length}
          icon={<FileText size={15} />}
        />
        <StatCard
          label="Completed"
          value={error ? "Unavailable" : completed}
          tone="good"
        />
        <StatCard
          label="Completion rate"
          value={error ? "Unavailable" : `${rate}%`}
          tone="good"
        />
      </div>

      <Card bodyClassName="p-0">
        {rows.length === 0 ? (
          <SectionEmpty
            icon={<FileText size={30} />}
            title={error ? "Work report unavailable" : "No tasks in range"}
            description="Adjust the filters to include more of your work."
          />
        ) : (
          <div
            className="eflow-analytics-table"
            tabIndex={0}
            role="region"
            aria-label="Work report table"
          >
            <table className="w-full">
              <thead>
                <tr className="bg-muted border-b border-border">
                  {[
                    "Task",
                    "Status",
                    "% complete",
                    "Deadline",
                    "Last update",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-2.5 text-left text-[10px] font-medium uppercase tracking-wider text-muted-foreground"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => (
                  <tr key={t.id} className="border-b border-border">
                    <td className="px-4 py-2.5 text-[12px] font-medium text-foreground">
                      {t.title}
                    </td>
                    <td className="px-4 py-2.5">
                      <TaskStatusBadge status={t.status} size="sm" />
                    </td>
                    <td className="px-4 py-2.5 text-[12px] text-muted-foreground tabular-nums">
                      {t.percentComplete ?? 0}%
                    </td>
                    <td className="px-4 py-2.5 text-[12px] text-muted-foreground">
                      {formatDate(t.deadline || t.dueDate)}
                    </td>
                    <td className="px-4 py-2.5 text-[12px] text-muted-foreground">
                      {formatDate(t.updatedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
