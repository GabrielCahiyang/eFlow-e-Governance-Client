import type {
  ProposalDecompositionActivity,
  ProposalDecompositionProgram,
  ProposalDecompositionProject,
  ProposalDecompositionResult,
  ProposalDecompositionTask,
} from "../../types";

/** Confirms that DeepSeek returned the complete nested proposal shape. */
export const hasHierarchyContent = (result: ProposalDecompositionResult): boolean => {
  if (!result.programs || result.programs.length === 0) return false;

  return result.programs.some(
    (program) =>
      Array.isArray(program.projects) &&
      program.projects.length > 0 &&
      program.projects.some(
        (project) =>
          Array.isArray(project.activities) && project.activities.length > 0,
      ),
  );
};

/**
 * Repairs only a flat representation of the same AI response. It does not
 * manufacture proposal content or replace a failed AI decomposition.
 */
export const repairFlatStructure = (
  result: ProposalDecompositionResult,
  rawObj: Record<string, unknown>,
): ProposalDecompositionResult => {
  if (!Array.isArray(result.programs) || result.programs.length === 0) {
    return result;
  }

  result.programs.forEach((program) => {
    if (!Array.isArray(program.projects) || program.projects.length === 0) {
      const topProjects = Array.isArray(rawObj.projects) ? rawObj.projects : [];
      if (topProjects.length > 0) {
        (program as ProposalDecompositionProgram).projects =
          topProjects as ProposalDecompositionProject[];
      }
    }

    (program.projects || []).forEach((project) => {
      if (!Array.isArray(project.activities) || project.activities.length === 0) {
        const topActivities = Array.isArray(rawObj.activities)
          ? rawObj.activities
          : [];
        if (topActivities.length > 0) {
          (project as ProposalDecompositionProject).activities =
            topActivities as ProposalDecompositionActivity[];
        }
      }

      (project.activities || []).forEach((activity) => {
        if (!Array.isArray(activity.tasks) || activity.tasks.length === 0) {
          const topTasks = Array.isArray(rawObj.tasks) ? rawObj.tasks : [];
          if (topTasks.length > 0) {
            (activity as ProposalDecompositionActivity).tasks =
              topTasks as ProposalDecompositionTask[];
          }
        }
      });
    });
  });

  return result;
};
