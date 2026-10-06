import { formatDate } from "../../components/workflow/primitives";
import type { ReportColumn } from "../../services/reportService";
import type { DepartmentReportRow } from "./types";
export const departmentReportColumns: ReportColumn<DepartmentReportRow>[] = [
  { key: "title", header: "Work item", value: (row) => row.title },
  { key: "parent", header: "Parent / transition", value: (row) => row.parent },
  { key: "person", header: "Person", value: (row) => row.person },
  { key: "role", header: "Role", value: (row) => row.role },
  { key: "project", header: "Project", value: (row) => row.project },
  { key: "status", header: "Status", value: (row) => row.status },
  {
    key: "priority",
    header: "Priority / severity",
    value: (row) => row.priority,
  },
  {
    key: "progress",
    header: "Progress",
    value: (row) =>
      typeof row.progress === "number" ? `${row.progress}%` : "—",
  },
  { key: "metric", header: "Signal", value: (row) => row.metric },
  {
    key: "event",
    header: "Event date",
    value: (row) => (row.eventAt ? formatDate(row.eventAt) : "—"),
  },
  {
    key: "due",
    header: "Due date",
    value: (row) => (row.dueAt ? formatDate(row.dueAt) : "—"),
  },
  { key: "detail", header: "Detail", value: (row) => row.detail },
];
