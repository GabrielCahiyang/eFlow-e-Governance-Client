import type { Employee } from "../../../services/employeeService";
import type { TeamMemberMetrics } from "../../team-management";

/**
 * AI assignment uses the same derived workload signal shown in Team
 * Intelligence. This avoids presenting one capacity score to a manager while
 * silently using a different approximation in proposal decomposition.
 */
export function withTeamIntelligenceCandidateWorkload(
  employees: Employee[],
  metrics: TeamMemberMetrics[],
): Employee[] {
  const signalByEmployeeId = new Map(
    metrics.map((metric) => [metric.employeeId, metric.workloadSignal]),
  );

  return employees.map((employee) => {
    return {
      ...employee,
      currentWorkload: signalByEmployeeId.get(employee.id) ?? employee.currentWorkload ?? 0,
    };
  });
}
