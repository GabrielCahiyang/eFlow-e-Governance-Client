import { Employee } from "./employeeService";
import { Task } from "./taskService";
import type { EmployeeNotesMap } from "./employeeNotesService";
import { scoreEmployees } from "./aiScoringEngine";
import {
  readAiText,
  requestAiChat,
  isAiServiceUnavailableError,
  type AiQueueUpdate,
} from "../features/ai";

const LLM_MODEL = "deepseek-r1:8b";
const LLM_MAX_ATTEMPTS = 2;

export interface LLMTeamRecommendation {
  recommendedEmployeeIds: string[];
  leadEmployeeId?: string;
  reasoning: string;
  burnoutWarning: boolean;
  source?: "llm" | "fallback" | "import";
}

export type HierarchyContext = {
  initiative?: string;
  program?: string;
  project?: string;
  activity?: string;
  schedule?: string;
  methodology?: string[];
  requiredSkills?: string[];
};

const normalizeName = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const mapNamesToIds = (values: string[], employees: Employee[]) => {
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

const buildEmployeesContext = (
  employees: Employee[],
  employeeNotes?: EmployeeNotesMap,
) =>
  employees
    .map((employee) => {
      const notes = employeeNotes?.[employee.id];
      const noteText = notes
        ? `\n  Strengths: ${notes.strengths || "-"}\n  Weaknesses: ${notes.weaknesses || "-"}\n  Notes: ${notes.notes || "-"}\n  Tags: ${(notes.tags || []).join(", ") || "-"}`
        : "";

      return `- ID: ${employee.id}\n  Name: ${employee.name}\n  Team: ${employee.departmentName ?? employee.department ?? "Unassigned"}\n  Job: ${employee.jobTitle || "-"}\n  Skills: ${employee.jobDescription || "-"}\n  Workload (0-100): ${employee.currentWorkload}${noteText}`;
    })
    .join("\n\n");

const buildHierarchyContextBlock = (context?: HierarchyContext) => {
  if (!context) return "";
  const lines: string[] = [];
  if (context.initiative) lines.push(`- Initiative: ${context.initiative}`);
  if (context.program) lines.push(`- Program: ${context.program}`);
  if (context.project) lines.push(`- Project: ${context.project}`);
  if (context.activity) lines.push(`- Activity: ${context.activity}`);
  if (context.schedule) lines.push(`- Schedule: ${context.schedule}`);
  if (context.methodology && context.methodology.length > 0)
    lines.push(`- Methodology: ${context.methodology.join(", ")}`);
  if (context.requiredSkills && context.requiredSkills.length > 0)
    lines.push(`- Required Skills: ${context.requiredSkills.join(", ")}`);

  return lines.length
    ? `\nHierarchy Context:\n${lines.join("\n")}\n`
    : "";
};

const buildTaskDetailsBlock = (task: Task, context?: HierarchyContext) => {
  const requiredSkills = (task as unknown as Record<string, unknown>)
    .requiredSkills as string[] | undefined;
  const taskTags = task.tags && task.tags.length > 0 ? task.tags.join(", ") : "-";
  const taskSkills = requiredSkills && requiredSkills.length > 0
    ? requiredSkills.join(", ")
    : "-";
  const deadline = task.deadline || task.dueDate || "-";

  return `Task Details:\n- Title: ${task.title}\n- Description: ${task.description || "No description provided."}\n- Tags: ${taskTags}\n- Required Skills: ${taskSkills}\n- Priority: ${task.priority || "medium"}\n- Deadline: ${deadline}${buildHierarchyContextBlock(context)}`;
};

const extractJsonString = (content: string) => {
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  return jsonMatch ? jsonMatch[0] : null;
};

const parseRecommendation = (
  contentString: string,
  employees: Employee[],
): LLMTeamRecommendation | null => {
  const jsonString = extractJsonString(contentString);
  if (!jsonString) return null;

  const parsed = JSON.parse(jsonString) as Record<string, unknown>;
  const rawIds = Array.isArray(parsed.recommendedEmployeeIds)
    ? parsed.recommendedEmployeeIds.filter(
        (id: unknown): id is string => typeof id === "string",
      )
    : typeof parsed.recommendedEmployeeIds === "string"
      ? [parsed.recommendedEmployeeIds]
      : Array.isArray(parsed.recommendedEmployeeNames)
        ? parsed.recommendedEmployeeNames.filter(
            (id: unknown): id is string => typeof id === "string",
          )
        : typeof parsed.recommendedEmployeeNames === "string"
          ? [parsed.recommendedEmployeeNames]
          : [];

  const resolvedIds = mapNamesToIds(rawIds, employees);

  if (!resolvedIds.length) return null;

  return {
    recommendedEmployeeIds: resolvedIds,
    leadEmployeeId: resolvedIds[0] || undefined,
    reasoning: typeof parsed.reasoning === "string" ? parsed.reasoning : "",
    burnoutWarning:
      parsed.burnoutWarning === true || parsed.burnoutWarning === "true",
    source: "llm",
  };
};

const buildFallbackRecommendation = (
  scored: ReturnType<typeof scoreEmployees>,
): LLMTeamRecommendation | null => {
  if (!scored.length) return null;

  const topSkillMatch = scored[0].breakdown.skillMatch;
  const SKILL_GAP = 15;
  const MIN_SKILL_FLOOR = Math.max(25, topSkillMatch - SKILL_GAP);

  const qualified = scored.filter(
    (candidate) => candidate.breakdown.skillMatch >= MIN_SKILL_FLOOR,
  );

  let team = (qualified.length ? qualified : scored).slice(0, 3);

  if (team.length >= 2) {
    const skillGapToSecond =
      team[0].breakdown.skillMatch - team[1].breakdown.skillMatch;
    if (skillGapToSecond >= 10) {
      team = skillGapToSecond >= 20 ? team.slice(0, 1) : team.slice(0, 2);
    } else if (team.length === 3) {
      const skillGapToThird =
        team[0].breakdown.skillMatch - team[2].breakdown.skillMatch;
      if (skillGapToThird >= 10) {
        team = team.slice(0, 2);
      }
    }
  }

  if (!team.length) return null;
  const lead = team[0];
  const supportNames = team.slice(1).map((c) => c.employeeName).join(", ");
  const reasoning = team.length > 1
    ? `Team of ${team.length} suggested based on local scoring. Lead: ${lead.employeeName} (${lead.reasoning}). Support: ${supportNames}.`
    : `Lead suggested based on local scoring. ${lead.reasoning}`;

  return {
    recommendedEmployeeIds: team.map((c) => c.employeeId),
    leadEmployeeId: lead.employeeId,
    reasoning,
    burnoutWarning: team.some((c) => c.burnoutWarning),
    source: "fallback",
  };
};

const requestLlm = async (
  prompt: string,
  onQueueUpdate?: (update: AiQueueUpdate) => void,
) => {
  const response = await requestAiChat(
    {
      model: LLM_MODEL,
      messages: [{ role: "user", content: prompt }],
      stream: false,
    },
    { requestTimeoutMs: 30_000, onQueueUpdate },
  );
  return readAiText(response);
};

export const recommendTeam = async (
  task: Task,
  employees: Employee[],
  employeeNotes?: EmployeeNotesMap,
  hierarchyContext?: HierarchyContext,
  onQueueUpdate?: (update: AiQueueUpdate) => void,
): Promise<LLMTeamRecommendation | null> => {
  // No employees in the department — skip LLM entirely and return null
  if (!employees || employees.length === 0) {
    console.info("[LLM] No members available in this office — skipping AI recommendation.");
    return null;
  }

  const employeesContext = buildEmployeesContext(employees, employeeNotes);
  const taskBlock = buildTaskDetailsBlock(task, hierarchyContext);

  const prompt = `You are an AI assistant helping a Head assign tasks to members using a Genetic Algorithm-like evaluation approach.\n\n${taskBlock}\n\nAvailable Members:\n${employeesContext}\n\nInstructions:\n1. Select a team of 1 to N members. You may choose as many as needed based on complexity.\n2. Use the Skills field and manager notes (strengths/weaknesses/tags) to match member capabilities to the task.\n3. Consider workload. Workload above 80 indicates burnout risk.\n4. Choose a lead candidate among the team (include them in the list).\n5. Output your response as strict JSON with no markdown.\n\nRequired JSON format:\n{\n  "recommendedEmployeeIds": ["id_1", "id_2"],\n  "reasoning": "Why this team and size were selected, plus workload assessment.",\n  "burnoutWarning": true/false\n}`;

  console.info("[LLM] Recommendation prompt:", prompt);

  for (let attempt = 1; attempt <= LLM_MAX_ATTEMPTS; attempt += 1) {
    try {
      const contentString = await requestLlm(prompt, onQueueUpdate);
      console.info("[LLM] Recommendation response:", contentString);
      const parsed = parseRecommendation(contentString, employees);
      if (parsed) return parsed;
    } catch (error) {
      console.warn(`[LLM] Attempt ${attempt} failed:`, error);
      if (isAiServiceUnavailableError(error)) throw error;
      if (attempt >= LLM_MAX_ATTEMPTS) break;
    }
  }

  console.info("[LLM] Falling back to local scoring.");
  const scored = scoreEmployees(task, employees, employeeNotes);
  return buildFallbackRecommendation(scored);
};

// ─── Bulk recommendation for multiple tasks ──────────────────────
export interface BulkRecommendationRequest {
  task: Task;
  hierarchyContext?: HierarchyContext;
}

export const recommendTeamsForTasks = async (
  requests: BulkRecommendationRequest[],
  employees: Employee[],
  employeeNotes?: EmployeeNotesMap,
  onQueueUpdate?: (update: AiQueueUpdate) => void,
): Promise<{ recommendations: Record<string, LLMTeamRecommendation>; failedTaskIds: string[] }> => {
  const recommendations: Record<string, LLMTeamRecommendation> = {};
  const failedTaskIds: string[] = [];

  for (const request of requests) {
    try {
      const result = await recommendTeam(
        request.task,
        employees,
        employeeNotes,
        request.hierarchyContext,
        onQueueUpdate,
      );
      if (result) {
        recommendations[request.task.id] = result;
      }
    } catch (error) {
      if (isAiServiceUnavailableError(error)) throw error;
      // Invalid AI output can still use the deterministic scoring fallback.
    }
  }

  for (const request of requests) {
    const taskId = request.task.id;
    if (recommendations[taskId]) continue;
    const scored = scoreEmployees(request.task, employees, employeeNotes);
    const fallback = buildFallbackRecommendation(scored);
    if (fallback) {
      recommendations[taskId] = fallback;
    } else {
      failedTaskIds.push(taskId);
    }
  }

  return { recommendations, failedTaskIds };
};
