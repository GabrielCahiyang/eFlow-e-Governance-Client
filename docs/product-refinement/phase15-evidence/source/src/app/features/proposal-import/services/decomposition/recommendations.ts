import type { Employee } from "../../../../services/employeeService";
import { scoreEmployees } from "../../../../services/aiScoringEngine";
import type { Task } from "../../../../services/taskService";
import type { EmployeeNotesMap } from "../../../../services/employeeNotesService";
import type { ProposalDecompositionResult, ProposalDecompositionTask } from "../../types";

const normalizeName = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export const mapNamesToIds = (values: string[], employees: Employee[]) => {
  const byId = new Map(employees.map((employee) => [employee.id, employee.id]));
  const byName = new Map(
    employees.map((employee) => [normalizeName(employee.name), employee.id]),
  );

  const resolved: string[] = [];
  values.forEach((value) => {
    if (byId.has(value)) {
      resolved.push(value);
      return;
    }
    const normalized = normalizeName(value);
    const exact = byName.get(normalized);
    if (exact) {
      resolved.push(exact);
      return;
    }
    const fuzzy = employees.find((employee) => {
      const candidate = normalizeName(employee.name);
      return candidate.includes(normalized) || normalized.includes(candidate);
    });
    if (fuzzy) resolved.push(fuzzy.id);
  });

  return Array.from(new Set(resolved));
};

export const getRecommendedValues = (task: ProposalDecompositionTask): string[] => {
  if (Array.isArray(task.recommendedEmployeeIds)) {
    return task.recommendedEmployeeIds.filter(
      (value): value is string => typeof value === "string",
    );
  }
  const names = (task as unknown as Record<string, unknown>)
    .recommendedEmployeeNames;
  if (Array.isArray(names)) {
    return names.filter((value): value is string => typeof value === "string");
  }
  if (typeof names === "string") return [names];
  return [];
};

export const buildCompactEmployeesContext = (
  employees: Employee[],
  employeeNotes?: EmployeeNotesMap,
) =>
  employees
    .map((employee) => {
      const notes = employeeNotes?.[employee.id];
      const profileSkills = employee.jobDescription || "General";
      return [
        `- ID: ${employee.id} | Name: ${employee.name} | Role: ${employee.jobTitle}`,
        `  Workload: ${employee.currentWorkload}% | Skills: ${profileSkills}`,
        `  Strengths: ${notes?.strengths || "No manager strengths recorded"}`,
        `  Weakness/risk constraints: ${notes?.weaknesses || "None recorded"}`,
        `  Manager notes: ${notes?.notes || "None"}`,
        `  Tags: ${(notes?.tags || []).join(", ") || "None"}`,
      ].join("\n");
    })
    .join("\n");

export const selectFallbackTeam = (scored: ReturnType<typeof scoreEmployees>) => {
  if (!scored.length) return [];

  const topSkillMatch = scored[0].breakdown.skillMatch;
  const SKILL_GAP = 15;
  const MIN_SKILL_FLOOR = Math.max(25, topSkillMatch - SKILL_GAP);

  const qualified = scored.filter(
    (candidate) => candidate.breakdown.skillMatch >= MIN_SKILL_FLOOR,
  );

  const candidates = qualified.length ? qualified : scored;
  const team = [candidates[0]];
  const coveredSkills = new Set(candidates[0].matchedSkills);
  candidates.slice(1).forEach((candidate) => {
    const addsCoverage = candidate.matchedSkills.some(
      (skill) => !coveredSkills.has(skill),
    );
    if (!addsCoverage) return;
    team.push(candidate);
    candidate.matchedSkills.forEach((skill) => coveredSkills.add(skill));
  });
  return team;
};

export const applyLocalRecommendations = (
  result: ProposalDecompositionResult,
  employees?: Employee[],
  employeeNotes?: EmployeeNotesMap,
) => {
  if (!employees || employees.length === 0) return;
  console.log("[Decomposition DEBUG] Running applyLocalRecommendations with members:", employees.map(e => e.name));

  result.programs.forEach((program) => {
    program.projects.forEach((project) => {
      project.activities.forEach((activity) => {
        activity.tasks.forEach((task) => {
          if (task.recommendedEmployeeIds && task.recommendedEmployeeIds.length > 0) {
            return; // Already has a real recommendation — don't overwrite it
          }
          const taskForScoring: Task = {
            id: "temp",
            title: task.title,
            description: task.description,
            status: "pending_assignment" as const,
            tags: task.requiredSkills,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          const scored = scoreEmployees(taskForScoring, employees, employeeNotes);
          if (scored.length > 0) {
            const team = selectFallbackTeam(scored);
            if (team.length > 0) {
              task.recommendedEmployeeIds = team.map((c) => c.employeeId);
              task.recommendationReasoning =
                team.length > 1
                  ? `Team of ${team.length}: Lead ${team[0].employeeName}, support ${team
                      .slice(1)
                      .map((c) => c.employeeName)
                      .join(", ")}.`
                  : scored[0].reasoning;
              task.burnoutWarning = team.some((c) => c.burnoutWarning);
              task.recommendationSource = "fallback";
            }
          }
        });
      });
    });
  });
};
