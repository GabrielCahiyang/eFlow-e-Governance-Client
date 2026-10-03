// ─── AI Assignment Validation Scoring ────────────────────────────
// Deterministic guardrail for DeepSeek recommendations. It validates skill,
// manager-noted risks and workload; it does not decompose proposals itself.

import { Employee } from "./employeeService";
import { Task } from "./taskService";
import type { EmployeeNotesMap } from "./employeeNotesService";
import { resolveScheduleTimestamp } from "../shared/scheduling/relativeSchedule";

export interface ScoredCandidate {
  employeeId: string;
  employeeName: string;
  workloadSignal: number;
  matchedSkills: string[];
  totalScore: number;
  breakdown: {
    skillMatch: number;
    weaknessConflict: number;
    workloadAvailability: number;
    burnoutPenalty: number;
    departmentCompatibility: number;
    deadlineUrgency: number;
  };
  reasoning: string;
  burnoutWarning: boolean;
  overloadRisk: boolean;
}

// ─── Weights ─────────────────────────────────────────────────────
const WEIGHTS = {
  skillMatch: 0.55,
  workloadAvailability: 0.20,
  burnoutPenalty: 0.10,
  departmentCompatibility: 0.10,
  deadlineUrgency: 0.05,
  weaknessConflict: 0.25,
} as const;

// ─── Skill keyword extraction ────────────────────────────────────
function extractKeywords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .filter((w) => !STOP_WORDS.has(w));
}

const STOP_WORDS = new Set([
  "the", "and", "for", "with", "all", "from", "that", "this",
  "are", "was", "has", "been", "will", "can", "its", "not",
  "but", "they", "their", "our", "your", "who", "also",
  "into", "than", "then", "when", "where", "while", "through",
  "task", "tasks", "work", "project", "projects", "activity",
  "complete", "ensure", "using", "based", "relevant", "current",
]);

function keywordMatches(candidate: string, target: string): boolean {
  return candidate.includes(target) || target.includes(candidate);
}

function keywordCoverage(concept: string, employeeKeywords: string[]): number {
  const conceptKeywords = extractKeywords(concept);
  if (!conceptKeywords.length) return 0;
  const matches = conceptKeywords.filter((keyword) =>
    employeeKeywords.some((employeeKeyword) => keywordMatches(employeeKeyword, keyword)),
  ).length;
  return matches / conceptKeywords.length;
}

function taskRequiredSkills(task: Task): string[] {
  const requiredSkills = (task as unknown as Record<string, unknown>).requiredSkills;
  return Array.from(new Set([
    ...(task.tags || []),
    ...(Array.isArray(requiredSkills)
      ? requiredSkills.filter((value): value is string => typeof value === "string")
      : []),
  ].map((value) => value.trim()).filter(Boolean)));
}

// ─── Score calculation ───────────────────────────────────────────
function computeSkillMatch(
  employee: Employee,
  task: Task,
  employeeNotes?: EmployeeNotesMap,
): number {
  const requiredSkills = taskRequiredSkills(task);
  const taskText = `${task.title} ${task.description || ""} ${requiredSkills.join(" ")}`;

  const notes = employeeNotes?.[employee.id];
  const positiveNotes = notes
    ? `${notes.strengths || ""} ${notes.notes || ""} ${(notes.tags || []).join(" ")}`
    : "";

  // Weaknesses are deliberately excluded here and scored as conflicts below.
  const empText = `${employee.jobTitle} ${employee.jobDescription} ${employee.departmentName || ""} ${positiveNotes}`;

  const taskKw = extractKeywords(taskText);
  const empKwArray = extractKeywords(empText);

  if (taskKw.length === 0) return 50; // No keywords = neutral score

  const matches = taskKw.filter((kw) =>
    empKwArray.some((ek) => keywordMatches(ek, kw)),
  ).length;
  const narrativeScore = (matches / Math.max(taskKw.length, 1)) * 100;
  if (!requiredSkills.length) return Math.min(100, 15 + narrativeScore * 0.85);

  const explicitSkillScore = requiredSkills.reduce(
    (total, skill) => total + keywordCoverage(skill, empKwArray) * 100,
    0,
  ) / requiredSkills.length;

  return Math.min(100, explicitSkillScore * 0.75 + narrativeScore * 0.25);
}

function computeMatchedSkills(
  employee: Employee,
  task: Task,
  employeeNotes?: EmployeeNotesMap,
): string[] {
  const notes = employeeNotes?.[employee.id];
  const positiveText = [
    employee.jobTitle,
    employee.jobDescription,
    employee.departmentName || "",
    notes?.strengths || "",
    notes?.notes || "",
    ...(notes?.tags || []),
  ].join(" ");
  const employeeKeywords = extractKeywords(positiveText);

  return taskRequiredSkills(task).filter(
    (skill) => keywordCoverage(skill, employeeKeywords) >= 0.5,
  );
}

function computeWeaknessConflict(
  employee: Employee,
  task: Task,
  employeeNotes?: EmployeeNotesMap,
): number {
  const weaknessText = employeeNotes?.[employee.id]?.weaknesses?.trim();
  if (!weaknessText) return 0;
  const weaknessKeywords = extractKeywords(weaknessText);
  if (!weaknessKeywords.length) return 0;
  const requiredSkills = taskRequiredSkills(task);
  const taskText = `${task.title} ${task.description || ""} ${requiredSkills.join(" ")}`;
  const taskKeywords = extractKeywords(taskText);
  const narrativeMatches = taskKeywords.filter((keyword) =>
    weaknessKeywords.some((weaknessKeyword) => keywordMatches(weaknessKeyword, keyword)),
  ).length;
  const narrativeConflict = taskKeywords.length
    ? narrativeMatches / taskKeywords.length * 100
    : 0;
  const explicitConflict = requiredSkills.length
    ? requiredSkills.reduce(
        (total, skill) => total + keywordCoverage(skill, weaknessKeywords) * 100,
        0,
      ) / requiredSkills.length
    : 0;
  return Math.min(100, explicitConflict * 0.75 + narrativeConflict * 0.25);
}

function computeWorkloadAvailability(employee: Employee): number {
  // 0 workload = 100 availability, 100 workload = 0 availability
  return Math.max(0, 100 - employee.currentWorkload);
}

function computeBurnoutPenalty(employee: Employee): number {
  if (employee.currentWorkload >= 85) return 10;  // Severe penalty
  if (employee.currentWorkload >= 70) return 40;  // Moderate penalty
  if (employee.currentWorkload >= 50) return 70;  // Low penalty
  return 100; // No penalty
}

function computeDeptCompatibility(employee: Employee, task: Task): number {
  if (!task.department || !employee.department) return 50;
  return employee.department === task.department ? 100 : 30;
}

function computeDeadlineUrgency(task: Task): number {
  if (!task.deadline && !task.dueDate) return 50;
  const now = Date.now();
  const deadline = resolveScheduleTimestamp(
    task.deadline || task.dueDate,
    Number.isFinite(task.createdAt) ? task.createdAt : now,
  );
  if (deadline === null) return 50;
  const daysLeft = (deadline - now) / (1000 * 60 * 60 * 24);

  if (daysLeft < 0) return 100;  // Overdue — urgent, pick least busy
  if (daysLeft < 3) return 90;
  if (daysLeft < 7) return 70;
  if (daysLeft < 14) return 50;
  return 30; // Plenty of time
}

// ─── Main scoring function ───────────────────────────────────────
export function scoreEmployees(task: Task, employees: Employee[], employeeNotes?: EmployeeNotesMap): ScoredCandidate[] {
  const urgency = computeDeadlineUrgency(task);

  const scored = employees.map((emp): ScoredCandidate => {
    const skillMatch = computeSkillMatch(emp, task, employeeNotes);
    const matchedSkills = computeMatchedSkills(emp, task, employeeNotes);
    const weaknessConflict = computeWeaknessConflict(emp, task, employeeNotes);
    const workloadAvailability = computeWorkloadAvailability(emp);
    const burnoutPenalty = computeBurnoutPenalty(emp);
    const departmentCompatibility = computeDeptCompatibility(emp, task);
    const deadlineUrgency = urgency;

    const totalScore = Math.max(0, Math.min(100,
      skillMatch * WEIGHTS.skillMatch +
      workloadAvailability * WEIGHTS.workloadAvailability +
      burnoutPenalty * WEIGHTS.burnoutPenalty +
      departmentCompatibility * WEIGHTS.departmentCompatibility +
      deadlineUrgency * WEIGHTS.deadlineUrgency -
      weaknessConflict * WEIGHTS.weaknessConflict
    ));

    const burnoutWarning = emp.currentWorkload >= 75;
    const overloadRisk = emp.currentWorkload >= 85;

    // Generate reasoning
    const reasons: string[] = [];
    if (skillMatch > 60) reasons.push(`Strong skill match (${Math.round(skillMatch)}%)`);
    else if (skillMatch > 30) reasons.push(`Moderate skill match (${Math.round(skillMatch)}%)`);
    else reasons.push(`Low skill match (${Math.round(skillMatch)}%)`);

    if (weaknessConflict >= 20) {
      reasons.push(`Role risk found in manager-noted weaknesses (${Math.round(weaknessConflict)}%)`);
    }

    if (workloadAvailability > 60) reasons.push(`Good availability (${100 - emp.currentWorkload}% free)`);
    else reasons.push(`Limited availability (workload ${emp.currentWorkload}%)`);

    if (burnoutWarning) reasons.push(`⚠️ Burnout risk — workload at ${emp.currentWorkload}%`);
    if (departmentCompatibility > 80) reasons.push("Same office");

    return {
      employeeId: emp.id,
      employeeName: emp.name,
      workloadSignal: emp.currentWorkload,
      matchedSkills,
      totalScore: Math.round(totalScore * 10) / 10,
      breakdown: {
        skillMatch: Math.round(skillMatch),
        weaknessConflict: Math.round(weaknessConflict),
        workloadAvailability: Math.round(workloadAvailability),
        burnoutPenalty: Math.round(burnoutPenalty),
        departmentCompatibility: Math.round(departmentCompatibility),
        deadlineUrgency: Math.round(deadlineUrgency),
      },
      reasoning: reasons.join(". ") + ".",
      burnoutWarning,
      overloadRisk,
    };
  });

  // Sort by total score descending
  scored.sort((a, b) => b.totalScore - a.totalScore || a.employeeName.localeCompare(b.employeeName));
  return scored;
}

// ─── Get top recommendation ──────────────────────────────────────
export function getTopRecommendation(task: Task, employees: Employee[], employeeNotes?: EmployeeNotesMap): ScoredCandidate | null {
  const scored = scoreEmployees(task, employees, employeeNotes);
  return scored.length > 0 ? scored[0] : null;
}

// ─── Generate summary text ───────────────────────────────────────
export function generateRecommendationSummary(
  candidate: ScoredCandidate,
  allCandidates: ScoredCandidate[]
): string {
  const rank = allCandidates.findIndex((c) => c.employeeId === candidate.employeeId) + 1;
  const total = allCandidates.length;

  let summary = `${candidate.employeeName} ranks #${rank} of ${total} candidates with a fit score of ${candidate.totalScore.toFixed(1)}/100. `;
  summary += candidate.reasoning;

  if (candidate.overloadRisk) {
    summary += ` WARNING: This member is at high burnout risk.`;
    if (allCandidates.length > 1 && allCandidates[1]) {
      summary += ` Consider ${allCandidates[1].employeeName} as an alternative (score: ${allCandidates[1].totalScore.toFixed(1)}).`;
    }
  }

  return summary;
}
