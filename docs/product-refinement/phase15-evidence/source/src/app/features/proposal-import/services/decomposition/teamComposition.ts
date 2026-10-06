import type { ScoredCandidate } from "../../../../services/aiScoringEngine";
import type {
  ProposalDecompositionTask,
  ProposalTeamComposition,
} from "../../types";

const WORKSTREAM_PATTERNS: Array<[string, RegExp]> = [
  ["analysis", /\b(analy(?:sis|ze)|diagnostic|assessment|benchmark|research)\b/i],
  ["data work", /\b(data|survey|statistics|evidence|forecast)\b/i],
  ["facilitation", /\b(facilitat|workshop|meeting|consultation|discussion)\w*/i],
  ["stakeholder coordination", /\b(stakeholder|community|partner|coordination|outreach)\w*/i],
  ["documentation", /\b(document|report|draft|writing|record|minutes)\w*/i],
  ["presentation", /\b(present|plenary|briefing|visioning)\w*/i],
  ["planning", /\b(plan|strategy|roadmap|framework|timeline)\w*/i],
  ["field operations", /\b(field|site|logistics|venue|transport|equipment)\w*/i],
  ["validation", /\b(validat|review|quality|compliance|endorse|approval)\w*/i],
  ["financial work", /\b(budget|financial|cost|investment|funding)\w*/i],
  ["technical work", /\b(technical|system|engineering|implementation)\w*/i],
];

const normalizeSkill = (value: string) => value.trim().toLowerCase();

export function inferTaskWorkstreams(task: ProposalDecompositionTask): string[] {
  const text = [
    task.title,
    task.description,
    ...(task.requiredSkills || []),
    ...(task.subtasks || []),
  ].join(" ");
  return WORKSTREAM_PATTERNS
    .filter(([, pattern]) => pattern.test(text))
    .map(([name]) => name);
}

export function inferMinimumTeamSize(
  task: ProposalDecompositionTask,
  eligibleCount: number,
): number {
  if (eligibleCount <= 1) return Math.max(0, eligibleCount);
  const skillCount = new Set(
    (task.requiredSkills || []).map(normalizeSkill).filter(Boolean),
  ).size;
  const subtaskCount = task.subtasks?.length || 0;
  const workstreamCount = inferTaskWorkstreams(task).length;

  const skillDemand = skillCount >= 3 ? Math.ceil(skillCount / 2) : 1;
  const checklistDemand = subtaskCount >= 4 ? Math.ceil(subtaskCount / 3) : 1;
  const workstreamDemand = workstreamCount >= 3
    ? 2 + Math.floor((workstreamCount - 3) / 3)
    : 1;

  return Math.min(
    eligibleCount,
    Math.max(1, skillDemand, checklistDemand, workstreamDemand),
  );
}

function contributionFor(candidate: ScoredCandidate): string {
  if (candidate.matchedSkills.length) {
    return `Covers ${candidate.matchedSkills.join(", ")}`;
  }
  return `Adds a ${candidate.breakdown.skillMatch}% supporting skill fit`;
}

export function buildTeamComposition(
  task: ProposalDecompositionTask,
  team: ScoredCandidate[],
  eligibleCount: number,
): ProposalTeamComposition {
  const lead = team[0];
  const workstreams = inferTaskWorkstreams(task);
  const mode = team.length === 1 ? "solo" : "team";
  const scopeText = workstreams.length
    ? workstreams.join(", ")
    : (task.requiredSkills || []).join(", ") || "the defined work";
  const inferredMinimum = inferMinimumTeamSize(task, eligibleCount);
  const rationale = mode === "solo" && inferredMinimum > 1
    ? `${lead.employeeName} is currently the only validated assignment, although the task spans ${scopeText}. Manager review is recommended because additional available coverage could not be confirmed.`
    : mode === "solo"
    ? `${lead.employeeName} was assigned solo because one qualified person covers the essential work (${scopeText}); no additional contributor was needed.`
    : `${team.length} people were selected from ${eligibleCount} eligible office members because the task spans ${scopeText}. ${lead.employeeName} leads, with complementary contributors added only where they strengthen delivery or parallel execution.`;

  return {
    mode,
    selectedCount: team.length,
    eligibleCount,
    rationale,
    memberReasons: team.map((candidate, index) => ({
      employeeId: candidate.employeeId,
      employeeName: candidate.employeeName,
      role: index === 0 ? "lead" : "support",
      contribution: contributionFor(candidate),
    })),
  };
}
