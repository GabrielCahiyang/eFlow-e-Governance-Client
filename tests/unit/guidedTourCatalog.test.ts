import { describe, expect, it, vi } from "vitest";
import { getPageTourSteps, getSystemTourSteps } from "../../src/app/features/guided-tours";

describe("guided tour manifests", () => {
  it("builds a system tour only from role-visible destinations", () => {
    const navigate = vi.fn();
    const steps = getSystemTourSteps([
      { id: "tasks", label: "My Tasks", page: "My Tasks" },
      { id: "subtasks", label: "My Subtasks", page: "My Subtasks" },
    ], navigate);

    expect(steps.some((step) => step.id === "system-section-tasks")).toBe(true);
    expect(steps.some((step) => step.id === "system-section-subtasks")).toBe(true);
    expect(steps.some((step) => step.id === "system-section-users")).toBe(false);

    steps.find((step) => step.id === "system-section-tasks")?.beforeShow?.();
    expect(navigate).toHaveBeenCalledWith("tasks", "My Tasks");
  });

  it("provides a replayable page guide for every destination", () => {
    const steps = getPageTourSteps("projects", "Projects");
    expect(steps).toHaveLength(4);
    expect(steps[1].description).toContain("Groups organize tasks");
    expect(steps[1].target).toBe("[data-tour-id='project-main-table']");
    expect(steps.at(-1)?.target).toBe("[data-tour-id='page-walkthrough']");
  });
});
