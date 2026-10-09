import type { ProjectCommandData } from "../components/project-command/types";
export function financialOfficeUnavailable(
  data: ProjectCommandData,
  taskId: string,
) {
  const office = data.financial.summary?.orgId || data.project.orgId;
  const task = data.tasks.find((t) => t.id === taskId);
  return !!(office && task?.orgId && office !== task.orgId);
}
