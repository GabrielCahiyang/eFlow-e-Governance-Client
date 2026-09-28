/** Maps persisted application roles to the existing presentation panels. */
export function mapRoleToPanel(role: string): string {
  switch (role) {
    case "super_admin":
    case "admin":
      return "superadmin";
    case "dept_head":
    case "assistant_head":
    case "department_head":
      return "depthead";
    case "accounting_staff":
      return "accounting_staff";
    case "team_leader":
    case "teamleader":
      return "employee";
    case "employee":
    default:
      return "employee";
  }
}
