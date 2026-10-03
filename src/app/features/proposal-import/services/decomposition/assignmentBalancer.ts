import type { Employee } from "../../../../services/employeeService";
import type { EmployeeNotesMap } from "../../../../services/employeeNotesService";
import { scoreEmployees, type ScoredCandidate } from "../../../../services/aiScoringEngine";
import type { Task } from "../../../../services/taskService";
import type { ProposalDecompositionResult, ProposalDecompositionTask } from "../../types";
import type { ProposalAssignmentException } from "../../types";
import {
  getTeamWorkloadBand,
  TEAM_WORKLOAD_ELEVATED_THRESHOLD,
} from "../../../team-management";
import { getRecommendedValues, mapNamesToIds } from "./recommendations";
import {
  buildTeamComposition,
  inferMinimumTeamSize,
} from "./teamComposition";
import type { ProposalTeamComposition } from "../../types";

const LEAD_REPEAT_PENALTY = 14;
const TEAM_REPEAT_PENALTY = 4;
const AI_SUGGESTION_BONUS = 3;
const MAX_ACCEPTABLE_SKILL_GAP = 22;

function taskForScoring(task: ProposalDecompositionTask): Task {
  const now = Date.now();
  return {
    id: "proposal-draft",
    title: task.title,
    description: task.description,
    status: "pending_assignment",
    tags: task.requiredSkills || [],
    createdAt: now,
    updatedAt: now,
  };
}

function strongestSkillCandidate(
  scored: ScoredCandidate[],
  rawIds: Set<string> = new Set(),
): ScoredCandidate | undefined {
  return [...scored].sort((first, second) =>
    (second.breakdown.skillMatch - second.breakdown.weaknessConflict)
      - (first.breakdown.skillMatch - first.breakdown.weaknessConflict)
    || second.breakdown.skillMatch - first.breakdown.skillMatch
    || Number(rawIds.has(second.employeeId)) - Number(rawIds.has(first.employeeId))
    || first.employeeName.localeCompare(second.employeeName),
  )[0];
}

function candidatePool(
  scored: ScoredCandidate[],
  rawIds: Set<string>,
): ScoredCandidate[] {
  if (!scored.length) return [];
  const strongest = strongestSkillCandidate(scored, rawIds) || scored[0];
  const skillFloor = Math.max(20, strongest.breakdown.skillMatch - MAX_ACCEPTABLE_SKILL_GAP);
  const qualified = scored.filter((candidate) =>
    candidate.breakdown.skillMatch >= skillFloor && !candidate.overloadRisk,
  );
  const availableQualified = qualified.filter(
    (candidate) => candidate.workloadSignal < TEAM_WORKLOAD_ELEVATED_THRESHOLD,
  );
  if (
    strongest.workloadSignal >= TEAM_WORKLOAD_ELEVATED_THRESHOLD
    && availableQualified.length
  ) {
    return availableQualified;
  }
  if (qualified.length) return qualified;
  return scored.filter((candidate) => !candidate.overloadRisk).length
    ? scored.filter((candidate) => !candidate.overloadRisk)
    : scored;
}

function adjustedLeadScore(
  candidate: ScoredCandidate,
  rawIds: Set<string>,
  leadCounts: Map<string, number>,
  memberCounts: Map<string, number>,
): number {
  return candidate.totalScore
    + (rawIds.has(candidate.employeeId) ? AI_SUGGESTION_BONUS : 0)
    - (leadCounts.get(candidate.employeeId) || 0) * LEAD_REPEAT_PENALTY
    - (memberCounts.get(candidate.employeeId) || 0) * TEAM_REPEAT_PENALTY;
}

function adjustedSupportScore(
  candidate: ScoredCandidate,
  rawIds: Set<string>,
  leadCounts: Map<string, number>,
  memberCounts: Map<string, number>,
): number {
  return candidate.totalScore
    + (rawIds.has(candidate.employeeId) ? AI_SUGGESTION_BONUS : 0)
    - (memberCounts.get(candidate.employeeId) || 0) * TEAM_REPEAT_PENALTY
    - (leadCounts.get(candidate.employeeId) || 0) * 2;
}

function assignmentReasoning(
  lead: ScoredCandidate,
  support: ScoredCandidate[],
  priorLeadCount: number,
  composition: ProposalTeamComposition,
  exception?: ProposalAssignmentException,
): string {
  const supportText = support.length
    ? ` Support: ${support.map((candidate) => {
      const skills = candidate.matchedSkills.length
        ? ` (${candidate.matchedSkills.join(", ")})`
        : "";
      return `${candidate.employeeName}${skills}`;
    }).join(", ")}.`
    : " Solo assignment confirmed.";
  const balanceText = priorLeadCount > 0
    ? " Proposal-wide assignment balance was applied because this person already leads other work in the draft."
    : " Proposal-wide workload and assignment balance were checked.";
  const exceptionText = exception ? ` ${exception.message}` : "";
  return `Validated AI assignment. ${composition.rationale} Lead fit: ${lead.reasoning}${supportText}${balanceText}${exceptionText}`;
}

function selectSupportMembers({
  task,
  lead,
  scored,
  rawIds,
  leadCounts,
  memberCounts,
}: {
  task: ProposalDecompositionTask;
  lead: ScoredCandidate;
  scored: ScoredCandidate[];
  rawIds: Set<string>;
  leadCounts: Map<string, number>;
  memberCounts: Map<string, number>;
}): ScoredCandidate[] {
  const ordered = scored
    .filter((candidate) => candidate.employeeId !== lead.employeeId)
    .filter((candidate) => !candidate.overloadRisk)
    .sort((first, second) =>
      adjustedSupportScore(second, rawIds, leadCounts, memberCounts)
      - adjustedSupportScore(first, rawIds, leadCounts, memberCounts)
      || second.matchedSkills.length - first.matchedSkills.length
      || second.totalScore - first.totalScore
      || first.employeeName.localeCompare(second.employeeName),
    );
  const selected: ScoredCandidate[] = [];
  const selectedIds = new Set([lead.employeeId]);
  const requiredSkills = new Set(
    (task.requiredSkills || []).map((skill) => skill.trim().toLowerCase()).filter(Boolean),
  );
  const coveredSkills = new Set(
    lead.matchedSkills.map((skill) => skill.trim().toLowerCase()),
  );
  const add = (candidate: ScoredCandidate) => {
    if (selectedIds.has(candidate.employeeId)) return;
    selected.push(candidate);
    selectedIds.add(candidate.employeeId);
    candidate.matchedSkills.forEach((skill) => coveredSkills.add(skill.trim().toLowerCase()));
  };

  // DeepSeek may request any number of contributors. Keep every valid request;
  // there is deliberately no team-size ceiling.
  ordered
    .filter((candidate) => rawIds.has(candidate.employeeId))
    .forEach(add);

  // Add specialists that cover required skills not represented by the current
  // team, even when DeepSeek returned only a single ID.
  while (true) {
    const uncovered = new Set(
      [...requiredSkills].filter((skill) => !coveredSkills.has(skill)),
    );
    if (!uncovered.size) break;
    const next = ordered
      .filter((candidate) => !selectedIds.has(candidate.employeeId))
      .map((candidate) => ({
        candidate,
        gain: candidate.matchedSkills.filter((skill) =>
          uncovered.has(skill.trim().toLowerCase()),
        ).length,
      }))
      .sort((first, second) => second.gain - first.gain)[0];
    if (!next || next.gain === 0) break;
    add(next.candidate);
  }

  const minimumTeamSize = inferMinimumTeamSize(task, scored.length);
  for (const candidate of ordered) {
    if (selected.length + 1 >= minimumTeamSize) break;
    add(candidate);
  }

  return selected;
}

function buildAssignmentException(
  strongest: ScoredCandidate | undefined,
  selected: ScoredCandidate,
): ProposalAssignmentException | undefined {
  if (
    !strongest
    || strongest.employeeId === selected.employeeId
    || strongest.workloadSignal < TEAM_WORKLOAD_ELEVATED_THRESHOLD
    || selected.breakdown.skillMatch < strongest.breakdown.skillMatch - MAX_ACCEPTABLE_SKILL_GAP
  ) {
    return undefined;
  }

  const band = getTeamWorkloadBand(strongest.workloadSignal);
  if (band === "available") return undefined;
  const severity = band === "high" ? "high" : "elevated";
  const loadReason = severity === "high"
    ? "a high workload and burnout-risk signal"
    : "an elevated workload signal";
  const message = `${strongest.employeeName} is the strongest skill match (${strongest.breakdown.skillMatch}%), but Team Intelligence reports ${loadReason} of ${strongest.workloadSignal}/100. ${selected.employeeName} was assigned as the closest qualified alternative (${selected.breakdown.skillMatch}% skill match, ${selected.workloadSignal}/100 workload signal).`;

  return {
    bypassedEmployeeId: strongest.employeeId,
    bypassedEmployeeName: strongest.employeeName,
    selectedEmployeeId: selected.employeeId,
    selectedEmployeeName: selected.employeeName,
    bypassedWorkloadSignal: strongest.workloadSignal,
    selectedWorkloadSignal: selected.workloadSignal,
    bypassedSkillMatch: strongest.breakdown.skillMatch,
    selectedSkillMatch: selected.breakdown.skillMatch,
    severity,
    message,
  };
}

/**
 * Validates every DeepSeek recommendation against the live employee directory,
 * manager strengths/weaknesses and workload. It then balances leadership over
 * the complete proposal without imposing an equal-assignment quota.
 */
export function applyBalancedProposalAssignments(
  result: ProposalDecompositionResult,
  employees?: Employee[],
  employeeNotes?: EmployeeNotesMap,
): ProposalDecompositionResult {
  if (!employees?.length) return result;

  const leadCounts = new Map<string, number>();
  const memberCounts = new Map<string, number>();

  result.programs.forEach((program) => {
    program.projects.forEach((project) => {
      project.activities.forEach((activity) => {
        activity.tasks.forEach((task) => {
          const scored = scoreEmployees(taskForScoring(task), employees, employeeNotes);
          const rawIds = mapNamesToIds(getRecommendedValues(task), employees);
          const rawIdSet = new Set(rawIds);
          const pool = candidatePool(scored, rawIdSet);
          if (!pool.length) {
            task.recommendedEmployeeIds = [];
            task.recommendationReasoning = "No eligible office member matched this task.";
            return;
          }

          const lead = [...pool].sort((first, second) =>
            adjustedLeadScore(second, rawIdSet, leadCounts, memberCounts)
            - adjustedLeadScore(first, rawIdSet, leadCounts, memberCounts)
            || second.totalScore - first.totalScore
            || first.employeeName.localeCompare(second.employeeName),
          )[0];

          const support = selectSupportMembers({
            task,
            lead,
            scored,
            rawIds: rawIdSet,
            leadCounts,
            memberCounts,
          });

          const priorLeadCount = leadCounts.get(lead.employeeId) || 0;
          const team = [lead, ...support];
          const teamComposition = buildTeamComposition(task, team, scored.length);
          const assignmentException = buildAssignmentException(
            strongestSkillCandidate(scored, rawIdSet),
            lead,
          );
          task.recommendedEmployeeIds = team.map((candidate) => candidate.employeeId);
          task.assignmentException = assignmentException;
          task.teamComposition = teamComposition;
          task.recommendationReasoning = assignmentReasoning(
            lead,
            support,
            priorLeadCount,
            teamComposition,
            assignmentException,
          );
          task.burnoutWarning = team.some((candidate) => candidate.burnoutWarning);
          task.recommendationSource = rawIds.length ? "llm" : "fallback";

          leadCounts.set(lead.employeeId, priorLeadCount + 1);
          team.forEach((candidate) => {
            memberCounts.set(candidate.employeeId, (memberCounts.get(candidate.employeeId) || 0) + 1);
          });
        });
      });
    });
  });

  return result;
}
