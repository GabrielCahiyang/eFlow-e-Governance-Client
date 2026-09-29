// @vitest-environment jsdom
import { fireEvent, render, screen, within, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CollaborationWorkspaceHeader } from "../../src/app/features/interdepartment-collaboration/components/CollaborationWorkspaceHeader";
import { CollaborationActionRail } from "../../src/app/features/interdepartment-collaboration/components/CollaborationActionRail";
import { countOverdueDeliveryTasks, filterCommittedProposalBoardTasks } from "../../src/app/features/interdepartment-collaboration";
import type { Task } from "../../src/app/features/tasks";

const task = (id: string, linkedProjectId: string, title: string, deadline: string, status: Task["status"] = "todo") => ({
  id,
  linkedProjectId,
  title,
  description: "Operational delivery item",
  projectTitle: linkedProjectId,
  activityTitle: "Delivery",
  status,
  deadline,
} as Task);

describe("committed proposal delivery board", () => {
  it("selects the opened approval tab and preserves the published task label for department plans", () => {
    const common = {
      draft: { id: "selected-plan", title: "Source proposal title", status: "in_review", ownerOrgId: "org" } as any,
      snapshot: { tasks: [], organizations: [] } as any,
      participantCount: 2, openChangeCount: 0, onTabChange: vi.fn(),
    };
    const view = render(<CollaborationWorkspaceHeader {...common} tab="approvals" />);
    expect(screen.getByRole("tab", { name: "Review & Governance" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tab", { name: "Overview" }).getAttribute("aria-selected")).toBe("false");
    view.rerender(<CollaborationWorkspaceHeader {...common} draft={{ ...common.draft, status: "committed" }} tab="plan" departmentOnly />);
    expect(screen.getByRole("tab", { name: "Project tasks" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.queryByRole("tab", { name: "Delivery" })).toBeNull();
  });
  it("filters the live proposal tasks by project and search text", () => {
    const tasks = [
      task("one", "project-a", "Prepare investment brief", "2026-08-01"),
      task("two", "project-b", "Conduct field validation", "2026-09-01"),
    ];
    expect(filterCommittedProposalBoardTasks(tasks, "investment", "all").map((row) => row.id)).toEqual(["one"]);
    expect(filterCommittedProposalBoardTasks(tasks, "", "project-b").map((row) => row.id)).toEqual(["two"]);
    expect(countOverdueDeliveryTasks(tasks, new Date("2026-08-22").getTime())).toBe(1);
  });

  it("shows Board only after a proposal has been published", () => {
    const onTabChange = vi.fn();
    const commonProps = {
      draft: { id: "draft-1", title: "LEDIPO plan", sourceType: "manual", status: "committed", ownerOrgId: "org-1" } as any,
      snapshot: { tasks: [], organizations: [] } as any,
      owner: { id: "org-1", name: "LEDIPO" } as any,
      participantCount: 1,
      openChangeCount: 0,
      tab: "overview" as const,
      onTabChange,
    };
    const { rerender } = render(<CollaborationWorkspaceHeader {...commonProps} showDeliveryBoard={false} />);
    expect(screen.queryByRole("tab", { name: "Board" })).toBeNull();
    rerender(<CollaborationWorkspaceHeader {...commonProps} showDeliveryBoard />);
    fireEvent.click(screen.getByRole("tab", { name: "Board" }));
    expect(onTabChange).toHaveBeenCalledWith("board");
  });

  it("confirms publication of a department-only proposal without collaboration review controls", async () => {
    const onCommit = vi.fn(async () => undefined);
    const onRequestReview = vi.fn(async () => undefined);
    render(
      <CollaborationActionRail
        departmentOnly
        isOwner
        status="draft"
        readiness={{
          ready: true,
          requiredOrganizations: 0,
          approvedOrganizations: 0,
          openChangeRequests: 0,
          missingApprovers: 0,
          currentRevisionId: "revision-1",
          blockers: [],
        }}
        busy={false}
        hasRevision
        onRequestReview={onRequestReview}
        onCommit={onCommit}
        onDelete={vi.fn(async () => undefined)}
        ownerName="LEDIPO"
      />,
    );

    expect(screen.queryByRole("button", { name: "Request collaboration review" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Publish department proposal" }));
    expect(onCommit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Publish work plan" }));
    await waitFor(() => expect(onCommit).toHaveBeenCalledOnce());
    expect(onRequestReview).not.toHaveBeenCalled();
  });

  it("asks for confirmation before sending an inter-department review request", () => {
    const onRequestReview = vi.fn(async () => undefined);
    render(
      <CollaborationActionRail
        departmentOnly={false}
        isOwner
        status="draft"
        readiness={null}
        busy={false}
        hasRevision
        onRequestReview={onRequestReview}
        onCommit={vi.fn(async () => undefined)}
        onDelete={vi.fn(async () => undefined)}
        ownerName="LEDIPO"
      />,
    );

    fireEvent.click(screen.getByTestId("request-collaboration-review"));
    expect(onRequestReview).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toContain("Send this plan for review?");

    fireEvent.click(screen.getByTestId("confirm-request-collaboration-review"));
    expect(onRequestReview).toHaveBeenCalledOnce();
  });

  it("hides collaboration-only tabs for a department proposal", () => {
    const view = render(
      <CollaborationWorkspaceHeader
        draft={{ id: "draft-1", title: "LEDIPO plan", sourceType: "manual", status: "draft", ownerOrgId: "org-1" } as any}
        snapshot={{ tasks: [], organizations: [] } as any}
        owner={{ id: "org-1", name: "LEDIPO" } as any}
        participantCount={1}
        openChangeCount={0}
        tab="overview"
        onTabChange={vi.fn()}
        departmentOnly
      />,
    );

    expect(within(view.container).queryByRole("tab", { name: "Approval" })).toBeNull();
    expect(within(view.container).queryByRole("tab", { name: "Governance" })).toBeNull();
    expect(within(view.container).getByRole("tab", { name: "Work plan" })).toBeTruthy();
    expect(within(view.container).getByText("1 organization")).toBeTruthy();
  });
});
