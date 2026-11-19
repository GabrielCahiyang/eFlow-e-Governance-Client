import { isAppointedOfficeHead } from "../../../shared/officeAuthority";
import { isAdminRole } from "../../../shared/roles";
import type { Organization, UserProfile } from "../../../types";

export interface ProjectScope {
  /** Admin sees all organizations. */
  includeAllAccessibleWork: boolean;
  /** Exact organization ids visible to a scoped management workspace. */
  scopedOrgIds: string[];
  /** Employees rely on membership RLS; management uses an explicit exact scope. */
  enforceOrgScope?: boolean;
}

export const ALL_PROJECT_DEPARTMENTS = "all";
export const UNASSIGNED_PROJECT_DEPARTMENT = "unassigned";

export function matchesProjectDepartment(
  organizationId: string | null | undefined,
  selectedOfficeId: string,
): boolean {
  if (selectedOfficeId === ALL_PROJECT_DEPARTMENTS) return true;
  if (selectedOfficeId === UNASSIGNED_PROJECT_DEPARTMENT) return !organizationId;
  return organizationId === selectedOfficeId;
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
  const canCreate = !readOnly && hasPermission("projects.create");
  return {
    canCreate,
    canManage: canCreate,
    canArchive: !readOnly && hasPermission("projects.archive"),
    canDelete: !readOnly && hasPermission("projects.delete"),
    canReviewTasks: !readOnly && hasPermission("tasks.verify"),
    canExport: hasPermission("reports.export"),
  };
}

export interface ProjectOwnershipContext {
  orgId?: string | null;
  createdBy?: string | null;
  ownerId?: string | null;
  projectLeadId?: string | null;
  sourceCollaborationDraftId?: string | null;
}

export function canCreateOfficeProject(
  userProfile: UserProfile | null | undefined,
  organizations: Organization[],
  hasCreatePermission: boolean,
  workspaceOfficeId?: string | null,
): boolean {
  if (!hasCreatePermission || !userProfile || userProfile.is_active === false) return false;
  if (isAdminRole(userProfile.role)) return false;
  const userOrgId = userProfile.org_id || userProfile.departmentId || "";
  if (!userOrgId) return false;
  const activeOffice = organizations.some((org) => org.id === userOrgId && org.is_active !== false);
  if (!activeOffice) return false;
  if (workspaceOfficeId && workspaceOfficeId !== userOrgId) return false;
  return true;
}

export function canManageSpecificProject(
  project: ProjectOwnershipContext,
  userProfile: UserProfile | null | undefined,
  organizations: Organization[],
  hasManagePermission: boolean,
): boolean {
  if (!hasManagePermission || !userProfile || userProfile.is_active === false) return false;
  if (isAdminRole(userProfile.role)) return false;
  const userOrgId = userProfile.org_id || userProfile.departmentId || "";
  if (!userOrgId || !project.orgId || project.orgId !== userOrgId) return false;

  if (isAppointedOfficeHead(userProfile, organizations)) {
    return true;
  }

  if (project.sourceCollaborationDraftId) {
    return false;
  }

  return (
    project.createdBy === userProfile.id ||
    project.ownerId === userProfile.id ||
    project.projectLeadId === userProfile.id
  );
}

export const MILESTONE_STATUS_META: Record<string, { label: string; tone: string }> = {
  not_started: { label: "Not started", tone: "bg-neutral-100 text-neutral-600" },
  in_progress: { label: "In progress", tone: "bg-blue-50 text-blue-700" },
  at_risk: { label: "At risk", tone: "bg-amber-50 text-amber-700" },
  completed: { label: "Completed", tone: "bg-emerald-50 text-emerald-700" },
};

// ─── Main ProjectsWorkspace ───────────────────────────────────────
