import type { Employee } from "../../../../services/employeeService";
import type { EmployeeNotesMap } from "../../../../services/employeeNotesService";
import type { AiQueueUpdate } from "../../../ai";
import type { ProposalDecompositionResult, ProposalImportOptions } from "../../types";
import { decomposeProposalByPart } from "./partDecomposition";
import { applyBalancedProposalAssignments } from "./assignmentBalancer";
import { readSourceBudget } from '../sourceBudget';
import { extractProposalTitle } from './textAnalysis';

export type {
  ProposalDecompositionActivity,
  ProposalDecompositionProgram,
  ProposalDecompositionProject,
  ProposalDecompositionResult,
  ProposalDecompositionTask,
} from "../../types";

export async function decomposeProposal(
  proposalText: string,
  proposalTitle: string,
  employees?: Employee[],
  employeeNotes?: EmployeeNotesMap,
  onProgress?: (current: number, total: number, partTitle: string) => void,
  onQueueUpdate?: (update: AiQueueUpdate) => void,
  options?: ProposalImportOptions,
): Promise<ProposalDecompositionResult> {
  const title = extractProposalTitle(proposalText, proposalTitle);
  if (options?.addTasks === false) {
    return { proposal: { title, description: proposalText.substring(0, 200) }, programs: [] };
  }
  // Fail before inference when the source table itself does not reconcile.
  const budget = options?.addBudget === false ? null : readSourceBudget(proposalText);
  const candidates = options?.assignPeople === false ? undefined : employees;
  const result = await decomposeProposalByPart(
    proposalText,
    title,
    candidates,
    options?.assignPeople === false ? undefined : employeeNotes,
    onProgress,
    onQueueUpdate,
    options,
    budget,
  );
  const tasks = result.programs.flatMap((program) =>
    program.projects.flatMap((project) =>
      project.activities.flatMap((activity) => activity.tasks),
    ),
  );
  for (const task of tasks) {
    if (options?.addBudget === false) {
      task.budgetLines = [];
      task.budgetDecision = 'missing';
      task.budgetNoCostReason = undefined;
    }
    if (options?.assignPeople === false) {
      task.recommendedEmployeeIds = [];
      task.recommendationSource = undefined;
      task.recommendationReasoning = undefined;
      task.burnoutWarning = undefined;
      task.assignmentException = undefined;
      task.teamComposition = undefined;
    }
  }
  const serverOptimized = tasks.length > 0
    && tasks.every((task) => task.recommendationSource === "pygad");
  return serverOptimized || options?.assignPeople === false
    ? result
    : applyBalancedProposalAssignments(result, candidates, employeeNotes);
}
