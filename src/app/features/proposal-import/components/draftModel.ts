import type {
  ProposalAssignmentException,
  ProposalTeamComposition,
} from "../types";
import type { BudgetLineInput, TaskBudgetDecision } from "../../budget";

export type PdfPhase =
  | "idle"
  | "extracting"
  | "validating"
  | "saving"
  | "decomposing"
  | "review"
  | "committing"
  | "done"
  | "error";

export interface DraftTask {
  key: string;
  proposalTitle: string;
  proposalId: string;
  programIdx: number;
  projectIdx: number;
  activityIdx: number;
  taskIdx: number;
  programId: string;
  programTitle: string;
  projectId: string;
  projectTitle: string;
  activityId: string;
  activityTitle: string;
  activitySchedule: string;
  title: string;
  description: string;
  deadline: string;
  estimatedHours?: number;
  primaryOrgId?: string;
  supportingOrgIds?: string[];
  activityPrimaryOrgId?: string;
  activitySupportingOrgIds?: string[];
  priority: "low" | "medium" | "high";
  requiredSkills: string[];
  assignedMemberIds: string[];
  leadMemberId: string | null;
  burnoutWarning: boolean;
  reasoning: string;
  assignmentException?: ProposalAssignmentException;
  teamComposition?: ProposalTeamComposition;
  budgetDecision?: TaskBudgetDecision;
  budgetNoCostReason?: string;
  budgetLines?: BudgetLineInput[];
  enabled: boolean;
}

// ─── Constants & Helpers ──────────────────────────────────────────

export const priorityMeta: Record<
  string,
  { bar: string; badge: string; label: string }
> = {
  high: {
    bar: "bg-red-500",
    badge: "bg-red-100 text-red-700",
    label: "High",
  },
  medium: {
    bar: "bg-amber-400",
    badge: "bg-amber-100 text-amber-700",
    label: "Medium",
  },
  low: {
    bar: "bg-emerald-400",
    badge: "bg-emerald-100 text-emerald-700",
    label: "Low",
  },
};

export const getInitials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

export const slugifyFragment = (value: string, fallback: string) => {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return slug || fallback;
};

export const buildHierarchyIds = (
  proposalTitle: string,
  programTitle: string,
  projectTitle: string,
  activityTitle: string,
  pi: number,
  pj: number,
  ai: number,
) => {
  const proposalId = `proposal-${slugifyFragment(proposalTitle, "imported")}`;
  const programId = `${proposalId}-program-${pi + 1}-${slugifyFragment(programTitle, "program")}`;
  const projectId = `${programId}-project-${pj + 1}-${slugifyFragment(projectTitle, "project")}`;
  const activityId = `${projectId}-activity-${ai + 1}-${slugifyFragment(activityTitle, "activity")}`;
  return { proposalId, programId, projectId, activityId };
};

// ─── Main Component ───────────────────────────────────────────────
