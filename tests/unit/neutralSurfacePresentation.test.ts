import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const budgetPosition = readFileSync(
  "src/app/features/budget/components/BudgetPositionSummary.tsx",
  "utf8",
);
const proposalBudget = readFileSync(
  "src/app/features/budget/components/ProposalBudgetEditor.tsx",
  "utf8",
);
const memberBoard = readFileSync(
  "src/app/features/team-management/components/supervision/TeamMemberBoard.tsx",
  "utf8",
);
const iamWorkspace = readFileSync(
  "src/app/features/team-management/components/supervision/HeadIAMWorkspace.tsx",
  "utf8",
);
const monthlyLeaderboard = readFileSync(
  "src/app/features/productivity/components/MonthlyLeaderboard.tsx",
  "utf8",
);
const personalContribution = readFileSync(
  "src/app/features/productivity/components/MyMonthlyContributionCard.tsx",
  "utf8",
);

describe("neutral surface presentation", () => {
  it("keeps budget and team supervision surfaces on the shared primary/card system", () => {
    for (const source of [
      budgetPosition,
      proposalBudget,
      memberBoard,
      iamWorkspace,
      monthlyLeaderboard,
      personalContribution,
    ]) {
      expect(source).not.toMatch(/bg-neutral-(900|950)/);
      expect(source).not.toContain("from-neutral-950");
    }

    expect(budgetPosition).toContain("bg-primary/5");
    expect(proposalBudget).toContain("bg-primary/10");
    expect(memberBoard).toContain("bg-primary/10");
    expect(iamWorkspace).toContain("from-primary/10");
    expect(monthlyLeaderboard).toContain("bg-primary/10");
    expect(personalContribution).toContain("bg-primary/10");
  });
});
