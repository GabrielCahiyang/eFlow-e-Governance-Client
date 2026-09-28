import type { UserRole } from "../types";

export const HEAD_ROLE: UserRole = "dept_head";
export const ASSISTANT_HEAD_ROLE: UserRole = "assistant_head";

export function isHeadWorkspaceRole(role: string | null | undefined): boolean {
  return role === HEAD_ROLE || role === ASSISTANT_HEAD_ROLE || role === "department_head";
}

export function getRoleLabel(role: string): string {
  switch (role) {
    case "super_admin":
      return "Super Admin";
    case "admin":
      return "Admin";
    case "dept_head":
    case "department_head":
      return "Head";
    case "assistant_head":
      return "Assistant Head";
    case "accounting_staff":
      return "Accounting Staff";
    case "depthead":
      return "Department Head";
    case "teamleader":
      return "Team Leader";
    case "executive":
      return "Executive";
    case "legislative":
      return "Legislative";
    case "councilor_pad":
      return "Councilor";
    case "hrmo":
      return "Human Resources";
    case "finance":
      return "Finance";
    case "employee":
      return "Employee";
    default:
      return role.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  }
}

export function getHeadWorkspaceLabel(role: string | null | undefined): "Head" | "Assistant Head" {
  return role === ASSISTANT_HEAD_ROLE ? "Assistant Head" : "Head";
}
