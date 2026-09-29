import { createContext, useContext, type ReactNode } from "react";
import type { Organization } from "../../../types";

const DepartmentContext = createContext<{ organizations: Organization[]; defaultDepartmentId?: string }>({ organizations: [] });
export function TaskDepartmentProvider({ organizations, defaultDepartmentId, children }: { organizations: Organization[]; defaultDepartmentId?: string; children: ReactNode }) {
  return <DepartmentContext.Provider value={{ organizations, defaultDepartmentId }}>{children}</DepartmentContext.Provider>;
}

export function TaskDepartmentLabel({ task, draft = false }: { task: { orgId?: string; department?: string; primaryOrgId?: string; activityPrimaryOrgId?: string; supportingOrgIds?: string[]; activitySupportingOrgIds?: string[] }; draft?: boolean }) {
  const { organizations, defaultDepartmentId } = useContext(DepartmentContext);
  const id = task.primaryOrgId || task.activityPrimaryOrgId || task.orgId || task.department || (draft ? defaultDepartmentId : undefined);
  const name = organizations.find((org) => org.id === id || org.name === id)?.name;
  const supporting = (task.supportingOrgIds || task.activitySupportingOrgIds || []).map((orgId) => organizations.find((org) => org.id === orgId)?.name).filter(Boolean);
  return <p className="mt-1 text-[11px] leading-relaxed text-neutral-500"><span>Department: {name || (id ? "Department unavailable" : "Department not set")}</span>{supporting.length > 0 && <span className="block">Supporting departments: {supporting.join(", ")}</span>}</p>;
}
