import { describe, expect, it } from "vitest";
import {
  buildProjectFilterOptions,
  filterTasksByRecordScope,
  filterTasksByBoardView,
  filterTasksByProject,
  getTaskProjectKey,
  getTaskProjectLabel,
} from "../../src/app/features/tasks/components/board/model";
import type { Task } from "../../src/app/types";

const sampleTasks: Task[] = [
  {
    id: "task-1",
    title: "Setup solar panels",
    status: "in_progress",
    projectId: "proj-solar",
    projectTitle: "City Solar Initiative",
    createdAt: 1000,
    updatedAt: 1000,
  },
  {
    id: "task-2",
    title: "Inspect inverter wiring",
    status: "todo",
    projectId: "proj-solar",
    projectTitle: "City Solar Initiative",
    createdAt: 2000,
    updatedAt: 2000,
  },
  {
    id: "task-3",
    title: "Deploy public Wi-Fi hotspots",
    status: "todo",
    projectId: "proj-wifi",
    projectTitle: "Public Wi-Fi Mesh",
    createdAt: 3000,
    updatedAt: 3000,
  },
  {
    id: "task-4",
    title: "Roadside tree planting",
    status: "for_review",
    projectTitle: "Green Ormoc Urban Greening",
    createdAt: 4000,
    updatedAt: 4000,
  },
  {
    id: "task-5",
    title: "General administrative report",
    status: "todo",
    createdAt: 5000,
    updatedAt: 5000,
  },
];

describe("Task Board Project Filter", () => {
  it("determines correct project key and label for each task", () => {
    expect(getTaskProjectKey(sampleTasks[0])).toBe("proj-solar");
    expect(getTaskProjectLabel(sampleTasks[0])).toBe("City Solar Initiative");

    // Task with projectTitle but no projectId
    expect(getTaskProjectKey(sampleTasks[3])).toBe("title:green ormoc urban greening");
    expect(getTaskProjectLabel(sampleTasks[3])).toBe("Green Ormoc Urban Greening");

    // Task with no project
    expect(getTaskProjectKey(sampleTasks[4])).toBe("unassigned");
    expect(getTaskProjectLabel(sampleTasks[4])).toBe("Unlinked / No project");
  });

  it("builds project filter options with item counts and All projects summary", () => {
    const options = buildProjectFilterOptions(sampleTasks);

    expect(options[0]).toEqual({
      value: "all",
      label: "All projects (5)",
      count: 5,
    });

    // Check project options
    const solarOption = options.find((opt) => opt.value === "proj-solar");
    expect(solarOption).toEqual({
      value: "proj-solar",
      label: "City Solar Initiative (2)",
      count: 2,
    });

    const wifiOption = options.find((opt) => opt.value === "proj-wifi");
    expect(wifiOption).toEqual({
      value: "proj-wifi",
      label: "Public Wi-Fi Mesh (1)",
      count: 1,
    });

    const unassignedOption = options.find((opt) => opt.value === "unassigned");
    expect(unassignedOption).toEqual({
      value: "unassigned",
      label: "Unlinked / No project (1)",
      count: 1,
    });
  });

  it("filters tasks by selected project key", () => {
    // "all" returns everything
    expect(filterTasksByProject(sampleTasks, "all")).toHaveLength(5);
    expect(filterTasksByProject(sampleTasks, "")).toHaveLength(5);

    // Filter by specific project ID
    const solarTasks = filterTasksByProject(sampleTasks, "proj-solar");
    expect(solarTasks).toHaveLength(2);
    expect(solarTasks.map((t) => t.id)).toEqual(["task-1", "task-2"]);

    // Filter by project title key
    const greenTasks = filterTasksByProject(sampleTasks, "title:green ormoc urban greening");
    expect(greenTasks).toHaveLength(1);
    expect(greenTasks[0].id).toBe("task-4");

    // Filter by unassigned
    const unlinkedTasks = filterTasksByProject(sampleTasks, "unassigned");
    expect(unlinkedTasks).toHaveLength(1);
    expect(unlinkedTasks[0].id).toBe("task-5");
  });

  it("derives additive work views from real task fields", () => {
    const now = Date.parse("2026-09-10T00:00:00Z");
    const tasks = [
      { id: "mine", status: "in_progress", assigneeId: "user-1", deadline: "2026-09-12" },
      { id: "soon", status: "todo", deadline: "2026-09-16" },
      { id: "late", status: "in_progress", deadline: "2026-09-01" },
      { id: "review", status: "for_review" },
      { id: "done", status: "completed" },
    ] as Task[];

    expect(filterTasksByBoardView(tasks, "my_work", "user-1", now).map((task) => task.id)).toEqual(["mine"]);
    expect(filterTasksByBoardView(tasks, "due_soon", undefined, now).map((task) => task.id)).toEqual(["mine", "soon"]);
    expect(filterTasksByBoardView(tasks, "overdue", undefined, now).map((task) => task.id)).toEqual(["late"]);
    expect(filterTasksByBoardView(tasks, "for_review", undefined, now).map((task) => task.id)).toEqual(["review"]);
    expect(filterTasksByBoardView(tasks, "completed", undefined, now).map((task) => task.id)).toEqual(["done"]);
  });

  it("shows all current records by default while allowing an open-status filter", () => {
    const tasks = [
      { id: "open", status: "in_progress" },
      { id: "review", status: "for_review" },
      { id: "done", status: "completed" },
      { id: "cancelled", status: "cancelled" },
      { id: "archived", status: "todo", archivedAt: 1 },
    ] as Task[];

    expect(filterTasksByRecordScope(tasks, "active").map((task) => task.id)).toEqual(["open", "review", "done", "cancelled"]);
    expect(filterTasksByRecordScope(tasks, "active", "active").map((task) => task.id)).toEqual(["open", "review"]);
    expect(filterTasksByRecordScope(tasks, "active", "completed").map((task) => task.id)).toEqual(["done"]);
    expect(filterTasksByRecordScope(tasks, "active", "cancelled").map((task) => task.id)).toEqual(["cancelled"]);
    expect(filterTasksByRecordScope(tasks, "archived").map((task) => task.id)).toEqual(["archived"]);
  });
});
