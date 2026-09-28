import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const dashboard = readFileSync("src/app/components/DeptHead/DeptHeadDashboard.tsx", "utf8");
const taskRow = readFileSync("src/app/components/DeptHead/DeptHeadDashboardTaskRow.tsx", "utf8");

describe("department head command center presentation", () => {
  it("uses a responsive command-center shell and skeleton loading state", () => {
    expect(dashboard).toContain("max-w-[1480px]");
    expect(dashboard).toContain("bg-gradient-to-br from-primary/5 via-card to-card");
    expect(dashboard).toContain("function DeptHeadDashboardSkeleton()");
    expect(dashboard).toContain('aria-live="polite"');
  });

  it("keeps dashboard status and task rows on semantic design tokens", () => {
    expect(dashboard).toContain("No overdue tasks");
    expect(dashboard).toContain("border-border/70");
    expect(dashboard).toContain("hover:bg-accent/60");
    expect(taskRow).toContain("text-foreground");
    expect(taskRow).toContain("text-muted-foreground");
    expect(taskRow).not.toContain("text-neutral-900");
  });
});
