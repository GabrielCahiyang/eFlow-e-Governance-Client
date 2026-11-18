// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { TeamHealthOverview } from "../../src/app/features/team-management/components/intelligence/TeamHealthOverview";
import type { TeamHealthSummary, TeamMemberMetrics } from "../../src/app/features/team-management";

afterEach(cleanup);

const health: TeamHealthSummary = {
  activeTasks: 2,
  activeSubtasks: 0,
  completedTasks: 0,
  overdue: 0,
  blocked: 0,
  stalled: 0,
  awaitingReview: 0,
  changesRequested: 0,
  vagueSchedules: 0,
  firstPassApprovalRate: null,
  averageReviewHours: null,
};

function makeMember(
  id: string,
  name: string,
  signal: number,
  activeTasks = signal > 0 ? 1 : 0,
  level: "light" | "moderate" | "high" | "very_high" | "unknown" = "light",
): TeamMemberMetrics {
  return {
    employeeId: id,
    employeeName: name,
    recordedWorkload: signal,
    workloadSignal: signal,
    workload: {
      level,
      label: level === "unknown" ? "Estimate needed" : "Light",
      pressurePercent: signal,
      signal,
      remainingHours: level === "unknown" ? 0 : activeTasks * 8,
      capacityHours: 40,
      dueHours: level === "unknown" ? 0 : activeTasks * 8,
      missingEstimates: level === "unknown" ? 1 : 0,
      missingDeadlines: 0,
      overdue: 0,
      explanation: "",
    },
    activeTasks,
    leadingTasks: activeTasks,
    activeSubtasks: 0,
    dueSoon: 0,
    overdue: 0,
    blocked: 0,
    awaitingReview: 0,
    changesRequested: 0,
    completedContributions: 0,
    firstPassApprovalRate: null,
    revisionRequests: 0,
    averageReviewHours: null,
    stale: false,
  };
}

describe("TeamHealthOverview workload concentration", () => {
  it("reports concentrated workload instead of balanced when 2 of 7 members carry 55 and others are at 0", () => {
    const members = [
      makeMember("1", "Crisostomo Ibarra", 55, 1, "unknown"),
      makeMember("2", "Gabriel Cahiyang", 55, 1, "unknown"),
      makeMember("3", "Andres Manili", 0, 0),
      makeMember("4", "Basilio Santos", 0, 0),
      makeMember("5", "Cheryl Gallo", 0, 0),
      makeMember("6", "Juan Dela Cruz", 0, 0),
      makeMember("7", "Maria Clara", 0, 0),
    ];

    render(<TeamHealthOverview health={health} members={members} />);

    expect(screen.getByText("Concentrated")).toBeTruthy();
    expect(screen.queryByText(/Workload is balanced across the team/i)).toBeNull();
    expect(screen.getByText(/Workload is concentrated on 2 of 7 members/i)).toBeTruthy();
    expect(screen.getAllByText(/1 task · Est\. needed/).length).toBe(2);

    expect(screen.queryByText("Juan Dela Cruz")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Show all 7 members" }));
    expect(screen.getByText("Juan Dela Cruz")).toBeTruthy();
    expect(screen.getByText("Maria Clara")).toBeTruthy();
  });

  it("reports balanced workload only when work is genuinely distributed across members", () => {
    const members = [
      makeMember("1", "Crisostomo Ibarra", 38, 1, "light"),
      makeMember("2", "Gabriel Cahiyang", 32, 1, "light"),
      makeMember("3", "Andres Manili", 28, 1, "light"),
    ];

    render(<TeamHealthOverview health={health} members={members} />);

    expect(screen.getByText("Balanced")).toBeTruthy();
    expect(screen.getByText(/Workload is balanced across the team \(28–38 signal\)/i)).toBeTruthy();
  });
});
