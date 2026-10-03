import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");
const reviews = read("src/app/features/reviews/components/ForReviewInbox.tsx");
const financialReviews = read("src/app/features/budget/components/BudgetReviewInbox.tsx");
const budget = read("src/app/features/budget/components/OfficeBudgetWorkspace.tsx");
const budgetPosition = read("src/app/features/budget/components/BudgetPositionSummary.tsx");
const projectWorkspace = read("src/app/features/projects/components/project-command/ProjectCommandWorkspace.tsx");

describe("remaining phase presentation contracts", () => {
  it("keeps all review categories inside one shell and restores the URL view", () => {
    expect(reviews).toContain('url.pathname = "/reviews"');
    expect(reviews).toContain('url.searchParams.set("view", next)');
    expect(reviews).toContain("<BudgetReviewInbox");
    expect(reviews).toContain("embedded");
    expect(reviews).not.toContain("if (reviewKind === \"budget\" && canReviewBudget) {");
    expect(financialReviews).toContain("embedded?: boolean");
    expect(financialReviews).toContain("WorkspaceLoadingSkeleton");
  });

  it("groups budget navigation without removing the underlying finance views", () => {
    expect(budget).toContain("Planning &amp; Allocation");
    expect(budget).toContain("Requests &amp; Settlement");
    expect(budget).toContain("Ledger &amp; Audit");
    expect(budget).toContain('url.searchParams.set("view", nextTab)');
    for (const view of ["annual", "funding", "approvals", "releases", "expenses", "journal", "audit"]) {
      expect(budget).toContain(`id: "${view}"`);
    }
    expect(budget).toContain("WorkspaceLoadingSkeleton");
    expect(budget).toContain('sticky top-3 z-20');
    expect(budget).toContain('aria-label="Budget fiscal scope and view filters"');
    expect(budget).toContain("BudgetPositionSummary");
    expect(budgetPosition).toContain("Pending approvals");
    expect(budgetPosition).toContain("Release deadlines");
    expect(budgetPosition).toContain("Settlement exposure");
  });

  it("keeps project view selection shareable without changing the project service contract", () => {
    expect(projectWorkspace).toContain('url.searchParams.set("project", project.id)');
    expect(projectWorkspace).toContain('url.searchParams.set("view", nextTab)');
    expect(projectWorkspace).toContain("popstate");
  });
});
