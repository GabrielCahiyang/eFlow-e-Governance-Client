import { describe, expect, it } from "vitest";
import { groupProjectTasksForFigmaBoard } from "../../src/app/features/projects/components/project-command/ProjectWorkTab";

describe("project Figma board lifecycle grouping", () => {
  it("keeps every eFlow task lifecycle state visible in its source-aligned lane", () => {
    const tasks = [
      "pending_assignment",
      "todo",
      "changes_requested",
      "in_progress",
      "for_review",
      "completed",
      "cancelled",
    ].map((status, index) => ({ id: `${index}`, status })) as any[];

    const grouped = groupProjectTasksForFigmaBoard(tasks);

    expect(grouped.get("todo")?.map((task) => task.status)).toEqual([
      "pending_assignment",
      "todo",
    ]);
    expect(grouped.get("in_progress")?.map((task) => task.status)).toEqual(["in_progress"]);
    expect(grouped.get("changes_requested")?.map((task) => task.status)).toEqual(["changes_requested"]);
    expect(grouped.get("for_review")?.map((task) => task.status)).toEqual(["for_review"]);
    expect(grouped.get("completed")?.map((task) => task.status)).toEqual(["completed"]);
    expect(grouped.get("cancelled")?.map((task) => task.status)).toEqual(["cancelled"]);
  });
});
