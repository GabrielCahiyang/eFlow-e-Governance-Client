import { describe, expect, it } from "vitest";
import {
  addManualActivity,
  addManualProgram,
  addManualProject,
  addManualTask,
  renameManualPlan,
  renameManualProgram,
  renameManualProject,
  updateManualActivity,
} from "../../src/app/features/proposal-import/services/manualPlanDraft";
import { validateManualPlanDraft } from "../../src/app/features/proposal-import/services/manualPlanValidation";

describe("manual work-plan draft hierarchy", () => {
  it("supports multiple projects within one program and tasks within an activity", () => {
    let tasks = addManualProgram([], "Annual Development Plan");
    tasks = addManualProject(tasks, 0);
    tasks = addManualActivity(tasks, 0, 1);
    tasks = addManualTask(tasks, 0, 1, 1);

    expect(tasks).toHaveLength(4);
    expect(tasks.filter((task) => task.programIdx === 0 && task.projectIdx === 1 && task.activityIdx === 1)).toHaveLength(2);
    expect(tasks.map((task) => task.projectIdx)).toEqual([0, 1, 1, 1]);
  });

  it("keeps hierarchy identifiers aligned when manual levels are renamed", () => {
    let tasks = addManualProgram([], "Annual Development Plan");
    tasks = addManualProject(tasks, 0);
    tasks = renameManualPlan(tasks, "Updated Development Plan");
    tasks = renameManualProgram(tasks, 0, "Infrastructure Program");
    tasks = renameManualProject(tasks, 0, 1, "Road Rehabilitation");
    tasks = updateManualActivity(tasks, 0, 1, 0, {
      activityTitle: "Site assessment",
      activitySchedule: "2026-10-01",
    });

    const updated = tasks.find((task) => task.projectIdx === 1)!;
    expect(updated).toMatchObject({
      proposalTitle: "Updated Development Plan",
      programTitle: "Infrastructure Program",
      projectTitle: "Road Rehabilitation",
      activityTitle: "Site assessment",
      activitySchedule: "2026-10-01",
    });
    expect(updated.activityId).toContain("site-assessment");
    expect(updated.projectId).toContain("road-rehabilitation");
  });

  it("reports the exact fields that prevent an incomplete plan from being created", () => {
    const tasks = addManualProgram([], "Annual Development Plan");

    const issues = validateManualPlanDraft({
      planTitle: "Annual Development Plan",
      planDescription: "",
      tasks,
    });

    expect(issues.map((issue) => issue.message)).toEqual(expect.arrayContaining([
      "Plan description is required.",
      "Task description is required.",
      "Due date is required.",
    ]));
  });
});
