import type { ReportColumn } from "../../../services/reportService";
import { formatPeso } from "../../../shared/currency";
import type { ProjectExecutionFinancialRow } from "./projectFinancialReportSelectors";
export const COLUMNS: ReportColumn<ProjectExecutionFinancialRow>[] = [
  {
    key: "hierarchy",
    header: "Work Item",
    value: (row) => `${row.level === "subtask" ? "  ↳ " : ""}${row.workItem}`,
  },
  {
    key: "accountability",
    header: "Accountability",
    value: (row) => row.accountability,
  },
  {
    key: "status",
    header: "Status",
    value: (row) => row.status.replace(/_/g, " "),
  },
  { key: "progress", header: "Progress", value: (row) => `${row.progress}%` },
  {
    key: "deadline",
    header: "Deadline",
    value: (row) => row.deadline || "Unscheduled",
  },
  {
    key: "schedule",
    header: "Schedule Health",
    value: (row) => row.schedule.replace(/_/g, " "),
  },
  { key: "budget_mode", header: "Budget Mode", value: (row) => row.budgetMode },
  {
    key: "budget",
    header: "Budget / Cap",
    value: (row) =>
      row.budgetMode === "shared"
        ? "Shared task pool"
        : formatPeso(row.budgetAmount),
  },
  {
    key: "reserved",
    header: "Reserved",
    value: (row) => formatPeso(row.reservedAmount),
  },
  {
    key: "spent",
    header: "Actual Spent",
    value: (row) => formatPeso(row.spentAmount),
  },
  {
    key: "returned",
    header: "Returned",
    value: (row) => formatPeso(row.returnedAmount),
  },
  {
    key: "available",
    header: "Available",
    value: (row) =>
      row.budgetMode === "shared"
        ? "From parent task"
        : formatPeso(row.availableAmount),
  },
  { key: "receipts", header: "Receipts", value: (row) => row.receiptCount },
  {
    key: "evidence",
    header: "Completion Evidence",
    value: (row) => row.evidenceCount,
  },
];
