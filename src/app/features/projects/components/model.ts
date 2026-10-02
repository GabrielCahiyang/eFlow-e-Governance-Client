export interface ProjectScope {
  /** Admin sees all organizations. */
  isSuperAdmin: boolean;
  /** Exact organization ids visible to a scoped management workspace. */
  scopedOrgIds: string[];
  /** Employees rely on membership RLS; management uses an explicit exact scope. */
  enforceOrgScope?: boolean;
}

export const ALL_PROJECT_DEPARTMENTS = "all";
export const UNASSIGNED_PROJECT_DEPARTMENT = "unassigned";

export function matchesProjectDepartment(
  organizationId: string | null | undefined,
  selectedDepartmentId: string,
): boolean {
  if (selectedDepartmentId === ALL_PROJECT_DEPARTMENTS) return true;
  if (selectedDepartmentId === UNASSIGNED_PROJECT_DEPARTMENT) return !organizationId;
  return organizationId === selectedDepartmentId;
}

export interface ProjectWorkspaceAccess {
  canCreate: boolean;
  canManage: boolean;
  canArchive: boolean;
  canDelete: boolean;
  canReviewTasks: boolean;
  canExport: boolean;
}

export function resolveProjectWorkspaceAccess(
  readOnly: boolean,
  hasPermission: (permission: string) => boolean,
): ProjectWorkspaceAccess {
  return {
    canCreate: !readOnly && hasPermission("projects.create"),
    canManage: !readOnly && hasPermission("projects.create"),
    canArchive: !readOnly && hasPermission("projects.archive"),
    canDelete: !readOnly && hasPermission("projects.delete"),
    canReviewTasks: !readOnly && hasPermission("tasks.verify"),
    canExport: hasPermission("reports.export"),
  };
}

export const MILESTONE_STATUS_META: Record<string, { label: string; tone: string }> = {
  not_started: { label: "Not started", tone: "bg-neutral-100 text-neutral-600" },
  in_progress: { label: "In progress", tone: "bg-blue-50 text-blue-700" },
  at_risk: { label: "At risk", tone: "bg-amber-50 text-amber-700" },
  completed: { label: "Completed", tone: "bg-emerald-50 text-emerald-700" },
};

// ─── Main ProjectsWorkspace ───────────────────────────────────────
