export interface ProposalAssignmentException {
  bypassedEmployeeId: string;
  bypassedEmployeeName: string;
  selectedEmployeeId: string;
  selectedEmployeeName: string;
  bypassedWorkloadSignal: number;
  selectedWorkloadSignal: number;
  bypassedSkillMatch: number;
  selectedSkillMatch: number;
  severity: "elevated" | "high";
  message: string;
}

export interface ProposalTeamMemberReason {
  employeeId: string;
  employeeName: string;
  role: "lead" | "support";
  contribution: string;
}

export interface ProposalTeamComposition {
  mode: "solo" | "team";
  selectedCount: number;
  eligibleCount: number;
  rationale: string;
  memberReasons: ProposalTeamMemberReason[];
}

export interface ProposalDecompositionBudgetLine {
  expenseClass: string;
  category: string;
  particular: string;
  quantity?: number;
  unit?: string;
  unitCost?: number;
  amount: number;
  fundSource?: string;
}

export interface ProposalDecompositionTask {
  title: string;
  description: string;
  estimatedDuration?: string;
  requiredSkills?: string[];
  priority?: "low" | "medium" | "high";
  recommendedEmployeeIds?: string[];
  recommendationReasoning?: string;
  burnoutWarning?: boolean;
  subtasks?: string[];
  recommendationSource?: "llm" | "laya" | "pygad" | "fallback" | "import";
  routingDecision?: {
    department: string;
    workflow: string;
    confidence: number;
    laya_model: boolean;
    requires_manual_review?: boolean;
  };
  clearanceDecision?: {
    requiresBAC: boolean;
    requiresCashAdvance: boolean;
    approvalTier: string;
    badge: string;
    reason: string;
    confidence: number;
  };
  decisionLayer?: {
    engine: "laya" | "heuristic_fallback";
    requiresManualReview: boolean;
  };
  optimizationMetadata?: {
    scheduledStartDay: number;
    scheduledEndDay: number;
    durationDays: number;
    budgetMultiplier: number;
    profile: string;
    pipelineStages: string[];
  };
  assignmentException?: ProposalAssignmentException;
  teamComposition?: ProposalTeamComposition;
  budgetDecision?: "missing" | "funded" | "no_cost";
  budgetNoCostReason?: string;
  budgetLines?: ProposalDecompositionBudgetLine[];
}

export interface ProposalDecompositionActivity {
  title: string;
  description: string;
  schedule?: string;
  methodology?: string[];
  tasks: ProposalDecompositionTask[];
}

export interface ProposalDecompositionProject {
  title: string;
  description: string;
  activities: ProposalDecompositionActivity[];
}

export interface ProposalDecompositionProgram {
  title: string;
  description: string;
  projects: ProposalDecompositionProject[];
}

export interface ProposalDecompositionResult {
  proposal?: { title: string; description: string };
  programs: ProposalDecompositionProgram[];
}
