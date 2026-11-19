import type { BackupJob } from "../services/backupService";
import { formatManilaDateTime } from "../../../shared/calendarDisplay";

export interface BackupJobFilters {
  search: string;
  status: string;
  mode: string;
  exportFormat: string;
  dateFrom: string;
  dateTo: string;
}

export const DEFAULT_BACKUP_JOB_FILTERS: BackupJobFilters = {
  search: "",
  status: "all",
  mode: "all",
  exportFormat: "all",
  dateFrom: "",
  dateTo: "",
};

export interface ImportantTablePreset {
  id: string;
  label: string;
  description: string;
  tables: string[];
}

export const IMPORTANT_DATA_PRESETS: ImportantTablePreset[] = [
  {
    id: "projects_work",
    label: "Projects & Tasks",
    description: "Projects, groups, milestones, tasks, subtasks, submissions, and seals",
    tables: [
      "projects",
      "project_groups",
      "milestones",
      "tasks",
      "subtasks",
      "task_submissions",
      "subtask_submissions",
      "task_activities",
      "task_status_history",
      "project_readiness_reviews",
      "project_seal_certificates",
    ],
  },
  {
    id: "finance_budget",
    label: "Budget & Petty Cash",
    description: "Fiscal budgets, sections, commitments, ledger, petty cash, and journals",
    tables: [
      "department_fiscal_budgets",
      "department_budget_lines",
      "office_budget_sections",
      "budget_commitments",
      "budget_ledger_entries",
      "work_budget_allocations",
      "work_budget_allocation_lines",
      "petty_cash_requests",
      "petty_cash_request_lines",
      "petty_cash_releases",
      "petty_cash_liquidations",
      "petty_cash_receipts",
      "petty_cash_receipt_items",
      "general_journal_entries",
      "general_journal_lines",
      "accounting_accounts",
    ],
  },
  {
    id: "people_offices",
    label: "Offices, People & Access",
    description: "Organizations, memberships, profiles, roles, permissions, and skill tags",
    tables: [
      "organizations",
      "organization_memberships",
      "profiles",
      "project_members",
      "project_offices",
      "project_office_identities",
      "custom_roles",
      "role_permissions",
      "user_permission_overrides",
      "user_invitations",
      "skill_tag_definitions",
      "work_status_definitions",
    ],
  },
  {
    id: "proposals_governance",
    label: "Proposals & Governance",
    description: "Collaboration drafts, governance resolutions, signoffs, and imports",
    tables: [
      "proposal_collaboration_drafts",
      "proposal_collaboration_revisions",
      "proposal_collaboration_approvals",
      "proposal_governance_records",
      "proposal_governance_assignments",
      "proposal_governance_signoffs",
      "proposal_delivery_closeouts",
      "project_pdf_import_sessions",
    ],
  },
  {
    id: "audit_comms",
    label: "Audit & Announcements",
    description: "Administrative audit trail, announcements, and notifications",
    tables: [
      "audit_events",
      "announcements",
      "announcement_recipients",
      "notifications",
    ],
  },
];

export const QUICK_EXPLORER_TABLES: { table: string; label: string }[] = [
  { table: "projects", label: "Projects" },
  { table: "tasks", label: "Tasks" },
  { table: "subtasks", label: "Subtasks" },
  { table: "profiles", label: "Profiles" },
  { table: "organizations", label: "Offices" },
  { table: "department_fiscal_budgets", label: "Fiscal Budgets" },
  { table: "petty_cash_requests", label: "Petty Cash" },
  { table: "petty_cash_liquidations", label: "Liquidations" },
  { table: "budget_ledger_entries", label: "Budget Ledger" },
  { table: "audit_events", label: "Audit Events" },
  { table: "project_seal_certificates", label: "Project Seals" },
];

export function hasBackupJobFilters(filters: BackupJobFilters): boolean {
  return Boolean(
    filters.search.trim() ||
      filters.status !== "all" ||
      filters.mode !== "all" ||
      filters.exportFormat !== "all" ||
      filters.dateFrom ||
      filters.dateTo,
  );
}

export function filterBackupJobs(
  jobs: BackupJob[],
  filters: BackupJobFilters,
): BackupJob[] {
  const needle = filters.search.trim().toLowerCase();
  return jobs.filter((job) => {
    if (filters.status !== "all" && job.status !== filters.status) return false;
    if (filters.mode !== "all" && job.mode !== filters.mode) return false;
    if (
      filters.exportFormat !== "all" &&
      (job.export_format || "archive") !== filters.exportFormat
    ) {
      return false;
    }
    const createdDay = job.created_at.slice(0, 10);
    if (filters.dateFrom && createdDay < filters.dateFrom) return false;
    if (filters.dateTo && createdDay > filters.dateTo) return false;
    if (needle) {
      const haystack = [
        job.id,
        job.archive_name,
        job.archive_sha256,
        job.phase,
        job.error,
        job.scope,
        ...(job.selected_tables || []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(needle)) return false;
    }
    return true;
  });
}

export function paginateItems<T>(
  items: readonly T[],
  requestedPage: number,
  pageSize: number,
): {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  startIndex: number;
  endIndex: number;
} {
  const safeSize = Math.max(1, pageSize);
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / safeSize));
  const page = Math.max(1, Math.min(totalPages, requestedPage));
  const start = (page - 1) * safeSize;
  const sliced = items.slice(start, start + safeSize);
  return {
    items: sliced,
    page,
    pageSize: safeSize,
    total,
    totalPages,
    startIndex: total === 0 ? 0 : start + 1,
    endIndex: total === 0 ? 0 : start + sliced.length,
  };
}

export function formatBytes(value?: number | null): string {
  if (!value) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let size = value;
  let index = 0;
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index += 1;
  }
  return `${size.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

export function formatExplorerCell(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return value.toLocaleString();
  if (typeof value === "object") {
    const raw = JSON.stringify(value);
    return raw.length > 72 ? `${raw.slice(0, 72)}…` : raw;
  }
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(text)) {
    const formatted = formatManilaDateTime(text, "");
    if (formatted) return formatted;
  }
  return text.length > 72 ? `${text.slice(0, 72)}…` : text;
}
