import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const mondayBoard = readFileSync("src/app/features/tasks/components/board/MondayBoard.tsx", "utf8");
const deptHeadBoard = readFileSync("src/app/features/tasks/components/HeadTaskBoardView.tsx", "utf8");
const deptHeadContent = readFileSync("src/app/features/role-head/HeadContent.tsx", "utf8");
const hierarchyBoard = readFileSync("src/app/features/tasks/components/board/HierarchyBoardView.tsx", "utf8");
const appShellCss = readFileSync("src/app/features/app-shell/eflowAppShell.css", "utf8");
const reviewInbox = readFileSync("src/app/features/reviews/components/ForReviewInbox.tsx", "utf8");
const subtaskReviewInbox = readFileSync("src/app/features/reviews/components/SubtaskReviewInbox.tsx", "utf8");

describe("Phase 04 task board presentation", () => {
  it("uses a left task context rail and addable work views", () => {
    expect(mondayBoard).toContain('aria-label="Task board context"');
    expect(mondayBoard).toContain("Project context");
    expect(mondayBoard).toContain("Add view");
    expect(mondayBoard).toContain("viewBarPinned");
    expect(mondayBoard).toContain("eflow-task-board__toolbar--pinned");
    expect(mondayBoard).toContain("eflow-task-board__view-tabs");
    expect(mondayBoard).toContain("More task board views");
    expect(mondayBoard).toContain("const overflowBoardViews = optionalBoardViews.slice(visibleOptionalViewCount);");
    expect(mondayBoard).toContain("scroller.scrollWidth > scroller.clientWidth + 1");
    expect(mondayBoard).toContain("new ResizeObserver");
    expect(mondayBoard).toContain("Workload");
    expect(mondayBoard).toContain("Calendar");
    expect(mondayBoard).toContain("Dependencies");
    expect(mondayBoard).toContain("Due soon");
    expect(mondayBoard).toContain("role=\"menu\"");
  });

  it("keeps the desktop sidebar hover from reflowing the workspace", () => {
    expect(appShellCss).toContain("flex: 0 0 68px;");
    expect(appShellCss).toContain("overflow: visible;");
    expect(appShellCss).toContain(".eflow-app-shell__desktop-navigation .eflow-productivity-sidebar:not(.eflow-productivity-sidebar--compact)");
  });

  it("visually distinguishes the pinned task-board view bar and Add view action", () => {
    expect(appShellCss).toContain(".eflow-task-board__toolbar--pinned");
    expect(appShellCss).toContain(".eflow-task-board__add-view");
  });

  it("keeps the board shell visible while primary task data is loading", () => {
    expect(deptHeadContent).not.toContain("Loading tasks and team members");
    expect(deptHeadContent).toContain("loading={isLoading}");
    expect(mondayBoard).toContain("TaskBoardLoadingSkeleton");
    expect(mondayBoard).toContain('aria-label="Loading board records"');
  });

  it("removes the repeated KPI card row from the task board header", () => {
    expect(deptHeadBoard).not.toContain("<StatCard");
    expect(deptHeadBoard).not.toContain("choose the view that best supports the next decision");
    expect(mondayBoard).not.toContain("Task workspace");
    expect(mondayBoard).toContain('label: "List"');
    expect(mondayBoard).toContain('label: "Activity history"');
    expect(mondayBoard).toContain("filterTasksByRecordScope");
  });

  it("labels the hierarchy content by the work breakdown it represents", () => {
    expect(hierarchyBoard).toContain("Work breakdown");
    expect(hierarchyBoard).toContain("Project → activity or milestone → task → subtask");
    expect(hierarchyBoard).toContain("fetchSubtasksForTasks");
  });

  it("keeps subtask reviews inside the shared review workspace shell", () => {
    expect(reviewInbox).toContain("<SubtaskReviewInbox");
    expect(reviewInbox).toContain("embedded");
    expect(subtaskReviewInbox).toContain("embedded = false");
    expect(subtaskReviewInbox).toContain('embedded ? "space-y-4" : "eflow-operational-workspace min-h-full p-4 sm:p-8"');
  });

  it("keeps the review tabs in a stable header column", () => {
    expect(reviewInbox).toContain('className="flex w-full min-w-0 flex-col items-stretch gap-2 sm:w-auto sm:items-end"');
    expect(reviewInbox).toContain('className="flex min-h-7 justify-end"');
  });
});
