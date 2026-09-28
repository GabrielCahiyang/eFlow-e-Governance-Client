import { describe, expect, it, vi } from "vitest";
import type { Employee } from "../../src/app/services/employeeService";

const { callDecompositionLLM } = vi.hoisted(() => ({
  callDecompositionLLM: vi.fn(),
}));

vi.mock(
  "../../src/app/features/proposal-import/services/decomposition/llmClient",
  () => ({ callDecompositionLLM }),
);

import { decomposeProposal } from "../../src/app/features/proposal-import/services/decomposition";

describe("server optimized proposal decomposition", () => {
  it("uses the per-section server pipeline and preserves PyGAD as the final assignment stage", async () => {
    callDecompositionLLM.mockResolvedValue(JSON.stringify({
      tasks: [{
        title: "Prepare diagnostic",
        description: "Analyze the local economy.",
        requiredSkills: ["economic analysis"],
        recommendedEmployeeIds: ["server-selected"],
        recommendationSource: "pygad",
        routingDecision: {
          department: "Local Economic Development & Investment (LEDIPO)",
          workflow: "economic_promotion",
          confidence: 0.91,
          laya_model: true,
        },
        optimizationMetadata: {
          scheduledStartDay: 0,
          scheduledEndDay: 4,
          durationDays: 4,
          budgetMultiplier: 1,
          profile: "balanced",
          pipelineStages: ["deepseek-r1:8b", "laya", "pygad"],
        },
      }],
    }));

    const employees: Employee[] = [{
      id: "local-balancer-choice",
      name: "Local Candidate",
      department: "ledipo",
      departmentName: "LEDIPO",
      jobTitle: "Analyst",
      jobDescription: "economic analysis",
      currentWorkload: 0,
    }];
    const result = await decomposeProposal(
      "Project proposal scope and methodology for economic analysis and delivery.",
      "Economic Plan",
      employees,
    );
    const task = result.programs[0].projects[0].activities[0].tasks[0];

    expect(callDecompositionLLM).toHaveBeenCalledTimes(1);
    expect(task.recommendationSource).toBe("pygad");
    expect(task.recommendedEmployeeIds).toEqual(["server-selected"]);
    expect(task.optimizationMetadata?.pipelineStages).toEqual([
      "deepseek-r1:8b",
      "laya",
      "pygad",
    ]);
  });
});
