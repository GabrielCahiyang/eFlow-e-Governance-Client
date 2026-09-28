import { describe, expect, it } from "vitest";
import {
  buildLeaderTaskScopeOptions,
  getLeaderTaskScopeOption,
} from "../../src/app/features/tasks/selectors/leaderWorkspace";
import type { Task } from "../../src/app/features/tasks/taskTypes";

function task(overrides: Partial<Task>): Task {
  return {
    id: String(overrides.id || "task"),
    title: "Task",
    status: "todo",
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

describe("leader workspace hierarchy filter", () => {
  it("lists every exact project and activity combination after the all option", () => {
    const options = buildLeaderTaskScopeOptions([
      task({ id: "a", projectId: "project-2", projectTitle: "Project 2", activityId: "activity-1", activityTitle: "Activity 1" }),
      task({ id: "b", projectId: "project-1", projectTitle: "Project 1", activityId: "activity-2", activityTitle: "Activity 2" }),
      task({ id: "c", projectId: "project-1", projectTitle: "Project 1", activityId: "activity-2", activityTitle: "Activity 2" }),
    ]);

    expect(options.map((option) => option.label)).toEqual([
      "All Projects / Activities",
      "Project 1 · Activity 2",
      "Project 2 · Activity 1",
    ]);
  });

  it("supports legacy leading tasks that only carry a project title", () => {
    expect(getLeaderTaskScopeOption(task({ projectTitle: "Project 1" }))).toMatchObject({
      label: "Project 1",
    });
  });
});
