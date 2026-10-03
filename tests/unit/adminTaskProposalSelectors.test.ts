import { describe, expect, it } from "vitest";
import { buildAdminTaskProposalGroups } from "../../src/app/features/tasks/selectors/adminTaskProposalSelectors";
import type { Task } from "../../src/app/features/tasks/taskTypes";

function task(id: string, overrides: Partial<Task> = {}): Task {
  return {
    id,
    title: `Task ${id}`,
    status: "todo",
    orgId: "org-a",
    proposalId: "proposal-1",
    proposalTitle: "City Development Proposal",
    programId: "program-1",
    programTitle: "Planning Program",
    projectId: "project-1",
    projectTitle: "Baseline Project",
    deadline: "2099-01-01",
    percentComplete: 0,
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

describe("Admin task proposal hierarchy", () => {
  it("groups tasks as proposal, program, project, then task", () => {
    const groups = buildAdminTaskProposalGroups([
      task("one", { percentComplete: 50 }),
      task("two", { status: "completed", percentComplete: 100 }),
      task("three", { projectId: "project-2", projectTitle: "Delivery Project", status: "for_review" }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      title: "City Development Proposal",
      projectCount: 2,
      taskCount: 3,
      completedCount: 1,
      reviewCount: 1,
      progress: 50,
    });
    expect(groups[0].programs[0].projects.flatMap((project) => project.tasks).map((row) => row.id)).toEqual(
      expect.arrayContaining(["one", "two", "three"]),
    );
  });

  it("does not merge the same proposal across organizations", () => {
    const groups = buildAdminTaskProposalGroups([
      task("org-a"),
      task("org-b", { orgId: "org-b" }),
    ]);
    expect(groups).toHaveLength(2);
  });

  it("keeps unlinked work visible in a standalone collection", () => {
    const groups = buildAdminTaskProposalGroups([
      task("standalone", {
        proposalId: undefined,
        proposalTitle: undefined,
        programId: undefined,
        programTitle: undefined,
        projectId: undefined,
        projectTitle: undefined,
      }),
    ]);

    expect(groups[0].title).toBe("Standalone operational work");
    expect(groups[0].programs[0].title).toBe("Uncategorized program");
    expect(groups[0].programs[0].projects[0].title).toBe("General / unlinked project");
  });
});
