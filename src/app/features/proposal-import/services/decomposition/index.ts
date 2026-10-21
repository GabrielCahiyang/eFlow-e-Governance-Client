import type { Employee } from "../../../../services/employeeService";
import type { EmployeeNotesMap } from "../../../../services/employeeNotesService";
import type { AiQueueUpdate } from "../../../ai";
import type { ProposalDecompositionResult } from "../../types";
import { decomposeProposalByPart } from "./partDecomposition";
import { applyBalancedProposalAssignments } from "./assignmentBalancer";
import { reconcileProposalSourceBudget } from './budgetReconciliation';
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
): Promise<ProposalDecompositionResult> {
  // Fail before inference when the source table itself does not reconcile.
  readSourceBudget(proposalText);
  const result = await decomposeProposalByPart(
    proposalText,
    extractProposalTitle(proposalText, proposalTitle),
    employees,
    employeeNotes,
    onProgress,
    onQueueUpdate,
  );
  const tasks = result.programs.flatMap((program) =>
    program.projects.flatMap((project) =>
      project.activities.flatMap((activity) => activity.tasks),
    ),
  );
  const serverOptimized = tasks.length > 0
    && tasks.every((task) => task.recommendationSource === "pygad");
  const reviewed = serverOptimized
    ? result
    : applyBalancedProposalAssignments(result, employees, employeeNotes);
  await reconcileProposalSourceBudget(reviewed, proposalText, onQueueUpdate);
  return reviewed;
}
