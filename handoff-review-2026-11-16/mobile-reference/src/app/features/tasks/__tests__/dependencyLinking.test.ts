import { expect, jest, test } from "@jest/globals";
import {
  taskPrerequisiteSelectionError,
  buildTaskPrerequisiteOptions,
} from "../taskPrerequisites";
import type { Task } from "../../../../core/web/app/features/tasks/taskTypes";
jest.mock("../../../../core/web/app/features/project-table/selectors", () => ({
  dependencyWouldCycle: (_tasks: unknown, _task: string, ids: string[]) =>
    ids.includes("cycle"),
}));
const tasks = [
  {
    id: "a",
    title: "A",
    status: "todo",
    startDate: "2026-11-16",
    dueDate: "2026-11-20",
  },
  { id: "undated", title: "Undated A", status: "todo" },
] as Task[];
test.each(["2026-11-16", "2026-11-18", "2026-11-24"])(
  "prerequisite dates do not block linking with dependent start %s",
  (dependentStart) => {
    expect(
      taskPrerequisiteSelectionError({
        allTasks: tasks,
        visibleProjectIds: new Set(["a", "undated"]),
        taskId: "b",
        candidateIds: ["a", "undated"],
        dependentStart,
        requireDueDates: true,
      }),
    ).toBe("");
    const options = buildTaskPrerequisiteOptions({
      choices: tasks,
      allTasks: tasks,
      selectedIds: [],
      dependentStart,
      requireScheduledIncomplete: true,
    });
    expect(options.every((option) => !option.disabled)).toBe(true);
    expect(
      options.every(
        (option) =>
          !/(before linking|due after selected|schedule.*first)/i.test(
            option.description || "",
          ),
      ),
    ).toBe(true);
  },
);
test("scope, self, duplicate and cycle errors survive removing schedule coupling", () => {
  const base = {
    allTasks: [
      ...tasks,
      { id: "cycle", title: "Cycle", status: "todo" } as Task,
    ],
    taskId: "b",
  };
  expect(
    taskPrerequisiteSelectionError({ ...base, candidateIds: ["a", "a"] }),
  ).toMatch(/once/);
  expect(
    taskPrerequisiteSelectionError({ ...base, candidateIds: ["b"] }),
  ).toMatch(/itself/);
  expect(
    taskPrerequisiteSelectionError({ ...base, candidateIds: ["missing"] }),
  ).toMatch(/available/);
  expect(
    taskPrerequisiteSelectionError({ ...base, candidateIds: ["cycle"] }),
  ).toMatch(/circular/);
  expect(
    taskPrerequisiteSelectionError({
      ...base,
      candidateIds: ["a"],
      visibleProjectIds: new Set(),
    }),
  ).toMatch(/available/);
});
