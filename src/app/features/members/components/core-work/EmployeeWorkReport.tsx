import { useMemo, useState } from 'react';
import { FileText } from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';
import type { Task } from '../../../../services/taskService';
import { exportCsv, exportPdf, type ReportColumn } from '../../../../services/reportService';
import { Card, ExportMenu, LoadingState, PageHeader, SectionEmpty, StatCard, WSelect, formatDate } from '../../../../components/workflow/primitives';
import { TaskStatusBadge } from '../../../../components/workflow/StatusBadges';
import { useMyTasks } from './useMyTasks';

export function EmployeeWorkReport() {
  const { mine, loading } = useMyTasks();
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
      { key: "priority", header: "Priority", value: (t) => t.priority || "medium" },
      { key: "percent", header: "% complete", value: (t) => t.percentComplete ?? 0 },
      { key: "deadline", header: "Deadline", value: (t) => formatDate(t.deadline || t.dueDate) },
      { key: "updated", header: "Last update", value: (t) => formatDate(t.updatedAt) },
    ];
    const meta = {
      title: `My work report — ${userProfile?.full_name || "Me"}`,
      subtitle: "My Workspace · Personal report",
      filters: { Status: statusFilter === "all" ? "All" : statusFilter, Period: period === "0" ? "All time" : `Last ${period} days` },
      totals: { Tasks: rows.length, Completed: completed, "Completion rate": `${rate}%` },
    };
    kind === "csv" ? exportCsv(rows, cols, meta) : exportPdf(rows, cols, meta);
  };

  if (loading) return <div className="p-8"><LoadingState label="Preparing your report…" /></div>;

  return (
    <div className="min-h-full p-4 sm:p-8">
      <PageHeader
        eyebrow="My Workspace · Report"
        title="My Work Report"
        subtitle="A personal summary of your tasks and progress — export anytime."
        actions={<ExportMenu onCsv={() => doExport("csv")} onPdf={() => doExport("pdf")} disabled={rows.length === 0} />}
      />

      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <WSelect value={statusFilter} onChange={setStatusFilter} options={[
          { value: "all", label: "All statuses" },
          { value: "in_progress", label: "In Progress" },
          { value: "for_review", label: "In Review" },
          { value: "completed", label: "Completed" },
        ]} />
        <WSelect value={period} onChange={setPeriod} options={[
          { value: "7", label: "Last 7 days" },
          { value: "30", label: "Last 30 days" },
          { value: "90", label: "Last 90 days" },
          { value: "0", label: "All time" },
        ]} />
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Tasks" value={rows.length} icon={<FileText size={15} />} />
        <StatCard label="Completed" value={completed} tone="good" />
        <StatCard label="Completion rate" value={`${rate}%`} tone="good" />
      </div>

      <Card bodyClassName="p-0">
        {rows.length === 0 ? (
          <SectionEmpty icon={<FileText size={30} />} title="No tasks in range" description="Adjust the filters to include more of your work." />
        ) : (
          <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Work report table">
            <table className="w-full">
              <thead>
                <tr className="bg-neutral-50 border-b border-neutral-200">
                  {["Task", "Status", "% complete", "Deadline", "Last update"].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-[10px] font-medium uppercase tracking-wider text-neutral-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => (
                  <tr key={t.id} className="border-b border-neutral-50">
                    <td className="px-4 py-2.5 text-[12px] font-medium text-neutral-900">{t.title}</td>
                    <td className="px-4 py-2.5"><TaskStatusBadge status={t.status} size="sm" /></td>
                    <td className="px-4 py-2.5 text-[12px] text-neutral-600 tabular-nums">{t.percentComplete ?? 0}%</td>
                    <td className="px-4 py-2.5 text-[12px] text-neutral-600">{formatDate(t.deadline || t.dueDate)}</td>
                    <td className="px-4 py-2.5 text-[12px] text-neutral-500">{formatDate(t.updatedAt)}</td>
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
