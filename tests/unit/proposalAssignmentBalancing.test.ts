import { describe, expect, it } from "vitest";
import type { Employee } from "../../src/app/services/employeeService";
import type { EmployeeNotesMap } from "../../src/app/services/employeeNotesService";
import type { Task } from "../../src/app/services/taskService";
import { scoreEmployees } from "../../src/app/services/aiScoringEngine";
import { applyBalancedProposalAssignments } from "../../src/app/features/proposal-import/services/decomposition/assignmentBalancer";
import { withTeamIntelligenceCandidateWorkload } from "../../src/app/features/proposal-import/selectors/candidateWorkload";
import type { ProposalDecompositionResult } from "../../src/app/features/proposal-import/types";
import type { TeamMemberMetrics } from "../../src/app/features/team-management";

const employee = (id: string, name: string, skills: string, workload = 0): Employee => ({
  id,
  name,
  jobTitle: "Member",
  jobDescription: skills,
  currentWorkload: workload,
  department: "ledipo",
  departmentName: "LEDIPO",
});

const note = (employeeId: string, strengths: string, weaknesses = "") => ({
  employeeId,
  strengths,
  weaknesses,
  notes: "",
  tags: strengths.toLowerCase().split(/,\s*/),
  updatedAt: 0,
});

const employees = [
  employee("cheryl", "Cheryl", "Strategic planning, Public relations, Policy analysis"),
  employee("juan", "Juan", "Data analysis, Economic forecasting, Report writing"),
  employee("maria", "Maria", "Public relations, Event management, Stakeholder outreach"),
  employee("cris", "Crisostomo", "Technical writing, Milestone tracking, Regulatory compliance"),
];

const notes: EmployeeNotesMap = {
  cheryl: note("cheryl", "Investor relations, strategic planning", "Impatient with iterative documentation revisions"),
  juan: note("juan", "Quantitative data modeling, economic analysis", "Needs assistance with live presentations"),
  maria: note("maria", "Community outreach, public relations, event facilitation", "Less comfortable with econometric models"),
  cris: note("cris", "Technical documentation, milestone tracking", "Slow during rapid crisis response"),
};

function proposalTasks(tasks: ProposalDecompositionResult["programs"][number]["projects"][number]["activities"][number]["tasks"]): ProposalDecompositionResult {
  return {
    programs: [{
      title: "Program",
      description: "",
      projects: [{
        title: "Project",
        description: "",
        activities: [{ title: "Activity", description: "", tasks }],
      }],
    }],
  };
}

describe("proposal AI assignment validation", () => {
  it("treats weakness matches as risks instead of positive skills", () => {
    const task = {
      id: "presentation",
      title: "Deliver stakeholder presentation",
      description: "Facilitate a live presentation and collect stakeholder feedback.",
      status: "pending_assignment",
      tags: ["presentation", "facilitation"],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    } as Task;
    const scored = scoreEmployees(task, employees, notes);
    expect(scored.find((candidate) => candidate.employeeId === "juan")?.breakdown.weaknessConflict).toBeGreaterThan(0);
    expect(scored.findIndex((candidate) => candidate.employeeId === "maria"))
      .toBeLessThan(scored.findIndex((candidate) => candidate.employeeId === "juan"));
  });

  it("overrides a repeated raw pick when better task specialists exist", () => {
    const result = proposalTasks([
      { title: "Investor strategy", description: "Set strategic investment direction", requiredSkills: ["strategic planning"], recommendedEmployeeIds: ["cheryl"] },
      { title: "Economic diagnostic", description: "Analyze economic datasets and trends", requiredSkills: ["data analysis", "economic forecasting"], recommendedEmployeeIds: ["cheryl"] },
      { title: "Stakeholder workshop", description: "Facilitate public stakeholder outreach", requiredSkills: ["public relations", "event management"], recommendedEmployeeIds: ["cheryl"] },
      { title: "Technical plan", description: "Write and track the formal implementation plan", requiredSkills: ["technical writing", "milestone tracking"], recommendedEmployeeIds: ["cheryl"] },
    ]);

    applyBalancedProposalAssignments(result, employees, notes);
    const tasks = result.programs[0].projects[0].activities[0].tasks;
    expect(tasks[0].recommendedEmployeeIds?.[0]).toBe("cheryl");
    expect(tasks[1].recommendedEmployeeIds?.[0]).toBe("juan");
    expect(tasks[2].recommendedEmployeeIds?.[0]).toBe("maria");
    expect(tasks[3].recommendedEmployeeIds?.[0]).toBe("cris");
  });

  it("feeds the Team Intelligence workload signal into AI scoring", () => {
    const metrics = [
      { employeeId: "cheryl", workloadSignal: 72 },
      { employeeId: "maria", workloadSignal: 18 },
    ] as TeamMemberMetrics[];
    const adjusted = withTeamIntelligenceCandidateWorkload(employees, metrics);
    expect(adjusted.find((candidate) => candidate.id === "cheryl")?.currentWorkload).toBe(72);
    expect(adjusted.find((candidate) => candidate.id === "maria")?.currentWorkload).toBe(18);
  });

  it("records why an overloaded best-fit candidate was bypassed", () => {
    const capacityAwareEmployees = withTeamIntelligenceCandidateWorkload([
      employee("cheryl", "Cheryl", "Strategic planning, investment strategy"),
      employee("gabriel", "Gabriel", "Strategic planning, investment strategy, policy research"),
    ], [
      { employeeId: "cheryl", workloadSignal: 72 },
      { employeeId: "gabriel", workloadSignal: 21 },
    ] as TeamMemberMetrics[]);
    const result = proposalTasks([{
      title: "Prepare investment strategy",
      description: "Develop the strategic investment direction.",
      requiredSkills: ["strategic planning", "investment strategy"],
      recommendedEmployeeIds: ["cheryl"],
    }]);

    applyBalancedProposalAssignments(result, capacityAwareEmployees);
    const task = result.programs[0].projects[0].activities[0].tasks[0];
    expect(task.recommendedEmployeeIds?.[0]).toBe("gabriel");
    expect(task.assignmentException).toMatchObject({
      bypassedEmployeeId: "cheryl",
      selectedEmployeeId: "gabriel",
      bypassedWorkloadSignal: 72,
      selectedWorkloadSignal: 21,
      severity: "elevated",
    });
    expect(task.assignmentException?.message).toContain("Team Intelligence");
  });

  it("expands a one-person AI response when complementary specialists are needed", () => {
    const result = proposalTasks([{
      title: "Deliver integrated strategy workshop",
      description: "Analyze data, facilitate stakeholders, document findings, and validate the strategic plan.",
      requiredSkills: [
        "strategic planning",
        "data analysis",
        "public relations",
        "technical writing",
      ],
      subtasks: [
        "Prepare data",
        "Design workshop",
        "Coordinate participants",
        "Facilitate session",
        "Document outputs",
        "Validate recommendations",
      ],
      recommendedEmployeeIds: ["cheryl"],
    }]);

    applyBalancedProposalAssignments(result, employees, notes);
    const task = result.programs[0].projects[0].activities[0].tasks[0];
    expect(task.recommendedEmployeeIds).toHaveLength(3);
    expect(new Set(task.recommendedEmployeeIds)).toEqual(
      new Set(["cheryl", "juan", "cris"]),
    );
    expect(task.teamComposition?.mode).toBe("team");
    expect(task.teamComposition?.memberReasons).toHaveLength(3);
  });

  it("keeps a task solo when one person sufficiently covers its narrow scope", () => {
    const result = proposalTasks([{
      title: "Update the economic forecast",
      description: "Update one forecast calculation using the approved dataset.",
      requiredSkills: ["economic forecasting"],
      subtasks: ["Update calculation", "Check result"],
      recommendedEmployeeIds: ["juan"],
    }]);

    applyBalancedProposalAssignments(result, employees, notes);
    const task = result.programs[0].projects[0].activities[0].tasks[0];
    expect(task.recommendedEmployeeIds).toEqual(["juan"]);
    expect(task.teamComposition?.mode).toBe("solo");
    expect(task.teamComposition?.rationale).toContain("assigned solo");
  });

  it("does not cap a valid AI team at three members", () => {
    const result = proposalTasks([{
      title: "Office-wide planning session",
      description: "Coordinate the full office planning and validation session.",
      requiredSkills: ["strategic planning"],
      recommendedEmployeeIds: ["cheryl", "juan", "maria", "cris"],
    }]);

    applyBalancedProposalAssignments(result, employees, notes);
    const task = result.programs[0].projects[0].activities[0].tasks[0];
    expect(task.recommendedEmployeeIds).toHaveLength(4);
    expect(task.teamComposition?.selectedCount).toBe(4);
    expect(task.teamComposition?.eligibleCount).toBe(4);
  });
});
