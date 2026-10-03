import { normalizeUserRole } from "../../shared/roles";
export function mapRoleToPanel(role: string): string {
  try { return normalizeUserRole(role); } catch { return "unsupported"; }
}
