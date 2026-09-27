import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const annualBudget = readFileSync("src/app/features/budget/components/AnnualBudgetSetup.tsx", "utf8");
const sessionBroadcast = readFileSync("src/app/features/role-legislative/session/components/SessionBroadcast.tsx", "utf8");
const auditPrimitives = readFileSync("src/app/features/role-executive/components/AuditPrimitives.tsx", "utf8");
const returnedFunds = readFileSync("src/app/features/role-executive/components/ReturnedFunds.tsx", "utf8");
const projectDashboard = readFileSync("src/app/features/projects/components/project-command/ProjectDashboardTab.tsx", "utf8");
const taskList = readFileSync("src/app/features/tasks/components/board/ListBoardView.tsx", "utf8");
const taskEditor = readFileSync("src/app/features/tasks/components/board/TaskEditorModal.tsx", "utf8");
const reviewInbox = readFileSync("src/app/features/reviews/components/ForReviewInbox.tsx", "utf8");

const card = "rounded-[10px] border border-border bg-card p-5 shadow-[0_4px_6px_-4px_rgba(0,0,0,0.10)]";

describe("page-local surface standardization", () => {
  it("uses canonical cards and 14px panels in the budget and legislative workspaces", () => {
    expect(annualBudget).toContain(card);
    expect(annualBudget).toContain("rounded-[14px] border border-border bg-muted/50 p-3");
    expect(annualBudget).toContain("bg-primary px-4");
    expect(sessionBroadcast).toContain("rounded-[10px] border border-border bg-card shadow-[0_4px_6px_-4px_rgba(0,0,0,0.10)]");
    expect(sessionBroadcast).toContain("rounded-[14px] border border-border bg-card");
  });

  it("uses canonical executive cards and a scrollable, fixed-width table pattern", () => {
    expect(auditPrimitives).toContain(card);
    expect(returnedFunds).toContain("overflow-x-auto rounded-[10px] border border-border bg-card");
    expect(returnedFunds).toContain("grid min-w-[900px] grid-cols-[90px_130px_110px_110px_110px_110px_130px_100px]");
    expect(returnedFunds).toContain("bg-primary/5");
  });

  it("uses canonical cards, panels, and table toolbars in project, task, and review workspaces", () => {
    expect(projectDashboard).toContain(card);
    expect(projectDashboard).toContain("rounded-[14px] border border-border bg-muted/50 p-3.5");
    expect(taskList).toContain("overflow-hidden rounded-[10px] border border-border bg-card");
    expect(taskList).toContain("border-b border-border bg-muted/40 px-5 py-3");
    expect(taskEditor).toContain("rounded-[14px] border border-border bg-muted/50 p-3");
    expect(reviewInbox).toContain(card);
    expect(reviewInbox).toContain("border-b border-border bg-muted/40 px-5 py-3");
    expect(reviewInbox).toContain('isSel ? "bg-primary/5"');
  });
});
